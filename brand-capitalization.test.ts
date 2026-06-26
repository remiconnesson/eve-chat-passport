import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const textFilePattern = /(?:^|\/)(?:\.env\.example|\.gitignore|\.vercelignore)$|\.(?:css|js|json|md|mjs|ts|tsx|yaml|yml)$/u;
const capitalizedBrand = ["E", "ve"].join("");
const uppercaseBrand = ["E", "VE"].join("");
const forbiddenBrandPattern = new RegExp(`\\b(?:${capitalizedBrand}|${uppercaseBrand})\\b`, "u");

describe("brand capitalization", () => {
  it("keeps the eve product name lowercase", async () => {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      { encoding: "utf8" },
    );
    const files = stdout.split("\0").filter((file) => textFilePattern.test(file));
    const violations: string[] = [];

    for (const file of files) {
      const content = await readExistingFile(file);
      if (content === null) continue;
      const match = forbiddenBrandPattern.exec(content);
      if (!match || match.index === undefined) continue;

      const line = content.slice(0, match.index).split("\n").length;
      violations.push(`${file}:${line}`);
    }

    expect(violations).toEqual([]);
  });
});

async function readExistingFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}
