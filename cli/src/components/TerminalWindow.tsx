import React from 'react';
import {Box, Text} from 'ink';
import {BRAND_COLORS} from '../types';

/**
 * Terminal window decoration component
 */
export const TerminalWindow: React.FC<{title: string; children: React.ReactNode}> = ({
	title,
	children,
}) => {
	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={BRAND_COLORS.blue}
		>
			<Box
				paddingX={1}
				borderStyle="single"
				borderBottom
				borderColor={BRAND_COLORS.dark}
			>
				<Box marginRight={1}>
					<Text color="red">●</Text>
					<Text> </Text>
					<Text color="yellow">●</Text>
					<Text> </Text>
					<Text color="green">●</Text>
				</Box>
				<Text color={BRAND_COLORS.hedera.smoke}>{title}</Text>
			</Box>
			<Box paddingX={2} paddingY={1} flexDirection="column">
				{children}
			</Box>
		</Box>
	);
};
