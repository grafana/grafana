// Deletes every tarball in the artifacts folder whose name@version is already on the npm registry,
// so the validate and publish scripts only see packages that still need publishing.
// Fails on prerelease versions because the publish workflow always uses the latest dist-tag.
//
// Usage: node scripts/release/select-unpublished-npm-packages.mts [artifacts-dir] [registry]

import { execFileSync } from 'node:child_process';
import { readdirSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_DIR = './npm-artifacts';
const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';

export interface Deps {
  listTarballs(dir: string): string[];
  readTarballManifest(file: string): { name: string; version: string };
  npmView(name: string, version: string, registry: string): { exitCode: number; output: string };
  removeFile(file: string): void;
  log(message: string): void;
}

export function parseArgs(argv: string[]): { dir: string; registry: string } {
  return { dir: argv[0] ?? DEFAULT_DIR, registry: argv[1] ?? DEFAULT_REGISTRY };
}

export function selectUnpublished(dir: string, registry: string, deps: Deps): void {
  for (const file of deps.listTarballs(dir)) {
    const { name, version } = deps.readTarballManifest(file);
    const spec = `${name}@${version}`;

    if (version.includes('-')) {
      throw new Error(
        `${spec} is a prerelease, but this workflow publishes stable versions to the latest dist-tag only.`
      );
    }

    const { exitCode, output } = deps.npmView(name, version, registry);
    if (exitCode === 0) {
      deps.log(`${spec} is already published, skipping.`);
      deps.removeFile(file);
    } else if (output.includes('E404')) {
      deps.log(`${spec} is not published yet.`);
    } else {
      throw new Error(`Could not check whether ${spec} is published:\n${output}`);
    }
  }
}

function errorField(error: unknown, key: 'status' | 'stdout' | 'stderr'): unknown {
  return typeof error === 'object' && error !== null && key in error ? Reflect.get(error, key) : undefined;
}

function createDeps(): Deps {
  return {
    listTarballs: (dir) => {
      try {
        return readdirSync(dir)
          .filter((entry) => entry.endsWith('.tgz'))
          .sort()
          .map((entry) => join(dir, entry));
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          return [];
        }
        throw error;
      }
    },
    readTarballManifest: (file) =>
      JSON.parse(execFileSync('tar', ['-xzOf', file, 'package/package.json'], { encoding: 'utf8' })),
    npmView: (name, version, registry) => {
      try {
        const output = execFileSync('npm', ['view', `${name}@${version}`, 'version', '--registry', registry], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        return { exitCode: 0, output };
      } catch (error) {
        const status = errorField(error, 'status');
        return {
          exitCode: typeof status === 'number' ? status : 1,
          output: `${errorField(error, 'stdout') ?? ''}${errorField(error, 'stderr') ?? ''}`,
        };
      }
    },
    removeFile: (file) => rmSync(file),
    log: (message) => console.log(message),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  try {
    const { dir, registry } = parseArgs(process.argv.slice(2));
    selectUnpublished(dir, registry, createDeps());
  } catch (error) {
    const [first, ...rest] = (error instanceof Error ? error.message : String(error)).split('\n');
    console.error(`::error::${first}`);
    if (rest.length > 0) {
      console.error(rest.join('\n'));
    }
    process.exit(1);
  }
}
