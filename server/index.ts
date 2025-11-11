import "dotenv/config";
import express from "express";
import net from "node:net";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Middleware
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

async function startServer() {
  const server = await registerRoutes(app);

  const desiredPort = Number.parseInt(process.env.PORT || "5000", 10);
  const basePort = Number.isNaN(desiredPort) ? 5000 : desiredPort;
  const host = process.env.HOST || "0.0.0.0";

  const port = await findAvailablePort(basePort, host);

  if (port !== basePort) {
    log(`port ${basePort} is in use, switched to ${port}`);
  }

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

async function findAvailablePort(port: number, host: string): Promise<number> {
  let candidate = port;
  for (let attempts = 0; attempts < 20; attempts += 1) {
    const isAvailable = await isPortAvailable(candidate, host);
    if (isAvailable) {
      return candidate;
    }
    candidate += 1;
  }

  throw new Error(
    `Unable to find an available port after checking 20 ports starting from ${port}`,
  );
}

function isPortAvailable(port: number, host: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();

    tester.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }

      reject(error);
    });

    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });

    tester.listen(port, host);
  });
}