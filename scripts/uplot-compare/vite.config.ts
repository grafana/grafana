import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type ViteDevServer } from 'vite';

const OUTPUT_CAP_BYTES = 256 * 1024;
const JEST_TIMEOUT_MS = 5 * 60 * 1000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function escapeRegex(s: string): string {
  return s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function isPathInsideRoot(candidate: string, root: string): boolean {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function capOutput(buf: string): string {
  if (buf.length <= OUTPUT_CAP_BYTES) {
    return buf;
  }
  return `…(truncated, showing last ${OUTPUT_CAP_BYTES} chars)\n${buf.slice(-OUTPUT_CAP_BYTES)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function narrowString(o: Record<string, unknown>, key: string): string | undefined {
  const v = o[key];
  return typeof v === 'string' ? v : undefined;
}

function narrowBool(o: Record<string, unknown>, key: string): boolean | undefined {
  const v = o[key];
  return typeof v === 'boolean' ? v : undefined;
}

function acceptSnapshotPlugin(): { name: string; configureServer: (server: ViteDevServer) => void } {
  const repoRoot = path.resolve(__dirname, '..', '..');

  return {
    name: 'uplot-compare-accept-snapshot',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__uplot-compare/accept', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
          return;
        }

        let body: unknown;
        try {
          body = await readJsonBody(req);
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }));
          return;
        }

        if (!isRecord(body)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: 'Invalid payload' }));
          return;
        }

        const testPath = narrowString(body, 'testPath');
        const testName = narrowString(body, 'testName');
        const updateSnapshot = narrowBool(body, 'updateSnapshot') ?? true;

        if (!testPath || !testName) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: 'Invalid testPath or testName' }));
          return;
        }

        if (!path.isAbsolute(testPath) || !isPathInsideRoot(testPath, repoRoot) || !existsSync(testPath)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({ ok: false, error: 'testPath must be an absolute path inside the repo and must exist' })
          );
          return;
        }

        const pattern = `^${escapeRegex(testName)}$`;
        const yarnBin = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
        const args = ['jest'];
        if (updateSnapshot) {
          args.push('--updateSnapshot');
        }
        args.push('--testNamePattern', pattern, '--', testPath);
        const command = `${yarnBin} ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}`;

        const child = spawn(yarnBin, args, {
          cwd: repoRoot,
          env: process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (d: Buffer) => {
          stdout += d.toString('utf8');
          if (stdout.length > OUTPUT_CAP_BYTES * 2) {
            stdout = stdout.slice(-OUTPUT_CAP_BYTES * 2);
          }
        });
        child.stderr?.on('data', (d: Buffer) => {
          stderr += d.toString('utf8');
          if (stderr.length > OUTPUT_CAP_BYTES * 2) {
            stderr = stderr.slice(-OUTPUT_CAP_BYTES * 2);
          }
        });

        const exitCode: number = await new Promise((resolve) => {
          let settled = false;
          const finish = (code: number) => {
            if (settled) {
              return;
            }
            settled = true;
            clearTimeout(t);
            resolve(code);
          };
          const t = setTimeout(() => {
            child.kill('SIGTERM');
            finish(-1);
          }, JEST_TIMEOUT_MS);
          child.once('close', (code) => finish(code ?? -1));
          child.once('error', () => finish(-1));
        });

        const ok = exitCode === 0;
        const payload = {
          ok,
          exitCode,
          stdout: capOutput(stdout),
          stderr: capOutput(stderr),
          command,
          ...(exitCode === -1 ? { error: 'jest timed out or failed to spawn' } : {}),
        };

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(payload));
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), acceptSnapshotPlugin()],
});
