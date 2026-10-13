import { findByCode } from "../db/householdsDB.js";

export async function requireHousehold(req, res, next) {
  const code = req.get("x-household-code")?.trim().toUpperCase();
  if (!code) {
    return res.status(401).json({ error: "Missing household code" });
  }
  try {
    const household = await findByCode(code);
    if (!household) {
      return res.status(404).json({ error: "Household not found" });
    }
    req.code = household.code;
    next();
  } catch (err) {
    next(err);
  }
}
