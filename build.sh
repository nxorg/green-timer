#!/bin/bash

# Green Timer & Stopwatch Build Script
# This script packages the extension for Chrome/Firefox stores.

NAME="green-timer"
VERSION=$(grep '"version"' manifest.json | cut -d '"' -f 4)
OUT_DIR="dist"
FILENAME="${NAME}-v${VERSION}.zip"

echo "🔨 Building ${NAME} v${VERSION}..."

# Create output directory
mkdir -p $OUT_DIR

# Remove old build if exists
rm -f $OUT_DIR/$FILENAME

# Create zip file with required extension files (excluding dev tools)
zip -r $OUT_DIR/$FILENAME \
    manifest.json \
    app.html \
    app.css \
    app.js \
    background.js \
    content.js \
    chart.js \
    icons/ \
    LICENSE \
    README.md \
    PRIVACY.md

echo "✅ Build complete: ${OUT_DIR}/${FILENAME}"
echo "🚀 Ready for upload to Chrome Web Store and Firefox Add-ons!"
