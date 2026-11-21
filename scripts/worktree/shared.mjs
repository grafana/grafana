// Constants and registry helpers shared by worktree.mjs and the dashboard.
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

export const HOME = process.env.GRAFANA_WORKTREES_HOME || path.join(os.homedir(), '.grafana-worktrees');
export const MAIN = 'main';
// The main checkout keeps the ports a plain `make run` / `pnpm start` use.
export const MAIN_FRONTEND_PORT = 3333;
export const MAIN_BACKEND_PORT = 3000;
export const DASHBOARD_HOST = 'worktrees.localhost';
export const DASHBOARD_PORT = 3399;

export function readRegistry() {
  const dir = path.join(HOME, 'registry');
  if (!fs.existsSync(dir)) {
    return [];
  }
  return (
    fs
      .readdirSync(dir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')))
      // Entries from before the one-backend layout have no `port`; they reappear once their frontend is run again.
      .filter((entry) => Number.isInteger(entry.port))
  );
}

export function listening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port, timeout: 300 });
    socket.once('connect', () => (socket.destroy(), resolve(true)));
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => (socket.destroy(), resolve(false)));
  });
}
