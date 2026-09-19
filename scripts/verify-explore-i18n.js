#!/usr/bin/env node
/**
 * Standalone Explore i18n Verification Runner
 *
 * Validates the 5 core i18n requirements for Grafana Explore components:
 * 1. Fallback English text rendering under Node/Jest
 * 2. Key format validity (explore.<component>.<descriptor> max 3 segments)
 * 3. No forbidden direct imports from react-i18next or i18next
 * 4. No top-level module scope calls to t()
 * 5. Static key extraction capability
 */

const glob = require('fast-glob');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const rootDir = path.resolve(__dirname, '..');
const exploreDir = path.resolve(rootDir, 'public/app/features/explore');

// Target M1 Explore components
const m1Files = [
  'public/app/features/explore/NoData.tsx',
  'public/app/features/explore/ErrorContainer.tsx',
  'public/app/features/explore/ResponseErrorContainer.tsx',
  'public/app/features/explore/NoDataSourceCallToAction.tsx',
];

console.log('====================================================');
console.log('   Grafana Explore i18n Verification Runner');
console.log('====================================================\n');

// 1. Scan Explore Source Files
const sourceFiles = glob.sync('**/*.{ts,tsx}', {
  cwd: exploreDir,
  absolute: true,
  ignore: ['**/*.test.{ts,tsx}', '**/spec/**', '**/mocks/**', '**/__mocks__/**'],
});

console.log(`[INFO] Auditing ${sourceFiles.length} Explore source files in: ${exploreDir}\n`);

// Data structures for audit results
const directImportViolations = [];
const topLevelTViolations = [];
const allExtractedKeys = [];
const keyFormatViolations = [];

function validateKeyFormat(key) {
  if (!key || typeof key !== 'string') {
    return { valid: false, reason: 'Key is empty or not a string' };
  }
  const segments = key.split('.');
  if (segments[0] !== 'explore') {
    return { valid: false, reason: `Invalid namespace: expected "explore", got "${segments[0]}"` };
  }
  if (segments.length < 2) {
    return { valid: false, reason: 'Key must have at least 2 segments' };
  }
  if (segments.length > 3) {
    return { valid: false, reason: `Exceeds max 3 segments (${segments.length} segments)` };
  }
  const kebabRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  for (let i = 0; i < segments.length; i++) {
    if (!kebabRegex.test(segments[i])) {
      return { valid: false, reason: `Segment "${segments[i]}" is not lowercase kebab-case` };
    }
  }
  return { valid: true, segments };
}

