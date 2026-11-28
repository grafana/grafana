// Serves the worktree dashboard: static files plus a JSON endpoint that is read fresh on every request.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DASHBOARD_HOST, DASHBOARD_PORT, MAIN, MAIN_BACKEND_PORT, listening, readRegistry } from '../shared.mjs';

const STATIC_DIR = path.dirname(fileURLToPath(import.meta.url));
const STATIC_FILES = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/dashboard.css': { file: 'dashboard.css', type: 'text/css; charset=utf-8' },
  '/dashboard.js': { file: 'dashboard.js', type: 'text/javascript; charset=utf-8' },
};
// Only the dashboard's own names are accepted, so a rebinding page cannot read the worktree paths it lists.
const ALLOWED_HOSTS = new Set([DASHBOARD_HOST, `127.0.0.1:${DASHBOARD_PORT}`, `localhost:${DASHBOARD_PORT}`]);
const collator = new Intl.Collator();

// Subjects of the commits on the worktree's branch that are not on main yet; a stale or missing path gives none.
function commitsAheadOfMain(worktreePath) {
  try {
    const subjects = execFileSync('git', ['-C', worktreePath, 'log', 'origin/main..HEAD', '--format=%s', '-n', '5'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return subjects.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

async function worktreeData() {
  const entries = readRegistry().sort((a, b) => collator.compare(a.name, b.name));
  return {
    backend: { name: MAIN, port: MAIN_BACKEND_PORT, up: await listening(MAIN_BACKEND_PORT) },
    worktrees: await Promise.all(
      entries.map(async (entry) => ({
        name: entry.name,
        branch: entry.branch,
        port: entry.port,
        up: await listening(entry.port),
        description: entry.description ?? null,
        commits: commitsAheadOfMain(entry.path),
      }))
    ),
  };
}

function respond(res, status, type, body) {
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'self'",
  });
  res.end(body);
}

async function handle(req, res) {
  if (!ALLOWED_HOSTS.has(req.headers.host ?? '')) {
    respond(res, 421, 'text/plain', 'Unexpected host');
    return;
  }
  if (req.method !== 'GET') {
    respond(res, 405, 'text/plain', 'Method not allowed');
    return;
  }
  if (req.url === '/api/worktrees') {
    respond(res, 200, 'application/json', JSON.stringify(await worktreeData()));
    return;
  }
  const staticFile = STATIC_FILES[req.url];
  if (!staticFile) {
    respond(res, 404, 'text/plain', 'Not found');
    return;
  }
  respond(res, 200, staticFile.type, fs.readFileSync(path.join(STATIC_DIR, staticFile.file)));
}

export function startDashboard() {
  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => respond(res, 500, 'text/plain', err.message));
  });
  server.listen(DASHBOARD_PORT, '127.0.0.1', () => {
    console.log(`Worktree dashboard: http://${DASHBOARD_HOST}`);
  });
}
