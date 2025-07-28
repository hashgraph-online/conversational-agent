import {useReducer, useCallback, useMemo} from 'react';
import {type Screen, type Message} from '../types';
import {type MCPServerConfig} from '@hashgraphonline/conversational-agent';

export interface AppState {
  screen: Screen;
  messages: Message[];
  input: string;
  isLoading: boolean;
  error: string | null;
  mcpConfig: {
    enableFilesystem: boolean;
    filesystemPath: string;
    customServers: MCPServerConfig[];
    addingCustom: boolean;
    newServerName: string;
    newServerCommand: string;
    newServerArgs: string;
    newServerEnv: string;
    currentField: number;
  };
  editingFilesystemPath: boolean;
  currentField: number;
  logs: string[];
}

type AppAction =
  | {type: 'SET_SCREEN'; payload: Screen}
  | {type: 'SET_MESSAGES'; payload: Message[]}
  | {type: 'ADD_MESSAGES'; payload: Message[]}
  | {type: 'SET_INPUT'; payload: string}
  | {type: 'SET_LOADING'; payload: boolean}
  | {type: 'SET_ERROR'; payload: string | null}
  | {type: 'SET_MCP_CONFIG'; payload: Partial<AppState['mcpConfig']>}
  | {type: 'SET_EDITING_FILESYSTEM_PATH'; payload: boolean}
  | {type: 'SET_CURRENT_FIELD'; payload: number}
  | {type: 'SET_LOGS'; payload: string[]};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_SCREEN':
      return {...state, screen: action.payload};
    case 'SET_MESSAGES':
      return {...state, messages: action.payload};
    case 'ADD_MESSAGES':
      return {...state, messages: [...state.messages, ...action.payload]};
    case 'SET_INPUT':
      return {...state, input: action.payload};
    case 'SET_LOADING':
      return {...state, isLoading: action.payload};
    case 'SET_ERROR':
      return {...state, error: action.payload};
    case 'SET_MCP_CONFIG':
      return {...state, mcpConfig: {...state.mcpConfig, ...action.payload}};
    case 'SET_EDITING_FILESYSTEM_PATH':
      return {...state, editingFilesystemPath: action.payload};
    case 'SET_CURRENT_FIELD':
      return {...state, currentField: action.payload};
    case 'SET_LOGS':
      return {...state, logs: action.payload};
    default:
      return state;
  }
};

export const useStableState = (initialMcpServers: MCPServerConfig[]) => {
  const getInitialState = useCallback((): AppState => {
    const filesystemServer = initialMcpServers.find(s => s.name === 'filesystem');
    const customServers = initialMcpServers.filter(s => s.name !== 'filesystem');

    return {
      screen: 'welcome',
      messages: [],
      input: '',
      isLoading: false,
      error: null,
      mcpConfig: {
        enableFilesystem: !!filesystemServer,
        filesystemPath: filesystemServer ? filesystemServer.args[2] || process.cwd() : process.cwd(),
        customServers,
        addingCustom: false,
        newServerName: '',
        newServerCommand: '',
        newServerArgs: '',
        newServerEnv: '',
        currentField: 0,
      },
      editingFilesystemPath: false,
      currentField: 0,
      logs: [],
    };
  }, [initialMcpServers]);

  const [state, dispatch] = useReducer(appReducer, null, getInitialState);

  const actions = useMemo(() => ({
    setScreen: (screen: Screen) => dispatch({type: 'SET_SCREEN', payload: screen}),
    setMessages: (messages: Message[]) => dispatch({type: 'SET_MESSAGES', payload: messages}),
    addMessages: (messages: Message[]) => dispatch({type: 'ADD_MESSAGES', payload: messages}),
    setInput: (input: string) => dispatch({type: 'SET_INPUT', payload: input}),
    setLoading: (loading: boolean) => dispatch({type: 'SET_LOADING', payload: loading}),
    setError: (error: string | null) => dispatch({type: 'SET_ERROR', payload: error}),
    setMcpConfig: (config: Partial<AppState['mcpConfig']>) => dispatch({type: 'SET_MCP_CONFIG', payload: config}),
    setEditingFilesystemPath: (editing: boolean) => dispatch({type: 'SET_EDITING_FILESYSTEM_PATH', payload: editing}),
    setCurrentField: (field: number) => dispatch({type: 'SET_CURRENT_FIELD', payload: field}),
    setLogs: (logs: string[]) => dispatch({type: 'SET_LOGS', payload: logs}),
  }), [dispatch]);

  return {state, actions};
};