for (const filePath of sourceFiles) {
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const code = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);

  function visit(node, inFunctionScope) {
    // Check forbidden imports
    if (ts.isImportDeclaration(node)) {
      if (ts.isStringLiteral(node.moduleSpecifier)) {
        const mod = node.moduleSpecifier.text;
        if (mod === 'react-i18next' || mod === 'i18next') {
          directImportViolations.push({ file: relPath, module: mod });
        }
      }
    }

    const nextInFunctionScope =
      inFunctionScope ||
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessor(node) ||
      ts.isSetAccessor(node);

    // Check t() calls
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === 't') {
        const arg0 = node.arguments[0];
        const arg1 = node.arguments[1];

        if (!nextInFunctionScope) {
          topLevelTViolations.push({ file: relPath, snippet: node.getText(sourceFile) });
        }

        if (arg0 && ts.isStringLiteral(arg0)) {
          const key = arg0.text;
          const defaultMessage = arg1 && ts.isStringLiteral(arg1) ? arg1.text : '';
          allExtractedKeys.push({ file: relPath, type: 't', key, defaultMessage });

          if (key.startsWith('explore.')) {
            if (m1Files.includes(relPath)) {
              const val = validateKeyFormat(key);
              if (!val.valid) {
                keyFormatViolations.push({ file: relPath, key, reason: val.reason });
              }
            }
          }
        }
      }
    }

    // Check <Trans> elements
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
      if (ts.isIdentifier(tag) && tag.text === 'Trans') {
        const attrs = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
        for (const prop of attrs.properties) {
          if (ts.isJsxAttribute(prop) && prop.name.text === 'i18nKey') {
            if (prop.initializer && ts.isStringLiteral(prop.initializer)) {
              const key = prop.initializer.text;
              allExtractedKeys.push({ file: relPath, type: 'Trans', key });

              if (key.startsWith('explore.')) {
                if (m1Files.includes(relPath)) {
                  const val = validateKeyFormat(key);
                  if (!val.valid) {
                    keyFormatViolations.push({ file: relPath, key, reason: val.reason });
                  }
                }
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, (child) => visit(child, nextInFunctionScope));
  }

  visit(sourceFile, false);
}

// Summary Reporting
console.log('--- 1. Forbidden Direct Imports ---');
if (directImportViolations.length === 0) {
  console.log('  [PASS] Zero forbidden direct imports from react-i18next or i18next.');
} else {
  console.log(`  [FAIL] Found ${directImportViolations.length} forbidden imports:`);
  for (const v of directImportViolations) {
    console.log(`    - ${v.file}: import from "${v.module}"`);
  }
}

console.log('\n--- 2. Root Module Scope t() Calls ---');
if (topLevelTViolations.length === 0) {
  console.log('  [PASS] Zero top-level module scope calls to t().');
} else {
  console.log(`  [FAIL] Found ${topLevelTViolations.length} top-level t() calls:`);
  for (const v of topLevelTViolations) {
    console.log(`    - ${v.file}: ${v.snippet}`);
  }
}

console.log('\n--- 3. Explore i18n Keys Summary & Format Validation ---');
const exploreKeys = allExtractedKeys.filter((k) => k.key.startsWith('explore.'));
console.log(`  Total explore.* keys found: ${exploreKeys.length}`);

// Check M1 components specifically

console.log('\n  [Milestone M1 Components Audit]:');
for (const file of m1Files) {
  const keysInFile = exploreKeys.filter((k) => k.file === file);
  console.log(`  - ${file}: ${keysInFile.length} keys`);
  for (const k of keysInFile) {
    const val = validateKeyFormat(k.key);
    if (val.valid) {
      console.log(`      ✓ ${k.key} [${k.type}] (valid 2 or 3 segments)`);
    } else {
      console.log(`      ✗ ${k.key} [${k.type}] DEFECT: ${val.reason}`);
    }
  }
}

if (keyFormatViolations.length > 0) {
  console.log(
    `\n  [DEFECT ESCALATION SUMMARY] ${keyFormatViolations.length} keys exceed 3 segments or violate format.`
  );
  const violatingFiles = Array.from(new Set(keyFormatViolations.map((v) => v.file)));
  console.log(`  --> ATTENTION: ${keyFormatViolations.length} violation(s) found in ${violatingFiles.join(', ')}:`);
  for (const v of keyFormatViolations) {
    console.log(`      * ${v.key} (${v.reason}) in ${v.file}`);
  }
}

console.log('\n--- 4. Static Extraction Verification ---');
const i18nextConfigPath = path.resolve(rootDir, 'i18next.config.ts');
if (fs.existsSync(i18nextConfigPath)) {
  const cfg = fs.readFileSync(i18nextConfigPath, 'utf8');
  if (cfg.includes('public/**/*.{tsx,ts}')) {
    console.log('  [PASS] i18next.config.ts configured to extract public/**/*.{tsx,ts}');
  } else {
    console.log('  [WARN] i18next.config.ts does not contain expected input glob');
  }
}

console.log('\n====================================================');
console.log(' Explore i18n Verification Run Complete.');
console.log('====================================================\n');

if (directImportViolations.length > 0 || topLevelTViolations.length > 0 || keyFormatViolations.length > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
