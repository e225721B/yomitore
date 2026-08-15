import type { FastifyInstance } from "fastify";
import { redis } from "../redis.js";

const TRENDS_KEY = "trends:latest";

export async function trendsRoutes(app: FastifyInstance) {
  // M5: トレンド表示。Redis(ElastiCache相当)のキャッシュを読むだけで応答し、DBには触れない。
  app.get("/trends", async () => {
    const raw = await redis.get(TRENDS_KEY);
    if (!raw) {
      return { windowDays: null, updatedAt: null, items: [] };
    }
    return JSON.parse(raw);
  });
}
