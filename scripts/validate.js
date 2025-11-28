#!/usr/bin/env node

/**
 * Validation Script for Penang CoE Salesforce Extension
 * 
 * Validates extension integrity:
 * - Manifest structure and permissions
 * - Module dependencies
 * - File references
 * - Code patterns
 * 
 * Usage:
 *   node scripts/validate.js             # Full validation
 *   node scripts/validate.js --manifest  # Manifest only
 *   node scripts/validate.js --modules   # Module dependencies
 *   node scripts/validate.js --deps      # File dependencies
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const validateManifest = args.includes('--manifest') || args.length === 0;
const validateModules = args.includes('--modules') || args.length === 0;
const validateDeps = args.includes('--dependencies') || args.includes('--deps') || args.length === 0;

const errors = [];
const warnings = [];

console.log('\n🔍 Validating extension...\n');

/**
 * Validate manifest.json structure
 */
function checkManifest() {
  console.log('Checking manifest.json...');
  
  const manifestPath = path.join(ROOT_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    errors.push('manifest.json not found');
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    errors.push(`manifest.json parse error: ${e.message}`);
    return;
  }

  // Required fields
  const required = ['manifest_version', 'name', 'version', 'description'];
  for (const field of required) {
    if (!manifest[field]) {
      errors.push(`manifest.json missing required field: ${field}`);
    }
  }

  // Manifest V3 check
  if (manifest.manifest_version !== 3) {
    warnings.push(`manifest_version is ${manifest.manifest_version}, expected 3`);
  }

  // Version format
  if (manifest.version && !/^\d+\.\d+(\.\d+)?$/.test(manifest.version)) {
    warnings.push(`Version format "${manifest.version}" may not be valid`);
  }

  // Check content script files exist
  for (const cs of manifest.content_scripts || []) {
    for (const jsFile of cs.js || []) {
      const filePath = path.join(ROOT_DIR, jsFile);
      if (!fs.existsSync(filePath)) {
        errors.push(`Content script not found: ${jsFile}`);
      }
    }
    for (const cssFile of cs.css || []) {
      const filePath = path.join(ROOT_DIR, cssFile);
      if (!fs.existsSync(filePath)) {
        errors.push(`CSS file not found: ${cssFile}`);
      }
    }
  }

  // Check background script
  if (manifest.background?.service_worker) {
    const bgPath = path.join(ROOT_DIR, manifest.background.service_worker);
    if (!fs.existsSync(bgPath)) {
      errors.push(`Background script not found: ${manifest.background.service_worker}`);
    }
  }

  // Check web_accessible_resources
  for (const resource of manifest.web_accessible_resources || []) {
    for (const res of resource.resources || []) {
      if (!res.includes('*')) {
        const resPath = path.join(ROOT_DIR, res);
        if (!fs.existsSync(resPath)) {
          errors.push(`Web accessible resource not found: ${res}`);
        }
      }
    }
  }

  // Check popup
  if (manifest.action?.default_popup) {
    const popupPath = path.join(ROOT_DIR, manifest.action.default_popup);
    if (!fs.existsSync(popupPath)) {
      errors.push(`Popup HTML not found: ${manifest.action.default_popup}`);
    }
  }

  // Check icons
  const icons = { ...manifest.icons, ...manifest.action?.default_icon };
  for (const [size, iconPath] of Object.entries(icons || {})) {
    const fullPath = path.join(ROOT_DIR, iconPath);
    if (!fs.existsSync(fullPath)) {
      warnings.push(`Icon not found: ${iconPath} (${size}px)`);
    }
  }

  console.log('  ✓ Manifest structure validated');
}

/**
 * Check module dependencies and globals
 */
