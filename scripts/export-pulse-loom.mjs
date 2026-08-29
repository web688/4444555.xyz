import { existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const projectDir = resolve(rootDir, "games/pulse-loom");
const outDir = resolve(rootDir, "apps/portal/public/games/pulse-loom");
const outHtml = resolve(outDir, "index.html");

function findGodotExecutable() {
  if (process.env.GODOT_BIN && existsSync(process.env.GODOT_BIN)) {
    return process.env.GODOT_BIN;
  }
  const candidates = process.platform === "win32"
    ? ["godot_console.exe", "godot.exe", "Godot_v4.6.3-stable_win64_console.exe", "Godot_v4.6.3-stable_win64.exe"]
    : ["godot", "godot4", "godot-headless", "Godot_v4.6.3-stable_linux.x86_64"];

  for (const cmd of candidates) {
    const res = spawnSync(cmd, ["--version"], { stdio: "pipe" });
    if (res.status === 0) {
      return cmd;
    }
  }
  return null;
}

export function exportPulseLoom() {
  console.log("[Pulse Loom] Exporting Godot project to web...");
  mkdirSync(outDir, { recursive: true });

  const godot = findGodotExecutable();
  if (!godot) {
    if (existsSync(outHtml) && existsSync(resolve(outDir, "index.wasm"))) {
      console.warn("[Pulse Loom] Godot executable not found, but pre-existing web export found in public/games/pulse-loom.");
      return;
    }
    throw new Error(
      "Godot executable not found on PATH or GODOT_BIN. Please install Godot 4.6.3 with Web export templates."
    );
  }

  const exportArgs = [
    "--headless",
    "--path",
    projectDir,
    "--export-release",
    "Web",
    resolve(outDir, "index.html"),
  ];

  console.log(`[Pulse Loom] Running: ${godot} ${exportArgs.join(" ")}`);
  const result = spawnSync(godot, exportArgs, {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Godot Web export failed with exit code ${result.status}`);
  }

  const requiredFiles = ["index.html", "index.js", "index.wasm", "index.pck"];
  for (const file of requiredFiles) {
    if (!existsSync(resolve(outDir, file))) {
      throw new Error(`Godot Web export completed, but expected output file '${file}' is missing from ${outDir}.`);
    }
  }

  console.log("[Pulse Loom] Web export successful.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    exportPulseLoom();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
