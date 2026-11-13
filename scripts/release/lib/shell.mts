import { execFileSync } from 'node:child_process';

export function run(command: string, args: string[], env: Record<string, string> = {}): string {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  });
}

export function stderrOf(error: unknown): string {
  return error instanceof Error && 'stderr' in error ? String(error.stderr) : '';
}
