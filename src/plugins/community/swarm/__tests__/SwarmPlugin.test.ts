/**
 * Comprehensive tests for SwarmPlugin
 * Tests all public methods and initialization scenarios.
 */

import { describe, expect, beforeEach, jest } from '@jest/globals';

import './SwarmPlugin.mocks';

import { BasePlugin, type GenericPluginContext, type HederaAgentKit } from "hedera-agent-kit";
import { SwarmConfig } from '../config';
import { SwarmPlugin } from "../SwarmPlugin";

describe("SwarmPlugin", () => {
  let plugin: SwarmPlugin;
  let mockContext: GenericPluginContext;
  let hederaKitMock: HederaAgentKit;
  let loggerMock: { info: jest.Mock; warn: jest.Mock };
  let swarmConfig: SwarmConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    loggerMock = {
      info: jest.fn(),
      warn: jest.fn(),
    };
    hederaKitMock = {} as HederaAgentKit; // Mock minimal HederaAgentKit
    mockContext = {
      config: {
        hederaKit: hederaKitMock,
      },
      logger: loggerMock,
    } as unknown as GenericPluginContext;

    swarmConfig = { 
      beeApiUrl: "http://127.0.0.1:1633",
      beeFeedPK: "",
      autoAssignStamp: true,
      deferredUploadSizeThresholdMB: 5 
    };

    plugin = new SwarmPlugin(swarmConfig);
  });

  it("should construct with config", () => {
    plugin = new SwarmPlugin(swarmConfig);
    expect(plugin).toBeInstanceOf(SwarmPlugin);
  });

  it("should skip initialization if hederaKit is missing", async () => {
    plugin = new SwarmPlugin(swarmConfig);
    const contextWithoutKit = { ...mockContext, config: {} };
    await plugin.initialize(contextWithoutKit);
    expect(loggerMock.warn).toHaveBeenCalledWith(
      "SwarmPlugin skipped because HederaAgentKit was not present in plugin context."
    );
    expect(plugin.getTools()).toHaveLength(0);
  });

  it("should skip initialization if config is missing", async () => {
    plugin = new SwarmPlugin();
    await plugin.initialize(mockContext);
    expect(loggerMock.warn).toHaveBeenCalledWith(
      "SwarmPlugin skipped because Swarm config was not present."
    );
    expect(plugin.getTools()).toHaveLength(0);
  });

  it("should initialize all tools and log info with valid config and hederaKit", async () => {
    plugin = new SwarmPlugin(swarmConfig);

    // Spy on super.initialize (BasePlugin's initialize)
    const superInitializeSpy = jest.spyOn(BasePlugin.prototype, "initialize");

    await plugin.initialize(mockContext);

    expect(superInitializeSpy).toHaveBeenCalledWith(mockContext);
    expect(plugin.getTools()).toHaveLength(12);

    expect(loggerMock.info).toHaveBeenCalledWith(
      "Swarm Plugin initialized."
    );
  });

  it("getTools returns empty array after cleanup", async () => {
    plugin = new SwarmPlugin(swarmConfig);
    await plugin.initialize(mockContext);
    expect(plugin.getTools()).toHaveLength(12);

    await plugin.cleanup();
    expect(plugin.getTools()).toHaveLength(0);
  });
});
