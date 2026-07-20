import { aiConfigured } from "@/lib/ai-model";
import { clickhouseConfigured } from "@/lib/clickhouse";
import { ensureRuntimeConfigLoaded, readRuntimeConfig } from "@/lib/runtime-config";

export async function GET() {
  ensureRuntimeConfigLoaded();
  const config = readRuntimeConfig();
  const aiOk = aiConfigured();
  return Response.json({
    ok: true,
    clickhouseConfigured: clickhouseConfigured(),
    weatherPipelineReady: clickhouseConfigured(),
    orsConfigured: Boolean(
      config.orsApiKey || process.env.ORS_API_KEY,
    ),
    aiConfigured: aiOk,
    aiProvider: config.aiProvider || process.env.CYCLEFORGE_AI_PROVIDER || null,
    /** @deprecated use aiConfigured — kept for older clients */
    googleConfigured: aiOk,
    triggerConfigured: Boolean(
      config.triggerSecretKey || process.env.TRIGGER_SECRET_KEY,
    ),
  });
}
