#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '../../../..');
export const store = path.join(root, 'local/shard1-profile/deps');
const planFile = path.join(here, 'plan.json');
const selectionFile = path.join(here, 'selection.json');
const stateFile = path.join(store, 'state.json');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const relative = (file) => path.relative(root, file).split(path.sep).join('/');
const exists = (file) => { try { return fs.lstatSync(file); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };
const within = (base, file) => file === base || file.startsWith(base + path.sep);

export function allocated(file) {
  const st = exists(file);
  if (!st) return 0;
  let bytes = st.blocks * 512;
  if (st.isDirectory()) for (const name of fs.readdirSync(file)) bytes += allocated(path.join(file, name));
  return bytes;
}

function disk() {
  const s = fs.statfsSync(root);
  return Number(s.bavail) * Number(s.bsize);
}

export function assertBudget({ dependencies, task, free }, reserve = 0, limits = json(selectionFile).limits) {
  if (dependencies + reserve > limits.dependenciesAndScratch || task + reserve > limits.task || free - reserve < limits.minimumFree) {
    throw new Error(`DISK BUDGET: dependencies=${dependencies}, task=${task}, free=${free}, reserve=${reserve}, limits=${JSON.stringify(limits)}`);
  }
}

function usage(state = {}) {
  const externalLinks = Object.keys(state.links || {}).reduce((n, f) => n + (exists(path.join(root, f))?.blocks || 0) * 512, 0);
  const dependencies = allocated(store) + externalLinks;
  return { dependencies, task: dependencies + allocated(here), free: disk() };
}

// Only measure the modified subtree after writes. Walking the entire store for
// every package makes installation quadratic in the number of installed files.
export function createAllocationLedger(initial, measure = allocated) {
  const totals = { ...initial };
  return {
    snapshot: (free) => ({ ...totals, free }),
    mutate(file, dependency, action) {
      const parent = path.dirname(file);
      const size = () => measure(file) + (exists(parent)?.blocks || 0) * 512;
      const before = size();
      try { return action(); }
      finally {
        const delta = size() - before;
        totals.task += delta;
        if (dependency) totals.dependencies += delta;
      }
    },
  };
}
let ledger;
let activeLimits;
const limits = () => activeLimits || json(selectionFile).limits;
function guard(state, reserve = 0) {
  const u = ledger ? ledger.snapshot(disk()) : usage(state);
  assertBudget(u, reserve, limits());
  return u;
}
function mutate(file, action) {
  return ledger ? ledger.mutate(file, within(store, file), action) : action();
}
function save(file, value, state = {}) {
  const text = JSON.stringify(value, null, 2) + '\n';
  guard(state, Buffer.byteLength(text) + 16384);
  mutate(file, () => {
    fs.writeFileSync(file + '.tmp', text, { flag: 'w' });
    fs.renameSync(file + '.tmp', file);
  });
}

function yaml(file) {
  return JSON.parse(execFileSync('bun', ['-e', 'const s=await Bun.file(process.argv[1]).text();console.log(JSON.stringify(s.split(/^---\\s*$/m).filter(x=>x.trim()).map(x=>Bun.YAML.parse(x))));', file], { maxBuffer: 40 * 1024 * 1024 }));
}

export function packageIdentity(snapshot) {
  const base = snapshot.split('(')[0];
  const at = base.lastIndexOf('@');
  assert(at > 0, `Invalid snapshot: ${snapshot}`);
  return { name: base.slice(0, at), version: base.slice(at + 1), base };
}

function generatePlan() {
  const selection = json(selectionFile);
  const lockPath = path.join(root, 'pnpm-lock.yaml');
  const lock = yaml(lockPath).find(d => d.importers?.['.']?.dependencies);
  assert(lock, 'Application lock document not found');
  const config = yaml(path.join(root, 'pnpm-workspace.yaml'))[0];
  const inputs = {};
  const input = (f) => { inputs[f] = sha(fs.readFileSync(path.join(root, f))); };
  input('pnpm-lock.yaml'); input('pnpm-workspace.yaml'); input('package.json');
  input(relative(selectionFile));
  const omitted = new Set(selection.omit);
  const packages = new Map();
  const workspaces = new Map();
  const direct = {};
  const omissions = [];
  const snapshotKey = (n, v) => Object.hasOwn(lock.snapshots, v) ? v : `${n}@${v}`;
  const target = (name, version, importer, origin, expand = true) => {
    if (omitted.has(name)) { if (expand) omissions.push({ origin, name, reference: version }); return null; }
    if (version.startsWith('link:')) {
      const dir = path.posix.normalize(path.posix.join(importer, version.slice(5)));
      assert(!dir.startsWith('../') && !path.isAbsolute(dir), `Unsafe workspace ${dir}`);
      if (expand && !workspaces.has(dir)) {
        const manifest = `${dir}/package.json`;
        const p = json(path.join(root, manifest));
        input(manifest);
        const w = { name: p.name, path: dir, links: {} };
        workspaces.set(dir, w);
        assert(lock.importers[dir], `Missing workspace importer: ${dir}`);
        for (const [n, d] of Object.entries(lock.importers[dir].dependencies || {})) {
          const t = target(n, d.version, dir, dir);
          if (t) w.links[n] = t;
        }
      }
      return workspaces.has(dir) ? { workspace: dir } : null;
    }
    const key = snapshotKey(name, version);
    if (!expand) return packages.has(key) ? { snapshot: key } : null;
    if (!packages.has(key)) {
      const snapshot = lock.snapshots[key];
      assert(snapshot, `Missing snapshot ${key}`);
      const identity = packageIdentity(key);
      const metadata = lock.packages[identity.base];
      assert(metadata?.resolution?.integrity && !metadata.resolution.tarball, `Unsupported resolution: ${key}`);
      const p = { snapshot: key, id: sha(key).slice(0, 24), ...identity, integrity: metadata.resolution.integrity,
        url: `https://registry.npmjs.org/${identity.name}/-/${identity.name.split('/').at(-1)}-${identity.version}.tgz`,
        links: {}, optionalLinks: {}, omittedOptional: {}, patch: null };
      packages.set(key, p);
      const ownPatch = key.slice(identity.base.length).match(/^\(patch_hash=([a-f0-9]+)\)/)?.[1];
      if (ownPatch) {
        const patchPath = config.patchedDependencies[identity.base];
        assert(patchPath && lock.patchedDependencies[identity.base] === ownPatch, `Missing patch: ${key}`);
        input(patchPath);
        assert(inputs[patchPath] === ownPatch, `Patch hash mismatch: ${key}`);
        p.patch = { path: patchPath, sha256: ownPatch };
      }
      for (const [n, v] of Object.entries(snapshot.dependencies || {})) {
        const t = target(n, v, '.', key);
        if (t) p.links[n] = t;
      }
    }
    return { snapshot: key };
  };
  const select = (importer, section, name) => {
    const entry = lock.importers[importer]?.[section]?.[name];
    assert(entry, `No locked selection: ${importer}:${section}:${name}`);
    const t = target(name, entry.version, importer, `${importer}:${section}`);
    if (t) {
      if (importer === '.') direct[name] = t;
      else {
        if (!workspaces.has(importer)) {
          const p = json(path.join(root, importer, 'package.json'));
          target(p.name, `link:${importer}`, '.', 'amendment');
        }
        workspaces.get(importer).links[name] = t;
      }
    }
  };
  if (selection.rootDependencies) for (const n of Object.keys(lock.importers['.'].dependencies)) select('.', 'dependencies', n);
  for (const n of selection.rootDevDependencies) select('.', 'devDependencies', n);
  for (const a of selection.additional) select(a.importer, a.section, a.name);
  for (const [name, snapshot] of Object.entries(selection.exposeSnapshots || {})) {
    direct[name] = target(name, snapshot, '.', 'explicit runtime resolution');
  }
  for (const p of packages.values()) for (const [n, v] of Object.entries(lock.snapshots[p.snapshot].optionalDependencies || {})) {
    const t = target(n, v, '.', p.snapshot, false);
    if (t) p.optionalLinks[n] = t;
    else p.omittedOptional[n] = v;
  }
  const plan = { schemaVersion: 1, registry: 'https://registry.npmjs.org', selection, inputs,
    rootLinks: direct, workspaces: [...workspaces.values()].sort((a, b) => a.path.localeCompare(b.path)),
    packages: [...packages.values()].sort((a, b) => a.snapshot.localeCompare(b.snapshot)), omissions };
  save(planFile, plan);
  console.log(`Plan: ${plan.packages.length} snapshots, ${plan.workspaces.length} workspaces; ${relative(planFile)}`);
  return plan;
}

function validatePlan(plan) {
  for (const [file, hash] of Object.entries(plan.inputs)) assert.equal(sha(fs.readFileSync(path.join(root, file))), hash, `Input changed: ${file}. Regenerate the plan deliberately.`);
  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.registry, 'https://registry.npmjs.org');
}

