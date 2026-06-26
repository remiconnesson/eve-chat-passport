import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import {
  PASSPORT_HEADER,
  readPageIdentity,
  readPassportIdentity,
  readRequestIdentity,
  visitorDisplayName,
  visitorProfile,
} from "./passport";

async function passportToken(
  claims: Record<string, unknown> = {},
): Promise<string> {
  return new SignJWT({
    email: "remi@example.com",
    external_sub: "00u14j2nwsisc9QmZ698",
    name: "Remi Connesson",
    connector_id: "scl_j1QUojH9qGLINIdBiQUvEw",
    ...claims,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(new TextEncoder().encode("test-only-passport-signing-key"));
}

describe("Passport identity", () => {
  it("reads the stable external subject and optional profile", async () => {
    const headers = new Headers({
      [PASSPORT_HEADER]: await passportToken(),
    });

    expect(readPassportIdentity(headers)).toEqual({
      authenticator: "vercel-passport",
      connectorId: "scl_j1QUojH9qGLINIdBiQUvEw",
      email: "remi@example.com",
      id: "00u14j2nwsisc9QmZ698",
      name: "Remi Connesson",
    });
  });

  it("rejects missing, malformed, and identity-free tokens", async () => {
    expect(readPassportIdentity(new Headers())).toBeNull();
    expect(
      readPassportIdentity(new Headers({ [PASSPORT_HEADER]: "not-a-jwt" })),
    ).toBeNull();
    expect(
      readPassportIdentity(
        new Headers({
          [PASSPORT_HEADER]: await passportToken({ external_sub: "" }),
        }),
      ),
    ).toBeNull();
  });

  it("allows loopback development without weakening deployed requests", () => {
    const localRequest = new Request("http://localhost:3000/api/chat-history", {
      headers: { host: "localhost:3000" },
    });
    const deployedRequest = new Request("https://eve.example/api/chat-history", {
      headers: { host: "eve.example" },
    });

    expect(
      readRequestIdentity(localRequest, { nodeEnv: "development" }),
    ).toMatchObject({ authenticator: "development", id: "local-development" });
    expect(
      readRequestIdentity(deployedRequest, { nodeEnv: "development" }),
    ).toBeNull();
    expect(readRequestIdentity(localRequest, { nodeEnv: "production" })).toBeNull();
  });

  it("uses the profile without exposing the external subject as display text", async () => {
    const identity = readPageIdentity(
      new Headers({ [PASSPORT_HEADER]: await passportToken({ name: undefined }) }),
      { nodeEnv: "production", vercel: "1" },
    );

    expect(identity && visitorDisplayName(identity)).toBe("remi@example.com");
    expect(identity && visitorProfile(identity)).toEqual({
      authenticator: "vercel-passport",
      connectorId: "scl_j1QUojH9qGLINIdBiQUvEw",
      displayName: "remi@example.com",
      email: "remi@example.com",
      externalSubject: "00u14j2nwsisc9QmZ698",
    });
  });

  it("ignores malformed optional profile claims", async () => {
    const identity = readPassportIdentity(
      new Headers({
        [PASSPORT_HEADER]: await passportToken({ email: 42, name: null }),
      }),
    );

    expect(identity).toMatchObject({ id: "00u14j2nwsisc9QmZ698" });
    expect(identity?.email).toBeUndefined();
    expect(identity?.name).toBeUndefined();
  });
});
