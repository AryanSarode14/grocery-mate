import "dotenv/config";
import express from "express";
import { getDB } from "./db/connection.js";
import householdRecipes from "./routes/householdRecipes.js";
import recipes from "./routes/recipes.js";

const app = express();
app.use(express.json());
app.use(express.static("frontend"));

app.get("/api/health", async (req, res) => {
  await (await getDB()).command({ ping: 1 });
  res.json({ ok: true });
});

app.use("/api/household-recipes", householdRecipes);
app.use("/api/recipes", recipes);

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === "entity.parse.failed")
    return res.status(400).json({ error: "Invalid JSON body" });
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(process.env.PORT || 3000);
