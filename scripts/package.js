#!/usr/bin/env node

/**
 * Package Script for Penang CoE Salesforce Extension
 * 
 * Creates deployable packages:
 * - ZIP file for Chrome Web Store upload
 * - Versioned releases for distribution
 * 
 * Usage:
 *   node scripts/package.js           # Create package from dist/
 *   node scripts/package.js --zip     # Create ZIP package
 *   node scripts/package.js --source  # Package from source (builds first)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const RELEASE_DIR = path.join(ROOT_DIR, 'releases');

const args = process.argv.slice(2);
const createZip = args.includes('--zip') || true; // Default to zip
const fromSource = args.includes('--source');

console.log('\n📦 Packaging extension...\n');

/**
 * Create releases directory
 */
function ensureReleasesDir() {
  if (!fs.existsSync(RELEASE_DIR)) {
    fs.mkdirSync(RELEASE_DIR, { recursive: true });
  }
}

/**
 * Get version from manifest
 */
function getVersion() {
  const manifestPath = fs.existsSync(path.join(DIST_DIR, 'manifest.json'))
    ? path.join(DIST_DIR, 'manifest.json')
    : path.join(ROOT_DIR, 'manifest.json');
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return manifest.version;
}

/**
 * Create ZIP package using built-in archiver or command line
 */
async function createZipPackage(sourceDir, outputPath) {
  // Try using archiver if available
  try {
    const archiver = await import('archiver');
    
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver.default('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        resolve(archive.pointer());
      });

      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  } catch (e) {
    // Fallback to PowerShell on Windows
    console.log('Using PowerShell for ZIP creation...');
    
    const tempPath = outputPath.replace(/\\/g, '/');
    const sourcePath = sourceDir.replace(/\\/g, '/');
    
    try {
      execSync(`powershell -Command "Compress-Archive -Path '${sourcePath}/*' -DestinationPath '${tempPath}' -Force"`, {
        stdio: 'pipe'
      });
      return fs.statSync(outputPath).size;
    } catch (err) {
      throw new Error(`Failed to create ZIP: ${err.message}`);
    }
  }
}

/**
 * Generate release notes
 */
function generateReleaseNotes(version) {
  const changesPath = path.join(ROOT_DIR, 'CHANGES.md');
  let releaseNotes = `# Release v${version}\n\n`;
  releaseNotes += `Build Date: ${new Date().toISOString()}\n\n`;

  if (fs.existsSync(changesPath)) {
    const changes = fs.readFileSync(changesPath, 'utf8');
    // Extract recent changes (first section after header)
    const match = changes.match(/## Change History\n\n(### \[[\s\S]*?)(?=\n### \[|$)/);
    if (match) {
      releaseNotes += `## Recent Changes\n\n${match[1]}`;
    }
  }

  return releaseNotes;
}

// Main packaging process
async function main() {
  try {
    // Build first if requested or dist doesn't exist
    if (fromSource || !fs.existsSync(DIST_DIR)) {
      console.log('Building from source...');
      execSync('node scripts/build.js --prod', { 
        cwd: ROOT_DIR, 
        stdio: 'inherit' 
      });
    }

    // Verify dist exists
    if (!fs.existsSync(DIST_DIR)) {
      throw new Error('dist/ directory not found. Run build first.');
    }

    ensureReleasesDir();

    const version = getVersion();
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const packageName = `penang-coe-extension-v${version}-${timestamp}`;

    if (createZip) {
      const zipPath = path.join(RELEASE_DIR, `${packageName}.zip`);
      
      console.log(`Creating ZIP package...`);
      const size = await createZipPackage(DIST_DIR, zipPath);
      const sizeMB = (size / (1024 * 1024)).toFixed(2);
      
      console.log(`✓ Created: ${zipPath}`);
      console.log(`  Size: ${sizeMB} MB`);
    }

    // Generate release notes
    const notesPath = path.join(RELEASE_DIR, `${packageName}-notes.md`);
    const notes = generateReleaseNotes(version);
    fs.writeFileSync(notesPath, notes);
    console.log(`✓ Created: ${notesPath}`);

    // Create latest symlink info
    const latestInfo = {
      version,
      package: `${packageName}.zip`,
      notes: `${packageName}-notes.md`,
      created: new Date().toISOString()
    };
    fs.writeFileSync(
      path.join(RELEASE_DIR, 'latest.json'),
      JSON.stringify(latestInfo, null, 2)
    );

    console.log(`\n✅ Package complete!`);
    console.log(`   Version: ${version}`);
    console.log(`   Output: ${RELEASE_DIR}\n`);

  } catch (error) {
    console.error('\n❌ Packaging failed:', error);
    process.exit(1);
  }
}

main();

