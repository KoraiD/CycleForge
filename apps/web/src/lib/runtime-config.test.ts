import { describe, expect, it } from "vitest";
import {
  EMPTY_RUNTIME_CONFIG,
  maskSecret,
  publicRuntimeConfig,
  type RuntimeConfig,
} from "./runtime-config";

describe("runtime-config public surface", () => {
  it("masks short and long secrets", () => {
    expect(maskSecret("")).toBe("");
    expect(maskSecret("abcd")).toBe("••••");
    expect(maskSecret("tr_dev_abcdefgh")).toMatch(/^tr_…/);
  });

  it("never returns raw secrets in publicRuntimeConfig", () => {
    const config: RuntimeConfig = {
      ...EMPTY_RUNTIME_CONFIG,
      triggerSecretKey: "tr_dev_secrettoken99",
      clickhouseUrl: "https://example.clickhouse.cloud:8443",
      clickhousePassword: "super-secret-pass",
      aiApiKey: "sk-live-should-not-leak",
      aiProvider: "openai",
      aiModel: "gpt-4o-mini",
    };
    const pub = publicRuntimeConfig(config);
    const blob = JSON.stringify(pub);
    expect(blob).not.toContain("tr_dev_secrettoken99");
    expect(blob).not.toContain("super-secret-pass");
    expect(blob).not.toContain("sk-live-should-not-leak");
    expect(pub.triggerConfigured).toBe(true);
    expect(pub.clickhouseConfigured).toBe(true);
    expect(pub.aiConfigured).toBe(true);
    expect(pub.clickhousePasswordSet).toBe(true);
    expect(pub.aiApiKeyMasked.length).toBeGreaterThan(0);
  });
});
