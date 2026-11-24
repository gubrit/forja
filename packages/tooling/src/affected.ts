/**
 * A target is a set of checks: the shared ones, or the ones of one app or package, named after its
 * folder (`apps/web/` is "web", `packages/core/` is "core").
 */
export type Target = string;

/** The checks every change can affect, whatever apps and packages exist. */
export const SHARED_TARGETS: readonly Target[] = ["tooling", "format"];

const PROJECT_FOLDER = /^(?:apps|packages)\/([^/]+)\//;

function targetsOf(path: string, projects: readonly Target[]): readonly Target[] {
  const project = PROJECT_FOLDER.exec(path)?.[1];
  if (project) return [project];
  if (path.startsWith(".claude/") || path.endsWith(".md")) return ["format"];
  // Any other root file or .github/ can change how everything builds or runs.
  return [...SHARED_TARGETS, ...projects];
}

/**
 * The targets the changed paths can affect. `projects` are the apps and packages that exist, which a
 * change at the root affects all of.
 */
export function affectedTargets(paths: readonly string[], projects: readonly Target[]): Set<Target> {
  const targets = new Set<Target>();
  for (const path of paths) {
    // Markdown anywhere is formatted by the format target, besides whatever else it belongs to.
    if (path.endsWith(".md")) targets.add("format");
    for (const target of targetsOf(path, projects)) targets.add(target);
  }
  return targets;
}

/** The apps and packages among the repository's files, named as their targets. */
export function projectsOf(files: readonly string[]): Target[] {
  const projects = new Set<Target>();
  for (const file of files) {
    const project = PROJECT_FOLDER.exec(file)?.[1];
    if (project) projects.add(project);
  }
  return [...projects].sort();
}
