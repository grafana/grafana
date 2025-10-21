#!/usr/bin/env node

const { AutoComplete } = require('enquirer');
const cp = require('node:child_process');
const { readFile } = require('node:fs/promises');
const { hideBin } = require('yargs/helpers');
const yargs = require('yargs/yargs');

const { CODEOWNERS_JSON_PATH: CODEOWNERS_MANIFEST_CODEOWNERS_PATH } = require('./codeowners-manifest/constants.js');

const JEST_CONFIG_PATH = 'jest.config.codeowner.js';

const ALL_OPTION = 'All (not recommended)';

let _codeownersCache = null;
async function getCodeowners() {
  if (_codeownersCache == null) {
    try {
      const codeownersJson = await readFile(CODEOWNERS_MANIFEST_CODEOWNERS_PATH, 'utf8');
      _codeownersCache = JSON.parse(codeownersJson);
    } catch (e) {
      if (e.code === 'ENOENT') {
        console.error(`Could not read ${CODEOWNERS_MANIFEST_CODEOWNERS_PATH} ...`);
      } else {
        console.error(e);
      }
      process.exit(1);
    }
  }
  return _codeownersCache;
}

async function promptCodeownerName(initial) {
  const teams = await getCodeowners();
  const prompt = new AutoComplete({
    name: 'flavor',
    message: 'Select your team to run tests by codeowner.',
    initial,
    limit: 10,
    initial: 2,
    choices: [ALL_OPTION, ...teams.filter((team) => team.startsWith('@grafana/'))],
  });
  return await prompt.run();
}

/**
 * Run test coverage for a specific codeowner
 * @param {string} codeownerName - The codeowner name to run coverage for
 * @param {string} codeownersPath - Path to the teams.json file
 * @param {string} jestConfigPath - Path to the Jest config file
 * @param {boolean} noOpen - Whether to skip opening the coverage report in the browser
 */
async function runTestCoverageByCodeowner(
  codeownerName,
  codeownersPath,
  jestConfigPath,
  noOpen = process.env.CI === 'true'
) {
  const codeownersJson = await readFile(codeownersPath, 'utf8');
  const codeowners = JSON.parse(codeownersJson);

  if (!codeowners.includes(codeownerName)) {
    throw new Error(`Codeowner ${codeownerName} was not found in ${codeownersPath}, check spelling`);
  }

  process.env.TEAM_NAME = codeownerName;
  process.env.SHOULD_OPEN_COVERAGE_REPORT = String(!noOpen);

  return new Promise((resolve, reject) => {
    const child = cp.spawn('jest', [`--config=${jestConfigPath}`], { stdio: 'inherit', shell: true });

    child.on('error', (error) => {
      reject(new Error(`Failed to start Jest: ${error.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Jest exited with code ${code}`));
      }
    });
  });
}

if (require.main === module) {
  (async () => {
    try {
      const argv = yargs(hideBin(process.argv)).parse();
      const teams = await getCodeowners();
      let codeownerName = argv._[0];
      if (!codeownerName || !teams.includes(codeownerName)) {
        codeownerName = await promptCodeownerName(codeownerName);
      }

      const noOpen = argv['open'] === false;

      console.log(`🧪 Running test coverage for codeowner: ${codeownerName}`);
      await runTestCoverageByCodeowner(codeownerName, JEST_CONFIG_PATH, noOpen);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  })();
}

module.exports = { runTestCoverageByCodeowner };
