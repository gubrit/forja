import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkRoot, rootEntries, unexpectedRootEntries } from "./root-files.ts";

function repository(files: Record<string, string>, tracked: string[] = []): string {
  const root = mkdtempSync(join(tmpdir(), "root-files-"));
  execFileSync("git", ["init", "--quiet", root]);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  if (tracked.length > 0) execFileSync("git", ["add", "--force", "--", ...tracked], { cwd: root });
  return root;
}

test("accepts the allowed root entries", () => {
  assert.deepEqual(unexpectedRootEntries(["apps", "packages", "mise.toml", "README.md", ".github"]), []);
});

test("reports every other entry, sorted", () => {
  assert.deepEqual(unexpectedRootEntries(["docs", "apps", "Makefile"]), ["Makefile", "docs"]);
});

test("the root's entries are the ones git sees, tracked or not yet added", () => {
  const root = repository({ "mise.toml": "", "apps/api/main.go": "", "docs/notes.md": "" }, ["mise.toml"]);
  assert.deepEqual(rootEntries(root).sort(), ["apps", "docs", "mise.toml"]);
});

test("what .gitignore leaves out is not checked", () => {
  const root = repository({
    ".gitignore": ".idea/\n.vscode/\n.DS_Store\nnode_modules/\n",
    ".idea/workspace.xml": "",
    ".vscode/settings.json": "",
    ".DS_Store": "",
    "node_modules/x/index.js": "",
    "README.md": "",
  });
  assert.deepEqual(checkRoot(root), []);
});

test("an ignored entry that was added anyway is reported", () => {
  const root = repository({ ".gitignore": ".idea/\n", ".idea/workspace.xml": "" }, [".idea/workspace.xml"]);
  assert.deepEqual(checkRoot(root), [
    '".idea" is not allowed at the repository root (see .claude/rules/structure.md).',
  ]);
});

test("an entry that is neither allowed nor ignored is reported", () => {
  const root = repository({ "docs/notes.md": "", Makefile: "", "README.md": "" });
  assert.deepEqual(
    checkRoot(root).map((problem) => problem.split('"')[1]),
    ["Makefile", "docs"],
  );
});
