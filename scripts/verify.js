#!/usr/bin/env node
/**
 * Data Verification Script for Apprenticeship Ratio Requirements
 *
 * Validates data files for integrity, completeness, and quality.
 *
 * Usage: npm run verify
 *        npm run verify -- --verbose
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const CONFIG = {
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  json: process.argv.includes('--json'),
};

// Expected US states + DC
const EXPECTED_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA',
  'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY'
];

const results = {
  passed: 0,
  warnings: 0,
  errors: 0,
  details: []
};

function log(message) {
  if (!CONFIG.json) console.log(message);
}

function pass(check) {
  results.passed++;
  if (CONFIG.verbose) log(`  \u2713 ${check}`);
}

function warn(check, details = '') {
  results.warnings++;
  results.details.push({ type: 'warning', check, details });
  log(`  \u26a0 WARNING: ${check}${details ? ` - ${details}` : ''}`);
}

function fail(check, details = '') {
  results.errors++;
  results.details.push({ type: 'error', check, details });
  log(`  \u2717 ERROR: ${check}${details ? ` - ${details}` : ''}`);
}

function validateIndexFile() {
  log('\n--- Validating index.json ---');

  const indexPath = path.join(DATA_DIR, 'index.json');

  if (!fs.existsSync(indexPath)) {
    fail('index.json exists', 'File not found');
    return null;
  }
  pass('index.json exists');

  let index;
  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    index = JSON.parse(content);
  } catch (e) {
    fail('index.json is valid JSON', e.message);
    return null;
  }
  pass('index.json is valid JSON');

  if (!index.lastUpdated) {
    fail('index.json has lastUpdated field');
  } else {
    const date = new Date(index.lastUpdated);
    if (isNaN(date.getTime())) {
      fail('lastUpdated is valid date', index.lastUpdated);
    } else {
      pass('lastUpdated is valid date');
    }
  }

  if (!index.states || typeof index.states !== 'object') {
    fail('index.json has states object');
    return null;
  }
  pass('index.json has states object');

  const indexStates = Object.keys(index.states);
  const missingStates = EXPECTED_STATES.filter(s => !indexStates.includes(s));

  if (missingStates.length > 0) {
    warn('All expected states present', `Missing: ${missingStates.join(', ')}`);
  } else {
    pass(`All ${EXPECTED_STATES.length} expected states present`);
  }

  return index;
}

function validateStateFile(stateCode, indexEntry) {
  const filePath = path.join(DATA_DIR, `${stateCode}.json`);
  const issues = [];

  if (!fs.existsSync(filePath)) {
    fail(`${stateCode}.json exists`);
    return null;
  }

  let data;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    data = JSON.parse(content);
  } catch (e) {
    fail(`${stateCode}.json is valid JSON`, e.message);
    return null;
  }

  // Validate structure
  if (data.state !== stateCode) {
    issues.push(`State code mismatch: ${data.state} vs ${stateCode}`);
  }

  if (!data.stateName) {
    issues.push('Missing stateName');
  }

  if (!['SAA', 'OA'].includes(data.agencyType)) {
    issues.push(`Invalid agencyType: ${data.agencyType}`);
  }

  if (typeof data.hasPublicWorksRequirement !== 'boolean') {
    issues.push('Missing or invalid hasPublicWorksRequirement');
  }

  // If has requirement, validate requirement object
  if (data.hasPublicWorksRequirement && data.requirement) {
    const req = data.requirement;
    if (!req.requirementType) issues.push('Missing requirement.requirementType');
    if (!req.ratioDescription) issues.push('Missing requirement.ratioDescription');
    if (!req.statute) issues.push('Missing requirement.statute');
    if (!req.statuteUrl) issues.push('Missing requirement.statuteUrl');
    if (req.statuteUrl && !req.statuteUrl.startsWith('http')) {
      issues.push(`Invalid statute URL: ${req.statuteUrl}`);
    }
  }

  if (data.hasPublicWorksRequirement && !data.requirement) {
    issues.push('hasPublicWorksRequirement is true but no requirement object');
  }

  if (!data.lastVerified) {
    issues.push('Missing lastVerified date');
  }

  // Report findings
  if (issues.length > 0) {
    for (const issue of issues.slice(0, 5)) {
      warn(`${stateCode}`, issue);
    }
    if (issues.length > 5) {
      warn(`${stateCode}`, `...and ${issues.length - 5} more issues`);
    }
  } else {
    pass(`${stateCode}.json structure is valid`);
  }

  return { issues: issues.length, hasReq: data.hasPublicWorksRequirement };
}

function validateSearchIndex() {
  log('\n--- Validating Search Index ---');

  const searchIndexPath = path.join(__dirname, '..', 'web', 'public', 'search-index.json');

  if (!fs.existsSync(searchIndexPath)) {
    warn('search-index.json exists', 'Run build-search-index.js to generate');
    return;
  }
  pass('search-index.json exists');

  try {
    const content = fs.readFileSync(searchIndexPath, 'utf-8');
    const index = JSON.parse(content);

    if (!Array.isArray(index)) {
      fail('search-index.json is an array');
      return;
    }
    pass(`search-index.json has ${index.length} entries`);
  } catch (e) {
    fail('search-index.json is valid JSON', e.message);
  }
}

function generateReport(stateStats) {
  let statesWithReq = 0;
  let statesWithIssues = 0;

  for (const [, stats] of Object.entries(stateStats)) {
    if (stats) {
      if (stats.hasReq) statesWithReq++;
      if (stats.issues > 0) statesWithIssues++;
    }
  }

  if (CONFIG.json) {
    const report = {
      timestamp: new Date().toISOString(),
      status: results.errors > 0 ? 'failed' : results.warnings > 0 ? 'passed_with_warnings' : 'passed',
      summary: {
        states: Object.keys(stateStats).length,
        statesWithRequirements: statesWithReq,
        statesWithIssues
      },
      results: { passed: results.passed, warnings: results.warnings, errors: results.errors },
      details: results.details
    };
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = results.errors > 0 ? 1 : 0;
    return;
  }

  log('\n========================================');
  log('         VERIFICATION SUMMARY');
  log('========================================\n');
  log(`Data Coverage:`);
  log(`  States: ${Object.keys(stateStats).length}`);
  log(`  States with Requirements: ${statesWithReq}`);
  log(`  States with Issues: ${statesWithIssues}`);
  log(`\nVerification Results:`);
  log(`  \u2713 Passed: ${results.passed}`);
  log(`  \u26a0 Warnings: ${results.warnings}`);
  log(`  \u2717 Errors: ${results.errors}`);

  log('\n----------------------------------------');
  if (results.errors > 0) {
    log('\u2717 VERIFICATION FAILED');
    process.exitCode = 1;
  } else if (results.warnings > 0) {
    log('\u26a0 VERIFICATION PASSED WITH WARNINGS');
  } else {
    log('\u2713 VERIFICATION PASSED');
  }
  log('----------------------------------------\n');
}

async function main() {
  log('========================================');
  log('  Apprenticeship Ratios Verification');
  log('========================================');
  log(`Data directory: ${DATA_DIR}`);

  const index = validateIndexFile();
  if (!index) {
    log('\nCannot continue without valid index.json');
    process.exitCode = 1;
    return;
  }

  log('\n--- Validating State Files ---');
  const stateStats = {};

  for (const [stateCode] of Object.entries(index.states)) {
    stateStats[stateCode] = validateStateFile(stateCode, index.states[stateCode]);
  }

  validateSearchIndex();
  generateReport(stateStats);
}

main().catch(err => {
  console.error('Verification script failed:', err);
  process.exitCode = 1;
});
