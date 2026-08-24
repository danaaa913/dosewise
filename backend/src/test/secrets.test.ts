import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      files.push(...listSourceFiles(full));
    } else if (/\.(ts|js|mjs)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

const FORBIDDEN_SECRETS = ["adm" + "in123", "dosewise-secret-key-" + "change-in-production"];

describe("AUTH-010: no static credentials in the repository", () => {
  const srcDir = join(import.meta.dirname, "..");

  it("source tree contains none of the known leaked secrets", () => {
    const offenders: string[] = [];

    for (const file of listSourceFiles(srcDir)) {
      const content = readFileSync(file, "utf8");
      for (const secret of FORBIDDEN_SECRETS) {
        if (content.includes(secret)) {
          offenders.push(file);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