export function verifyIntegrity(buffer, integrity) {
  const matches = integrity.split(/\s+/).some(token => {
    const i = token.indexOf('-');
    const algorithm = token.slice(0, i);
    assert(['sha512', 'sha256', 'sha1'].includes(algorithm), `Unsupported SRI: ${algorithm}`);
    return createHash(algorithm).update(buffer).digest('base64') === token.slice(i + 1);
  });
  assert(matches, 'Tarball integrity mismatch');
}

function tarNumber(buffer) {
  assert(!(buffer[0] & 128), 'Unsupported base-256 tar number');
  const text = buffer.toString().replace(/\0.*$/, '').trim();
  assert(/^[0-7]*$/.test(text), `Invalid tar number: ${text}`);
  return text ? parseInt(text, 8) : 0;
}
function tarText(buffer) { return buffer.toString('utf8').replace(/\0.*$/, ''); }
function pax(buffer) {
  const result = {};
  for (let i = 0; i < buffer.length;) {
    const space = buffer.indexOf(32, i);
    assert(space > i, 'Invalid PAX length');
    const length = Number(buffer.subarray(i, space).toString());
    assert(Number.isSafeInteger(length) && length > space - i + 1 && i + length <= buffer.length, 'Invalid PAX record');
    const record = buffer.subarray(space + 1, i + length - 1).toString();
    const eq = record.indexOf('=');
    assert(eq > 0, 'Invalid PAX key');
    result[record.slice(0, eq)] = record.slice(eq + 1);
    i += length;
  }
  return result;
}

