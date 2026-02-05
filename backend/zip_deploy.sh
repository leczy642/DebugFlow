#!/bin/bash

# Configuration
DEPLOY_ZIP="deploy.zip"
BUILD_DIR="dist"

echo "🚀 Starting to package backend for AWS Lambda (Direct Upload)..."

# Check if we are in the backend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the backend directory."
    exit 1
fi

# Clean up previous builds
rm -rf "$DEPLOY_ZIP" "$BUILD_DIR"

# ---------------------------------------------------------
# 1. Prepare Build Directory
# ---------------------------------------------------------
echo "📦 Preparing build directory..."
mkdir -p "$BUILD_DIR"

# Copy source files to build directory
# We explicitly copy what we need to avoid copying node_modules or junk
cp package.json "$BUILD_DIR/"
cp lambda.js "$BUILD_DIR/"
cp -r src "$BUILD_DIR/"

# ---------------------------------------------------------
# 2. Install Production Dependencies
# ---------------------------------------------------------
echo "📦 Installing production dependencies..."
cd "$BUILD_DIR"
npm install --omit=dev --no-package-lock --legacy-peer-deps

# ---------------------------------------------------------
# 3. Strip Bloat
# ---------------------------------------------------------
echo "🧹 Stripping bloat to save space..."
find node_modules -type f \( -name "*.md" -o -name "*.ts" -o -name "*.map" -o -name "LICENSE" -o -name "README" -o -name "CHANGELOG*" \) -delete
find node_modules -type d \( -name "test" -o -name "tests" -o -name "__tests__" -o -name "docs" -o -name "examples" \) -exec rm -rf {} +

# ---------------------------------------------------------
# 4. Zip Everything
# ---------------------------------------------------------
echo "🤐 Zipping..."
zip -rq "../$DEPLOY_ZIP" .

cd ..
rm -rf "$BUILD_DIR"

# Check size
ZIP_SIZE=$(du -h "$DEPLOY_ZIP" | cut -f1)

echo "✅ Created $DEPLOY_ZIP"
echo "INFO: Final Size: $ZIP_SIZE"
echo "─────────────────────────────────────────────────────────────────"
echo "NEXT STEPS:"
echo "1. Go to AWS Lambda Console -> Code -> Upload from -> .zip file."
echo "2. Upload '$DEPLOY_ZIP'."
echo "3. Ensure Handler is set to: lambda.handler"
echo "─────────────────────────────────────────────────────────────────"
