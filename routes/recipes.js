import { Router } from "express";
import { ObjectId } from "mongodb";
import { requireHousehold } from "../middleware/householdCode.js";
import { search, tagCounts, getCatalog } from "../db/catalogDB.js";
import { get } from "../db/householdRecipesDB.js";

const r = Router();

const optionalHousehold = (req, res, next) =>
  req.get("x-household-code")?.trim()
    ? requireHousehold(req, res, next)
    : next();

r.use(optionalHousehold);

// Ken: This is alright, just a suggestion.
// I noticed toId, notFound helper functions are defined in multiple files.
// We could create a js that just for this helper functions and import them in the files that need them.
// However, this didn't affect the functionality of the application, so it is not a big deal.
const toId = (s) => (/^[0-9a-f]{24}$/i.test(s) ? new ObjectId(s) : null);
const notFound = (res) => res.status(404).json({ error: "Recipe not found" });

function parse(qs) {
  const errs = [];
  // Ken: This is great! It prevent the odd query parameters from being passed to the Mongo.
  const one = (k) => {
    const v = qs[k];
    if (v === undefined || typeof v === "string") return v;
    errs.push(`${k} must be a single value`);
  };
  const int = (k, v, min, max) => {
    if (v === undefined || v === "") return undefined;
    const n = /^\d+$/.test(v) ? Number(v) : NaN;
    if (n >= min && n <= max) return n;
    errs.push(`${k} must be an integer from ${min} to ${max}`);
  };

  const q = one("q");
  if (q?.trim().length > 100) errs.push("q must be at most 100 characters");
  const tag = one("tag");
  const maxMinutes = int("maxMinutes", one("maxMinutes"), 1, 1440);
  const page = int("page", one("page"), 1, 10000) ?? 1;
  return { errs, q, tag, maxMinutes, page };
}

r.get("/", async (req, res) => {
  const { errs, ...p } = parse(req.query);
  if (errs.length) return res.status(400).json({ errors: errs });
  res.json(await search({ ...p, code: req.code }));
});

r.get("/tags", async (req, res) => res.json(await tagCounts(req.code)));

r.get("/:src/:id", async (req, res) => {
  const { src, id } = req.params;
  if (src === "catalog") {
    const d = /^\d+$/.test(id) && (await getCatalog(Number(id)));
    return d ? res.json(d) : notFound(res);
  }
  if (src === "household") {
    if (!req.code)
      return res.status(401).json({ error: "Missing household code" });
    const oid = toId(id);
    const d = oid && (await get(req.code, oid));
    return d ? res.json(d) : notFound(res);
  }
  notFound(res);
});

export default r;
