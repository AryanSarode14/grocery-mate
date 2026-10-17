import { Router } from "express";
import { ObjectId } from "mongodb";
import { requireHousehold } from "../middleware/householdCode.js";
import { list, get, create, update, remove } from "../db/pantryDB.js";

const r = Router();
r.use(requireHousehold);

const CATEGORIES = [
  "produce",
  "dairy",
  "meat",
  "seafood",
  "grains",
  "bakery",
  "spices",
  "canned",
  "frozen",
  "snacks",
  "drinks",
  "other",
];

const toId = (s) => (/^[0-9a-f]{24}$/i.test(s) ? new ObjectId(s) : null);
const isStr = (v) => typeof v === "string";
const body = (b) => (b && typeof b === "object" && !Array.isArray(b) ? b : {});
const notFound = (res) =>
  res.status(404).json({ error: "Pantry item not found" });
const fmt = (d) => ({
  ...d,
  expiry: d.expiry ? d.expiry.toISOString().slice(0, 10) : null,
});

function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  const ok =
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d;
  return ok ? dt : null;
}

function validate(b, partial) {
  const out = {};
  const errs = [];
  const has = (k) => b[k] !== undefined;

  if (has("name")) {
    const n = isStr(b.name)
      ? b.name.trim().replace(/\s+/g, " ").toLowerCase()
      : "";
    if (!n) errs.push("name must be a non-empty string");
    else if (n.length > 80) errs.push("name must be at most 80 characters");
    else out.name = n;
  } else if (!partial) errs.push("name is required");

  for (const k of ["quantity", "boughtBy"]) {
    if (!has(k)) {
      if (!partial) out[k] = "";
    } else if (!isStr(b[k])) errs.push(`${k} must be a string`);
    else if (b[k].trim().length > 40)
      errs.push(`${k} must be at most 40 characters`);
    else out[k] = b[k].trim();
  }

  if (!has("category")) {
    if (!partial) out.category = "other";
  } else if (CATEGORIES.includes(b.category)) out.category = b.category;
  else errs.push(`category must be one of: ${CATEGORIES.join(", ")}`);

  if (!has("expiry")) {
    if (!partial) out.expiry = null;
  } else if (b.expiry === null || b.expiry === "") out.expiry = null;
  else {
    const dt = isStr(b.expiry) ? parseDate(b.expiry) : null;
    if (dt) out.expiry = dt;
    else errs.push("expiry must be a real date in YYYY-MM-DD format, or null");
  }

  if (partial && !errs.length && !Object.keys(out).length)
    errs.push("No fields to update");
  return { out, errs };
}

r.get("/", async (req, res) => res.json((await list(req.code)).map(fmt)));

r.get("/:id", async (req, res) => {
  const id = toId(req.params.id);
  const d = id && (await get(req.code, id));
  if (!d) return notFound(res);
  res.json(fmt(d));
});

r.post("/", async (req, res) => {
  const { out, errs } = validate(body(req.body), false);
  if (errs.length) return res.status(400).json({ errors: errs });
  res.status(201).json(fmt(await create(req.code, out)));
});

r.put("/:id", async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return notFound(res);
  const { out, errs } = validate(body(req.body), true);
  if (errs.length) return res.status(400).json({ errors: errs });
  const d = (await update(req.code, id, out)) && (await get(req.code, id));
  if (!d) return notFound(res);
  res.json(fmt(d));
});

r.delete("/:id", async (req, res) => {
  const id = toId(req.params.id);
  if (!id || !(await remove(req.code, id))) return notFound(res);
  res.sendStatus(204);
});

export default r;
