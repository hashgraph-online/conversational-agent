import React from 'react';
import {Box, Text} from 'ink';
import {BRAND_COLORS} from '../types';

type Status = 'success' | 'info' | 'warning' | 'error';

const STATUS_COLORS: Record<Status, string> = {
	success: BRAND_COLORS.green,
	info: BRAND_COLORS.blue,
	warning: '#FFBD2E',
	error: '#FF5F57',
};

const STATUS_LABELS: Record<Status, string> = {
	success: 'SUCCESS',
	info: 'INFO',
	warning: 'WARNING',
	error: 'ERROR',
};

/**
 * Status badge component
 */
export const StatusBadge: React.FC<{status: Status}> = ({status}) => (
	<Box marginRight={1}>
		<Text color={STATUS_COLORS[status]} bold>
			[{STATUS_LABELS[status]}]
		</Text>
	</Box>
);
