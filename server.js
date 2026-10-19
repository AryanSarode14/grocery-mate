import "dotenv/config";
import express from "express";
import householdRecipes from "./routes/householdRecipes.js";
import households from "./routes/households.js";
import pantry from "./routes/pantry.js";
import recipes from "./routes/recipes.js";

const app = express();
app.use(express.json());
app.use(express.static("frontend"));

app.use("/api/household-recipes", householdRecipes);
app.use("/api/households", households);
app.use("/api/pantry", pantry);
app.use("/api/recipes", recipes);
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === "entity.parse.failed")
    return res.status(400).json({ error: "Invalid JSON body" });
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(process.env.PORT || 3000);
