import { describe, expect, it } from "vitest";
import {
  EMPTY_RUNTIME_CONFIG,
  maskSecret,
  publicRuntimeConfig,
  type RuntimeConfig,
} from "./runtime-config";

describe("runtime-config masking", () => {
  it("masks to first3…last3, or first2… when short", () => {
    expect(maskSecret("")).toBe("");
    expect(maskSecret("abcd")).toBe("ab...");
    expect(maskSecret("proj_xaqmyequiljoapntpnfx")).toBe("pro...nfx");
    expect(maskSecret("tr_dev_secrettoken99")).toBe("tr_...n99");
    expect(maskSecret("123456789")).toBe("12...");
  });

  it("returns saved values for the local setup UI", () => {
    const config: RuntimeConfig = {
      ...EMPTY_RUNTIME_CONFIG,
      triggerSecretKey: "tr_dev_secrettoken99",
      triggerProjectRef: "proj_xaqmyequiljoapntpnfx",
      clickhouseUrl: "https://example.clickhouse.cloud:8443",
      clickhousePassword: "super-secret-pass",
      aiApiKey: "sk-live-key",
      aiProvider: "openai",
      aiModel: "gpt-4o-mini",
    };
    const pub = publicRuntimeConfig(config);
    expect(pub.triggerConfigured).toBe(true);
    expect(pub.clickhouseConfigured).toBe(true);
    expect(pub.aiConfigured).toBe(true);
    expect(pub.clickhousePasswordSet).toBe(true);
    // Setup is a localhost-only surface: values are returned so the reveal
    // toggle can render them, and are masked for display client-side.
    expect(pub.clickhouseUrl).toBe(config.clickhouseUrl);
    expect(pub.triggerProjectRef).toBe(config.triggerProjectRef);
    expect(pub.aiModel).toBe(config.aiModel);
    // The ClickHouse password is never returned (write-only).
    expect("clickhousePassword" in pub).toBe(false);
  });
});
