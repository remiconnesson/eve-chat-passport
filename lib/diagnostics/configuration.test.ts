import { describe, expect, it } from "vitest";
import { collectConfigurationDiagnostics } from "./configuration";

const configured = {
  aiGatewayApiKeyConfigured: false,
  blobStoreConfigured: true,
  blobTokenConfigured: false,
  isVercel: true,
  nodeVersion: "24.17.0",
  oidcTokenConfigured: true,
};

describe("collectConfigurationDiagnostics", () => {
  it("returns no diagnostics for a configured Vercel deployment", () => {
    expect(collectConfigurationDiagnostics(configured)).toEqual([]);
  });

  it("reports missing Blob credentials", () => {
    const found = collectConfigurationDiagnostics({
      ...configured,
      blobStoreConfigured: false,
      blobTokenConfigured: false,
    });

    expect(found.map((diagnostic) => diagnostic.name)).toEqual(["EVE_C005"]);
  });

  it("accepts a static Blob token for local development", () => {
    const found = collectConfigurationDiagnostics({
      ...configured,
      blobStoreConfigured: false,
      blobTokenConfigured: true,
    });

    expect(found).toEqual([]);
  });

  it("returns all diagnostics for missing local configuration", () => {
    const found = collectConfigurationDiagnostics({
      ...configured,
      aiGatewayApiKeyConfigured: false,
      isVercel: false,
      nodeVersion: "22.0.0",
      oidcTokenConfigured: false,
    });

    expect(found.map((diagnostic) => diagnostic.name)).toEqual([
      "EVE_C005",
      "EVE_C003",
      "EVE_C004",
    ]);
  });
});
