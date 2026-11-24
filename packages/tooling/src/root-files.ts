import { repositoryFiles } from "./repo.ts";

const ALLOWED_ROOT_ENTRIES: ReadonlySet<string> = new Set([
  "apps",
  "packages",
  ".claude",
  ".github",
  "mise.toml",
  "mise.lock",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "biome.json",
  ".gitignore",
  ".gitattributes",
  ".editorconfig",
  "CLAUDE.md",
  "LICENSE",
  "README.md",
]);

export function unexpectedRootEntries(entries: Iterable<string>): string[] {
  return [...new Set(entries)].filter((entry) => !ALLOWED_ROOT_ENTRIES.has(entry)).sort();
}

// The root's names as git sees them: tracked or not yet added, never what .gitignore leaves out
// (an editor's folder, node_modules), which stays on one machine.
export function rootEntries(root: string): string[] {
  return [...new Set(repositoryFiles(root).map((path) => path.split("/")[0]))];
}

export function checkRoot(root: string): string[] {
  return unexpectedRootEntries(rootEntries(root)).map(
    (entry) => `"${entry}" is not allowed at the repository root (see .claude/rules/structure.md).`,
  );
}
