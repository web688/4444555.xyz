import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const manifestFiles = (await readdir(new URL("../catalog/manifests", import.meta.url))).filter((f) =>
  f.endsWith(".json"),
);

for (const file of manifestFiles) {
  test(`manifest ${file} identifies a versioned game and SDK`, async () => {
    const manifest = JSON.parse(
      await readFile(new URL(`../catalog/manifests/${file}`, import.meta.url), "utf8"),
    );
    assert.match(manifest.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
    assert.match(manifest.sdk, /^\d+\.\d+\.\d+$/);
    assert.ok(manifest.assets.initialBytes > 0);
    assert.ok(manifest.assets.totalBytes >= manifest.assets.initialBytes);
    assert.ok(manifest.assets.initialBytes <= 15 * 1024 * 1024);
  });
}
