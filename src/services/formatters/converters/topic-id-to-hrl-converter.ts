import { EntityFormat, FormatConverter, ConversionContext } from '../types';

/**
 * Converts Hedera topic IDs to HRL format for consensus service messages
 */
export class TopicIdToHrlConverter implements FormatConverter<string, string> {
  sourceFormat = EntityFormat.TOPIC_ID;
  targetFormat = EntityFormat.HRL;

  /**
   * Check if the source string is a valid topic ID
   */
  canConvert(source: string, _context: ConversionContext): boolean {
    return /^0\.0\.\d+$/.test(source);
  }

  /**
   * Convert topic ID to HRL format based on network type
   */
  async convert(topicId: string, context: ConversionContext): Promise<string> {
    const networkType = context.networkType || 'testnet';
    const networkId = networkType === 'mainnet' ? '0' : '1';
    return `hcs://${networkId}/${topicId}`;
  }
}
