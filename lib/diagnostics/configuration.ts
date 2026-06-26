import type { Diagnostic } from "nostics";
import { diagnostics } from "./catalog";

export interface ConfigurationDiagnosticInput {
  readonly aiGatewayApiKeyConfigured: boolean;
  readonly blobStoreConfigured: boolean;
  readonly blobTokenConfigured: boolean;
  readonly isVercel: boolean;
  readonly nodeVersion?: string;
  readonly oidcTokenConfigured: boolean;
}

export function collectConfigurationDiagnostics(
  input: ConfigurationDiagnosticInput,
): readonly Diagnostic[] {
  const found: Diagnostic[] = [];

  const blobCredentialsConfigured =
    input.blobTokenConfigured ||
    (input.blobStoreConfigured && input.oidcTokenConfigured);
  if (!blobCredentialsConfigured) {
    found.push(diagnostics.EVE_C005());
  }

  if (
    !input.isVercel &&
    !input.oidcTokenConfigured &&
    !input.aiGatewayApiKeyConfigured
  ) {
    found.push(diagnostics.EVE_C003());
  }

  if (input.nodeVersion) {
    const nodeMajor = Number(input.nodeVersion.split(".")[0]);
    if (!Number.isSafeInteger(nodeMajor) || nodeMajor < 24) {
      found.push(diagnostics.EVE_C004());
    }
  }

  return found;
}

export function readConfigurationDiagnostics(): readonly Diagnostic[] {
  return collectConfigurationDiagnostics({
    aiGatewayApiKeyConfigured: Boolean(process.env.AI_GATEWAY_API_KEY),
    blobStoreConfigured: Boolean(process.env.BLOB_STORE_ID),
    blobTokenConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    isVercel: process.env.VERCEL === "1",
    nodeVersion: readNodeVersion(),
    oidcTokenConfigured: Boolean(process.env.VERCEL_OIDC_TOKEN),
  });
}

function readNodeVersion(): string | undefined {
  const runtimeProcess: unknown = Reflect.get(globalThis, "process");
  if (typeof runtimeProcess !== "object" || runtimeProcess === null) {
    return undefined;
  }
  if (!("versions" in runtimeProcess)) return undefined;

  const versions: unknown = runtimeProcess.versions;
  if (typeof versions !== "object" || versions === null) return undefined;
  if (!("node" in versions) || typeof versions.node !== "string") {
    return undefined;
  }
  return versions.node;
}
