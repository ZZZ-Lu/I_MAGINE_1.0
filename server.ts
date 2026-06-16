import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createProxyMiddleware } from "http-proxy-middleware";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Proxy API requests FIRST
  app.use(
    "/api/t8star",
    createProxyMiddleware({
      target: "https://ai.t8star.org",
      changeOrigin: true,
      pathRewrite: {
        "^/api/t8star": "", // remove base path
      },
      onProxyReq: (proxyReq, req, res) => {
        // Just generic proxy functionality
      },
    })
  );

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
