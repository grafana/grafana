import { rspack, type Configuration, type OutputFileSystem, type Stats } from '@rspack/core';
import { createFsFromVolume, Volume } from 'memfs';
import path from 'node:path';

type MemFs = ReturnType<typeof createFsFromVolume>;

interface CompileResult {
  stats: Stats;
  outputFs: MemFs;
}

/** Compiles an rspack configuration with an in-memory output filesystem. */
export async function compile(config: Configuration): Promise<CompileResult> {
  const compiler = rspack(config);
  const outputFs = createFsFromVolume(new Volume());
  // memfs stat types allow bigint variants that rspack's OutputFileSystem doesn't model.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  compiler.outputFileSystem = outputFs as unknown as OutputFileSystem;

  const stats = await new Promise<Stats>((resolve, reject) => {
    compiler.run((runError, result) => {
      compiler.close((closeError) => {
        if (runError) {
          reject(runError);
          return;
        }
        if (closeError) {
          reject(closeError);
          return;
        }
        if (!result) {
          reject(new Error('Compilation produced no stats'));
          return;
        }
        if (result.hasErrors()) {
          reject(new Error(result.toString({ errors: true })));
          return;
        }
        resolve(result);
      });
    });
  });

  return { stats, outputFs };
}

/** Reads all emitted assets, recursively, keyed by path relative to the output directory. */
export function readAssets(outputFs: MemFs, outputPath: string, prefix = ''): Record<string, string> {
  const assets: Record<string, string> = {};
  for (const entry of outputFs.readdirSync(path.join(outputPath, prefix))) {
    const relativePath = path.join(prefix, String(entry));
    const stats = outputFs.statSync(path.join(outputPath, relativePath));
    if (stats.isDirectory()) {
      Object.assign(assets, readAssets(outputFs, outputPath, relativePath));
    } else {
      assets[relativePath] = outputFs.readFileSync(path.join(outputPath, relativePath), 'utf-8').toString();
    }
  }
  return assets;
}
