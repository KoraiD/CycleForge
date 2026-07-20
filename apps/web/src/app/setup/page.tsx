import type { Metadata } from "next";
import { SetupForm } from "@/components/setup-form";

export const metadata: Metadata = {
  title: "Setup — CycleForge",
  description:
    "Bring your own Trigger.dev, ClickHouse, and AI credentials for local hosting.",
};

export default function SetupPage() {
  return (
    <div className="setup-page">
      <SetupForm />
    </div>
  );
}
