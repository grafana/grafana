import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = join(import.meta.dirname, '..', 'publish-npm-packages.sh');

const FAKE_NPM = `#!/bin/bash
dir="$FAKE_NPM_DIR"
echo "$*" >> "$dir/calls.log"
spec_of() { tar -xzOf "$1" package/package.json | node -p 'const p = JSON.parse(require("fs").readFileSync(0, "utf8")); p.name + "@" + p.version'; }
has() { [ -f "$dir/$1" ] && grep -qxF "$2" "$dir/$1"; }
case "$1" in
  --version) echo "11.5.1" ;;
  view)
    if has unreachable "$2"; then echo "npm error code ECONNREFUSED" >&2; exit 1; fi
    if has published "$2"; then echo "\${2##*@}"; exit 0; fi
    echo "npm error code E404" >&2; exit 1 ;;
  publish)
    spec=$(spec_of "$2")
    echo "$spec" >> "$dir/attempts.log"
    if has published "$spec"; then echo "npm error code E403" >&2; exit 1; fi
    if has publish-fails "$spec"; then echo "npm error code E500" >&2; exit 1; fi
    echo "$spec" >> "$dir/published" ;;
esac
`;

interface Scenario {
  packages: Array<[name: string, version: string]>;
  published?: string[];
  unreachable?: string[];
  publishFails?: string[];
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'publish-npm-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeList(file: string, specs: string[] = []) {
  writeFileSync(join(root, 'fake-npm', file), specs.map((spec) => `${spec}\n`).join(''));
}

function readList(file: string): string[] {
  const path = join(root, 'fake-npm', file);
  return existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter(Boolean) : [];
}

function run({ packages, published, unreachable, publishFails }: Scenario) {
  mkdirSync(join(root, 'fake-npm'));
  mkdirSync(join(root, 'bin'));
  mkdirSync(join(root, 'home'));
  mkdirSync(join(root, 'work', 'npm-artifacts'), { recursive: true });
  writeFileSync(join(root, 'bin', 'npm'), FAKE_NPM);
  chmodSync(join(root, 'bin', 'npm'), 0o755);
  writeList('published', published);
  writeList('unreachable', unreachable);
  writeList('publish-fails', publishFails);

  for (const [name, version] of packages) {
    const dir = join(root, 'tarballs', `${name.replace(/[@/]/g, '_')}-${version}`);
    mkdirSync(join(dir, 'package'), { recursive: true });
    writeFileSync(join(dir, 'package', 'package.json'), JSON.stringify({ name, version }));
    const tarball = join(root, 'work', 'npm-artifacts', `${name.replace(/[@/]/g, '-')}-${version}.tgz`);
    const tar = spawnSync('tar', ['-czf', tarball, '-C', dir, 'package']);
    if (tar.status !== 0) {
      throw new Error(`tar failed for ${name}@${version}`);
    }
  }

  const result = spawnSync('bash', [SCRIPT, '--dist-tag', 'latest', '--registry', 'https://registry.example/'], {
    cwd: join(root, 'work'),
    encoding: 'utf8',
    env: {
      PATH: `${join(root, 'bin')}:${process.env.PATH}`,
      HOME: join(root, 'home'),
      FAKE_NPM_DIR: join(root, 'fake-npm'),
      ACTIONS_ID_TOKEN_REQUEST_URL: 'https://token.invalid',
    },
  });

  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
    attempts: readList('attempts.log'),
    calls: readList('calls.log'),
  };
}

describe('publish-npm-packages.sh', () => {
  it('publishes a version that is not on npm yet', () => {
    const result = run({ packages: [['@grafana/a', '1.0.0']] });

    expect(result.status).toBe(0);
    expect(result.attempts).toEqual(['@grafana/a@1.0.0']);
    expect(result.calls).toContain('view @grafana/a@1.0.0 version --registry https://registry.example/');
    expect(
      result.calls.some(
        (call) => call.startsWith('publish ') && call.endsWith('--tag latest --registry https://registry.example/')
      )
    ).toBe(true);
  });

  it('skips a version that is already on npm and ends green', () => {
    const result = run({ packages: [['@grafana/a', '1.0.0']], published: ['@grafana/a@1.0.0'] });

    expect(result.status).toBe(0);
    expect(result.attempts).toEqual([]);
    expect(result.output).toContain('Skipping @grafana/a@1.0.0: it is already published.');
  });

  it('publishes only what is missing when some packages are already on npm', () => {
    const result = run({
      packages: [
        ['@grafana/a', '1.0.0'],
        ['@grafana/b', '2.0.0'],
      ],
      published: ['@grafana/a@1.0.0'],
    });

    expect(result.status).toBe(0);
    expect(result.attempts).toEqual(['@grafana/b@2.0.0']);
  });

  it('counts a package as failed, and does not publish it, when the registry cannot be reached', () => {
    const result = run({
      packages: [
        ['@grafana/a', '1.0.0'],
        ['@grafana/b', '2.0.0'],
      ],
      unreachable: ['@grafana/a@1.0.0'],
    });

    expect(result.status).toBe(1);
    expect(result.attempts).toEqual(['@grafana/b@2.0.0']);
    expect(result.output).toContain('ERROR: The following packages failed to publish:');
    expect(result.output).toContain('grafana-a-1.0.0.tgz');
    expect(result.output).not.toContain('grafana-b-2.0.0.tgz');
  });

  it('still reports a package whose publish fails and goes on with the others', () => {
    const result = run({
      packages: [
        ['@grafana/a', '1.0.0'],
        ['@grafana/b', '2.0.0'],
      ],
      publishFails: ['@grafana/a@1.0.0'],
    });

    expect(result.status).toBe(1);
    expect(result.attempts).toEqual(['@grafana/a@1.0.0', '@grafana/b@2.0.0']);
    expect(result.output).toContain('grafana-a-1.0.0.tgz');
    expect(result.output).not.toContain('grafana-b-2.0.0.tgz');
  });
});
