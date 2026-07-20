import { chat } from "@trigger.dev/sdk/ai";
import { streamText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { getChatModel } from "@/lib/ai-model";
import { DEMO_ATHLETE_ID, suggestIntensityFromHistory } from "@/lib/athlete-history";
import { ensureDemoAthleteSeeded, upsertSession } from "@/lib/clickhouse";
import { attachCoachNote } from "@/lib/coach-note";
import { AGENT_SYSTEM_PROMPT } from "@/lib/constants";
import { mergeWizard } from "@/lib/plan-builder";
import { ensureRuntimeConfigLoaded } from "@/lib/runtime-config";
import {
  getPlan,
  getWizard,
  setPlan,
  setSessionAthlete,
  setWizard,
} from "@/lib/session-store";
import { toTaskWizard } from "@/lib/task-wizard";
import type { Intensity, PlanPayload, StartPreset, TerrainBias } from "@/lib/types";
import { generateRouteCandidatesTask } from "./generate-routes";
import { scoreAndEnrichRoutesTask } from "./score-routes";

const wizardPatchSchema = z.object({
  goalsText: z.string().optional(),
  durationMin: z.number().min(30).max(300).optional(),
  intensity: z.enum(["easy", "endurance", "tempo", "hills"]).optional(),
  terrainBias: z.enum(["flat", "rolling", "hilly"]).optional(),
  startPreset: z
    .enum(["centraal", "vondelpark", "amstel", "custom"])
    .optional(),
  startLat: z.number().optional(),
  startLng: z.number().optional(),
  startLabel: z.string().optional(),
  avoidBusyRoads: z.boolean().optional(),
  confirmed: z.boolean().optional(),
  ftpWatts: z.number().min(80).max(500).nullable().optional(),
});

function createTools(sessionId: string) {
  return {
    load_demo_athlete: tool({
      description:
        "Load the fixture demo athlete (≈3 weeks of Amsterdam rides) into ClickHouse history for coaching. Prefer this over inventing training history. Riders can also upload GPX exports in the UI; never claim a live Strava/Garmin/TrainingPeaks OAuth import.",
      inputSchema: z.object({}),
      execute: async () => {
        const history = await ensureDemoAthleteSeeded();
        setSessionAthlete(sessionId, DEMO_ATHLETE_ID);
        const current = getWizard(sessionId);
        const suggested = suggestIntensityFromHistory(
          history,
          current.intensity,
        );
        const wizard = suggested
          ? mergeWizard(current, { intensity: suggested })
          : current;
        if (suggested) setWizard(wizard);
        const plan = getPlan(sessionId);
        if (plan) {
          setPlan(
            attachCoachNote({ ...plan, historyContext: history, wizard }),
          );
        }
        return {
          ui: "wizard" as const,
          wizard,
          history,
          message: `Demo athlete loaded (${history.rideCount} rides). ${history.loadHint}.`,
        };
      },
    }),

    upsert_wizard_state: tool({
      description:
        "Create or update the interactive planning wizard from the rider's goals. Call this first. Always pass startLat/startLng/startLabel when the rider names a place.",
      inputSchema: wizardPatchSchema,
      execute: async (patch) => {
        const current = getWizard(sessionId);
        const next = mergeWizard(current, {
          ...patch,
          intensity: patch.intensity as Intensity | undefined,
          terrainBias: patch.terrainBias as TerrainBias | undefined,
          startPreset: patch.startPreset as StartPreset | undefined,
          ftpWatts: patch.ftpWatts === undefined ? undefined : patch.ftpWatts,
        });
        if (patch.goalsText !== undefined) next.goalsText = patch.goalsText;
        setWizard(next);
        await upsertSession(next, next.goalsText);
        return {
          wizard: next,
          ui: "wizard" as const,
          message: next.confirmed
            ? "Wizard confirmed — ready to generate routes."
            : "Wizard updated — ask the rider to confirm or adjust.",
        };
      },
    }),

    generate_route_candidates: tool({
      description:
        "Generate 3 live ORS route candidates via Trigger fan-out, score them in ClickHouse, and return the visual plan. Pass the full wizard fields so generation does not depend on another process's memory.",
      inputSchema: wizardPatchSchema.extend({
        confirmWizard: z
          .boolean()
          .optional()
          .describe("Set true to mark wizard confirmed before generating"),
      }),
      execute: async ({ confirmWizard, ...patch }) => {
        const current = getWizard(sessionId);
        let wizard = mergeWizard(current, {
          ...patch,
          intensity: patch.intensity as Intensity | undefined,
          terrainBias: patch.terrainBias as TerrainBias | undefined,
          startPreset: patch.startPreset as StartPreset | undefined,
          ftpWatts: patch.ftpWatts === undefined ? undefined : patch.ftpWatts,
          confirmed: confirmWizard ? true : patch.confirmed,
        });
        if (confirmWizard) wizard = { ...wizard, confirmed: true };
        setWizard(wizard);

        const taskWizard = toTaskWizard(wizard);
        const generated = await generateRouteCandidatesTask.triggerAndWait({
          wizard: taskWizard,
        });
        if (!generated.ok) {
          return { error: "Route generation failed", ui: "error" as const };
        }

        const scored = await scoreAndEnrichRoutesTask.triggerAndWait({
          wizard: taskWizard,
          rawRoutes: generated.output.routes,
        });
        if (!scored.ok) {
          return { error: "Scoring failed", ui: "error" as const };
        }

        const plan = scored.output as PlanPayload;
        setPlan(plan);
        return {
          ui: "plan" as const,
          plan,
          summary: `Built ${plan.routes.length} routes. Best score ${plan.routes[0]?.score.total ?? 0}.`,
        };
      },
    }),

    select_route: tool({
      description: "Select one of the generated routes as the active plan.",
      inputSchema: z.object({
        routeId: z.string(),
      }),
      execute: async ({ routeId }) => {
        const plan = getPlan(sessionId);
        if (!plan) return { error: "No plan yet", ui: "error" as const };
        const next = attachCoachNote({ ...plan, selectedRouteId: routeId });
        setPlan(next);
        return { ui: "plan" as const, plan: next };
      },
    }),

    refine_plan: tool({
      description:
        "Adjust constraints (shorter, hillier, easier, etc.) and regenerate routes via Trigger ORS fan-out.",
      inputSchema: wizardPatchSchema.extend({
        note: z.string().optional(),
      }),
      execute: async (patch) => {
        const current = getWizard(sessionId);
        const { note, ...wizardPatch } = patch;
        const wizard = mergeWizard(current, {
          ...wizardPatch,
          intensity: wizardPatch.intensity as Intensity | undefined,
          terrainBias: wizardPatch.terrainBias as TerrainBias | undefined,
          startPreset: wizardPatch.startPreset as StartPreset | undefined,
          ftpWatts:
            wizardPatch.ftpWatts === undefined
              ? undefined
              : wizardPatch.ftpWatts,
          confirmed: true,
          goalsText: note
            ? `${current.goalsText}\nRefine: ${note}`
            : current.goalsText,
        });
        setWizard(wizard);

        const taskWizard = toTaskWizard(wizard);
        const generated = await generateRouteCandidatesTask.triggerAndWait({
          wizard: taskWizard,
        });
        if (!generated.ok) {
          return { error: "Refine generation failed", ui: "error" as const };
        }
        const scored = await scoreAndEnrichRoutesTask.triggerAndWait({
          wizard: taskWizard,
          rawRoutes: generated.output.routes,
        });
        if (!scored.ok) {
          return { error: "Refine scoring failed", ui: "error" as const };
        }
        const plan = scored.output as PlanPayload;
        setPlan(plan);
        return {
          ui: "plan" as const,
          plan,
          summary: "Plan refined with updated constraints.",
        };
      },
    }),
  };
}

export const cycleforgeAgent = chat
  .withClientData({
    schema: z.object({
      sessionId: z.string(),
    }),
  })
  .agent({
    id: "cycleforge-agent",
    tools: ({ clientData }) => {
      const sessionId = clientData?.sessionId ?? "default";
      getWizard(sessionId);
      return createTools(sessionId);
    },
    run: async ({ messages, tools: resolvedTools, signal, clientData }) => {
      ensureRuntimeConfigLoaded();
      const sessionId = clientData?.sessionId ?? "default";
      getWizard(sessionId);

      return streamText({
        ...chat.toStreamTextOptions({ tools: resolvedTools }),
        model: getChatModel(),
        system: AGENT_SYSTEM_PROMPT,
        messages,
        abortSignal: signal,
        stopWhen: stepCountIs(12),
      });
    },
  });
