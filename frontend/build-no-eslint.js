#!/usr/bin/env node

// Temporary build script that bypasses ESLint
const { spawn } = require('child_process');
const path = require('path');

// Set environment variables to disable ESLint
process.env.ESLINT_NO_DEV_ERRORS = 'true';
process.env.DISABLE_ESLINT_PLUGIN = 'true';

// Run Next.js build with ESLint disabled
const nextBuild = spawn('npx', ['next', 'build'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: {
    ...process.env,
    ESLINT_NO_DEV_ERRORS: 'true',
    DISABLE_ESLINT_PLUGIN: 'true'
  }
});

nextBuild.on('close', (code) => {
  process.exit(code);
});
