#!/usr/bin/env node

/**
 * Build Script for Penang CoE Salesforce Extension
 * 
 * Creates production-ready builds with:
 * - Version injection
 * - Debug info stripping (production)
 * - Manifest validation
 * - File integrity checks
 * 
 * Usage:
 *   node scripts/build.js          # Default build
 *   node scripts/build.js --dev    # Development build (keeps console.log)
 *   node scripts/build.js --prod   # Production build (strips debug)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const args = process.argv.slice(2);
const isDev = args.includes('--dev');
const isProd = args.includes('--prod');

const BUILD_MODE = isProd ? 'production' : (isDev ? 'development' : 'default');

console.log(`\n🔨 Building extension (${BUILD_MODE} mode)...\n`);

// Files and folders to include in build
const INCLUDE_FILES = [
  'manifest.json',
  'background.js',
  'content_script.js',
  'content_script_exlibris.js',
  'content_script_highlighter.js',
  'popup.html',
  'popup.js',
  'updated.html',
  'updated.js',
  'customerMasterList.json',
  'instTimezones.dsv'
];

const INCLUDE_DIRS = [
  'modules',
  'lib',
  'icons',
  'img'
];

// Files to exclude
const EXCLUDE_PATTERNS = [
  /\.map$/,
  /\.test\.js$/,
  /\.spec\.js$/,
  /node_modules/,
  /\.git/,
  /dist/,
  /archive/,
  /docs/,
  /scripts/,
  /\.md$/,
  /\.plan\.md$/,
  /package.*\.json$/
];

/**
 * Clean dist directory
 */
function cleanDist() {
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });
  console.log('✓ Cleaned dist directory');
}

/**
 * Copy file with optional transformation
 */
function copyFile(src, dest, transform = null) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  if (transform && src.endsWith('.js')) {
    let content = fs.readFileSync(src, 'utf8');
    content = transform(content, src);
    fs.writeFileSync(dest, content, 'utf8');
  } else {
    fs.copyFileSync(src, dest);
  }
}

/**
 * Copy directory recursively
 */
function copyDir(srcDir, destDir, transform = null) {
  if (!fs.existsSync(srcDir)) {
    console.warn(`⚠ Directory not found: ${srcDir}`);
    return;
  }

  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    // Check exclusions
    const shouldExclude = EXCLUDE_PATTERNS.some(pattern => pattern.test(srcPath));
    if (shouldExclude) continue;

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, transform);
    } else {
      copyFile(srcPath, destPath, transform);
    }
  }
}

/**
 * Transform JS content for production
 */
function productionTransform(content, filePath) {
  if (!isProd) return content;

  // Strip console.log (keep console.warn, console.error)
  content = content.replace(/console\.log\([^)]*\);?/g, '');
  
  // Strip debug-only blocks
  content = content.replace(/\/\/ DEBUG START[\s\S]*?\/\/ DEBUG END/g, '');
  
  // Strip single-line debug comments
  content = content.replace(/\/\/\s*DEBUG:.*$/gm, '');

  return content;
}

/**
 * Inject build info into manifest
 */
function processManifest() {
  const manifestPath = path.join(ROOT_DIR, 'manifest.json');
  const destPath = path.join(DIST_DIR, 'manifest.json');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Add build metadata (stored separately, not in manifest itself)
  const buildInfo = {
    buildDate: new Date().toISOString(),
    buildMode: BUILD_MODE,
    version: manifest.version
  };

  // Write build info
  fs.writeFileSync(
    path.join(DIST_DIR, 'build-info.json'),
    JSON.stringify(buildInfo, null, 2)
  );

  // Copy manifest as-is
  fs.writeFileSync(destPath, JSON.stringify(manifest, null, 2));
  console.log(`✓ Processed manifest.json (v${manifest.version})`);
}

/**
 * Validate the build
 */
function validateBuild() {
  const errors = [];

  // Check manifest exists
  const manifestPath = path.join(DIST_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    errors.push('manifest.json missing from build');
  }

  // Check all content scripts exist
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  for (const contentScript of manifest.content_scripts || []) {
    for (const jsFile of contentScript.js || []) {
      const filePath = path.join(DIST_DIR, jsFile);
      if (!fs.existsSync(filePath)) {
        errors.push(`Content script missing: ${jsFile}`);
      }
    }
    for (const cssFile of contentScript.css || []) {
      const filePath = path.join(DIST_DIR, cssFile);
      if (!fs.existsSync(filePath)) {
        errors.push(`CSS file missing: ${cssFile}`);
      }
    }
  }

  // Check background script
  if (manifest.background?.service_worker) {
    const bgPath = path.join(DIST_DIR, manifest.background.service_worker);
    if (!fs.existsSync(bgPath)) {
      errors.push(`Background script missing: ${manifest.background.service_worker}`);
    }
  }

  // Check web_accessible_resources
  for (const resource of manifest.web_accessible_resources || []) {
    for (const res of resource.resources || []) {
      if (!res.includes('*')) {
        const resPath = path.join(DIST_DIR, res);
        if (!fs.existsSync(resPath)) {
          errors.push(`Web accessible resource missing: ${res}`);
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ Build validation failed:');
    errors.forEach(err => console.error(`   - ${err}`));
    process.exit(1);
  }

  console.log('✓ Build validation passed');
}

/**
 * Count files in build
 */
function countBuildFiles() {
  let count = 0;
  let size = 0;

  function countDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        countDir(fullPath);
      } else {
        count++;
        size += fs.statSync(fullPath).size;
      }
    }
  }

  countDir(DIST_DIR);
  return { count, size };
}

// Main build process
try {
  cleanDist();

  // Copy individual files
  for (const file of INCLUDE_FILES) {
    const srcPath = path.join(ROOT_DIR, file);
    const destPath = path.join(DIST_DIR, file);
    if (fs.existsSync(srcPath)) {
      copyFile(srcPath, destPath, productionTransform);
      console.log(`✓ Copied ${file}`);
    } else {
      console.warn(`⚠ File not found: ${file}`);
    }
  }

  // Copy directories
  for (const dir of INCLUDE_DIRS) {
    const srcPath = path.join(ROOT_DIR, dir);
    const destPath = path.join(DIST_DIR, dir);
    if (fs.existsSync(srcPath)) {
      copyDir(srcPath, destPath, productionTransform);
      console.log(`✓ Copied ${dir}/`);
    } else {
      console.warn(`⚠ Directory not found: ${dir}`);
    }
  }

  // Process manifest
  processManifest();

  // Validate
  validateBuild();

  // Summary
  const { count, size } = countBuildFiles();
  const sizeMB = (size / (1024 * 1024)).toFixed(2);

  console.log(`\n✅ Build complete!`);
  console.log(`   Mode: ${BUILD_MODE}`);
  console.log(`   Files: ${count}`);
  console.log(`   Size: ${sizeMB} MB`);
  console.log(`   Output: ${DIST_DIR}\n`);

} catch (error) {
  console.error('\n❌ Build failed:', error);
  process.exit(1);
}

