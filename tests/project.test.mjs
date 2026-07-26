import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("ships the Doodh Khata mobile application", async () => {
  const [page, app, manifest, packageJson] = await Promise.all([
    read("app/page.tsx"),
    read("app/DoodhKhata.tsx"),
    read("public/manifest.webmanifest"),
    read("package.json"),
  ]);

  assert.match(page, /<DoodhKhata \/>/);
  assert.match(app, /Doodh Khata/);
  assert.match(app, /Record sale/);
  assert.match(app, /Rozana Mashwara/);
  assert.match(app, /mobile-nav/);
  assert.equal(JSON.parse(manifest).display, "standalone");
  assert.equal(JSON.parse(packageJson).name, "doodh-khata");
});

test("protects Firebase data and documents the full submission", async () => {
  const [rules, readme, prompt] = await Promise.all([
    read("firestore.rules"),
    read("README.md"),
    read("app/firebase-client.ts"),
  ]);

  assert.match(rules, /request\.auth\.uid == userId/);
  assert.match(prompt, /You are Rozana Mashwara/);
  assert.match(readme, /Open the live app/);
  assert.match(readme, /## Features/);
  assert.match(readme, /## AI feature/);
  assert.match(readme, /## Screenshots/);
  assert.match(readme, /## Run locally/);

  for (const name of [
    "dashboard.png",
    "transactions.png",
    "ledgers.png",
    "ai-mashwara.png",
    "mobile-overview.png",
  ]) {
    await access(new URL(`public/screenshots/${name}`, root));
  }
});

