import {
  EntityFormat,
  type FormatConverter,
  type ConversionContext,
} from '../types';
import {
  HederaMirrorNode,
  HRLResolver,
  type NetworkType,
} from '@hashgraphonline/standards-sdk';

/**
 * Generic converter that normalizes various string entity references (cdn urls, content-ref, raw topic id)
 * into canonical HRL. It declares source ANY -> HRL and internally short-circuits if unsupported.
 */
export class StringNormalizationConverter
  implements FormatConverter<string, string>
{
  sourceFormat = EntityFormat.ANY;
  targetFormat = EntityFormat.HRL;

  private static standardCache: Map<string, string> = new Map();

  canConvert(source: string, _context: ConversionContext): boolean {
    if (typeof source !== 'string') {
      return false;
    }
    if (/^hcs:\/\/\d\/0\.0\.\d+$/i.test(source)) {
      return false;
    }
    if (/inscription-cdn\/(0\.0\.\d+)/i.test(source)) {
      return true;
    }
    if (/^content-ref:(0\.0\.\d+)$/i.test(source)) {
      return true;
    }
    if (/^0\.0\.\d+$/.test(source)) {
      const hasPreference = Boolean(
        (_context as unknown as { toolPreferences?: Record<string, string> })
          ?.toolPreferences?.inscription === 'hrl' ||
          (_context as unknown as { toolPreferences?: Record<string, string> })
            ?.toolPreferences?.topic === 'hrl'
      );
      return hasPreference;
    }
    return false;
  }

  async convert(source: string, context: ConversionContext): Promise<string> {
    const toolPrefs = (
      context as unknown as { toolPreferences?: Record<string, string> }
    ).toolPreferences;
    const fallbackStandard =
      toolPrefs?.hrlStandard || toolPrefs?.inscriptionHrlStandard || '1';
    const networkType = (context.networkType as string) || 'testnet';

    const resolver = new HRLResolver();

    const cdnMatch = source.match(/inscription-cdn\/(0\.0\.\d+)/i);
    if (cdnMatch && cdnMatch[1]) {
      try {
        const mirror = new HederaMirrorNode(networkType as NetworkType);
        mirror.configureRetry({
          maxRetries: 3,
          maxDelayMs: 1000,
        });
        const resolved = await mirror.getTopicInfo(cdnMatch[1]);
        const memo = (resolved && (resolved as { memo?: string }).memo) || '';
        const match = memo.match(/^hcs-(\d+)/);
        const standard = match && match[1] ? match[1] : '1';
        return `hcs://${standard}/${cdnMatch[1]}`;
      } catch {
        return `hcs://${fallbackStandard}/${cdnMatch[1]}`;
      }
    }

    const contentRefMatch = source.match(/^content-ref:(0\.0\.\d+)$/i);
    if (contentRefMatch && contentRefMatch[1]) {
      try {
        const resolved = await resolver.resolve(contentRefMatch[1], {
          network: networkType as NetworkType,
        });
        const parsed = resolver.parseHRL(`hcs://1/${resolved.topicId}`);
        const std = parsed?.standard || fallbackStandard;
        return `hcs://${std}/${resolved.topicId}`;
      } catch {
        return `hcs://${fallbackStandard}/${contentRefMatch[1]}`;
      }
    }

    if (/^0\.0\.\d+$/.test(source)) {
      try {
        const resolved = await resolver.resolve(source, {
          network: networkType as NetworkType,
        });
        const parsed = resolver.parseHRL(`hcs://1/${resolved.topicId}`);
        const std = parsed?.standard || fallbackStandard;
        return `hcs://${std}/${resolved.topicId}`;
      } catch {
        return `hcs://${fallbackStandard}/${source}`;
      }
    }

    return source;
  }
}
