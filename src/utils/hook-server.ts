import http from "node:http";
import streamDeck from "@elgato/streamdeck";
import { claudeState } from "./state";

const PORT = 19475;

let server: http.Server | null = null;

export function startHookServer(): void {
  if (server) return;

  server = http.createServer((req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405);
      res.end();
      return;
    }

    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const pathParts = (req.url ?? "").split("/").filter(Boolean);
        // POST /hook/:eventType
        const eventType = pathParts[1] ?? "unknown";
        const data = body ? JSON.parse(body) : {};

        streamDeck.logger.info(`Hook received: ${eventType} ${JSON.stringify(data).slice(0, 200)}`);
        claudeState.handleHookEvent(eventType, data);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        streamDeck.logger.error(`Hook parse error: ${err}`);
        res.writeHead(400);
        res.end(JSON.stringify({ error: "invalid json" }));
      }
    });
  });

  server.listen(PORT, "127.0.0.1", () => {
    streamDeck.logger.info(`Hook server listening on http://127.0.0.1:${PORT}`);
    claudeState.setState("idle");
  });

  server.on("error", (err) => {
    streamDeck.logger.error(`Hook server error: ${err}`);
  });
}

export function stopHookServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}
