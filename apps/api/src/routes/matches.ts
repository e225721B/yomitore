import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { categoryOf, feedCategorySchema, trackedItemWhere, type FeedCategory } from "../categories.js";

const queryFilterSchema = z.object({
  trackedItemId: z.string().trim().min(1).optional(),
  category: feedCategorySchema.optional(),
});

const TREND_WINDOW_DAYS = Number(process.env.TREND_WINDOW_DAYS ?? 7);
const TAKE = 50;

type ContentWithOrigins = Prisma.ContentGetPayload<{
  include: {
    matches: true;
    collections: { include: { trackedItem: true } };
  };
}>;

/** 画面に返す「この動画がこのタブに出ている理由」。score は Match があるときだけ入る。 */
type FeedOrigin = {
  trackedItemId: string;
  trackedItemTitle: string;
  trackedItemType: string;
  category: FeedCategory;
  score: number | null;
};

function windowStart(): Date {
  return new Date(Date.now() - TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * 「その内容がどれだけ盛り上がっているか」の簡易スコア。
 * 関連する追跡対象の一致度の合計に、新しいものほど有利になる係数を掛ける。
 * 係数は集計期間の端で 0.5 まで落ちるので、古くて強い話題より新着が上に来やすい。
 */
function hotScore(content: ContentWithOrigins, origins: FeedOrigin[]): number {
  const relevance = origins.reduce((sum, o) => sum + (o.score ?? 0), 0) || 1;
  const ageDays = (Date.now() - content.collectedAt.getTime()) / (24 * 60 * 60 * 1000);
  const recency = Math.max(0.5, 1 - (0.5 * ageDays) / TREND_WINDOW_DAYS);
  return relevance * recency;
}

export async function matchesRoutes(app: FastifyInstance) {
  // M4/M5: カテゴリタブごとの「トレンドの新着」。
  // trackedItemId を指定すると、その追跡対象（本・トピック詳細画面）に絞り込む。
  // category を指定すると、そのタブに対応するコンテンツだけを返す。
  app.get("/matches", async (request, reply) => {
    const parsed = queryFilterSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { trackedItemId, category } = parsed.data;

    const baseWhere = buildWhere(trackedItemId, category);

    // まず集計期間内で探し、まだデータが溜まっていなければ期間の制限なしで補う。
    let contents = await findContents({ ...baseWhere, collectedAt: { gte: windowStart() } });
    if (contents.length === 0) {
      contents = await findContents(baseWhere);
    }

    return contents
      .map((content) => {
        // 表示中のタブに該当する収集元だけを「出ている理由」として返す。
        const scoreOf = new Map(content.matches.map((m) => [m.trackedItemId, m.score]));
        const origins: FeedOrigin[] = content.collections
          .filter((collection) => {
            if (trackedItemId) return collection.trackedItemId === trackedItemId;
            if (category && category !== "OTHER") return categoryOf(collection.trackedItem) === category;
            return true;
          })
          .map((collection) => ({
            trackedItemId: collection.trackedItemId,
            trackedItemTitle: collection.trackedItem.title,
            trackedItemType: collection.trackedItem.type,
            category: categoryOf(collection.trackedItem),
            // AIマッチングがあれば一致度も添える（無ければ収集元の表示だけ）
            score: scoreOf.get(collection.trackedItemId) ?? null,
          }));
        return { content, origins };
      })
      .sort((a, b) => hotScore(b.content, b.origins) - hotScore(a.content, a.origins))
      .slice(0, TAKE)
      .map(({ content, origins }) => ({
        id: content.id,
        title: content.title,
        description: content.description,
        url: content.url,
        thumbnailUrl: content.thumbnailUrl,
        channelTitle: content.channelTitle,
        publishedAt: content.publishedAt,
        collectedAt: content.collectedAt,
        topic: content.topic,
        matches: origins,
      }));
  });
}

/**
 * 何を出すかは「どの追跡対象の検索で集まったか」(ContentCollection)で決める。
 * AIマッチングで絞ると1本の動画が複数タブに出てしまうため、タブごとに中身を独立させる。
 */
function buildWhere(trackedItemId: string | undefined, category: FeedCategory | undefined): Prisma.ContentWhereInput {
  if (trackedItemId) {
    return { collections: { some: { trackedItemId } } };
  }
  // 「その他」は追跡対象の検索では集まらなかった、ホットトピック起点のコンテンツ。
  // = ユーザーが登録していない、今盛り上がっている分野の話題。
  if (category === "OTHER") {
    return { topic: { not: null }, collections: { none: {} } };
  }
  if (category) {
    return { collections: { some: { trackedItem: trackedItemWhere(category) } } };
  }
  return { collections: { some: {} } };
}

function findContents(where: Prisma.ContentWhereInput): Promise<ContentWithOrigins[]> {
  return prisma.content.findMany({
    where,
    orderBy: { collectedAt: "desc" },
    // 並べ替えのために新着側を多めに取ってから、盛り上がり順に上位を返す。
    take: TAKE * 2,
    include: {
      matches: true,
      collections: { include: { trackedItem: true } },
    },
  });
}
