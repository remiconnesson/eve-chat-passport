import { decodeJwt } from "jose";
import { z } from "zod";

export const PASSPORT_HEADER = "x-vercel-oidc-passport-token";

const visitorIdSchema = z.string().min(1).max(512).brand<"VisitorId">();
const passportClaimsSchema = z
  .object({ external_sub: visitorIdSchema })
  .passthrough();
const developmentVisitorId = visitorIdSchema.parse("local-development");

type HeaderReader = Pick<Headers, "get">;

type RuntimeEnvironment = {
  readonly nodeEnv?: string;
  readonly vercel?: string;
  readonly vercelEnv?: string;
};

export type VisitorId = z.infer<typeof visitorIdSchema>;

export interface VisitorIdentity {
  readonly authenticator: "development" | "vercel-passport";
  readonly connectorId?: string;
  readonly email?: string;
  readonly id: VisitorId;
  readonly name?: string;
}

export interface VisitorProfile {
  readonly authenticator: VisitorIdentity["authenticator"];
  readonly connectorId?: string;
  readonly displayName: string;
  readonly email?: string;
  readonly externalSubject: string;
}

export function readPassportIdentity(
  headers: HeaderReader,
): VisitorIdentity | null {
  const token = headers.get(PASSPORT_HEADER);
  if (!token) return null;

  try {
    const claims = passportClaimsSchema.safeParse(decodeJwt(token));
    if (!claims.success) return null;

    return {
      authenticator: "vercel-passport",
      connectorId: optionalString(claims.data.connector_id, 512),
      email: optionalString(claims.data.email, 320),
      id: claims.data.external_sub,
      name: optionalString(claims.data.name, 200),
    };
  } catch {
    return null;
  }
}

export function readRequestIdentity(
  request: Request,
  environment: RuntimeEnvironment = runtimeEnvironment(),
): VisitorIdentity | null {
  return (
    readVercelPassportIdentity(request.headers, environment) ??
    developmentIdentity(request.headers, environment)
  );
}

export function readPageIdentity(
  headers: HeaderReader,
  environment: RuntimeEnvironment = runtimeEnvironment(),
): VisitorIdentity | null {
  return (
    readVercelPassportIdentity(headers, environment) ??
    developmentIdentity(headers, environment)
  );
}

export function readVercelPassportIdentity(
  headers: HeaderReader,
  environment: RuntimeEnvironment = runtimeEnvironment(),
): VisitorIdentity | null {
  return environment.vercel === "1" ? readPassportIdentity(headers) : null;
}

export function visitorDisplayName(identity: VisitorIdentity): string {
  return identity.name ?? identity.email ?? "Authenticated visitor";
}

export function visitorProfile(identity: VisitorIdentity): VisitorProfile {
  return {
    authenticator: identity.authenticator,
    ...(identity.connectorId ? { connectorId: identity.connectorId } : {}),
    displayName: visitorDisplayName(identity),
    ...(identity.email ? { email: identity.email } : {}),
    externalSubject: identity.id,
  };
}

function developmentIdentity(
  headers: HeaderReader,
  environment: RuntimeEnvironment,
): VisitorIdentity | null {
  const isVercelDevelopment =
    environment.vercel === "1" && environment.vercelEnv === "development";
  const isLocalDevelopment =
    environment.nodeEnv === "development" && isLoopbackHost(headers.get("host"));

  if (!isVercelDevelopment && !isLocalDevelopment) return null;

  return {
    authenticator: "development",
    id: developmentVisitorId,
    name: "Local development",
  };
}

function optionalString(value: unknown, maxLength: number): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength
    ? value
    : undefined;
}

function isLoopbackHost(host: string | null): boolean {
  if (!host) return false;

  try {
    const hostname = new URL(`http://${host}`).hostname;
    return (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "::1" ||
      hostname.startsWith("127.")
    );
  } catch {
    return false;
  }
}

function runtimeEnvironment(): RuntimeEnvironment {
  return {
    nodeEnv: process.env.NODE_ENV,
    vercel: process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV,
  };
}
