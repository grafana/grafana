import fs from 'fs';
import process from 'process';
import os from 'os';
import path from 'path';
import { glob } from 'glob';
import { SOURCE_DIR } from './constants';

export function isWSL() {
  if (process.platform !== 'linux') {
    return false;
  }

  if (os.release().toLowerCase().includes('microsoft')) {
    return true;
  }

  try {
    return fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
  } catch {
    return false;
  }
}

export function getPackageJson() {
  return require(path.resolve(process.cwd(), 'package.json'));
}

export function getPluginJson(pdir: string) {
  return require(path.resolve(process.cwd(), pdir, `${SOURCE_DIR}/plugin.json`));
}

export function hasReadme() {
  return fs.existsSync(path.resolve(process.cwd(), SOURCE_DIR, 'README.md'));
}

// Support bundling nested plugins by finding all plugin.json files in src directory
// then checking for a sibling module.[jt]sx? file.
export async function getEntries(pdir: string): Promise<Record<string, string>> {
  const pluginsJson = await glob(path.resolve(pdir, '**/src/**/plugin.json'), { absolute: true });

  const plugins = await Promise.all(
    pluginsJson.map((pluginJson) => {
      const folder = path.dirname(pluginJson);
      return glob(`${folder}/module.{ts,tsx,js,jsx}`, { absolute: true });
    })
  );

  return plugins.reduce((result, modules) => {
    return modules.reduce((result: { [s: string]: string }, module) => {
      result['module'] = module;
      return result;
    }, result);
  }, {});
}
