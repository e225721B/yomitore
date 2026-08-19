import Fastify from "fastify";
import cors from "@fastify/cors";
import { trackedItemsRoutes } from "./routes/trackedItems.js";
import { matchesRoutes } from "./routes/matches.js";
import { trendsRoutes } from "./routes/trends.js";
import { booksRoutes } from "./routes/books.js";
import { collectRoutes } from "./routes/collect.js";
import { releasesRoutes } from "./routes/releases.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
});

app.get("/health", async () => ({ status: "ok" }));

await app.register(trackedItemsRoutes);
await app.register(matchesRoutes);
await app.register(trendsRoutes);
await app.register(booksRoutes);
await app.register(collectRoutes);
await app.register(releasesRoutes);

const port = Number(process.env.PORT ?? 4000);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
