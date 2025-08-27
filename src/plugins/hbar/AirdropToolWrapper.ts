import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { HederaAgentKit } from 'hedera-agent-kit';
import { Logger } from '@hashgraphonline/standards-sdk';

interface TokenInfo {
  decimals: number;
  [key: string]: unknown;
}

interface ToolWithCall {
  _call(input: unknown): Promise<string>;
}

interface AgentKitWithMirrorNode {
  mirrorNode?: {
    getTokenInfo(tokenId: string): Promise<TokenInfo>;
  };
  network: string;
}

export class AirdropToolWrapper extends StructuredTool {
  name = 'hedera-hts-airdrop-token';
  description =
    'Airdrops fungible tokens to multiple recipients. Automatically converts human-readable amounts to smallest units based on token decimals.';

  schema = z.object({
    tokenId: z
      .string()
      .describe('The ID of the fungible token to airdrop (e.g., "0.0.yyyy").'),
    recipients: z
      .array(
        z.object({
          accountId: z
            .string()
            .describe('Recipient account ID (e.g., "0.0.xxxx").'),
          amount: z
            .union([z.number(), z.string()])
            .describe(
              'Amount in human-readable format (e.g., "10" for 10 tokens).'
            ),
        })
      )
      .min(1)
      .describe('Array of recipient objects, each with accountId and amount.'),
    memo: z.string().optional().describe('Optional. Memo for the transaction.'),
  });

  private originalTool: StructuredTool & ToolWithCall;
  private agentKit: HederaAgentKit & AgentKitWithMirrorNode;
  private logger: Logger;

  constructor(originalTool: StructuredTool, agentKit: unknown) {
    super();
    this.originalTool = originalTool as StructuredTool & ToolWithCall;
    this.agentKit = agentKit as HederaAgentKit & AgentKitWithMirrorNode;
    this.logger = new Logger({ module: 'AirdropToolWrapper' });
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      this.logger.info(
        `Processing airdrop request for token ${input.tokenId} with ${input.recipients.length} recipients`
      );

      const tokenInfo = await this.getTokenInfo(input.tokenId);
      const decimals = tokenInfo.decimals || 0;

      this.logger.info(`Token ${input.tokenId} has ${decimals} decimal places`);

      const convertedRecipients = input.recipients.map((recipient) => {
        const humanAmount =
          typeof recipient.amount === 'string'
            ? parseFloat(recipient.amount)
            : recipient.amount;
        const smallestUnitAmount = this.convertToSmallestUnits(
          humanAmount,
          decimals
        );

        this.logger.info(
          `Converting amount for ${recipient.accountId}: ${humanAmount} tokens → ${smallestUnitAmount} smallest units`
        );

        return {
          ...recipient,
          amount: smallestUnitAmount.toString(),
        };
      });

      const convertedInput = {
        ...input,
        recipients: convertedRecipients,
      };

      this.logger.info(`Calling original airdrop tool with converted amounts`);
      return await this.originalTool._call(convertedInput);
    } catch (error) {
      this.logger.error('Error in airdrop tool wrapper:', error);
      throw error;
    }
  }

  private convertToSmallestUnits(amount: number, decimals: number): number {
    return Math.floor(amount * Math.pow(10, decimals));
  }

  private async getTokenInfo(tokenId: string): Promise<TokenInfo> {
    try {
      return await this.queryTokenInfo(tokenId);
    } catch (error) {
      throw error;
    }
  }

  private async queryTokenInfo(tokenId: string): Promise<TokenInfo> {
    try {
      this.logger.info('Querying token info using mirror node');
      const mirrorNode = this.agentKit.mirrorNode;
      if (!mirrorNode) {
        this.logger.info(
          'MirrorNode not found in agentKit, attempting to access via fetch'
        );
        const network = this.agentKit.network || 'testnet';
        const mirrorNodeUrl =
          network === 'mainnet'
            ? 'https://mainnet.mirrornode.hedera.com'
            : 'https://testnet.mirrornode.hedera.com';

        const response = await fetch(
          `${mirrorNodeUrl}/api/v1/tokens/${tokenId}`
        );
        if (response.ok) {
          const tokenData = (await response.json()) as Record<string, unknown>;
          const decimals = parseInt(String(tokenData.decimals || '0'));
          this.logger.info(
            `Token ${tokenId} found with ${decimals} decimals via API`
          );
          return { ...tokenData, decimals };
        }
      } else {
        const tokenData = await mirrorNode.getTokenInfo(tokenId);

        if (tokenData && typeof tokenData.decimals !== 'undefined') {
          const decimals = parseInt(tokenData.decimals.toString()) || 0;
          this.logger.info(`Token ${tokenId} found with ${decimals} decimals`);
          return { ...tokenData, decimals };
        }
      }

      throw new Error(`Token data not found or missing decimals field`);
    } catch (error) {
      this.logger.warn(`Failed to query token info for ${tokenId}:`, error);

      this.logger.info(
        'Falling back to assumed 0 decimal places (smallest units)'
      );
      return { decimals: 0 };
    }
  }
}