export function inspectTar(buffer, blockSize = 4096) {
  const entries = [];
  const names = new Set();
  const dirs = new Set(['']);
  let next = {}, global = {}, longName, longLink;
  let prefix;
  for (let offset = 0; offset + 512 <= buffer.length;) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every(b => b === 0)) break;
    const checksum = header.reduce((sum, byte, i) => sum + (i >= 148 && i < 156 ? 32 : byte), 0);
    assert.equal(checksum, tarNumber(header.subarray(148, 156)), 'Tar checksum mismatch');
    const headerSize = tarNumber(header.subarray(124, 136));
    const type = String.fromCharCode(header[156] || 48);
    const attributes = { ...global, ...next };
    const size = !['x', 'g', 'L', 'K'].includes(type) && attributes.size ? Number(attributes.size) : headerSize;
    assert(Number.isSafeInteger(size) && size >= 0 && offset + 512 + size <= buffer.length, 'Invalid tar size');
    const data = buffer.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (type === 'x') { next = pax(data); continue; }
    if (type === 'g') { global = { ...global, ...pax(data) }; continue; }
    if (type === 'L') { longName = tarText(data); continue; }
    if (type === 'K') { longLink = tarText(data); continue; }
    assert(!Object.keys(attributes).some(k => k.startsWith('GNU.sparse')), 'Sparse archives are not supported');
    const pre = tarText(header.subarray(345, 500));
    const raw = attributes.path || longName || [pre, tarText(header.subarray(0, 100))].filter(Boolean).join('/');
    const clean = raw.replace(/^\.\//, '').replace(/\/$/, '');
    assert(clean && !clean.startsWith('/') && !clean.includes('\\') && !clean.includes('\0') && !clean.split('/').includes('..'), `Unsafe archive path: ${raw}`);
    const components = clean.split('/');
    prefix ??= components[0];
    assert.equal(components.shift(), prefix, 'Multiple tar roots');
    const name = components.join('/');
    const link = attributes.linkpath || longLink || tarText(header.subarray(157, 257));
    next = {}; longName = undefined; longLink = undefined;
    assert(['0', '5', '2', '1'].includes(type), `Unsupported tar type: ${type}`);
    if (!name) { assert.equal(type, '5', 'Archive root must be a directory'); continue; }
    assert(!names.has(name) || type === '5', `Duplicate archive path: ${name}`);
    names.add(name);
    let target;
    if (type === '2' || type === '1') {
      assert(!path.posix.isAbsolute(link) && !link.includes('\\'), `Unsafe archive link: ${link}`);
      target = type === '2' ? path.posix.normalize(path.posix.join(path.posix.dirname(name), link)) : link.replace(new RegExp(`^${prefix}/`), '');
      assert(target && target !== '..' && !target.startsWith('../') && !target.startsWith('/'), `Escaping archive link: ${link}`);
    }
    entries.push({ name, type, data, target, link, mode: tarNumber(header.subarray(100, 108)) & 0o777 });
    let parent = type === '5' ? name : path.posix.dirname(name);
    while (parent !== '.' && parent !== '') { dirs.add(parent); parent = path.posix.dirname(parent); }
  }
  const links = entries.filter(e => e.type === '1' || e.type === '2').map(e => e.name);
  for (const entry of entries) assert(!links.some(l => entry.name.startsWith(l + '/')), `Archive writes through link: ${entry.name}`);
  const reservedBytes = (dirs.size + entries.length * 2 + 32) * blockSize + entries.reduce((n, e) => n + Math.ceil(e.data.length / blockSize) * blockSize, 0);
  return { entries, reservedBytes, expandedBytes: entries.reduce((n, e) => n + e.data.length, 0) };
}

