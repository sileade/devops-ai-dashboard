import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { generalLimiter, burstLimiter, authLimiter, aiLimiter, infrastructureLimiter } from "./rateLimit";
import { initializeWebSocket } from "./websocket";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Initialize WebSocket server
  initializeWebSocket(server);
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // Apply rate limiting middleware
  // Burst limiter - prevents rapid-fire requests (10 req/sec)
  app.use("/api", burstLimiter);
  
  // General rate limiter for all API routes (100 req/15min)
  app.use("/api", generalLimiter);
  
  // Stricter rate limiting for authentication endpoints (10 req/15min)
  app.use("/api/oauth", authLimiter);
  
  // Rate limiting for AI endpoints (30 req/15min)
  app.use("/api/trpc/ai", aiLimiter);
  
  // Rate limiting for infrastructure operations (20 req/15min)
  app.use("/api/trpc/docker", infrastructureLimiter);
  app.use("/api/trpc/kubernetes", infrastructureLimiter);
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  // Health check endpoint (not rate limited)
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`WebSocket server initialized on same port`);
    console.log(`Rate limiting enabled: General (100/15min), Auth (10/15min), AI (30/15min), Infrastructure (20/15min)`);
  });
}

startServer().catch(console.error);
