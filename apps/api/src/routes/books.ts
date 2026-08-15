import type { FastifyInstance } from "fastify";
import { z } from "zod";

const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
});

type GoogleBooksItem = {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
};

export type BookSearchResult = {
  externalId: string;
  title: string;
  authors: string[];
  thumbnailUrl: string | null;
  publishedDate: string | null;
  description: string | null;
};

export async function booksRoutes(app: FastifyInstance) {
  // 本の検索（優先機能: 検索 → 選択 → 登録の入口）。Google Books APIを利用する。
  // GOOGLE_BOOKS_API_KEY未設定の場合はキー不要の匿名枠（クォータが非常に少ない）で呼び出す。
  app.get("/books/search", async (request, reply) => {
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", parsed.data.q);
    url.searchParams.set("maxResults", "10");
    url.searchParams.set("country", "JP");
    if (process.env.GOOGLE_BOOKS_API_KEY) {
      url.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY);
    }

    let upstream: Response;
    try {
      upstream = await fetch(url);
    } catch (err) {
      app.log.error(err, "book search upstream request failed");
      return reply.status(502).send({ error: "書籍検索サービスに接続できませんでした" });
    }

    if (upstream.status === 429) {
      app.log.error("book search upstream rate limited (quota exceeded)");
      return reply
        .status(503)
        .send({ error: "検索サービスが混み合っています。しばらくしてから再度お試しください" });
    }

    if (!upstream.ok) {
      app.log.error({ status: upstream.status }, "book search upstream returned error");
      return reply.status(502).send({ error: "書籍検索に失敗しました" });
    }

    const data = (await upstream.json()) as { items?: GoogleBooksItem[] };
    const results: BookSearchResult[] = (data.items ?? [])
      .filter((item) => item.volumeInfo?.title)
      .map((item) => ({
        externalId: item.id,
        title: item.volumeInfo!.title!,
        authors: item.volumeInfo!.authors ?? [],
        thumbnailUrl: item.volumeInfo!.imageLinks?.thumbnail?.replace(/^http:/, "https:") ?? null,
        publishedDate: item.volumeInfo!.publishedDate ?? null,
        description: item.volumeInfo!.description ?? null,
      }));

    return results;
  });
}
