import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { affectedTargets, projectsOf, type Target } from "./affected.ts";
import { changedSince, enterRepositoryRoot, repositoryFiles } from "./repo.ts";
import { checkRoot } from "./root-files.ts";
import { step } from "./run.ts";

const root = enterRepositoryRoot();

// CI sets the pull request's base commit.
const base = process.env.VERIFY_BASE ?? "origin/main";
// A base with no history in common with HEAD (the all-zero commit GitHub sends on a branch's
// first push, or the old tip after a forced push) leaves nothing to compare against.
const hasBase =
  !/^0+$/.test(base) && spawnSync("git", ["merge-base", base, "HEAD"], { stdio: "ignore" }).status === 0;

// Nothing to compare against (the first commit): every file counts as changed.
const files = repositoryFiles();
const changed = hasBase ? changedSince(base) : files;

// Secrets are looked for in every line the change's commits add and in every file as it is now,
// tracked or not yet committed. Findings are printed redacted.
function scanSecrets(): boolean {
  const options = ["--no-banner", "--redact", "--verbose"];
  const range = hasBase ? `${base}..HEAD` : "HEAD";
  if (!step("secrets in the commits", "gitleaks", ["git", ...options, `--log-opts=${range}`])) return false;

  // gitleaks scans a whole directory, ignored files included, so it gets a copy with only the rest.
  const copy = mkdtempSync(join(tmpdir(), "verify-secrets-"));
  try {
    for (const path of files) {
      if (!lstatSync(path, { throwIfNoEntry: false })?.isFile()) continue;
      mkdirSync(dirname(join(copy, path)), { recursive: true });
      copyFileSync(path, join(copy, path));
    }
    return step("secrets in the files", "gitleaks", ["dir", ...options], { cwd: copy });
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
}

const failures: string[] = [];

function report(name: string, problems: readonly string[]): void {
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) failures.push(name);
}

report("root files", checkRoot(root));

if (!scanSecrets()) failures.push("secrets");

const shellScripts = files.filter((path) => path.endsWith(".sh") && existsSync(path));
if (shellScripts.length > 0 && !step("shell scripts (shellcheck)", "shellcheck", shellScripts)) {
  failures.push("shell scripts");
}

const targets = affectedTargets(changed, projectsOf(files));
if (targets.size === 0) {
  console.log("Nothing this change can affect; no checks to run.");
} else {
  console.log(`Affected: ${[...targets].sort().join(", ")}`);
}

// Node's own search also runs any file named `test-*` or `*-test` and whatever a `test` folder
// holds: each run names its test files instead.
const nodeTests = (label: string, pattern: string) => step(label, "node", ["--test", pattern]);

// Every target's checks are a function that runs each tool in turn: one way to announce a step, one
// place that decides what failed, and no entry script per target.
const checks: Record<Target, () => boolean> = {
  tooling: () =>
    step("tooling: types", "pnpm", ["--dir", "packages/tooling", "run", "types"]) &&
    nodeTests("tooling: tests", "packages/tooling/src/**/*.test.ts"),
  format: () =>
    step("Biome", "pnpm", ["exec", "biome", "ci", "."]) &&
    // To fix what it reports: pnpm exec prettier --write "**/*.md"
    step("Prettier (Markdown)", "pnpm", ["exec", "prettier", "--check", "**/*.md"]),
};

for (const target of [...targets].sort()) {
  const check = checks[target];
  if (check) {
    if (!check()) failures.push(target);
  } else if (existsSync(`apps/${target}`) || existsSync(`packages/${target}`)) {
    // An app or package that exists must register its checks here when its skeleton is built.
    console.error(`"${target}" exists but has no checks registered in packages/tooling/src/verify.ts.`);
    failures.push(target);
  }
}

if (failures.length > 0) {
  console.error(`\nverify failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nverify passed.");
