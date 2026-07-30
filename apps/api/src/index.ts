import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({
  logger: true,
});

await app.register(cors);

app.get("/", async () => {
  return {
    success: true,
    name: "Habibi Arbitrage Engine API",
    version: "1.0.0",
    status: "ONLINE",
  };
});

app.get("/health", async () => {
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
});

const PORT = Number(process.env.PORT) || 3001;

try {
  await app.listen({
    port: PORT,
    host: "0.0.0.0",
  });

  console.log(`🚀 API Running → http://localhost:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
