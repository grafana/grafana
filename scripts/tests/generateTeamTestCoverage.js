/**
 * Coverage Report Generator
 *
 * How to use and run this script:
 * 1. Please ensure you have run `yarn test:coverage` before running this script
 * and the most recent coverage data is available in the coverage-final.json file.
 * 2. Run `node scripts/tests/generateDataVizCoverage.js [team]`
 *    - Default team: @grafana/dataviz-squad
 *    - Example: `node scripts/tests/generateDataVizCoverage.js @grafana/frontend-ops`
 * 3. The script will generate two local CSV files:
 *    - {team}-coverage-report.csv: Shows coverage for each file
 *    - {team}-directory-coverage.csv: Shows coverage summary per directory
 * 4. For dataviz, take the directory-coverage.csv file and copy/paste the csv data into the
 * dataviz-test-coverage infinity data source (reference CSV) in https://ops.grafana-ops.net/
 * 5. Take the coverage-report.csv and copy/paste the csv data into the File Coverage
 * table panel in https://ops.grafana-ops.net/d/feevc07fh71fka/dataviz-test-coverage-report?orgId=1
 * (For steps 4 - 5, implement the same steps for your team)
 * 6. Discard both csv files
 *
 * What does this script do?
 * 1. Parses CODEOWNERS to find files owned by the specified team
 * 2. Extracts existing coverage data from coverage-final.json
 * 3. Generates a CSV report showing coverage for the team's files
 *
 * Implementation detail: We need to calculate the stats the same as Jest's test
 * coverage report, Istanbul 🚀
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Constants
const COVERAGE_PATH = path.join(process.cwd(), 'coverage', 'coverage-final.json');
const CODEOWNERS_PATH = path.join(process.cwd(), '.github', 'CODEOWNERS');

// Get team from command line arguments or use default
const DEFAULT_TEAM = '@grafana/dataviz-squad';
const team = process.argv[2] || DEFAULT_TEAM;

// Generate file paths based on team name
const teamSlug = team.replace(/[@/]/g, '').toLowerCase();
const FILE_REPORT_PATH = path.join(process.cwd(), `${teamSlug}-coverage-report.csv`);
const DIR_REPORT_PATH = path.join(process.cwd(), `${teamSlug}-directory-coverage.csv`);

/**
 * Parse CODEOWNERS file and extract patterns owned by the specified team
 * @param {string} team - The team to find patterns for (e.g. '@grafana/dataviz-squad')
 * @returns {Object} - Object with directories and patterns
 */
function getTeamPathsFromCodeowners(team) {
  if (!fs.existsSync(CODEOWNERS_PATH)) {
    console.error('CODEOWNERS file not found');
    return { directories: [], patterns: [] };
  }

  const content = fs.readFileSync(CODEOWNERS_PATH, 'utf8');
  const lines = content.split('\n');

  // Find all paths owned by the team
  const directories = [];
  const wildcardPatterns = [];

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith('#') || line.trim() === '') {
      continue;
    }

    // Check if the line contains the team
    if (line.includes(team)) {
      // Extract the path (first part of the line before the space)
      const parts = line.trim().split(/\s+/);
      if (parts.length > 0) {
        let pathPattern = parts[0];

        // Remove leading slash if present
        if (pathPattern.startsWith('/')) {
          pathPattern = pathPattern.substring(1);
        }

        // Handle different types of patterns
        if (pathPattern.includes('*')) {
          wildcardPatterns.push(pathPattern);
        } else {
          // Normalize path - remove trailing slash
          if (pathPattern.endsWith('/')) {
            pathPattern = pathPattern.slice(0, -1);
          }
          directories.push(pathPattern);
        }
      }
    }
  }

  // Remove duplicates and sort
  return {
    directories: [...new Set(directories)].sort(),
    patterns: [...new Set(wildcardPatterns)].sort(),
  };
}

/**
 * Find all source files matching the team's patterns
 * @param {Object} pathData - Object with directories and patterns from CODEOWNERS
 * @returns {string[]} - Array of source file paths
 */
