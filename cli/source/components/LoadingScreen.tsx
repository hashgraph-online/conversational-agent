import React, {useEffect} from 'react';
import {Box, Text, useStdout} from 'ink';
import Spinner from 'ink-spinner';
import {BRAND_COLORS} from '../types';

export const LoadingScreen: React.FC = () => {
	const {write} = useStdout();
	
	useEffect(() => {
		// Clear screen once when component mounts
		write('\x1Bc');
	}, [write]);
	
	return (
		<Box flexDirection="column" alignItems="center" paddingY={4}>
			<Box marginBottom={2}>
				<Text color={BRAND_COLORS.blue}>Initializing </Text>
				<Text color={BRAND_COLORS.purple}>Conversational </Text>
				<Text color={BRAND_COLORS.green}>Agent...</Text>
			</Box>
			<Spinner type="dots" />
		</Box>
	);
};