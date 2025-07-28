export type Screen = 'welcome' | 'setup' | 'mcp-config' | 'chat' | 'loading';

export interface Message {
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: Date;
}

export interface Config {
	accountId: string;
	privateKey: string;
	network: string;
	openAIApiKey: string;
}

export const BRAND_COLORS = {
	blue: '#5599fe',
	green: '#48df7b',
	purple: '#b56cff',
	dark: '#3f4174',
	white: '#ffffff',

	hedera: {
		purple: '#8259ef',
		blue: '#2d84eb',
		green: '#3ec878',
		charcoal: '#464646',
		smoke: '#8c8c8c',
	},

	keywords: '#3f4174',
	functions: '#5599fe',
	strings: '#48df7b',
	variables: '#b56cff',
	comments: '#6b7280',
};