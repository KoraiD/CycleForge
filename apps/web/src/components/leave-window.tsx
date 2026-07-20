"use client";

import type { LeaveWindowHint } from "@/lib/types";
import { CommuteVerdict } from "./commute-verdict";

/** @deprecated Prefer CommuteVerdict — kept as a thin alias for older imports. */
export function LeaveWindowCard({ leave }: { leave: LeaveWindowHint }) {
  return <CommuteVerdict leave={leave} />;
}