function extractTar(archive, destination, state) {
  guard(state, archive.reservedBytes);
  fs.mkdirSync(destination, { recursive: true });
  for (const e of archive.entries.filter(e => e.type === '5')) fs.mkdirSync(path.join(destination, e.name), { recursive: true });
  for (const e of archive.entries.filter(e => e.type === '0')) {
    const file = path.join(destination, e.name);
    assert(within(destination, file));
    const reserve = Math.ceil(e.data.length / 4096) * 4096 + 32768;
    assert(disk() - reserve >= limits().minimumFree, 'Free space floor reached during extraction');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, e.data, { flag: 'wx', mode: e.mode | 0o600 });
    fs.chmodSync(file, e.mode | 0o400);
  }
  for (const e of archive.entries.filter(e => e.type === '1' || e.type === '2')) {
    const file = path.join(destination, e.name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (e.type === '2') fs.symlinkSync(e.link, file);
    else { const target = path.join(destination, e.target); assert(fs.lstatSync(target).isFile()); fs.linkSync(target, file); }
  }
}

function treeDigest(dir) {
  const hash = createHash('sha256');
  function walk(current, prefix = '') {
    for (const name of fs.readdirSync(current).sort()) {
      if (prefix === '' && name === 'node_modules') continue;
      const f = path.join(current, name), key = prefix + name, st = fs.lstatSync(f);
      hash.update(key + '\0' + (st.mode & 0o777) + '\0');
      if (st.isDirectory()) { hash.update('directory\0'); walk(f, key + '/'); }
      else if (st.isSymbolicLink()) hash.update('link\0' + fs.readlinkSync(f) + '\0');
      else { assert(st.isFile()); hash.update('file\0' + st.size + '\0'); hash.update(fs.readFileSync(f)); }
    }
  }
  walk(dir);
  return hash.digest('hex');
}
const packageDir = p => path.join(store, 'packages', p.id, 'node_modules', p.name);
const receiptFile = p => path.join(store, 'packages', p.id, 'receipt.json');

