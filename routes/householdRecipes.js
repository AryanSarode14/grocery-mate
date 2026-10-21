import { Router } from "express";
import { ObjectId } from "mongodb";
import { requireHousehold } from "../middleware/householdCode.js";
import { list, get, create, update, remove } from "../db/householdRecipesDB.js";

const r = Router();
r.use(requireHousehold);

const toId = (s) => (/^[0-9a-f]{24}$/i.test(s) ? new ObjectId(s) : null);
const isStr = (v) => typeof v === "string";
const body = (b) => (b && typeof b === "object" && !Array.isArray(b) ? b : {});
const notFound = (res) => res.status(404).json({ error: "Recipe not found" });

function validate(b, partial) {
  const out = {};
  const errs = [];
  const has = (k) => b[k] !== undefined;
  const miss = (k) => {
    if (!partial) errs.push(`${k} is required`);
  };

  if (has("name")) {
    const n = isStr(b.name)
      ? b.name.trim().replace(/\s+/g, " ").toLowerCase()
      : "";
    if (!n) errs.push("name must be a non-empty string");
    else if (n.length > 120) errs.push("name must be at most 120 characters");
    else out.name = n;
  } else miss("name");

  if (has("minutes")) {
    const m = b.minutes;
    if (Number.isInteger(m) && m >= 1 && m <= 1440) out.minutes = m;
    else errs.push("minutes must be an integer from 1 to 1440");
  } else miss("minutes");

  for (const [k, lower, req] of [
    ["tags", true, false],
    ["ingredients", true, true],
    ["steps", false, true],
  ]) {
    if (!has(k)) {
      if (req) miss(k);
      else if (!partial) out[k] = [];
      continue;
    }
    if (!Array.isArray(b[k]) || !b[k].every(isStr)) {
      errs.push(`${k} must be an array of strings`);
      continue;
    }
    const a = b[k]
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (lower ? s.toLowerCase() : s));
    if (req && !a.length) errs.push(`${k} must have at least one item`);
    else out[k] = a;
  }

  for (const k of ["description", "createdBy"]) {
    if (!has(k)) {
      if (!partial) out[k] = "";
    } else if (isStr(b[k])) out[k] = b[k].trim();
    else errs.push(`${k} must be a string`);
  }

  if (out.ingredients) out.nIngredients = out.ingredients.length;
  if (partial && !errs.length && !Object.keys(out).length)
    errs.push("No fields to update");
  return { out, errs };
}

// Ken: This is alright, just a suggestion.
// I noticed that GET /api/household-recipes and GET /api/household-recipes/:id were not using.
// May be these can be removed. However, this didn't affect the functionality of the application, so it is not a big deal.
r.get("/", async (req, res) => res.json(await list(req.code)));

r.get("/:id", async (req, res) => {
  const id = toId(req.params.id);
  const d = id && (await get(req.code, id));
  if (!d) return notFound(res);
  res.json(d);
});

r.post("/", async (req, res) => {
  const { out, errs } = validate(body(req.body), false);
  if (errs.length) return res.status(400).json({ errors: errs });
  res.status(201).json(await create(req.code, out));
});

r.put("/:id", async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return notFound(res);
  const { out, errs } = validate(body(req.body), true);
  if (errs.length) return res.status(400).json({ errors: errs });
  const d = (await update(req.code, id, out)) && (await get(req.code, id));
  if (!d) return notFound(res);
  res.json(d);
});

r.delete("/:id", async (req, res) => {
  const id = toId(req.params.id);
  if (!id || !(await remove(req.code, id))) return notFound(res);
  res.sendStatus(204);
});

export default r;
