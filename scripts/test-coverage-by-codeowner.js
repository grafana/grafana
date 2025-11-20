#!/usr/bin/env node

const { AutoComplete } = require('enquirer');
const cp = require('node:child_process');
const { hideBin } = require('yargs/helpers');
const yargs = require('yargs/yargs');

const { getCodeowners } = require('./codeowners-manifest/utils.js');

const JEST_CONFIG_PATH = 'jest.config.codeowner.js';

async function promptCodeownerName() {
  const teams = await getCodeowners();
  const prompt = new AutoComplete({
    name: 'flavor',
    message: 'Select your team to run tests by codeowner.',
    limit: 10,
    choices: teams.filter((team) => team.startsWith('@grafana/')),
  });
  return await prompt.run();
}

/**
 * Run test coverage for a specific codeowner
 * @param {string} codeownerName - The codeowner name to run coverage for
 * @param {boolean} noOpen - Whether to skip opening the coverage report in the browser
 */
async function runTestCoverageByCodeowner(codeownerName, noOpen = process.env.CI === 'true') {
  const teams = await getCodeowners();
  if (!teams.includes(codeownerName)) {
    throw new Error(`Codeowner "${codeownerName}" was not found.`);
  }

  process.env.CODEOWNER_NAME = codeownerName;
  process.env.SHOULD_OPEN_COVERAGE_REPORT = String(!noOpen);

  return new Promise((resolve, reject) => {
    const child = cp.spawn('jest', [`--config=${JEST_CONFIG_PATH}`], {
      stdio: 'inherit',
      shell: true,
    });

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
      if (codeownerName != null && !teams.includes(codeownerName)) {
        const msg = `Codeowner "${codeownerName}" was not found.`;
        codeownerName = null;
        if (process.env.CI === 'true') {
          throw new Error(msg);
        } else {
          console.warn(`⚠️ ${msg}`);
        }
      }

      if (!codeownerName) {
        codeownerName = await promptCodeownerName();
      }

      const noOpen = argv['open'] === false;

      console.log(`🧪 Running test coverage for codeowner: ${codeownerName}`);
      await runTestCoverageByCodeowner(codeownerName, noOpen);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  })();
}

module.exports = { runTestCoverageByCodeowner };
