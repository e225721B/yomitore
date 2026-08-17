import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { redis } from "../redis.js";
import { feedCategorySchema, type FeedCategory } from "../categories.js";

const TRENDS_KEY = "trends:latest";

const querySchema = z.object({
  category: feedCategorySchema.optional(),
});

type CachedTrends = {
  windowDays: number | null;
  updatedAt: string | null;
  items: { category?: FeedCategory }[];
  topics?: { topic: string; contentCount: number }[];
};

const EMPTY = { windowDays: null, updatedAt: null, items: [], topics: [] };

export async function trendsRoutes(app: FastifyInstance) {
  // M5: トレンド表示。Redis(ElastiCache相当)のキャッシュを読むだけで応答し、DBには触れない。
  // category を指定すると、そのカテゴリタブのランキングだけを返す。
  app.get("/trends", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { category } = parsed.data;

    const raw = await redis.get(TRENDS_KEY);
    if (!raw) {
      return EMPTY;
    }

    const cached = JSON.parse(raw) as CachedTrends;
    const topics = cached.topics ?? [];

    if (!category) {
      return { ...cached, topics };
    }
    // 「その他」は追跡対象ではなくホットトピックのランキングを見せる。
    if (category === "OTHER") {
      return { windowDays: cached.windowDays, updatedAt: cached.updatedAt, items: [], topics };
    }
    return {
      windowDays: cached.windowDays,
      updatedAt: cached.updatedAt,
      items: cached.items.filter((item) => item.category === category),
      topics: [],
    };
  });
}
