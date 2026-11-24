import assert from "node:assert/strict";
import { test } from "node:test";
import { affectedTargets, projectsOf } from "./affected.ts";

const sorted = (targets: Set<string>) => [...targets].sort();
const PROJECTS = ["core", "tooling", "web"];

test("a change inside an app or package runs only its own checks", () => {
  assert.deepEqual(sorted(affectedTargets(["apps/web/src/main.tsx"], PROJECTS)), ["web"]);
  assert.deepEqual(sorted(affectedTargets(["packages/core/src/schema.ts"], PROJECTS)), ["core"]);
});

test("a tooling change runs the tooling checks", () => {
  assert.deepEqual(sorted(affectedTargets(["packages/tooling/src/verify.ts"], PROJECTS)), ["tooling"]);
});

test("Markdown and .claude changes run only the format checks", () => {
  assert.deepEqual(sorted(affectedTargets([".claude/rules/testing.md", "README.md"], PROJECTS)), ["format"]);
});

test("a Markdown file inside an app also runs the format checks", () => {
  assert.deepEqual(sorted(affectedTargets(["apps/web/README.md"], PROJECTS)), ["format", "web"]);
});

test(".github and other root files run everything", () => {
  for (const path of [".github/workflows/verify.yml", "mise.toml", "biome.json"]) {
    assert.deepEqual(sorted(affectedTargets([path], PROJECTS)), ["core", "format", "tooling", "web"]);
  }
});

test("no changed paths run nothing", () => {
  assert.equal(affectedTargets([], PROJECTS).size, 0);
});

test("the projects are the folders under apps/ and packages/ that hold files", () => {
  const files = ["apps/web/package.json", "packages/core/src/a.ts", "packages/core/src/b.ts", "mise.toml"];
  assert.deepEqual(projectsOf(files), ["core", "web"]);
});
