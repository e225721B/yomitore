import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";

const queryFilterSchema = z.object({
  trackedItemId: z.string().trim().min(1).optional(),
});

export async function matchesRoutes(app: FastifyInstance) {
  // M4: 追跡対象にマッチした新着コンテンツの一覧。
  // trackedItemId を指定すると、その追跡対象（本・トピック詳細画面）に絞り込む。
  app.get("/matches", async (request, reply) => {
    const parsed = queryFilterSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { trackedItemId } = parsed.data;

    const contents = await prisma.content.findMany({
      where: {
        matches: trackedItemId ? { some: { trackedItemId } } : { some: {} },
      },
      orderBy: { collectedAt: "desc" },
      take: 50,
      include: {
        matches: {
          orderBy: { score: "desc" },
          include: { trackedItem: true },
        },
      },
    });

    return contents.map((content) => ({
      id: content.id,
      title: content.title,
      description: content.description,
      url: content.url,
      thumbnailUrl: content.thumbnailUrl,
      channelTitle: content.channelTitle,
      publishedAt: content.publishedAt,
      collectedAt: content.collectedAt,
      matches: content.matches
        .filter((match) => !trackedItemId || match.trackedItemId === trackedItemId)
        .map((match) => ({
          trackedItemId: match.trackedItemId,
          trackedItemTitle: match.trackedItem.title,
          trackedItemType: match.trackedItem.type,
          score: match.score,
        })),
    }));
  });
}
