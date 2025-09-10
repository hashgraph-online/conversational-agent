#!/usr/bin/env node

import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {access, constants} from 'fs/promises';
import {spawn} from 'child_process';
import { Logger } from '@hashgraphonline/standards-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliRoot = join(__dirname, '..');
const distPath = join(cliRoot, 'dist', 'cli.js');

/**
 * Check if CLI is built
 */
async function isBuilt() {
	try {
		await access(distPath, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Install dependencies
 */
function installDeps() {
	const logger = new Logger({ module: 'CLI' });
	return new Promise((resolve, reject) => {
		logger.info('📦 Installing CLI dependencies...');
		const child = spawn('pnpm', ['install'], {
			cwd: cliRoot,
			stdio: 'inherit',
		});

		child.on('close', code => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`Dependency installation failed with code ${code}`));
			}
		});
	});
}

/**
 * Build the CLI
 */
function build() {
	const logger = new Logger({ module: 'CLI' });
	return new Promise((resolve, reject) => {
		logger.info('🔨 Building Conversational Agent CLI...');
		const child = spawn('pnpm', ['build'], {
			cwd: cliRoot,
			stdio: 'inherit',
		});

		child.on('close', code => {
			if (code === 0) {
				logger.info('✅ CLI built successfully!');
				resolve();
			} else {
				reject(new Error(`Build failed with code ${code}`));
			}
		});
	});
}

/**
 * Run the CLI
 */
function runCli() {
	const projectRoot = join(__dirname, '..', '..');
	const sourcePath = join(cliRoot, 'source', 'cli.tsx');
	const child = spawn('npx', ['tsx', sourcePath, ...process.argv.slice(2)], {
		stdio: 'inherit',
		env: {
			...process.env,
			CONVERSATIONAL_AGENT_ROOT: projectRoot,
		},
	});

	child.on('close', code => {
		process.exit(code);
	});
}

/**
 * Check if node_modules exists
 */
async function hasDependencies() {
	try {
		await access(join(cliRoot, 'node_modules'), constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Main function
 */
async function main() {
	const logger = new Logger({ module: 'CLI' });
	try {
		if (!(await hasDependencies())) {
			await installDeps();
		}

		runCli();
	} catch (error: any) {
		logger.error('❌ Error:', error?.message || error);
		process.exit(1);
	}
}

main().catch((e) => {
	const logger = new Logger({ module: 'CLI' });
	logger.error('Unhandled error in CLI:', e);
});
