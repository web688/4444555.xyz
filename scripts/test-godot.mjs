import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const projectDir = resolve(rootDir, "games/pulse-loom");

export function runGodotHeadlessTest() {
  let godot = process.env.GODOT_BIN;
  if (!godot || !existsSync(godot)) {
    const candidates = process.platform === "win32"
      ? ["godot_console.exe", "godot.exe", "Godot_v4.6.3-stable_win64_console.exe", "Godot_v4.6.3-stable_win64.exe"]
      : ["godot", "godot4", "godot-headless", "Godot_v4.6.3-stable_linux.x86_64"];

    for (const cmd of candidates) {
      const res = spawnSync(cmd, ["--version"], { stdio: "pipe" });
      if (res.status === 0) {
        godot = cmd;
        break;
      }
    }
  }

  if (!godot) {
    throw new Error("Godot executable not found on PATH or GODOT_BIN.");
  }

  const args = [
    "--headless",
    "--path",
    projectDir,
    "--script",
    "res://scripts/headless_smoke_test.gd",
  ];

  console.log(`[Godot Smoke Test] Running: ${godot} ${args.join(" ")}`);
  const result = spawnSync(godot, args, { stdio: "inherit" });

  if (result.status !== 0) {
    throw new Error(`Godot headless smoke test failed with exit code ${result.status}`);
  }
  console.log("[Godot Smoke Test] All headless tests passed.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    runGodotHeadlessTest();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
