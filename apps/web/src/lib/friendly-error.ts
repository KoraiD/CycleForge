/** Map low-level browser/network failures to a short actionable UI message. */
export function friendlyErrorMessage(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (
    /networkerror|failed to fetch|load failed|fetch failed|econnreset|econnrefused|aborted|the operation was aborted/i.test(
      msg,
    )
  ) {
    return "Connection interrupted. Retry the action — local route generation still works if Trigger/AI is offline.";
  }
  if (!msg.trim()) return fallback;
  return msg;
}
