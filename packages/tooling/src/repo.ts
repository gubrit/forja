import { execFileSync } from "node:child_process";

/** Moves to the repository root, wherever the command was called from, and returns it. */
export function enterRepositoryRoot(): string {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  process.chdir(root);
  return root;
}

/**
 * The files git sees under `root`, tracked or not yet added. What .gitignore leaves out (an
 * editor's folder, node_modules, generated code) is not among them.
 */
export function repositoryFiles(root = "."): string[] {
  return execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1 << 28,
  })
    .split("\0")
    .filter(Boolean);
}

/**
 * The paths that differ between `base` and the working tree: what the commits since the branch left
 * `base` touched, what is not committed yet and what is not added yet. A file that moved is listed
 * at both ends, so that the place it left is checked too.
 */
export function changedSince(base: string, root = "."): string[] {
  const git = (args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  const committed = git(["diff", "--name-only", "--no-renames", `${base}...HEAD`]);
  const local = git(["diff", "--name-only", "--no-renames", "HEAD"]);
  const untracked = git(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set(`${committed}\n${local}\n${untracked}`.split("\n").filter(Boolean))];
}
