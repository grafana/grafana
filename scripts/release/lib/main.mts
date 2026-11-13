import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// True when the file with this URL is the one node was started with, and false when something else imported
// it, such as a test. Scripts use it to run their real work only when started directly. Symlinks are resolved
// because node gives the module URL as the real path: comparing against a symlinked path would be false, and a
// script that does nothing and exits successfully would look like a step that worked.
export function isMainModule(moduleUrl: string, entryPoint: string | undefined = process.argv[1]): boolean {
  if (!entryPoint) {
    return false;
  }
  return fileURLToPath(moduleUrl) === realpathSync(entryPoint);
}
