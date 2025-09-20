import React from 'react';
import {CLIApp} from './CLIApp';
import {type Network} from './types';

type Props = {
	accountId?: string;
	privateKey?: string;
	network?: Network;
	openAIApiKey?: string;
};

process.setMaxListeners(20);

/**
 * Main App component for the Hashgraph Online Conversational Agent CLI
 * @param accountId - Hedera account ID
 * @param privateKey - Hedera private key
 * @param network - Network to connect to (testnet or mainnet)
 * @param openAIApiKey - OpenAI API key for the conversational agent
 */
export default function App({
	accountId,
	privateKey,
	network = 'testnet',
	openAIApiKey,
}: Props) {
	return (
		<CLIApp
			accountId={accountId}
			privateKey={privateKey}
			network={network}
			openAIApiKey={openAIApiKey}
		/>
	);
}
