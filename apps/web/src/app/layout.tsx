import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CycleForge — Visual cycling training planner",
  description:
    "Chat agent that turns training goals into interactive route maps, elevation profiles, and training effect — powered by Trigger.dev and ClickHouse.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
