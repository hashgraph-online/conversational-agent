import { Logger } from '../utils/logger';
import type {
  HCS10ProfileFormData,
  HCS10ProfileResponse,
  StoredHCS10Profile,
} from '../../shared/schemas/hcs10';
import { ConfigService } from './ConfigService';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import {
  HCS10Client,
  AgentBuilder,
  AIAgentCapability,
  InboundTopicType,
  Logger as SDKLogger,
  SocialPlatform,
  RegistrationProgressData,
  AgentCreationState,
} from '@hashgraphonline/standards-sdk';
import { tagToCapabilityMap } from '../../shared/schemas/hcs10';
import { EventEmitter } from 'events';

/**
 * Service for handling HCS-10 profile registration using direct SDK functions
 */
export class HCS10RegistrationService extends EventEmitter {
  private static instance: HCS10RegistrationService;
  private logger: Logger;
  private configService: ConfigService;
  private currentRegistration: {
    profileName?: string;
    abortController?: AbortController;
  } = {};
  private progressThrottleTimer: NodeJS.Timeout | null = null;
  private lastProgressData: any = null;
  private saveStateThrottleTimer: NodeJS.Timeout | null = null;
  private pendingStateData: { profileName: string; state: AgentCreationState } | null = null;
  private progressCallCount = 0;
  private progressStartTime = 0;
  private lastEmitTime = 0;
  private minEmitInterval = 500;

  private constructor() {
    super();
    this.logger = new Logger({ module: 'HCS10RegistrationService' });
    this.configService = ConfigService.getInstance();
  }

  /**
   * Gets the singleton instance of HCS10RegistrationService
   */
  static getInstance(): HCS10RegistrationService {
    if (!this.instance) {
      this.instance = new HCS10RegistrationService();
    }
    return this.instance;
  }

  /**
   * Registers an HCS-10 profile using direct SDK functions with comprehensive progress callbacks
   */
  async registerProfile(
    profileData: HCS10ProfileFormData
  ): Promise<HCS10ProfileResponse> {
    try {
      this.logger.info('Starting HCS-10 profile registration', {
        name: profileData.name,
        capabilities: profileData.capabilities.length,
      });

      this.currentRegistration = {
        profileName: profileData.name,
        abortController: new AbortController()
      };

      const metadata = await this.prepareMetadata(profileData);

      const agentConfig = await this.getAgentConfig();
      const isAutonomous = agentConfig.operationalMode === 'autonomous';

      this.logger.info('Executing HCS-10 registration', {
        isAutonomous,
        hasFeesConfigured: !!profileData.feeConfiguration,
      });

      const result = await this.executeRegistration(
        metadata,
        profileData,
        isAutonomous
      );

      await this.storeProfile({
        ...profileData,
        accountId: result.accountId,
        registeredAt: new Date(),
        lastUpdated: new Date(),
        status: 'active',
      });

      return result;
    } catch (error) {
      this.logger.error('HCS-10 registration failed:', error);
      throw error;
    }
  }

  /**
   * Prepares metadata for HCS-10 registration
   */
  private async prepareMetadata(
    profileData: HCS10ProfileFormData
  ): Promise<any> {
    const metadata: any = {
      name: profileData.name,
      description: profileData.description,
      capabilities: profileData.capabilities,
      socials: profileData.socials,
    };

    if (profileData.profileImageFile) {
      const base64Data =
        profileData.profileImageFile.data.split(',')[1] ||
        profileData.profileImageFile.data;
      metadata.profilePictureBuffer = base64Data;
      metadata.profilePictureFilename = profileData.profileImageFile.name;
    } else if (profileData.profileImage) {
      metadata.profileImage = profileData.profileImage;
    }

    if (profileData.customProperties) {
      metadata.customProperties = profileData.customProperties;
    }

    return metadata;
  }

