export interface PackageRelease {
  name: string;
  currentVersion: string;
  newVersion: string;
  changelog: string;
}

function isPackageRelease(value: unknown): value is PackageRelease {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const fields = new Map(Object.entries(value));
  return ['name', 'currentVersion', 'newVersion', 'changelog'].every((key) => typeof fields.get(key) === 'string');
}

export function parseReleases(json: string): PackageRelease[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('The release summary is not valid JSON.');
  }

  if (!Array.isArray(parsed) || !parsed.every(isPackageRelease)) {
    throw new Error('The release summary must be a JSON list of {name, currentVersion, newVersion, changelog}.');
  }
  return parsed;
}
