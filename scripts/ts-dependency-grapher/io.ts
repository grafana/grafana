import chalk from 'chalk';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function getOutputPath() {
  return path.join(process.cwd(), 'out');
}

function getFilePath(name: string) {
  return path.join(getOutputPath(), name);
}

export function writeToFile(name: string, output: string) {
  const outputPath = getOutputPath();
  if (!existsSync(outputPath)) {
    mkdirSync(outputPath);
  }

  const filePath = getFilePath(`${name}.gv`);
  writeFileSync(filePath, output, { encoding: 'utf8' });
  console.log(`dot file ${chalk.green(filePath)} successfully created`);
}

export function outputToSvg(name: string) {
  try {
    const input = getFilePath(`${name}.gv`);
    const output = getFilePath(`${name}.svg`);
    const svgoutput = execFileSync('dot', ['-Tsvg', input], { encoding: 'utf8' });
    writeFileSync(output, svgoutput, { encoding: 'utf-8' });
    console.log(`svg file ${chalk.green(output)} successfully created`);
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 1) {
      return;
    }
    throw error;
  }
}
