'use strict';

import {
  type PlatformId,
  type PlatformGroupId,
  PLATFORM_CONFIGS,
} from '@trendmetrics/shared';
import { BaseConnector, type ConnectorCapabilities } from './base.js';
import { GroundedSearchConnector, GROUNDED_SEARCH_PLATFORMS } from './grounded-search.js';
import { YouTubeConnector } from './youtube.js';
import { createChildLogger } from '../../config/logger.js';

const logger = createChildLogger({ module: 'connector-registry' });

// ---------------------------------------------------------------------------
// ConnectorRegistry
// ---------------------------------------------------------------------------

export class ConnectorRegistry {
  private readonly connectors: Map<PlatformId, BaseConnector> = new Map();

  register(connector: BaseConnector): void {
    this.connectors.set(connector.platform, connector);
    logger.debug('Connector registered', {
      platform: connector.platform,
      capabilities: connector.capabilities,
    });
  }

  getForPlatform(id: PlatformId): BaseConnector | null {
    return this.connectors.get(id) ?? null;
  }

  getForGroup(group: PlatformGroupId): BaseConnector[] {
    const result: BaseConnector[] = [];
    for (const [platformId, connector] of this.connectors) {
      const platformConfig = PLATFORM_CONFIGS[platformId];
      if (platformConfig && platformConfig.group === group) {
        result.push(connector);
      }
    }
    return result;
  }

  getAllCapabilities(): Record<string, ConnectorCapabilities> {
    const result: Record<string, ConnectorCapabilities> = {};
    for (const [platformId, connector] of this.connectors) {
      result[platformId] = connector.capabilities;
    }
    return result;
  }

  getAllPlatforms(): PlatformId[] {
    return Array.from(this.connectors.keys());
  }

  get size(): number {
    return this.connectors.size;
  }
}

// ---------------------------------------------------------------------------
// Initialize all connectors
// ---------------------------------------------------------------------------

function initializeRegistry(): ConnectorRegistry {
  const registry = new ConnectorRegistry();

  // Register YouTube with its dedicated connector (supports API + fallback)
  registry.register(new YouTubeConnector());

  // Register grounded search connectors for all other platforms
  for (const platformId of GROUNDED_SEARCH_PLATFORMS) {
    // Skip youtube — it has a dedicated connector
    if (platformId === 'youtube') continue;
    // Skip platforms that already have dedicated connectors registered
    if (registry.getForPlatform(platformId)) continue;

    registry.register(new GroundedSearchConnector(platformId));
  }

  logger.info('Connector registry initialized', {
    totalConnectors: registry.size,
    platforms: registry.getAllPlatforms(),
  });

  return registry;
}

export const connectorRegistry: ConnectorRegistry = initializeRegistry();
