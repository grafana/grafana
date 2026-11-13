export interface IndependentPackage {
  group: string;
  name: string;
  root: string;
  manifestPath: string;
}

function isPackageEntry(value: unknown): value is IndependentPackage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const fields = new Map(Object.entries(value));
  return ['group', 'name', 'root', 'manifestPath'].every((key) => typeof fields.get(key) === 'string');
}

export function parsePackages(json: string | undefined): IndependentPackage[] {
  if (!json) {
    throw new Error('INDEPENDENT_PACKAGES is not set.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('INDEPENDENT_PACKAGES is not valid JSON.');
  }

  if (!Array.isArray(parsed) || !parsed.every(isPackageEntry)) {
    throw new Error('INDEPENDENT_PACKAGES must be a JSON list of {group, name, root, manifestPath}.');
  }
  return parsed;
}
