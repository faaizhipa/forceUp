#!/bin/bash

# Build script for Chrome Extension
# This script packages production files into a distributable .zip file

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Chrome Extension Build Process${NC}"

# Read version from manifest.json
VERSION=$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)
echo -e "${YELLOW}Extension Version: ${VERSION}${NC}"

# Create dist directory
DIST_DIR="dist"
BUILD_NAME="forceUp-v${VERSION}"
BUILD_DIR="${DIST_DIR}/${BUILD_NAME}"

echo -e "${YELLOW}Cleaning previous build...${NC}"
rm -rf "${DIST_DIR}"
mkdir -p "${BUILD_DIR}"

# Copy production files
echo -e "${YELLOW}Copying production files...${NC}"

# Core extension files
cp manifest.json "${BUILD_DIR}/"
cp background.js "${BUILD_DIR}/"
cp content_script.js "${BUILD_DIR}/"
cp content_script_exlibris.js "${BUILD_DIR}/"
cp content_script_highlighter.js "${BUILD_DIR}/"
cp popup.html "${BUILD_DIR}/"
cp popup.js "${BUILD_DIR}/"
cp sidepanel.html "${BUILD_DIR}/"
cp sidepanel.js "${BUILD_DIR}/"
cp styles.css "${BUILD_DIR}/"
cp updated.html "${BUILD_DIR}/"
cp updated.js "${BUILD_DIR}/"
cp privacy-policy.html "${BUILD_DIR}/"

# Data files
cp customerMasterList.json "${BUILD_DIR}/"
cp timezones_index.json "${BUILD_DIR}/"
cp timezones_index.js "${BUILD_DIR}/"
cp timezones_final.csv "${BUILD_DIR}/"
cp instTimezones.dsv "${BUILD_DIR}/"

# Copy directories
echo -e "${YELLOW}Copying directories...${NC}"
cp -r icons/ "${BUILD_DIR}/"
cp -r img/ "${BUILD_DIR}/"
cp -r lib/ "${BUILD_DIR}/"
cp -r utils/ "${BUILD_DIR}/"
cp -r preact-modules/ "${BUILD_DIR}/"
cp -r modules/ "${BUILD_DIR}/"

# Clean up backup and copy files from copied directories
# Note:
#   - Root-level backup files like "background_backup.js" in the source tree
#     are not copied into ${BUILD_DIR} (we only copy specific top-level files),
#     so this cleanup is only needed for recursively-copied directories.
#   - We intentionally scope the search to known copied folders to avoid
#     unnecessary work over the entire build tree while still removing
#     any "*copy.js" / "*backup.js" development artifacts that may exist there.
echo -e "${YELLOW}Cleaning up backup files...${NC}"
for dir in "modules" "lib" "utils" "preact-modules"; do
  if [ -d "${BUILD_DIR}/${dir}" ]; then
    find "${BUILD_DIR}/${dir}" -name "*copy.js" -type f -delete
    find "${BUILD_DIR}/${dir}" -name "*backup.js" -type f -delete
  fi
done

# Remove development-only directories if they exist in copied folders
rm -rf "${BUILD_DIR}/.github" 2>/dev/null || true
rm -rf "${BUILD_DIR}/.vscode" 2>/dev/null || true
rm -rf "${BUILD_DIR}/.cursor" 2>/dev/null || true
rm -rf "${BUILD_DIR}/.genkit" 2>/dev/null || true
rm -rf "${BUILD_DIR}/.reference" 2>/dev/null || true

# Create zip file
ZIP_FILE="${DIST_DIR}/${BUILD_NAME}.zip"
echo -e "${YELLOW}Creating zip file: ${ZIP_FILE}${NC}"

# Use absolute path for zip creation
ORIGINAL_DIR=$(pwd)
cd "${DIST_DIR}"
zip -r "$(basename ${BUILD_NAME}).zip" "$(basename ${BUILD_NAME})/" -q
cd "${ORIGINAL_DIR}"

# Display results
FILE_SIZE=$(du -h "${ZIP_FILE}" | cut -f1)
FILE_COUNT=$(find "${BUILD_DIR}" -type f | wc -l)

echo -e "${GREEN}✓ Build completed successfully!${NC}"
echo -e "${GREEN}✓ Package: ${ZIP_FILE}${NC}"
echo -e "${GREEN}✓ Size: ${FILE_SIZE}${NC}"
echo -e "${GREEN}✓ Files: ${FILE_COUNT}${NC}"
echo -e ""
echo -e "${YELLOW}To install the extension:${NC}"
echo -e "  1. Open Chrome and go to chrome://extensions/"
echo -e "  2. Enable 'Developer mode'"
echo -e "  3. Click 'Load unpacked' and select: ${BUILD_DIR}"
echo -e "  Or drag and drop: ${ZIP_FILE}"
