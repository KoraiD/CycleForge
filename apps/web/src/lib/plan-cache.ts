import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { PlanPayload } from "./types";

const DIR = join(process.cwd(), ".data", "plans");

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
}

/** Durable enough for local demo + summary deep-links across RSC/action isolates. */
export function cachePlan(plan: PlanPayload): void {
  try {
    ensureDir();
    writeFileSync(
      join(DIR, `${plan.sessionId}.json`),
      JSON.stringify(plan),
      "utf8",
    );
  } catch (err) {
    console.warn("cachePlan failed", err);
  }
}

export function readCachedPlan(sessionId: string): PlanPayload | null {
  const path = join(DIR, `${sessionId}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PlanPayload;
  } catch (err) {
    console.warn("readCachedPlan failed", err);
    return null;
  }
}
