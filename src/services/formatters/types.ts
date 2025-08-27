export enum EntityFormat {
  TOPIC_ID = 'topicId',
  HRL = 'hrl',
  SCHEDULE_ID = 'scheduleId',
  TOKEN_ID = 'tokenId',
  ADDRESS = 'address',
  SYMBOL = 'symbol',
  SERIAL_NUMBER = 'serialNumber',
  METADATA = 'metadata',
  ACCOUNT_ID = 'accountId',
  ALIAS = 'alias',
  EVM_ADDRESS = 'evmAddress',
  CONTRACT_ID = 'contractId',
  FILE_ID = 'fileId',
  ANY = 'any'
}

export interface ConversionContext {
  networkType?: string;
  sessionId?: string;
  toolName?: string;
  toolPreferences?: Record<string, string>;
  [key: string]: unknown;
}

export interface FormatConverter<TSource = string, TTarget = string> {
  sourceFormat: EntityFormat;
  targetFormat: EntityFormat;
  canConvert(source: string, context: ConversionContext): boolean;
  convert(entity: TSource, context: ConversionContext): Promise<TTarget>;
}