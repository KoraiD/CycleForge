"use client";

type Node = {
  id: string;
  label: string;
  state: "pending" | "active" | "done";
};

function inferNodes(activities: Array<{ name: string; state: string }>): Node[] {
  const names = new Set(activities.map((a) => a.name));
  const last = activities[activities.length - 1]?.name;
  const doneish = (name: string) =>
    activities.some(
      (a) =>
        a.name === name &&
        (a.state === "output-available" || a.state === "result"),
    );

  const mk = (id: string, label: string, activeWhen: boolean): Node => {
    if (doneish(id) || (names.has(id) && last !== id && names.size > 1)) {
      return { id, label, state: "done" };
    }
    if (activeWhen || last === id) return { id, label, state: "active" };
    return { id, label, state: "pending" };
  };

  return [
    mk("upsert_wizard_state", "Agent / goals", names.size > 0),
    mk(
      "generate_route_candidates",
      "generate-route-candidates",
      names.has("generate_route_candidates") || names.has("refine_plan"),
    ),
    {
      id: "fetch-ors-route-a",
      label: "fetch-ors-route",
      state:
        names.has("generate_route_candidates") || names.has("refine_plan")
          ? doneish("score_and_enrich_routes")
            ? "done"
            : "active"
          : "pending",
    },
    {
      id: "fetch-ors-route-b",
      label: "fetch-ors-route",
      state:
        names.has("generate_route_candidates") || names.has("refine_plan")
          ? doneish("score_and_enrich_routes")
            ? "done"
            : "active"
          : "pending",
    },
    {
      id: "fetch-ors-route-c",
      label: "fetch-ors-route",
      state:
        names.has("generate_route_candidates") || names.has("refine_plan")
          ? doneish("score_and_enrich_routes")
            ? "done"
            : "active"
          : "pending",
    },
    mk(
      "score_and_enrich_routes",
      "score-and-enrich-routes",
      names.has("score_and_enrich_routes"),
    ),
  ];
}

export function TriggerFanout({
  activities,
}: {
  activities: Array<{ name: string; state: string }>;
}) {
  const nodes = inferNodes(activities);
  const ors = nodes.filter((n) => n.id.startsWith("fetch-ors"));
  const rest = nodes.filter((n) => !n.id.startsWith("fetch-ors"));

  return (
    <div className="trigger-fanout" aria-label="Trigger run fan-out">
      <p className="eyebrow">Trigger.dev live</p>
      <ol className="fanout-spine">
        {rest.slice(0, 2).map((n) => (
          <li key={n.id} className={`fanout-node is-${n.state}`}>
            <code>{n.label}</code>
          </li>
        ))}
      </ol>
      <div className="fanout-branch">
        {ors.map((n) => (
          <div key={n.id} className={`fanout-node is-${n.state}`}>
            <code>{n.label}</code>
          </div>
        ))}
      </div>
      <ol className="fanout-spine">
        {rest.slice(2).map((n) => (
          <li key={n.id} className={`fanout-node is-${n.state}`}>
            <code>{n.label}</code>
          </li>
        ))}
      </ol>
    </div>
  );
}
