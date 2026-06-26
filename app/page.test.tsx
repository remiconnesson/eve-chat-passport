import { isValidElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import agent from "@/agent/agent";
import Page from "./page";

const mocks = vi.hoisted(() => ({
  currentPageVisitor: vi.fn(),
}));

vi.mock("@/lib/auth/page", () => ({
  currentPageVisitor: mocks.currentPageVisitor,
}));

describe("Page", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    mocks.currentPageVisitor.mockResolvedValue({
      authenticator: "vercel-passport",
      connectorId: "scl_j1QUojH9qGLINIdBiQUvEw",
      email: "remi@example.com",
      id: "visitor-id",
      name: "Remi Connesson",
    });
  });

  it("passes the eve agent model to the chat", async () => {
    const page = await Page();
    if (
      !isValidElement<{
        readonly model: string;
        readonly stopButtonEnabled: boolean;
        readonly visitor: {
          readonly connectorId?: string;
          readonly displayName: string;
          readonly email?: string;
          readonly externalSubject: string;
        };
      }>(page)
    ) {
      throw new TypeError("Expected Page to return a React element.");
    }

    expect(page.props.model).toBe(agent.model);
    expect(page.props.stopButtonEnabled).toBe(false);
    expect(page.props.visitor).toMatchObject({
      connectorId: "scl_j1QUojH9qGLINIdBiQUvEw",
      displayName: "Remi Connesson",
      email: "remi@example.com",
      externalSubject: "visitor-id",
    });
  });

  it("enables the stop button from the server-side feature flag", async () => {
    vi.stubEnv("EVE_ENABLE_STOP_BUTTON", "1");

    const page = await Page();
    if (!isValidElement<{ readonly stopButtonEnabled: boolean }>(page)) {
      throw new TypeError("Expected Page to return a React element.");
    }

    expect(page.props.stopButtonEnabled).toBe(true);
  });

  it("shows a configuration state when Passport is absent", async () => {
    mocks.currentPageVisitor.mockResolvedValue(null);

    const page = await Page();

    expect(isValidElement(page)).toBe(true);
    expect(page.type).not.toBe("main");
  });
});
