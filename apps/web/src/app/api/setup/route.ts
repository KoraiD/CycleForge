import { bootstrapClickHouse } from "@/lib/bootstrap-clickhouse";
import { pingClickHouse } from "@/lib/clickhouse";
import {
  publicRuntimeConfig,
  readRuntimeConfig,
  writeRuntimeConfig,
  type AiProvider,
  type RuntimeConfig,
} from "@/lib/runtime-config";

export async function GET() {
  return Response.json({
    ok: true,
    config: publicRuntimeConfig(),
    defaults: {
      aiProviders: [
        "google",
        "openai",
        "anthropic",
        "openai-compatible",
      ] satisfies AiProvider[],
      models: {
        google: "gemini-flash-latest",
        openai: "gpt-4o-mini",
        anthropic: "claude-sonnet-4-0",
        "openai-compatible": "local-model",
      },
    },
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<RuntimeConfig> & {
    bootstrap?: boolean;
  };
  const current = readRuntimeConfig();

  // Empty string secrets mean "leave unchanged" so the UI can omit re-entry.
  const mergeSecret = (incoming: string | undefined, prev: string) => {
    if (incoming === undefined) return prev;
    if (incoming === "") return prev;
    return incoming;
  };

  const next = writeRuntimeConfig({
    triggerSecretKey: mergeSecret(body.triggerSecretKey, current.triggerSecretKey),
    triggerProjectRef:
      body.triggerProjectRef !== undefined
        ? body.triggerProjectRef
        : current.triggerProjectRef,
    clickhouseUrl:
      body.clickhouseUrl !== undefined
        ? body.clickhouseUrl
        : current.clickhouseUrl,
    clickhouseUser:
      body.clickhouseUser !== undefined
        ? body.clickhouseUser
        : current.clickhouseUser,
    clickhousePassword: mergeSecret(
      body.clickhousePassword,
      current.clickhousePassword,
    ),
    clickhouseDatabase:
      body.clickhouseDatabase !== undefined
        ? body.clickhouseDatabase
        : current.clickhouseDatabase,
    orsApiKey: mergeSecret(body.orsApiKey, current.orsApiKey),
    aiProvider: body.aiProvider ?? current.aiProvider,
    aiApiKey: mergeSecret(body.aiApiKey, current.aiApiKey),
    aiModel: body.aiModel !== undefined ? body.aiModel : current.aiModel,
    aiBaseUrl: body.aiBaseUrl !== undefined ? body.aiBaseUrl : current.aiBaseUrl,
  });

  const shouldBootstrap = body.bootstrap !== false && Boolean(next.clickhouseUrl);
  let clickhousePing: { ok: boolean; error?: string } | null = null;
  let bootstrap: Awaited<ReturnType<typeof bootstrapClickHouse>> | null = null;

  if (next.clickhouseUrl) {
    clickhousePing = await pingClickHouse();
    if (shouldBootstrap && clickhousePing.ok) {
      bootstrap = await bootstrapClickHouse();
    }
  }

  const parts = [
    "Saved credentials to `.data/runtime-config.json` and synced `.env.local`.",
  ];
  if (clickhousePing) {
    parts.push(
      clickhousePing.ok
        ? "ClickHouse ping OK."
        : `ClickHouse ping failed: ${clickhousePing.error ?? "unknown"}`,
    );
  }
  if (bootstrap) {
    parts.push(
      bootstrap.ok
        ? `Schema/seed applied (${bootstrap.schemaStatements}+${bootstrap.seedStatements} statements, ${bootstrap.athleteRides} athlete rides).`
        : `Bootstrap skipped/failed: ${bootstrap.error ?? "unknown"}`,
    );
  }
  parts.push(
    "Restart `npm run dev` and `npm run dev:trigger` so the Trigger worker picks up `.env.local`.",
  );

  return Response.json({
    ok: true,
    config: publicRuntimeConfig(next),
    clickhousePing,
    bootstrap,
    message: parts.join(" "),
  });
}
