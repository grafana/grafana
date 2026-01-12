import chalk from 'chalk';
import { globSync } from 'glob';
import minimist from 'minimist';
import { Project } from 'ts-morph';

import { generateDotContent } from './dot.ts';
import { getClass, getFile, getFunction, getName, getType, getVariable, traverse } from './helpers.ts';
import { outputToSvg, writeToFile } from './io.ts';
import type { DotNode } from './types.ts';

const argv: minimist.ParsedArgs = minimist(process.argv.slice(2));
const searchingFor = argv._[0];
const searchingIn = argv._[1];
const maxLevel = argv.level ? Number(argv.level) : 0;
const svg = Boolean(argv.svg) || false;
const debug = Boolean(argv.debug) || false;

if (!searchingFor) {
  throw new Error(chalk.red(`Did you forget to supply an argument for what we should search for?`));
}

if (!searchingIn) {
  throw new Error(chalk.red(`Did you forget to supply an argument for the file we should start from?`));
}

console.log(`ts-dependency-grapher started with:
\t- Name to look for: ${chalk.green(searchingFor)}
\t- Start in file: ${chalk.green(searchingIn)}
\t- Maximum levels to traverse: ${chalk.green(maxLevel)}
\t- Save to svg (requires Graphwiz https://graphviz.org/download/): ${chalk.green(svg)}
\t- Debug: ${chalk.green(debug)}
`);

const tsconfigs = globSync('../../**/tsconfig.json', { ignore: ['../../node_modules/**', '../../data/**'] });
if (tsconfigs.length < 1) {
  throw new Error(chalk.red(`couldn't find any tsconfig files`));
}

console.log(`creating ts project from ${chalk.green(tsconfigs[0])}`);
const project = new Project({ tsConfigFilePath: tsconfigs[0] });

for (let index = 1; index < tsconfigs.length; index++) {
  const tsconfig = tsconfigs[index];
  if (debug) {
    console.log(`Adding source files from ${chalk.green(tsconfig)}`);
  }
  project.addSourceFilesFromTsConfig(tsconfig);
}

const source = project.getSourceFileOrThrow(searchingIn);

const start = getFunction(source, searchingFor) || getVariable(source, searchingFor) || getClass(source, searchingFor);

if (!start) {
  throw new Error(`couldn't find ${chalk.red(searchingFor)} in ${chalk.red(searchingIn)}`);
}

const file = getFile(start);
const name = getName(start);
const type = getType(start, name);
const kind = start.getKindName();
const dotNode: DotNode = { dependants: [], file, kind, name, type };

traverse({ dotNode, tsObj: start, level: 0, maxLevel, debug });
const output = generateDotContent({
  parent: dotNode,
  output: '',
  seen: new Set(),
});

writeToFile(searchingFor, output);
if (svg) {
  outputToSvg(searchingFor);
}
