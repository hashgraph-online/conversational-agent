#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import meow from 'meow';
import App from './app.js';

const cli = meow(
	`
	Usage
	  $ conversational-agent

	Options
		--account-id       Hedera account ID (e.g., 0.0.12345)
		--private-key      Private key for the account
		--network          Network to connect to (mainnet or testnet) [default: testnet]
		--openai-api-key   OpenAI API key for the LLM

	Examples
	  $ conversational-agent
	  Interactive mode - will prompt for configuration

	  $ conversational-agent --account-id=0.0.12345 --private-key=... --openai-api-key=sk-...
	  Start with provided configuration

	  $ export HEDERA_ACCOUNT_ID=0.0.12345
	  $ export HEDERA_PRIVATE_KEY=...
	  $ export OPENAI_API_KEY=sk-...
	  $ conversational-agent
	  Uses environment variables for Hedera credentials
`,
	{
		importMeta: import.meta,
		flags: {
			accountId: {
				type: 'string',
				default: process.env['HEDERA_ACCOUNT_ID'] || '',
			},
			privateKey: {
				type: 'string',
				default: process.env['HEDERA_PRIVATE_KEY'] || '',
			},
			network: {
				type: 'string',
				default: process.env['HEDERA_NETWORK'] || 'testnet',
				choices: ['testnet', 'mainnet'],
			},
			openaiApiKey: {
				type: 'string',
				default: process.env['OPENAI_API_KEY'] || '',
			},
		},
	},
);

render(
	<App
		accountId={cli.flags.accountId}
		privateKey={cli.flags.privateKey}
		network={cli.flags.network as 'testnet' | 'mainnet'}
		openAIApiKey={cli.flags.openaiApiKey}
	/>,
);
