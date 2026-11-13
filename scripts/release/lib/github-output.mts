import { appendFileSync } from 'node:fs';

export function writeOutputs(
  outputs: Record<string, string>,
  env: Record<string, string | undefined> = process.env
): void {
  const lines = Object.entries(outputs)
    .map(([key, value]) => {
      if (value.includes('\n')) {
        throw new Error(`Output ${key} must be a single line.`);
      }
      return `${key}=${value}\n`;
    })
    .join('');

  if (env.GITHUB_OUTPUT) {
    appendFileSync(env.GITHUB_OUTPUT, lines);
  } else {
    process.stdout.write(lines);
  }
}
