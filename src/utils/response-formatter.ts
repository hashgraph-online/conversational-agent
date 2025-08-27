/**
 * HCS-12 HashLink block structure for interactive content rendering
 */
interface HCS12BlockResult {
  blockId: string;
  hashLink: string;
  template: string;
  attributes: Record<string, unknown>;
}

/**
 * Utility class for formatting tool responses into user-friendly messages
 */
export class ResponseFormatter {
  /**
   * Checks if a parsed response contains HashLink block data for interactive rendering
   */
  static isHashLinkResponse(parsed: unknown): boolean {
    if (!parsed || typeof parsed !== 'object') {
      return false;
    }

    const responseObj = parsed as Record<string, unknown>;
    return !!(
      responseObj.success === true &&
      responseObj.type === 'inscription' &&
      responseObj.hashLinkBlock &&
      typeof responseObj.hashLinkBlock === 'object'
    );
  }

  /**
   * Formats HashLink block response with simple text confirmation
   * HTML template rendering is handled by HashLinkBlockRenderer component via metadata
   */
  static formatHashLinkResponse(parsed: Record<string, unknown>): string {
    const hashLinkBlock = parsed.hashLinkBlock as HCS12BlockResult;
    const metadata = parsed.metadata as Record<string, unknown> || {};
    const inscription = parsed.inscription as Record<string, unknown> || {};

    let message = '✅ Interactive content created successfully!\n\n';

    if (metadata.name) {
      message += `**${metadata.name}**\n`;
    }

    if (metadata.description) {
      message += `${metadata.description}\n\n`;
    }

    if (inscription.topicId || hashLinkBlock.attributes.topicId) {
      message += `📍 **Topic ID:** ${inscription.topicId || hashLinkBlock.attributes.topicId}\n`;
    }

    if (inscription.hrl || hashLinkBlock.attributes.hrl) {
      message += `🔗 **HRL:** ${inscription.hrl || hashLinkBlock.attributes.hrl}\n`;
    }

    if (inscription.cdnUrl) {
      message += `🌐 **CDN URL:** ${inscription.cdnUrl}\n`;
    }

    if (metadata.creator) {
      message += `👤 **Creator:** ${metadata.creator}\n`;
    }

    message += '\n⚡ Interactive content will load below';

    return message.trim();
  }

  /**
   * Checks if a parsed response is an inscription response that needs formatting
   */
  static isInscriptionResponse(parsed: unknown): boolean {
    if (!parsed || typeof parsed !== 'object') {
      return false;
    }

    const responseObj = parsed as Record<string, unknown>;
    return !!(
      responseObj.success === true &&
      responseObj.type === 'inscription' &&
      responseObj.inscription &&
      typeof responseObj.inscription === 'object'
    );
  }

  /**
   * Formats inscription response into user-friendly message
   */
  static formatInscriptionResponse(parsed: Record<string, unknown>): string {
    const inscription = parsed.inscription as Record<string, unknown>;
    const metadata = parsed.metadata as Record<string, unknown> || {};
    const title = parsed.title as string || 'Inscription Complete';

    let message = `✅ ${title}\n\n`;

    if (metadata.name) {
      message += `**${metadata.name}**\n`;
    }

    if (metadata.description) {
      message += `${metadata.description}\n\n`;
    }

    if (inscription.topicId) {
      message += `📍 **Topic ID:** ${inscription.topicId}\n`;
    }

    if (inscription.hrl) {
      message += `🔗 **HRL:** ${inscription.hrl}\n`;
    }

    if (inscription.cdnUrl) {
      message += `🌐 **CDN URL:** ${inscription.cdnUrl}\n`;
    }

    if (metadata.creator) {
      message += `👤 **Creator:** ${metadata.creator}\n`;
    }

    return message.trim();
  }

  /**
   * Main formatting method that determines the best response format
   */
  static formatResponse(toolOutput: string): string {
    try {
      const parsed = JSON.parse(toolOutput);
      
      if (ResponseFormatter.isHashLinkResponse(parsed)) {
        return ResponseFormatter.formatHashLinkResponse(parsed);
      }
      
      if (ResponseFormatter.isInscriptionResponse(parsed)) {
        return ResponseFormatter.formatInscriptionResponse(parsed);
      }
      
      return toolOutput;
    } catch {
      return toolOutput;
    }
  }
}