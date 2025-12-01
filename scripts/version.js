#!/usr/bin/env node

/**
 * Version Management Script
 * 
 * Bumps version in manifest.json and package.json
 * 
 * Usage:
 *   node scripts/version.js           # Patch bump (7.2.0 -> 7.2.1)
 *   node scripts/version.js --minor   # Minor bump (7.2.0 -> 7.3.0)
 *   node scripts/version.js --major   # Major bump (7.2.0 -> 8.0.0)
 *   node scripts/version.js --set 7.5.0  # Set specific version
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const bumpMajor = args.includes('--major');
const bumpMinor = args.includes('--minor');
const setIndex = args.indexOf('--set');
const setVersion = setIndex !== -1 ? args[setIndex + 1] : null;

/**
 * Parse version string
 */
function parseVersion(version) {
  const parts = version.split('.').map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0
  };
}

/**
 * Bump version
 */
function bumpVersion(version, type) {
  const v = parseVersion(version);
  
  switch (type) {
    case 'major':
      return `${v.major + 1}.0.0`;
    case 'minor':
      return `${v.major}.${v.minor + 1}.0`;
    case 'patch':
    default:
      return `${v.major}.${v.minor}.${v.patch + 1}`;
  }
}

/**
 * Update file with new version
 */
function updateFile(filePath, newVersion) {
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠ File not found: ${path.basename(filePath)}`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(content);
  const oldVersion = json.version;
  
  json.version = newVersion;
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
  
  console.log(`  ✓ ${path.basename(filePath)}: ${oldVersion} → ${newVersion}`);
  return true;
}

// Main
try {
  console.log('\n📌 Version Management\n');

  // Read current version from manifest
  const manifestPath = path.join(ROOT_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const currentVersion = manifest.version;

  console.log(`Current version: ${currentVersion}`);

  // Determine new version
  let newVersion;
  if (setVersion) {
    if (!/^\d+\.\d+(\.\d+)?$/.test(setVersion)) {
      throw new Error(`Invalid version format: ${setVersion}`);
    }
    newVersion = setVersion;
  } else {
    const bumpType = bumpMajor ? 'major' : (bumpMinor ? 'minor' : 'patch');
    newVersion = bumpVersion(currentVersion, bumpType);
    console.log(`Bump type: ${bumpType}`);
  }

  console.log(`New version: ${newVersion}\n`);

  // Update files
  updateFile(manifestPath, newVersion);
  updateFile(path.join(ROOT_DIR, 'package.json'), newVersion);

  console.log(`\n✅ Version updated to ${newVersion}\n`);

} catch (error) {
  console.error('\n❌ Version update failed:', error.message);
  process.exit(1);
}