  /**
   * Executes the HCS-10 registration using direct SDK functions with comprehensive progress tracking
   */
  private async executeRegistration(
    metadata: any,
    profileData: HCS10ProfileFormData,
    isAutonomous: boolean
  ): Promise<HCS10ProfileResponse> {
    try {
      const config = await this.configService.load();

      if (!config.hedera?.accountId || !config.hedera?.privateKey) {
        throw new Error(
          'Missing Hedera credentials. Please configure your Hedera account in Settings.'
        );
      }

      const hcs10Client = new HCS10Client({
        network: config.hedera.network || 'testnet',
        operatorId: config.hedera.accountId,
        operatorPrivateKey: config.hedera.privateKey,
        logLevel: 'info',
        prettyPrint: false,
      });

      const sdkLogger = new SDKLogger({
        module: 'HCS10Registration',
        level: 'info',
        prettyPrint: false,
      });

      const mappedCapabilities = profileData.capabilities.map(cap => 
        tagToCapabilityMap[cap] || AIAgentCapability.TEXT_GENERATION
      );

      const agentBuilder = new AgentBuilder()
        .setName(profileData.name)
        .setAlias(
          `${profileData.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')}-${Date.now()}`
        )
        .setBio(profileData.description)
        .setCapabilities(mappedCapabilities)
        .setType(isAutonomous ? 'autonomous' : 'manual')
        .setModel('conversational-agent-2024')
        .setNetwork(config.hedera.network || 'testnet')
        .setInboundTopicType(
          profileData.feeConfiguration?.hbarFee
            ? InboundTopicType.FEE_BASED
            : InboundTopicType.PUBLIC
        )
        .setExistingAccount(config.hedera.accountId, config.hedera.privateKey);

      if (metadata.socials && Object.keys(metadata.socials).length > 0) {
        Object.entries(metadata.socials).forEach(([platform, handle]) => {
          if (handle && typeof handle === 'string') {
            agentBuilder.addSocial(platform as SocialPlatform, handle);
          }
        });
      }

      if (profileData.customProperties) {
        Object.entries(profileData.customProperties).forEach(([key, value]) => {
          if (value) {
            agentBuilder.addProperty(key, value);
          }
        });
      }

      if (metadata.profilePictureBuffer && metadata.profilePictureFilename) {
        try {
          const buffer = Buffer.from(metadata.profilePictureBuffer, 'base64');
          agentBuilder.setProfilePicture(
            buffer,
            metadata.profilePictureFilename
          );
        } catch (err) {
          this.logger.warn('Failed to set profile picture:', err);
        }
      }

      this.logger.info('Starting HCS-10 agent registration with direct SDK');

      const existingState = await this.loadRegistrationState(profileData.name);
      
      this.logger.info('Starting HCS-10 agent registration with progress tracking', {
        hasExistingState: !!existingState,
        currentStage: existingState?.currentStage || 'init',
        completedPercentage: existingState?.completedPercentage || 0
      });

      this.logger.info('Starting HCS-10 agent registration on existing account', {
        accountId: config.hedera.accountId,
        network: config.hedera.network
      });
      
      const result = await hcs10Client.createAndRegisterAgent(agentBuilder, {
        existingState: existingState || undefined,
        progressCallback: (data: RegistrationProgressData) => {
          const now = Date.now();
          
          if (!this.progressCallCount) {
            this.progressCallCount = 0;
            this.progressStartTime = now;
            this.lastEmitTime = 0;
          }
          this.progressCallCount++;
          
          this.lastProgressData = {
            stage: data.stage,
            message: data.message,
            progressPercent: data.progressPercent,
            details: data.details,
            timestamp: new Date().toISOString()
          };
          
          if (data.details?.state) {
            this.throttledSaveState(profileData.name, data.details.state);
          }
          
          const timeSinceLastEmit = now - this.lastEmitTime;
          
          if (timeSinceLastEmit >= this.minEmitInterval) {
            this.emit('registrationProgress', this.lastProgressData);
            this.lastEmitTime = now;
            
            const elapsed = now - this.progressStartTime;
            const rate = elapsed > 0 ? (this.progressCallCount / elapsed) * 1000 : 0;
            if (this.progressCallCount % 10 === 0) {
              this.logger.info(`Progress: ${this.progressCallCount} SDK calls, ${rate.toFixed(1)} calls/sec, emitting every ${this.minEmitInterval}ms`);
            }
          } else if (!this.progressThrottleTimer) {
            const delay = this.minEmitInterval - timeSinceLastEmit;
            this.progressThrottleTimer = setTimeout(() => {
              if (this.lastProgressData) {
                this.emit('registrationProgress', this.lastProgressData);
                this.lastEmitTime = Date.now();
              }
              this.progressThrottleTimer = null;
            }, delay);
          }
        },
      });

      if (!result.metadata) {
        throw new Error('Agent registration failed - no metadata returned');
      }

      await this.clearRegistrationState(profileData.name);
      
      const registrationResult = result.metadata;

      this.emit('registrationProgress', {
        stage: 'completed',
        message: 'Registration completed successfully!',
        progressPercent: 100,
        details: { accountId: registrationResult.accountId },
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        accountId: registrationResult.accountId,
        transactionId: result.transactionId || 'N/A',
        timestamp: new Date().toISOString(),
        profileUrl: `https://hashscan.io/${
          config.hedera.network || 'testnet'
        }/account/${registrationResult.accountId}`,
        metadata: {
          name: profileData.name,
          description: profileData.description,
          capabilities: profileData.capabilities,
          socials: profileData.socials,
          profileImage: profileData.profileImage,
          feeConfiguration: profileData.feeConfiguration,
        },
      };
    } catch (error) {
      this.logger.error(
        'Failed to execute HCS10 registration with direct SDK:',
        error
      );
      throw new Error(
        `HCS10 registration failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Gets the agent configuration
   */
  private async getAgentConfig(): Promise<any> {
    const config = await this.configService.load();
    return {
      operationalMode: 'autonomous',
    };
  }

  /**
   * Stores a registered profile
   */
  private async storeProfile(
    profile: Omit<StoredHCS10Profile, 'id'>
  ): Promise<void> {
    try {
      const config = await this.configService.load();

      if (!config.hcs10Profiles) {
        config.hcs10Profiles = [];
      }

      const storedProfile: StoredHCS10Profile = {
        id: `hcs10-${Date.now()}`,
        ...profile,
      };

      config.hcs10Profiles.push(storedProfile);
      await this.configService.save(config);

      this.logger.info('HCS10 profile stored successfully', {
        id: storedProfile.id,
        accountId: storedProfile.accountId,
      });
    } catch (error) {
      this.logger.error('Failed to store HCS10 profile:', error);
    }
  }

  /**
   * Gets all registered HCS-10 profiles
   */
  async getRegisteredProfiles(): Promise<StoredHCS10Profile[]> {
    try {
      const config = await this.configService.load();
      return config.hcs10Profiles || [];
    } catch (error) {
      this.logger.error('Failed to get registered profiles:', error);
      return [];
    }
  }

  /**
   * Updates a registered profile
   */
  async updateProfile(
    profileId: string,
    updates: Partial<StoredHCS10Profile>
  ): Promise<void> {
    try {
      const config = await this.configService.load();

      if (!config.hcs10Profiles) {
        throw new Error('No profiles found');
      }

      const profileIndex = config.hcs10Profiles.findIndex(
        (p) => p.id === profileId
      );
      if (profileIndex === -1) {
        throw new Error('Profile not found');
      }

      config.hcs10Profiles[profileIndex] = {
        ...config.hcs10Profiles[profileIndex],
        ...updates,
        lastUpdated: new Date(),
      };

      await this.configService.save(config);
    } catch (error) {
      this.logger.error('Failed to update profile:', error);
      throw error;
    }
  }

  /**
   * Deletes a registered profile
   */
  async deleteProfile(profileId: string): Promise<void> {
    try {
      const config = await this.configService.load();

      if (!config.hcs10Profiles) {
        return;
      }

      config.hcs10Profiles = config.hcs10Profiles.filter(
        (p) => p.id !== profileId
      );
      await this.configService.save(config);

      this.logger.info('HCS10 profile deleted', { profileId });
    } catch (error) {
      this.logger.error('Failed to delete profile:', error);
      throw error;
    }
  }

  /**
   * Saves registration state for recovery purposes
   */
  private async saveRegistrationState(profileName: string, state: AgentCreationState): Promise<void> {
    try {
      const stateFilePath = this.getStateFilePath(profileName);
      const stateData = {
        ...state,
        lastUpdated: new Date().toISOString(),
        profileName
      };
      
      await fs.promises.writeFile(stateFilePath, JSON.stringify(stateData, null, 2));
      this.logger.debug('Registration state saved', { 
        profileName, 
        stage: state.currentStage,
        percentage: state.completedPercentage 
      });
    } catch (error) {
      this.logger.warn('Failed to save registration state:', error);
    }
  }

  /**
   * Loads existing registration state for recovery
   */
  private async loadRegistrationState(profileName: string): Promise<AgentCreationState | null> {
    try {
      const stateFilePath = this.getStateFilePath(profileName);
      
      if (!fs.existsSync(stateFilePath)) {
        return null;
      }

      const stateData = JSON.parse(await fs.promises.readFile(stateFilePath, 'utf8'));
      
      const lastUpdated = new Date(stateData.lastUpdated);
      const now = new Date();
      const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        this.logger.info('Registration state expired, clearing', { profileName, hoursDiff });
        await this.clearRegistrationState(profileName);
        return null;
      }

      this.logger.info('Loaded existing registration state', {
        profileName,
        stage: stateData.currentStage,
        percentage: stateData.completedPercentage,
        hoursSinceUpdate: hoursDiff.toFixed(2)
      });

      return stateData;
    } catch (error) {
      this.logger.warn('Failed to load registration state:', error);
      return null;
    }
  }

  /**
   * Clears registration state
   */
  private async clearRegistrationState(profileName: string): Promise<void> {
    try {
      const stateFilePath = this.getStateFilePath(profileName);
      
      if (fs.existsSync(stateFilePath)) {
        await fs.promises.unlink(stateFilePath);
        this.logger.debug('Registration state cleared', { profileName });
      }
    } catch (error) {
      this.logger.warn('Failed to clear registration state:', error);
    }
  }

  /**
   * Clears all registration states from disk
   */
  async clearAllRegistrationStates(): Promise<void> {
    try {
      const userDataPath = app.getPath('userData');
      const stateDir = path.join(userDataPath, 'hcs10-states');
      
      if (fs.existsSync(stateDir)) {
        const files = await fs.promises.readdir(stateDir);
        const stateFiles = files.filter(f => f.endsWith('_registration_state.json'));
        
        for (const file of stateFiles) {
          const filePath = path.join(stateDir, file);
          try {
            await fs.promises.unlink(filePath);
            this.logger.debug('Deleted registration state file', { file });
          } catch (err) {
            this.logger.warn('Failed to delete state file', { file, error: err });
          }
        }
        
        this.logger.info('Cleared all registration states', { count: stateFiles.length });
      }
    } catch (error) {
      this.logger.error('Failed to clear all registration states:', error);
      throw error;
    }
  }

  /**
   * Gets the file path for storing registration state
   */
  private getStateFilePath(profileName: string): string {
    const userDataPath = app.getPath('userData');
    const stateDir = path.join(userDataPath, 'hcs10-states');
    
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    
    const sanitizedName = profileName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    return path.join(stateDir, `${sanitizedName}_registration_state.json`);
  }

  /**
   * Gets current registration progress for a profile
   */
  async getRegistrationProgress(profileName: string): Promise<AgentCreationState | null> {
    return await this.loadRegistrationState(profileName);
  }

  /**
   * Checks if a registration is in progress
   */
  async isRegistrationInProgress(profileName: string): Promise<boolean> {
    const state = await this.loadRegistrationState(profileName);
    return state !== null && state.currentStage !== 'complete' && !state.error;
  }

  /**
   * Cancels the current registration in progress
   */
  async cancelRegistration(): Promise<void> {
    try {
      this.logger.info('Attempting to cancel registration', {
        profileName: this.currentRegistration.profileName
      });

      if (this.currentRegistration.abortController) {
        this.currentRegistration.abortController.abort();
      }

      if (this.currentRegistration.profileName) {
        await this.clearRegistrationState(this.currentRegistration.profileName);
      }

      this.currentRegistration = {};

      if (this.progressThrottleTimer) {
        clearTimeout(this.progressThrottleTimer);
        this.progressThrottleTimer = null;
      }
      if (this.saveStateThrottleTimer) {
        clearTimeout(this.saveStateThrottleTimer);
        this.saveStateThrottleTimer = null;
      }
      
      this.progressCallCount = 0;
      this.lastEmitTime = 0;

      this.logger.info('Registration cancelled successfully');
    } catch (error) {
      this.logger.error('Failed to cancel registration:', error);
      throw error;
    }
  }


  /**
   * Throttled state saving to prevent excessive file I/O
   */
  private throttledSaveState(profileName: string, state: AgentCreationState): void {
    this.pendingStateData = { profileName, state };
    
    if (!this.saveStateThrottleTimer) {
      this.saveRegistrationState(profileName, state).catch(error => {
        this.logger.warn('Failed to save registration state:', error);
      });
      
      this.saveStateThrottleTimer = setTimeout(async () => {
        if (this.pendingStateData) {
          await this.saveRegistrationState(
            this.pendingStateData.profileName, 
            this.pendingStateData.state
          ).catch(error => {
            this.logger.warn('Failed to save registration state:', error);
          });
        }
        this.saveStateThrottleTimer = null;
      }, 1000);
    }
  }
}
