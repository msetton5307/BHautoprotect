import "dotenv/config";
import express from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Middleware
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

async function startServer() {
  const server = await registerRoutes(app);

  const port = parseInt(process.env.PORT || "5000");
  const host = process.env.HOST || "0.0.0.0";

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    await setupVite(app, server);
  }

  server.listen(port, host, () => {
    log(`serving on port ${port}`);
  });
}

startServer().catch(console.error);