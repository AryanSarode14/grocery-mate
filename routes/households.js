import { Router } from "express";
import { requireHousehold } from "../middleware/householdCode.js";
import { findByCode, create } from "../db/householdsDB.js";

const r = Router();

const isStr = (v) => typeof v === "string";
const body = (b) => (b && typeof b === "object" && !Array.isArray(b) ? b : {});

function validateName(v) {
  if (v === undefined) return "name is required";
  const n = isStr(v) ? v.trim() : "";
  if (!n) return "name must be a non-empty string";
  if (n.length > 60) return "name must be at most 60 characters";
  return null;
}

r.post("/", async (req, res) => {
  const { name } = body(req.body);
  const err = validateName(name);
  if (err) return res.status(400).json({ errors: [err] });
  res.status(201).json(await create(name.trim()));
});

r.get("/me", requireHousehold, async (req, res) => {
  const { name, code } = await findByCode(req.code);
  res.json({ name, code });
});

export default r;
