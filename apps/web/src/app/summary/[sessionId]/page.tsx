import Link from "next/link";
import type { Metadata } from "next";
import { getPlanAction } from "@/app/actions";
import { BrandMark } from "@/components/brand-mark";
import { SummaryView } from "@/components/summary-view";
import { attachCoachNote } from "@/lib/coach-note";

type PageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ route?: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { sessionId } = await params;
  const plan = await getPlanAction(sessionId);
  const route =
    plan?.routes.find((r) => r.routeId === plan.selectedRouteId) ??
    plan?.routes[0];
  return {
    title: route
      ? `${route.label} — CycleForge summary`
      : "Ride summary — CycleForge",
    description:
      "Printable ride summary with map, elevation, coach note, and tips.",
  };
}

export default async function SummaryPage({ params, searchParams }: PageProps) {
  const { sessionId } = await params;
  const { route: routeParam } = await searchParams;
  const stored = await getPlanAction(sessionId);

  if (!stored) {
    return (
      <div className="summary-missing">
        <BrandMark withWordmark size={36} />
        <h1>Plan not found</h1>
        <p>
          This summary link needs a plan from the current app session. Generate
          routes in the planner, then open summary again.
        </p>
        <p className="summary-missing__id">
          Session <code>{sessionId}</code>
        </p>
        <Link href="/" className="primary">
          Back to planner
        </Link>
      </div>
    );
  }

  const routeId =
    routeParam && stored.routes.some((r) => r.routeId === routeParam)
      ? routeParam
      : stored.selectedRouteId;

  const plan =
    routeId === stored.selectedRouteId
      ? stored
      : attachCoachNote({ ...stored, selectedRouteId: routeId });

  return <SummaryView plan={plan} initialRouteId={routeId} />;
}
