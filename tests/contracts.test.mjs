import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("games are kept behind the platform SDK boundary", async () => {
  const sdk = await readFile(new URL("../packages/game-sdk/src/index.ts", import.meta.url), "utf8");
  for (const capability of ["requestRun", "submitScore", "loadSave", "reportAchievement", "emit", "exit"]) {
    assert.match(sdk, new RegExp(`\\b${capability}\\b`));
  }
});