async function download(p) {
  const url = new URL(p.url);
  assert(url.protocol === 'https:' && url.hostname === 'registry.npmjs.org' && !url.port && !url.username && !url.password, 'Unapproved registry URL');
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(120000) });
  assert(response.ok, `Download failed: ${response.status} ${url}`);
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    assert(size <= 128000000, `Compressed archive exceeds memory cap: ${p.snapshot}`);
    chunks.push(chunk);
  }
  const archive = Buffer.concat(chunks);
  verifyIntegrity(archive, p.integrity);
  return gunzipSync(archive, { maxOutputLength: 512000000 });
}

function ownLink(file, target, state) {
  const key = relative(file), st = exists(file), desired = path.relative(path.dirname(file), target);
  if (st) {
    assert(st.isSymbolicLink(), `Refusing to overwrite non-link: ${key}`);
    const prior = fs.readlinkSync(file);
    if (prior === desired) return;
    const owned = state.links[key]?.target === prior;
    const adopt = key === 'node_modules' && prior === 'local/jest-dom-bench/node_modules' && !fs.existsSync(file);
    assert(owned || adopt, `Refusing to overwrite unowned link: ${key} -> ${prior}`);
    if (adopt) state.originalRootLink = prior;
    state.links[key] = { target: desired, previous: prior };
    save(stateFile, state, state);
    fs.unlinkSync(file);
  } else {
    state.links[key] = { target: desired };
    save(stateFile, state, state);
  }
  assert(disk() - 32768 >= limits().minimumFree, 'Free space floor reached before link');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.symlinkSync(desired, file);
}

function wire(plan, state) {
  const byKey = new Map(plan.packages.map(p => [p.snapshot, p]));
  const resolve = t => t.workspace ? path.join(root, t.workspace) : packageDir(byKey.get(t.snapshot));
  const internalLink = (file, destination) => {
    const desired = path.relative(path.dirname(file), destination), st = exists(file);
    if (st) { assert(st.isSymbolicLink() && fs.readlinkSync(file) === desired, `Conflicting package link: ${file}`); return; }
    assert(disk() - 32768 >= limits().minimumFree, 'Free space floor reached before internal link');
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.symlinkSync(desired, file);
  };
  const edgeCount = plan.packages.reduce((n, p) => n + Object.keys(p.links).length + Object.keys(p.optionalLinks).length, 0);
  guard(state, (edgeCount + 2000) * 4096);
  for (const p of plan.packages) for (const [name, t] of Object.entries({ ...p.links, ...p.optionalLinks })) internalLink(path.join(packageDir(p), 'node_modules', name), resolve(t));
  const rootModules = path.join(store, 'root-node_modules');
  fs.mkdirSync(rootModules, { recursive: true });
  for (const [name, t] of Object.entries(plan.rootLinks)) internalLink(path.join(rootModules, name), resolve(t));
  for (const w of plan.workspaces) {
    const dir = path.join(store, 'workspaces', sha(w.path).slice(0, 16), 'node_modules');
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, t] of Object.entries(w.links)) internalLink(path.join(dir, name), resolve(t));
    ownLink(path.join(root, w.path, 'node_modules'), dir, state);
  }
  ownLink(path.join(root, 'node_modules'), rootModules, state);
  for (const [name, t] of Object.entries(plan.rootLinks)) {
    if (t.workspace) continue;
    const dir = resolve(t), p = json(path.join(dir, 'package.json'));
    const bins = typeof p.bin === 'string' ? { [name.split('/').at(-1)]: p.bin } : p.bin || {};
    for (const [bin, f] of Object.entries(bins)) {
      assert(!bin.includes('/') && within(dir, path.resolve(dir, f)), 'Unsafe bin path');
      internalLink(path.join(rootModules, '.bin', bin), path.resolve(dir, f));
    }
  }
  guard(state);
}

