#!/usr/bin/env node

/**
 * Clean Script
 * 
 * Removes build artifacts and temporary files
 * 
 * Usage:
 *   node scripts/clean.js         # Clean dist/
 *   node scripts/clean.js --all   # Clean dist/ and releases/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const cleanAll = args.includes('--all');

console.log('\n🧹 Cleaning build artifacts...\n');

const dirsToClean = ['dist'];
if (cleanAll) {
  dirsToClean.push('releases');
}

for (const dir of dirsToClean) {
  const dirPath = path.join(ROOT_DIR, dir);
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`  ✓ Removed ${dir}/`);
  } else {
    console.log(`  ℹ ${dir}/ not found (already clean)`);
  }
}

console.log('\n✅ Clean complete!\n');

