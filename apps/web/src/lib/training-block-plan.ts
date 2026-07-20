import type { HistoryContext, Intensity, WizardState } from "./types";

export type BlockDayPlan = {
  dayIndex: number;
  dateIso: string;
  label: string;
  intensity: Intensity;
  durationMin: number;
  targetTss: number;
  focus: string;
};

export type TrainingBlockPlan = {
  blockId: string;
  sessionId: string;
  athleteId: string;
  label: string;
  days: BlockDayPlan[];
  totalTargetTss: number;
  notes: string;
};

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function dateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Build a 4-day microcycle from the current wizard + athlete load. */
export function buildTrainingBlockPlan(input: {
  sessionId: string;
  athleteId: string;
  wizard: WizardState;
  history?: HistoryContext | null;
  blockId: string;
  startDate?: Date;
}): TrainingBlockPlan {
  const start = input.startDate ?? new Date();
  const recoveryBias = Boolean(input.history?.loadHint.includes("recovery"));
  const qualityBias = Boolean(input.history?.loadHint.includes("quality"));
  const ftp = input.wizard.ftpWatts;

  const template: Array<{
    intensity: Intensity;
    durationMin: number;
    focus: string;
    tssFactor: number;
  }> = recoveryBias
    ? [
        {
          intensity: "easy",
          durationMin: Math.max(45, input.wizard.durationMin - 20),
          focus: "Recovery spin",
          tssFactor: 0.55,
        },
        {
          intensity: "endurance",
          durationMin: input.wizard.durationMin,
          focus: "Aerobic rebuild",
          tssFactor: 0.7,
        },
        {
          intensity: "easy",
          durationMin: 50,
          focus: "Legs openers",
          tssFactor: 0.5,
        },
        {
          intensity: "tempo",
          durationMin: Math.min(90, input.wizard.durationMin),
          focus: "Controlled tempo",
          tssFactor: 0.85,
        },
      ]
    : qualityBias
      ? [
          {
            intensity: "endurance",
            durationMin: input.wizard.durationMin,
            focus: "Endurance base",
            tssFactor: 0.72,
          },
          {
            intensity: "tempo",
            durationMin: Math.min(75, input.wizard.durationMin),
            focus: "Quality tempo",
            tssFactor: 0.9,
          },
          {
            intensity: "easy",
            durationMin: 55,
            focus: "Easy between",
            tssFactor: 0.5,
          },
          {
            intensity: input.wizard.intensity === "hills" ? "hills" : "endurance",
            durationMin: input.wizard.durationMin + 15,
            focus: "Key ride",
            tssFactor: 0.95,
          },
        ]
      : [
          {
            intensity: "endurance",
            durationMin: input.wizard.durationMin,
            focus: "Steady endurance",
            tssFactor: 0.72,
          },
          {
            intensity: "easy",
            durationMin: 50,
            focus: "Recovery",
            tssFactor: 0.5,
          },
          {
            intensity: input.wizard.intensity,
            durationMin: input.wizard.durationMin,
            focus: "Goal-matched ride",
            tssFactor: 0.8,
          },
          {
            intensity: "endurance",
            durationMin: Math.min(150, input.wizard.durationMin + 30),
            focus: "Longer aerobic",
            tssFactor: 0.75,
          },
        ];

  const days: BlockDayPlan[] = template.map((t, i) => {
    const date = addDays(start, i);
    const hours = t.durationMin / 60;
    const ifEst = t.tssFactor;
    const targetTss = Math.round(hours * ifEst * ifEst * 100);
    return {
      dayIndex: i + 1,
      dateIso: date.toISOString().slice(0, 10),
      label: dateLabel(date),
      intensity: t.intensity,
      durationMin: t.durationMin,
      targetTss,
      focus: t.focus,
    };
  });

  const totalTargetTss = days.reduce((s, d) => s + d.targetTss, 0);
  const notes = [
    `4-day block from ${input.wizard.startLabel || "your start"}.`,
    ftp ? `FTP ${ftp} W used for load context.` : "Set FTP for tighter TSS.",
    input.history
      ? `Recent load: ${input.history.loadHint}.`
      : "No athlete history bound yet.",
  ].join(" ");

  return {
    blockId: input.blockId,
    sessionId: input.sessionId,
    athleteId: input.athleteId,
    label: `Block · ${days[0]?.label ?? "start"}`,
    days,
    totalTargetTss,
    notes,
  };
}
