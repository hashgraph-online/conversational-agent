#!/usr/bin/env node

/**
 * CLI executable for Conversational Agent
 * This file enables running the CLI via npx
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Run the actual CLI from the cli directory
const cliPath = join(__dirname, '..', 'cli', 'dist', 'cli.js');

const child = spawn('node', [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: false
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('Failed to start CLI:', err);
  process.exit(1);
});