import { spawnSync } from "node:child_process";

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export function run(command: string, args: string[], options: RunOptions = {}): boolean {
  return spawnSync(command, args, { stdio: "inherit", ...options }).status === 0;
}

/** The same, announced first: one step of `mise run verify`. */
export function step(label: string, command: string, args: string[], options: RunOptions = {}): boolean {
  console.log(`\n▶ ${label}`);
  return run(command, args, options);
}
