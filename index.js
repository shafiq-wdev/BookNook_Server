import "dotenv/config";

import cors from "cors";
import express from "express";

import { closeMongoDB, connectToMongoDB } from "./db.js";
import { booksRouter } from "./routes/books.js";
import { borrowsRouter } from "./routes/borrows.js";

const app = express();
const port = Number(process.env.PORT) || 8000;
const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(
  /\/+$/,
  ""
);

const allowedOrigins = new Set([clientUrl, "http://127.0.0.1:3000"]);

app.disable("x-powered-by");

app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server tools and same-origin requests without an Origin
      // header, plus the configured Next.js client origins.
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "BookNook API",
    status: "ok",
    routes: [
      "GET /books",
      "GET /books/:id",
      "POST /books",
      "PATCH /books/:id",
      "DELETE /books/:id",
      "POST /borrows",
      "GET /borrows",
      "DELETE /borrows/:id",
    ],
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/books", booksRouter);
app.use("/borrows", borrowsRouter);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found." });
});

// eslint-disable-next-line no-unused-vars
app.use((error, _req, res, _next) => {
  console.error("API error:", error);

  if (error?.message?.includes("not allowed by CORS")) {
    return res.status(403).json({ message: error.message });
  }

  return res.status(500).json({
    message: "Something went wrong on the server. Please try again.",
  });
});

let server;

async function start() {
  try {
    await connectToMongoDB();

    server = app.listen(port, () => {
      console.log(`BookNook API listening on http://localhost:${port}`);
      console.log(`Trusted client origin: ${clientUrl}`);
    });
  } catch (error) {
    console.error("Unable to start the BookNook API:", error);
    process.exitCode = 1;
  }
}

async function shutdown(signal) {
  console.log(`\n${signal} received. Closing BookNook API…`);

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await closeMongoDB();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();