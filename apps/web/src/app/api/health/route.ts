import { clickhouseConfigured } from "@/lib/clickhouse";

export async function GET() {
  return Response.json({
    ok: true,
    clickhouseConfigured: clickhouseConfigured(),
    orsConfigured: Boolean(process.env.ORS_API_KEY),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    triggerConfigured: Boolean(process.env.TRIGGER_SECRET_KEY),
  });
}
