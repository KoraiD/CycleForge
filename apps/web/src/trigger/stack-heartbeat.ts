import { logger, schedules } from "@trigger.dev/sdk";

/**
 * Hourly cron demo for the Stack page — proves schedules.task + run history links.
 * Lightweight: no external IO besides logging.
 */
export const stackHeartbeatSchedule = schedules.task({
  id: "stack-heartbeat-schedule",
  cron: "15 * * * *",
  run: async () => {
    const at = new Date().toISOString();
    logger.info("CycleForge stack heartbeat", { at });
    return {
      ok: true as const,
      at,
      message: "Stack heartbeat — weather cron sibling for demo/judging",
    };
  },
});
