import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { categoryOf, trackedCategorySchema, trackedItemWhere } from "../categories.js";

const createTrackedItemSchema = z.object({
  type: z.enum(["BOOK", "INTEREST"]),
  title: z.string().trim().min(1).max(200),
  note: z.string().trim().max(1000).optional(),
  author: z.string().trim().max(200).optional(),
  thumbnailUrl: z.string().trim().url().max(2000).optional(),
  externalId: z.string().trim().max(200).optional(),
  // 本のみ。省略時は「気になっている本」として登録する。
  bookStatus: z.enum(["WANT", "FINISHED"]).optional(),
  // 読了日。読了本の登録画面から "YYYY-MM-DD" で送られてくる。省略時は登録時刻。
  finishedAt: z.coerce.date().optional(),
});

const updateTrackedItemSchema = z
  .object({
    note: z.string().trim().max(1000).nullable().optional(),
    bookStatus: z.enum(["WANT", "FINISHED"]).optional(),
    finishedAt: z.coerce.date().nullable().optional(),
  })
  .refine((v) => v.note !== undefined || v.bookStatus !== undefined || v.finishedAt !== undefined, {
    message: "更新する項目がありません",
  });

const listQuerySchema = z.object({
  category: trackedCategorySchema.optional(),
});

/** レスポンスにカテゴリを含め、フロントで型とステータスから再計算しなくて済むようにする。 */
function withCategory<T extends { type: string; bookStatus: string | null }>(item: T) {
  return { ...item, category: categoryOf(item) };
}

export async function trackedItemsRoutes(app: FastifyInstance) {
  // M1: 追跡対象の一覧取得。category でカテゴリタブごとに絞り込める。
  app.get("/tracked-items", async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { category } = parsed.data;

    const items = await prisma.trackedItem.findMany({
      where: category ? trackedItemWhere(category) : undefined,
      orderBy: { createdAt: "desc" },
    });
    return items.map(withCategory);
  });

  // 追跡対象の詳細取得（本・トピック詳細画面用）
  app.get("/tracked-items/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await prisma.trackedItem.findUnique({ where: { id } });
    if (!item) {
      return reply.status(404).send({ error: "追跡対象が見つかりません" });
    }
    return withCategory(item);
  });

  // M1: 追跡対象の登録（本は検索結果からの選択、興味分野はフリーテキストを想定）
  app.post("/tracked-items", async (request, reply) => {
    const parsed = createTrackedItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { externalId, bookStatus, finishedAt, ...rest } = parsed.data;
    if (externalId) {
      const existing = await prisma.trackedItem.findFirst({ where: { externalId } });
      if (existing) {
        return reply.status(409).send({ error: "この本はすでに登録されています", item: withCategory(existing) });
      }
    }

    const status = rest.type === "BOOK" ? bookStatus ?? "WANT" : null;
    const item = await prisma.trackedItem.create({
      data: {
        ...rest,
        externalId,
        // 興味分野は読書状態を持たない
        bookStatus: status,
        // 読了日は読了本だけが持つ。指定がなければ登録時刻を読了日とみなす。
        finishedAt: status === "FINISHED" ? finishedAt ?? new Date() : null,
      },
    });
    return reply.status(201).send(withCategory(item));
  });

  // 読書状態の変更（「気になっている本」→「読み終わった本」の移動など）
  app.patch("/tracked-items/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateTrackedItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.trackedItem.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "追跡対象が見つかりません" });
    }
    if ((parsed.data.bookStatus || parsed.data.finishedAt) && existing.type !== "BOOK") {
      return reply.status(400).send({ error: "読書状態を持てるのは本だけです" });
    }

    // 読書状態が変わったら読了日も追随させる。
    // FINISHED になったら（明示指定がなければ）その時刻、WANT に戻したら null。
    const nextStatus = parsed.data.bookStatus ?? existing.bookStatus;
    const finishedAt =
      nextStatus === "FINISHED"
        ? parsed.data.finishedAt ?? existing.finishedAt ?? new Date()
        : null;

    const item = await prisma.trackedItem.update({
      where: { id },
      data: { ...parsed.data, ...(existing.type === "BOOK" ? { finishedAt } : {}) },
    });
    return withCategory(item);
  });

  // 追跡対象の削除
  app.delete("/tracked-items/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.trackedItem.delete({ where: { id } }).catch(() => null);
    return reply.status(204).send();
  });
}
