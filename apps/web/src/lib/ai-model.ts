import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import {
  ensureRuntimeConfigLoaded,
  readRuntimeConfig,
  type AiProvider,
} from "./runtime-config";

/** Resolve the chat model from BYOK / env (Google, OpenAI, Anthropic, or local OpenAI-compatible). */
export function getChatModel() {
  ensureRuntimeConfigLoaded();
  const config = readRuntimeConfig();
  const provider = (process.env.CYCLEFORGE_AI_PROVIDER ||
    config.aiProvider ||
    "google") as AiProvider;
  const modelId =
    process.env.CYCLEFORGE_AI_MODEL ||
    config.aiModel ||
    process.env.GOOGLE_GENERATIVE_AI_MODEL ||
    "gemini-flash-latest";

  switch (provider) {
    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey:
          config.aiApiKey ||
          process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
          undefined,
      });
      return google(modelId);
    }
    case "openai": {
      const openai = createOpenAI({
        apiKey: config.aiApiKey || process.env.OPENAI_API_KEY || undefined,
      });
      return openai(modelId || "gpt-4o-mini");
    }
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: config.aiApiKey || process.env.ANTHROPIC_API_KEY || undefined,
      });
      return anthropic(modelId || "claude-sonnet-4-0");
    }
    case "openai-compatible": {
      const baseURL =
        config.aiBaseUrl ||
        process.env.CYCLEFORGE_AI_BASE_URL ||
        process.env.OPENAI_BASE_URL ||
        "http://127.0.0.1:1234/v1";
      const openai = createOpenAI({
        apiKey: config.aiApiKey || process.env.OPENAI_API_KEY || "local",
        baseURL,
      });
      return openai(modelId || "local-model");
    }
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unsupported AI provider: ${_exhaustive}`);
    }
  }
}

export function aiConfigured(): boolean {
  ensureRuntimeConfigLoaded();
  const config = readRuntimeConfig();
  if (config.aiProvider === "openai-compatible") {
    return Boolean(config.aiBaseUrl || process.env.OPENAI_BASE_URL);
  }
  if (config.aiApiKey) return true;
  return Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY,
  );
}