async function install({ verify = false, limit = Infinity } = {}) {
  const plan = json(planFile); validatePlan(plan);
  fs.mkdirSync(store, { recursive: true });
  const state = exists(stateFile) ? json(stateFile) : { schemaVersion: 1, links: {}, createdAt: new Date().toISOString() };
  activeLimits = json(selectionFile).limits;
  ledger = createAllocationLedger(usage(state));
  guard(state);
  const mutex = path.join(store, 'installer.lock');
  const fd = fs.openSync(mutex, 'wx'); fs.writeSync(fd, String(process.pid)); fs.closeSync(fd);
  let added = 0;
  try {
    save(stateFile, state, state);
    for (const [index, p] of plan.packages.entries()) {
      if (exists(receiptFile(p))) {
        const receipt = json(receiptFile(p));
        assert.equal(receipt.snapshot, p.snapshot);
        assert.equal(receipt.integrity, p.integrity);
        assert.equal(receipt.patchHash, p.patch?.sha256 || null);
        if (verify) assert.equal(treeDigest(packageDir(p)), receipt.treeSha256, `Installed contents changed: ${p.snapshot}`);
        continue;
      }
      if (added >= limit) break;
      const container = path.join(store, 'packages', p.id);
      if (exists(container)) mutate(container, () => fs.rmSync(container, { recursive: true }));
      guard(state);
      console.log(`[${index + 1}/${plan.packages.length}] ${p.base}`);
      const archive = inspectTar(await download(p), Number(fs.statfsSync(root).bsize));
      mutate(container, () => extractTar(archive, packageDir(p), state));
      const manifest = json(path.join(packageDir(p), 'package.json'));
      assert.equal(manifest.name, p.name); assert.equal(manifest.version, p.version);
      if (p.patch) {
        guard(state, allocated(packageDir(p)) + 1048576);
        mutate(container, () => execFileSync('patch', ['--batch', '--forward', '--fuzz=0', '--no-backup-if-mismatch', '-p1', '-i', path.join(root, p.patch.path)], { cwd: packageDir(p), stdio: 'pipe' }));
      }
      save(receiptFile(p), { snapshot: p.snapshot, integrity: p.integrity, patchHash: p.patch?.sha256 || null,
        expandedBytes: archive.expandedBytes, treeSha256: treeDigest(packageDir(p)) }, state);
      guard(state); added++;
    }
    const count = plan.packages.filter(p => exists(receiptFile(p))).length;
    if (count === plan.packages.length) wire(plan, state);
    // Reconcile all directory/link overhead once, including workspace links.
    ledger = createAllocationLedger(usage(state));
    const result = { snapshots: plan.packages.length, installed: count, added, complete: count === plan.packages.length,
      planSha256: sha(fs.readFileSync(planFile)), ...guard(state) };
    save(path.join(store, 'last-install.json'), result, state);
    console.log(JSON.stringify(result, null, 2));
  } finally { fs.unlinkSync(mutex); ledger = undefined; activeLimits = undefined; }
}

function amend(args) {
  const [importer, section, name] = args;
  assert(importer && ['dependencies', 'devDependencies', 'optionalDependencies'].includes(section) && name,
    'Usage: amend IMPORTER SECTION NAME (choose an existing lock importer entry)');
  const selection = json(selectionFile);
  selection.omit = selection.omit.filter(n => n !== name);
  if (!selection.additional.some(a => a.importer === importer && a.section === section && a.name === name)) selection.additional.push({ importer, section, name });
  save(selectionFile, selection);
  generatePlan();
}

export async function main(args = process.argv.slice(2)) {
  const [command, ...rest] = args;
  if (command === 'plan') generatePlan();
  else if (command === 'install' || command === 'verify') {
    const limitArg = rest.find(x => x.startsWith('--limit='));
    const limit = limitArg ? Number(limitArg.slice(8)) : Infinity;
    assert(limit === Infinity || Number.isSafeInteger(limit) && limit >= 0, 'Invalid --limit');
    await install({ verify: command === 'verify' || rest.includes('--verify'), limit });
  } else if (command === 'amend') amend(rest);
  else if (command === 'status') console.log(JSON.stringify(usage(exists(stateFile) ? json(stateFile) : {}), null, 2));
  else throw new Error('Usage: node scripts/test-harness/profiling/shard1-deps/installer.mjs plan|install [--verify] [--limit=N]|verify|status|amend IMPORTER SECTION NAME');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
}
