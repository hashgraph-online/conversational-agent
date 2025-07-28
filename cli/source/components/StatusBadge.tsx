import React from 'react';
import {Box, Text} from 'ink';

const BRAND_COLORS = {
	blue: '#5599fe',
	green: '#48df7b',
};

/**
 * Status badge component
 */
export const StatusBadge: React.FC<{
	status: 'success' | 'info' | 'warning' | 'error';
}> = ({status}) => {
	const colors = {
		success: BRAND_COLORS.green,
		info: BRAND_COLORS.blue,
		warning: '#FFBD2E',
		error: '#FF5F57',
	};

	const labels = {
		success: 'SUCCESS',
		info: 'INFO',
		warning: 'WARNING',
		error: 'ERROR',
	};

	return (
		<Box marginRight={1}>
			<Text color={colors[status]} bold>
				[{labels[status]}]
			</Text>
		</Box>
	);
};