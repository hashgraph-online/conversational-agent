import { EntityFormat, FormatConverter, ConversionContext } from './types';
import {
  HederaMirrorNode,
  Logger,
  NetworkType,
} from '@hashgraphonline/standards-sdk';

interface CacheEntry {
  format: EntityFormat;
  timestamp: number;
  ttl: number;
}

/**
 * Registry for format converters that handles entity transformation
 */
export class FormatConverterRegistry {
  private converters = new Map<string, FormatConverter<unknown, unknown>>();
  private entityTypeCache = new Map<string, CacheEntry>();
  private logger = new Logger({ module: 'FormatConverterRegistry' });
  private defaultCacheTTL = 5 * 60 * 1000;

  /**
   * Register a format converter
   */
  register<TSource, TTarget>(
    converter: FormatConverter<TSource, TTarget>
  ): void {
    const key = `${converter.sourceFormat}→${converter.targetFormat}`;
    this.converters.set(key, converter as FormatConverter<unknown, unknown>);
  }

  /**
   * Find a converter for the given source and target formats
   */
  findConverter(
    source: EntityFormat,
    target: EntityFormat
  ): FormatConverter<unknown, unknown> | null {
    const key = `${source}→${target}`;
    return this.converters.get(key) || null;
  }

  /**
   * Convert an entity to the target format
   */
  async convertEntity(
    entity: string,
    target: EntityFormat,
    context: ConversionContext
  ): Promise<string> {
    const sourceFormat = await this.detectFormatWithFallback(entity, context);
    if (sourceFormat === target) {
      return entity;
    }

    const converter = this.findConverter(sourceFormat, target);
    if (!converter) {
      throw new Error(`No converter found for ${sourceFormat} → ${target}`);
    }

    if (!converter.canConvert(entity, context)) {
      throw new Error(`Converter cannot handle entity: ${entity}`);
    }

    const result = await converter.convert(entity, context);
    return result as string;
  }

  /**
   * Detect the format of an entity string with API-based verification and fallback
   */
  private async detectFormatWithFallback(
    entity: string,
    context?: ConversionContext
  ): Promise<EntityFormat> {
    if (entity.startsWith('hcs://')) {
      return EntityFormat.HRL;
    }

    if (/^0\.0\.\d+$/.test(entity)) {
      const cached = this.getCachedFormat(entity);
      if (cached) {
        return cached;
      }

      try {
        const detected = await this.detectFormat(entity, context || {});
        if (detected !== EntityFormat.ANY) {
          this.setCachedFormat(entity, detected);
          return detected;
        }
      } catch (error) {
        this.logger.warn(
          `Entity detection failed for ${entity}, using fallback: ${
            (error as Error).message
          }`
        );
      }

      return EntityFormat.ANY;
    }

    return EntityFormat.ANY;
  }

  /**
   * Public helper: detect entity format (ACCOUNT_ID, TOKEN_ID, TOPIC_ID, HRL, or ANY)
   */
  async detectEntityFormat(
    entity: string,
    context?: ConversionContext
  ): Promise<EntityFormat> {
    return this.detectFormatWithFallback(entity, context);
  }

  /**
   * Detect entity format via Hedera Mirror Node API calls
   */
  private async detectFormat(
    entity: string,
    context: ConversionContext
  ): Promise<EntityFormat> {
    const networkType = (context.networkType as NetworkType) || 'testnet';
    const mirrorNode = new HederaMirrorNode(networkType, this.logger);

    mirrorNode.configureRetry({
      maxRetries: 3,
      maxDelayMs: 1000,
    });

    const checks = await Promise.allSettled([
      mirrorNode
        .getAccountBalance(entity)
        .then((result) => (result !== null ? EntityFormat.ACCOUNT_ID : null))
        .catch(() => null),

      mirrorNode
        .getTokenInfo(entity)
        .then((result) => (result !== null ? EntityFormat.TOKEN_ID : null))
        .catch(() => null),

      mirrorNode
        .getTopicInfo(entity)
        .then((result) => (result !== null ? EntityFormat.TOPIC_ID : null))
        .catch(() => null),

      mirrorNode
        .getContract(entity)
        .then((result) => (result !== null ? EntityFormat.CONTRACT_ID : null))
        .catch(() => null),
    ]);

    const successful = checks.find(
      (result) => result.status === 'fulfilled' && result.value !== null
    );

    return successful && successful.status === 'fulfilled'
      ? (successful.value as EntityFormat)
      : EntityFormat.ANY;
  }

  /**
   * Get cached entity format if valid
   */
  private getCachedFormat(entity: string): EntityFormat | null {
    const entry = this.entityTypeCache.get(entity);
    if (!entry || this.isCacheExpired(entry)) {
      this.entityTypeCache.delete(entity);
      return null;
    }
    return entry.format;
  }

  /**
   * Set cached entity format
   */
  private setCachedFormat(entity: string, format: EntityFormat): void {
    this.entityTypeCache.set(entity, {
      format,
      timestamp: Date.now(),
      ttl: this.defaultCacheTTL,
    });
  }

  /**
   * Check if cache entry is expired
   */
  private isCacheExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Get all registered converters
   */
  getRegisteredConverters(): Array<{
    source: EntityFormat;
    target: EntityFormat;
  }> {
    return Array.from(this.converters.keys()).map((key) => {
      const [source, target] = key.split('→');
      return {
        source: source as EntityFormat,
        target: target as EntityFormat,
      };
    });
  }

  /**
   * Check if a converter exists for the given formats
   */
  hasConverter(source: EntityFormat, target: EntityFormat): boolean {
    return this.findConverter(source, target) !== null;
  }

  /**
   * Clear all registered converters
   */
  clear(): void {
    this.converters.clear();
  }

  /**
   * Clear entity type cache
   */
  clearCache(): void {
    this.entityTypeCache.clear();
  }
}
