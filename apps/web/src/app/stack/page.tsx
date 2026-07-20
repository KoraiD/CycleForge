import Link from "next/link";
import type { Metadata } from "next";
import { BrandMark } from "@/components/brand-mark";
import { StackView } from "@/components/stack-view";
import { queryStackStats } from "@/lib/clickhouse";

export const metadata: Metadata = {
  title: "Stack — Trigger.dev × ClickHouse · CycleForge",
  description:
    "How CycleForge uses Trigger.dev durable tasks and ClickHouse analytics — with live table counts when configured.",
};

export const dynamic = "force-dynamic";

export default async function StackPage() {
  const stats = await queryStackStats();

  return (
    <div className="stack-page">
      <header className="stack-top">
        <Link href="/" className="summary-brand">
          <BrandMark withWordmark size={32} />
        </Link>
        <nav className="stack-nav">
          <Link href="/" className="ghost">
            ← Back to planner
          </Link>
        </nav>
      </header>
      <StackView stats={stats} />
    </div>
  );
}
