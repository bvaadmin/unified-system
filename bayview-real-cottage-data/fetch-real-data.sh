#!/bin/bash
# Script to fetch real cottage data from bva-pc02

echo "Fetching real cottage data from bva-pc02..."

# Create directory if it doesn't exist
mkdir -p bayview-real-cottage-data

# Get the base64 encoded files via SSH MCP
echo "Getting block-lot file..."
ssh -p 2222 sam@bva-pc02.dory-phrygian.ts.net 'cat ~/bayview-real-data/block-lot.b64' > bayview-real-cottage-data/block-lot.b64

echo "Getting leaseholder file..."
ssh -p 2222 sam@bva-pc02.dory-phrygian.ts.net 'base64 ~/bayview-real-data/LEASHOLD\ 4-26-22.XLS' > bayview-real-cottage-data/leashold.b64

# Decode the files
echo "Decoding files..."
base64 -d bayview-real-cottage-data/block-lot.b64 > bayview-real-cottage-data/block-lot-4-26-22.xls
base64 -d bayview-real-cottage-data/leashold.b64 > bayview-real-cottage-data/LEASHOLD-4-26-22.xls

echo "Files downloaded successfully!"
ls -la bayview-real-cottage-data/*.xls