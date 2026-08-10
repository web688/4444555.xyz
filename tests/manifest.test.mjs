import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(await readFile(new URL("../catalog/manifests/gravity-courier.json", import.meta.url)));

test("manifest identifies a versioned game and SDK", () => {
  assert.match(manifest.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.match(manifest.sdk, /^\d+\.\d+\.\d+$/);
});

test("asset budgets are internally consistent", () => {
  assert.ok(manifest.assets.initialBytes > 0);
  assert.ok(manifest.assets.totalBytes >= manifest.assets.initialBytes);
  assert.ok(manifest.assets.initialBytes <= 15 * 1024 * 1024);
});
