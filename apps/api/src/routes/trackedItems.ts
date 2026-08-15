import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";

const createTrackedItemSchema = z.object({
  type: z.enum(["BOOK", "INTEREST"]),
  title: z.string().trim().min(1).max(200),
  note: z.string().trim().max(1000).optional(),
  author: z.string().trim().max(200).optional(),
  thumbnailUrl: z.string().trim().url().max(2000).optional(),
  externalId: z.string().trim().max(200).optional(),
});

export async function trackedItemsRoutes(app: FastifyInstance) {
  // M1: 追跡対象の一覧取得
  app.get("/tracked-items", async () => {
    return prisma.trackedItem.findMany({ orderBy: { createdAt: "desc" } });
  });

  // 追跡対象の詳細取得（本・トピック詳細画面用）
  app.get("/tracked-items/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await prisma.trackedItem.findUnique({ where: { id } });
    if (!item) {
      return reply.status(404).send({ error: "追跡対象が見つかりません" });
    }
    return item;
  });

  // M1: 追跡対象の登録（本は検索結果からの選択、興味分野はフリーテキストを想定）
  app.post("/tracked-items", async (request, reply) => {
    const parsed = createTrackedItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { externalId } = parsed.data;
    if (externalId) {
      const existing = await prisma.trackedItem.findFirst({ where: { externalId } });
      if (existing) {
        return reply.status(409).send({ error: "この本はすでに登録されています", item: existing });
      }
    }

    const item = await prisma.trackedItem.create({ data: parsed.data });
    return reply.status(201).send(item);
  });

  // 追跡対象の削除
  app.delete("/tracked-items/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.trackedItem.delete({ where: { id } }).catch(() => null);
    return reply.status(204).send();
  });
}