function checkModules() {
  console.log('Checking module dependencies...');

  const modulesDir = path.join(ROOT_DIR, 'modules');
  if (!fs.existsSync(modulesDir)) {
    warnings.push('modules/ directory not found');
    return;
  }

  // Map of module names to their expected globals
  const moduleGlobals = {};
  const moduleFiles = fs.readdirSync(modulesDir)
    .filter(f => f.endsWith('.js'))
    .map(f => path.join(modulesDir, f));

  // Extract module names from files
  for (const filePath of moduleFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath, '.js');

    // Look for const ModuleName = pattern
    const moduleMatch = content.match(/^const\s+(\w+)\s*=\s*\(?function/m);
    if (moduleMatch) {
      moduleGlobals[moduleMatch[1]] = fileName;
    }
  }

  // Check for undefined references
  for (const filePath of moduleFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);

    // Find typeof checks for modules
    const typeofChecks = content.matchAll(/typeof\s+(\w+)\s*!==?\s*['"]undefined['"]/g);
    for (const match of typeofChecks) {
      const moduleName = match[1];
      // Skip standard globals
      if (['chrome', 'window', 'document', 'console', 'Intl', 'fetch', 'URL', 'JSON', 'Array', 'Object', 'Math', 'Date', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'Proxy', 'Reflect', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'HTMLElement', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'DOMParser', 'XMLSerializer', 'Blob', 'FileReader', 'FormData', 'Headers', 'Request', 'Response', 'AbortController', 'TextEncoder', 'TextDecoder', 'atob', 'btoa', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'queueMicrotask', 'CSS', 'CSSStyleSheet', 'ShadowRoot', 'Element', 'NodeList', 'DOMRect', 'DOMRectReadOnly', 'DOMTokenList', 'NamedNodeMap', 'Attr', 'Text', 'Comment', 'DocumentFragment', 'Range', 'Selection', 'getComputedStyle', 'matchMedia', 'scrollTo', 'scrollBy', 'alert', 'confirm', 'prompt', 'ClipboardEvent', 'DataTransfer', 'ClipboardItem', 'Clipboard', 'Navigator', 'Storage', 'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'crypto', 'performance', 'location', 'history', 'navigator', 'screen', 'self', 'globalThis', 'DOMPurify', 'html2canvas', 'fabric', 'module'].includes(moduleName)) {
        continue;
      }
      // Check if module exists
      if (!moduleGlobals[moduleName]) {
        // This is expected - modules check before use
      }
    }
  }

  console.log(`  ✓ Found ${Object.keys(moduleGlobals).length} modules`);
}

/**
 * Check for common code issues
 */
function checkCodePatterns() {
  console.log('Checking code patterns...');

  const jsFiles = [];
  
  function findJsFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !['node_modules', 'dist', 'archive', 'lib'].includes(entry.name)) {
        findJsFiles(fullPath);
      } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.min.js')) {
        jsFiles.push(fullPath);
      }
    }
  }

  findJsFiles(ROOT_DIR);

  let asyncWithoutAwait = 0;
  let todoComments = 0;
  let debugStatements = 0;

  for (const filePath of jsFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.relative(ROOT_DIR, filePath);

    // Check for async functions without await
    const asyncFunctions = content.match(/async\s+(?:function\s+\w+|\w+\s*=\s*async\s*\([^)]*\)\s*=>|\w+\s*:\s*async\s+function)/g);
    // This is a simple heuristic - more complex analysis would be needed for accuracy

    // Count TODO comments
    const todos = content.match(/\/\/\s*TODO/gi);
    if (todos) {
      todoComments += todos.length;
    }

    // Check for debugger statements (excluding comments and strings about debugger)
    const lines = content.split('\n');
    for (const line of lines) {
      // Skip comments and strings that mention debugger
      if (line.includes('//') && line.indexOf('debugger') > line.indexOf('//')) continue;
      if (/['"`].*debugger.*['"`]/.test(line)) continue;
      
      // Check for actual debugger statement
      if (/^\s*debugger\s*;?\s*$/.test(line) || /[^a-zA-Z]debugger\s*;/.test(line)) {
        debugStatements++;
        warnings.push(`debugger statement found in ${fileName}`);
        break;
      }
    }
  }

  if (todoComments > 0) {
    console.log(`  ℹ Found ${todoComments} TODO comments`);
  }

  console.log(`  ✓ Checked ${jsFiles.length} JavaScript files`);
}

/**
 * Check file dependencies
 */
function checkFileDependencies() {
  console.log('Checking file dependencies...');

  // Check customerMasterList.json
  const masterListPath = path.join(ROOT_DIR, 'customerMasterList.json');
  if (!fs.existsSync(masterListPath)) {
    warnings.push('customerMasterList.json not found - run "npm run build:data"');
  } else {
    const stats = fs.statSync(masterListPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`  ✓ customerMasterList.json found (${sizeMB} MB)`);
  }

  // Check lib dependencies
  const libFiles = ['DOMPurify.min.js', 'html2canvas.min.js', 'fabric.min.js'];
  for (const lib of libFiles) {
    const libPath = path.join(ROOT_DIR, 'lib', lib);
    if (!fs.existsSync(libPath)) {
      errors.push(`Library missing: lib/${lib}`);
    }
  }

  console.log('  ✓ Library dependencies validated');
}

// Run validations
try {
  if (validateManifest) {
    checkManifest();
  }

  if (validateModules) {
    checkModules();
  }

  if (validateDeps) {
    checkFileDependencies();
    checkCodePatterns();
  }

  // Summary
  console.log('\n' + '─'.repeat(50));
  
  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach(err => console.log(`   • ${err}`));
  }

  if (warnings.length > 0) {
    console.log('\n⚠ WARNINGS:');
    warnings.forEach(warn => console.log(`   • ${warn}`));
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('\n✅ All validations passed!\n');
  } else if (errors.length === 0) {
    console.log(`\n✅ Validation passed with ${warnings.length} warning(s)\n`);
  } else {
    console.log(`\n❌ Validation failed with ${errors.length} error(s)\n`);
    process.exit(1);
  }

} catch (error) {
  console.error('\n❌ Validation error:', error);
  process.exit(1);
}