function findTeamFiles(pathData) {
  const { directories, patterns } = pathData;
  const sourceFiles = [];

  // Process regular directories
  for (const directory of directories) {
    const sourcePattern = `${directory}/**/*.{ts,tsx,js,jsx}`;
    // Ignore node_modules
    const files = glob.sync(sourcePattern).filter((file) => !file.includes('node_modules'));
    sourceFiles.push(...files);
  }

  // Process wildcard patterns
  for (const pattern of patterns) {
    // Ignore node_modules
    const files = glob.sync(pattern).filter((file) => !file.includes('node_modules'));
    sourceFiles.push(...files);
  }

  // Remove duplicates and sort
  return [...new Set(sourceFiles)].sort();
}

/**
 * Read coverage data from the coverage-final.json file
 * @returns {Object|null} - Coverage data or null if not found
 */
function readCoverageFinalData() {
  if (!fs.existsSync(COVERAGE_PATH)) {
    console.error(`Coverage file not found: ${COVERAGE_PATH}, please run yarn test:coverage first`);
    return null;
  }

  try {
    const data = fs.readFileSync(COVERAGE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading coverage data: ${error.message}`);
    return null;
  }
}

/**
 * Find the matching coverage key for a file path
 * @param {Object} coverageData - The coverage data object
 * @param {string} filePath - The file path to find
 * @returns {string|null} - The matching key or null if not found
 */
function findMatchingCoverageKey(coverageData, filePath) {
  // Normalize the file path for comparison
  const normalizedFilePath = filePath.replace(/\\/g, '/');
  const cwdPath = process.cwd().replace(/\\/g, '/');

  // Try different path formats
  const pathVariations = [
    normalizedFilePath,
    normalizedFilePath.replace(cwdPath + '/', ''),
    path.relative(cwdPath, normalizedFilePath).replace(/\\/g, '/'),
    '/' + normalizedFilePath.replace(cwdPath + '/', ''),
  ];

  // Try exact matches first
  for (const pathVar of pathVariations) {
    if (coverageData[pathVar]) {
      return pathVar;
    }
  }

  // If no exact match, try to find a key that ends with our path
  const fileName = path.basename(normalizedFilePath);
  const dirPath = path.dirname(normalizedFilePath.replace(cwdPath + '/', ''));
  const coverageKeys = Object.keys(coverageData);

  // First try to match both directory and filename
  const dirMatches = coverageKeys.filter((key) => {
    const keyDir = path.dirname(key);
    return key.endsWith(fileName) && (keyDir.endsWith(dirPath) || dirPath.endsWith(keyDir));
  });

  if (dirMatches.length === 1) {
    return dirMatches[0];
  }

  // If that doesn't work, try just matching the filename
  const fileMatches = coverageKeys.filter((key) => key.endsWith('/' + fileName));

  if (fileMatches.length === 1) {
    return fileMatches[0];
  }

  // If we have multiple matches, find the best one
  if (fileMatches.length > 1) {
    // Look for the one with the most similar path
    const bestMatch = fileMatches.reduce((best, current) => {
      // Count matching path segments
      const currentSegments = current.split('/');
      const fileSegments = normalizedFilePath
        .replace(cwdPath, '')
        .split('/')
        .filter((s) => s);

      let matchCount = 0;
      for (let i = 1; i <= Math.min(currentSegments.length, fileSegments.length); i++) {
        if (currentSegments[currentSegments.length - i] === fileSegments[fileSegments.length - i]) {
          matchCount++;
        } else {
          break;
        }
      }

      // Return the one with more matching segments
      if (!best || matchCount > best.count) {
        return { key: current, count: matchCount };
      }
      return best;
    }, null);

    if (bestMatch) {
      return bestMatch.key;
    }
  }

  // Log when we can't find a match to help debugging
  console.log(`Could not find coverage data for: ${normalizedFilePath}`);
  return null;
}

/**
 * Calculate percentage with two decimal places
 * @param {number} covered - Number of covered items
 * @param {number} total - Total number of items
 * @returns {number} - Percentage with two decimal places
 */
function calculatePercentage(covered, total) {
  if (total === 0) {
    return 0;
  }
  return parseFloat(((covered / total) * 100).toFixed(2));
}

/**
 * Extract coverage summary from coverage data
 * @param {Object} fileCoverage - Coverage data for a file
 * @returns {Object} - Object with coverage summary
 */
function extractCoverageSummary(fileCoverage) {
  if (!fileCoverage) {
    return {
      statements: { total: 0, covered: 0, pct: 0 },
      functions: { total: 0, covered: 0, pct: 0 },
      branches: { total: 0, covered: 0, pct: 0 },
    };
  }

  // Initialize counters
  const summary = {
    statements: { total: 0, covered: 0, pct: 0 },
    functions: { total: 0, covered: 0, pct: 0 },
    branches: { total: 0, covered: 0, pct: 0 },
  };

  // Count statements
  if (fileCoverage.statementMap) {
    summary.statements.total = Object.keys(fileCoverage.statementMap).length;
    summary.statements.covered = Object.values(fileCoverage.s).filter((v) => v > 0).length;
  }

  // Count functions
  if (fileCoverage.fnMap) {
    summary.functions.total = Object.keys(fileCoverage.fnMap).length;
    summary.functions.covered = Object.values(fileCoverage.f).filter((v) => v > 0).length;
  }

  // Count branches - using the same approach as in the directory summary
  if (fileCoverage.branchMap && fileCoverage.b) {
    let totalBranches = 0;
    let coveredBranches = 0;

    for (const [_, branches] of Object.entries(fileCoverage.b)) {
      totalBranches += branches.length;
      coveredBranches += branches.filter((c) => c > 0).length;
    }

    summary.branches.total = totalBranches;
    summary.branches.covered = coveredBranches;
  }

  // Calculate percentages with two decimal places
  summary.statements.pct = calculatePercentage(summary.statements.covered, summary.statements.total);
  summary.functions.pct = calculatePercentage(summary.functions.covered, summary.functions.total);
  summary.branches.pct = calculatePercentage(summary.branches.covered, summary.branches.total);

  return summary;
}

/**
 * Check if a file is a test file
 * @param {string} filePath - File path to check
 * @returns {boolean} - True if it's a test file
 */
function isTestFile(filePath) {
  return filePath.includes('.test.') || filePath.includes('.spec.');
}

/**
 * Get relative path from absolute path
 * @param {string} filePath - Absolute file path
 * @returns {string} - Relative path
 */
function getRelativePath(filePath) {
  return filePath.replace(process.cwd() + '/', '');
}

/**
 * Generate CSV report from coverage data
 * @param {Object} coverageData - Coverage data from coverage-final.json
 * @param {string[]} teamFiles - Array of team file paths
 * @returns {string} - CSV formatted coverage data
 */
function generateCSVReport(coverageData, teamFiles) {
  if (!coverageData) {
    console.error('No coverage data available');
    return '';
  }

  // Define CSV headers
  const headers = [
    'SourceFile',
    'SourcePath',
    'Statement Coverage (%)',
    'Function Coverage (%)',
    'Branch Coverage (%)',
  ];

  // Create rows for each team file
  const rows = [headers.join(',')];

  // Process each team file
  for (const filePath of teamFiles) {
    // Skip test files
    if (isTestFile(filePath)) {
      continue;
    }

    const relativePath = getRelativePath(filePath);
    const sourceFileName = path.basename(filePath);
    const coverageKey = findMatchingCoverageKey(coverageData, filePath);

    if (coverageKey) {
      const coverage = extractCoverageSummary(coverageData[coverageKey]);
      rows.push(
        [sourceFileName, relativePath, coverage.statements.pct, coverage.functions.pct, coverage.branches.pct].join(',')
      );
    } else {
      // If no coverage data is found, we'll show 0% for all coverage metrics
      rows.push([sourceFileName, relativePath, 0, 0, 0].join(','));
    }
  }

  return rows.join('\n');
}

/**
 * Generate a directory-level summary report
 * @param {Object} coverageData - Coverage data from coverage-final.json
 * @param {string[]} teamFiles - Array of team file paths
 * @returns {string} - CSV formatted directory summary
 */
function generateDirectorySummaryReport(coverageData, teamFiles) {
  if (!coverageData) {
    console.error('No coverage data available');
    return '';
  }

  // Define CSV headers
  const headers = [
    'Directory',
    'FileCount',
    'FilesWithCoverage',
    'Statement Coverage (%)',
    'Function Coverage (%)',
    'Branch Coverage (%)',
  ];

  // Group files by directory
  const directorySummary = new Map();

  // Process each team file
  for (const filePath of teamFiles) {
    // Skip test files
    if (isTestFile(filePath)) {
      continue;
    }

    const relativePath = getRelativePath(filePath);
    const dirPath = path.dirname(relativePath);

    // Initialize directory entry if it doesn't exist
    if (!directorySummary.has(dirPath)) {
      directorySummary.set(dirPath, {
        fileCount: 0,
        filesWithCoverage: 0,
        statements: { total: 0, covered: 0 },
        functions: { total: 0, covered: 0 },
        branches: { total: 0, covered: 0 },
      });
    }

    // Update directory summary
    const dirSummary = directorySummary.get(dirPath);
    dirSummary.fileCount++;

    const coverageKey = findMatchingCoverageKey(coverageData, filePath);

    if (coverageKey) {
      dirSummary.filesWithCoverage++;

      // Get the raw coverage data
      const fileCoverage = coverageData[coverageKey];

      // Count statements
      if (fileCoverage.statementMap) {
        dirSummary.statements.total += Object.keys(fileCoverage.statementMap).length;
        dirSummary.statements.covered += Object.values(fileCoverage.s).filter((v) => v > 0).length;
      }

      // Count functions
      if (fileCoverage.fnMap) {
        dirSummary.functions.total += Object.keys(fileCoverage.fnMap).length;
        dirSummary.functions.covered += Object.values(fileCoverage.f).filter((v) => v > 0).length;
      }

      // Count branches
      if (fileCoverage.branchMap && fileCoverage.b) {
        for (const [_, branches] of Object.entries(fileCoverage.b)) {
          dirSummary.branches.total += branches.length;
          dirSummary.branches.covered += branches.filter((c) => c > 0).length;
        }
      }
    }
  }

  // Create rows for the CSV
  const rows = [headers.join(',')];

  // Calculate percentages and create rows
  for (const [dirPath, summary] of directorySummary.entries()) {
    const stmtPct = calculatePercentage(summary.statements.covered, summary.statements.total);
    const fnPct = calculatePercentage(summary.functions.covered, summary.functions.total);
    const branchPct = calculatePercentage(summary.branches.covered, summary.branches.total);

    rows.push([dirPath, summary.fileCount, summary.filesWithCoverage, stmtPct, fnPct, branchPct].join(','));
  }

  return rows.join('\n');
}

/**
 * Save CSV data to a file
 * @param {string} csvData - CSV data to save
 * @param {string} filePath - Path to save the file
 */
function saveCSVToFile(csvData, filePath) {
  try {
    fs.writeFileSync(filePath, csvData);
    console.log(`Report saved to: ${filePath}`);
  } catch (error) {
    console.error(`Error saving CSV to ${filePath}: ${error.message}`);
  }
}

/**
 * Main function to generate coverage report
 */
function generateCoverageReport() {
  console.log(`Generating coverage report for team: ${team}`);

  // 1. Get team paths from CODEOWNERS
  const pathData = getTeamPathsFromCodeowners(team);

  // 2. Find all team files
  const teamFiles = findTeamFiles(pathData);

  if (teamFiles.length === 0) {
    console.error(`No files found for team: ${team}`);
    process.exit(1);
  }

  console.log(`Found ${teamFiles.length} files owned by ${team}`);

  // 3. Read coverage data
  const coverageData = readCoverageFinalData();

  if (!coverageData) {
    console.error('No coverage data available. Please run tests with coverage first.');
    process.exit(1);
  }

  // 4. Generate file-level CSV report
  const csvReport = generateCSVReport(coverageData, teamFiles);

  // 5. Generate directory-level summary report
  const dirSummaryReport = generateDirectorySummaryReport(coverageData, teamFiles);

  // 6. Save the CSV reports
  saveCSVToFile(csvReport, FILE_REPORT_PATH);
  saveCSVToFile(dirSummaryReport, DIR_REPORT_PATH);

  console.log('\nCoverage report generation complete!');
}

// Run the main function
generateCoverageReport();
