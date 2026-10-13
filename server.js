import "dotenv/config";
import express from "express";
import { getDB } from "./db/connection.js";

const app = express();
app.use(express.json());
app.use(express.static("frontend"));

app.get("/api/health", async (req, res) => {
  await (await getDB()).command({ ping: 1 });
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000);
