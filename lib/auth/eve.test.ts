import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PASSPORT_HEADER } from "./passport";
import { passportAuth } from "./eve";

async function passportToken(): Promise<string> {
  return new SignJWT({
    email: "remi@example.com",
    external_sub: "00u14j2nwsisc9QmZ698",
    name: "Remi Connesson",
  })
    .setProtectedHeader({ alg: "HS256" })
    .sign(new TextEncoder().encode("test-only-passport-signing-key"));
}

describe("passportAuth", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL", "1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps the Passport subject to an eve user principal", async () => {
    const authenticate = passportAuth();
    const result = await authenticate(
      new Request("https://eve.example/eve/v1/session", {
        headers: { [PASSPORT_HEADER]: await passportToken() },
      }),
    );

    expect(result).toEqual({
      attributes: {
        email: "remi@example.com",
        name: "Remi Connesson",
      },
      authenticator: "vercel-passport",
      principalId: "00u14j2nwsisc9QmZ698",
      principalType: "user",
    });
  });

  it("skips requests without a valid Passport identity", async () => {
    const authenticate = passportAuth();

    await expect(
      authenticate(new Request("https://eve.example/eve/v1/session")),
    ).resolves.toBeNull();
    await expect(
      authenticate(
        new Request("https://eve.example/eve/v1/session", {
          headers: { [PASSPORT_HEADER]: "not-a-jwt" },
        }),
      ),
    ).resolves.toBeNull();
  });

  it("does not trust a caller-supplied Passport header off Vercel", async () => {
    vi.stubEnv("VERCEL", "");
    const authenticate = passportAuth();

    await expect(
      authenticate(
        new Request("https://eve.example/eve/v1/session", {
          headers: { [PASSPORT_HEADER]: await passportToken() },
        }),
      ),
    ).resolves.toBeNull();
  });
});
