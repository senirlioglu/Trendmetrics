import { Router } from "express";
import type { Request, Response } from "express";
import type { ApiResponse, PlatformConfig, PlatformCapability } from "@trendmetrics/shared";
import { PLATFORM_CONFIGS } from "@trendmetrics/shared";
import { healthCheck } from "../../db/index.js";

const router = Router();

const startedAt = Date.now();

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------

router.get("/", async (_req: Request, res: Response) => {
  const dbOk = await healthCheck();
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);

  const body: ApiResponse<{
    status: string;
    uptime: number;
    version: string;
    db: string;
  }> = {
    success: true,
    data: {
      status: "ok",
      uptime: uptimeSeconds,
      version: process.env["npm_package_version"] ?? "0.1.0",
      db: dbOk ? "connected" : "disconnected",
    },
  };

  res.status(dbOk ? 200 : 503).json(body);
});

// ---------------------------------------------------------------------------
// GET /api/health/connectors
// ---------------------------------------------------------------------------

interface ConnectorStatus {
  id: string;
  name: string;
  group: string;
  capabilities: PlatformCapability;
}

router.get("/connectors", (_req: Request, res: Response) => {
  const configs = PLATFORM_CONFIGS as Record<string, PlatformConfig>;
  const connectors: ConnectorStatus[] = Object.values(configs).map(
    (cfg: PlatformConfig) => ({
      id: cfg.id,
      name: cfg.name,
      group: cfg.group,
      capabilities: cfg.capabilities,
    }),
  );

  const body: ApiResponse<ConnectorStatus[]> = {
    success: true,
    data: connectors,
  };

  res.json(body);
});

export default router;
