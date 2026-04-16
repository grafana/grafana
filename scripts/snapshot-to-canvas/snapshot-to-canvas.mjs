#!/usr/bin/env node
/**
 * Decode Jest canvas snapshots (jest-canvas-mock / CanvasRenderingContext2DEvent arrays)
 * into a readable sequence of Canvas2D API calls.
 *
 * Usage:
 *   node scripts/snapshot-to-canvas/snapshot-to-canvas.mjs <file.snap> [export-name-filter]
 *   node scripts/snapshot-to-canvas/snapshot-to-canvas.mjs --stdin [export-name-filter] < events.json
 *   node scripts/snapshot-to-canvas/snapshot-to-canvas.mjs <file.snap> --list
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseJestSnapshot, parseSnapshotJson, eventsToCanvasScript } from './emitCanvasCalls.mjs';

function printHelp() {
  console.log(`Usage:
  snapshot-to-canvas.mjs <path-to.snap> [export-name-substring]
  snapshot-to-canvas.mjs <path-to.snap> --list
  snapshot-to-canvas.mjs --stdin [export-name-substring]   # JSON array on stdin

Options:
  --list          Print snapshot export names from a .snap file
  --stdin         Read a JSON array of events from stdin (not a full .snap file)
  --context, -c   Variable name for the context (default: ctx)
  --help, -h      Show this message
`);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  let argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    process.exit(argv.length === 0 ? 1 : 0);
  }

  let contextName = 'ctx';
  const ctxIdx = argv.findIndex((a) => a === '--context' || a === '-c');
  if (ctxIdx !== -1) {
    contextName = argv[ctxIdx + 1] ?? 'ctx';
    argv.splice(ctxIdx, 2);
  }

  const useStdin = argv.includes('--stdin');
  const listOnly = argv.includes('--list');
  const filtered = argv.filter((a) => !['--stdin', '--list'].includes(a));

  const fileArg = filtered.find((a) => !a.startsWith('-'));
  const nameFilter = filtered.filter((a) => a !== fileArg).join(' ') || undefined;

  if (useStdin) {
    if (listOnly) {
      console.error('--list is not supported with --stdin');
      process.exit(1);
    }
    return readStdin().then((raw) => {
      const data = parseSnapshotJson(raw);
      process.stdout.write(eventsToCanvasScript(data, { contextName }));
    });
  }

  if (!fileArg) {
    console.error('Missing .snap file path');
    printHelp();
    process.exit(1);
  }

  const abs = path.resolve(fileArg);
  const content = fs.readFileSync(abs, 'utf8');
  const map = parseJestSnapshot(content);

  if (listOnly) {
    for (const name of map.keys()) {
      console.log(name);
    }
    return;
  }

  const names = [...map.keys()].filter((n) => !nameFilter || n.includes(nameFilter));
  if (names.length === 0) {
    console.error(
      nameFilter
        ? `No exports matching ${JSON.stringify(nameFilter)} in ${abs}`
        : `No exports found in ${abs}`
    );
    process.exit(1);
  }

  for (const name of names) {
    const value = map.get(name);
    if (value && typeof value === 'object' && value.__parseError) {
      console.error(`// Failed to parse export ${JSON.stringify(name)}: ${value.message}`);
      continue;
    }
    process.stdout.write(`\n// ---- ${name} ----\n`);
    process.stdout.write(eventsToCanvasScript(value, { contextName }));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
