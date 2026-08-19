import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";

/**
 * 登録した本の続編・同じ著者の新刊。検出は Python ワーカー（releases_main.py）が担い、
 * ここは保存済みの結果を読む／既読にするだけ。
 */

const listQuerySchema = z.object({
  // "true" のとき未読だけを返す
  unseen: z.enum(["true", "false"]).optional(),
});

const updateSchema = z.object({
  seen: z.boolean(),
});

export async function releasesRoutes(app: FastifyInstance) {
  app.get("/releases", async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const releases = await prisma.bookRelease.findMany({
      where: parsed.data.unseen === "true" ? { seenAt: null } : undefined,
      // 発売日が未定のものは末尾に回す
      orderBy: [{ releaseDate: "desc" }, { detectedAt: "desc" }],
      take: 100,
      include: { trackedItem: { select: { id: true, title: true } } },
    });

    return releases.map(({ trackedItem, ...release }) => ({
      ...release,
      trackedItemId: trackedItem.id,
      trackedItemTitle: trackedItem.title,
    }));
  });

  // 既読／未読の切り替え
  app.patch("/releases/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.bookRelease.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "新刊情報が見つかりません" });
    }

    return prisma.bookRelease.update({
      where: { id },
      data: { seenAt: parsed.data.seen ? new Date() : null },
    });
  });

  // まとめて既読にする（一覧を開いたときの「すべて既読」用）
  app.post("/releases/seen-all", async () => {
    const { count } = await prisma.bookRelease.updateMany({
      where: { seenAt: null },
      data: { seenAt: new Date() },
    });
    return { updated: count };
  });
}
