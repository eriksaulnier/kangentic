#!/usr/bin/env node

// Kangentic CLI entry point
// Launches the Electron desktop app

const { execSync, spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);

// Find the electron binary
let electronPath;
try {
  electronPath = require('electron');
} catch {
  console.error('Error: electron not found. Run from the project directory or install globally.');
  process.exit(1);
}

const appPath = path.join(__dirname, '..');

// Launch Electron with args forwarded
const child = spawn(electronPath, [appPath, ...args], {
  stdio: 'inherit',
  detached: process.platform !== 'win32',
});

child.on('close', (code) => {
  process.exit(code || 0);
});

// Don't wait for the Electron process
if (process.platform !== 'win32') {
  child.unref();
}
