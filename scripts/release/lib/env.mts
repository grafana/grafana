export function requireEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
}
