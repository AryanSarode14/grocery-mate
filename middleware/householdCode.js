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
    // Ken: This is alright, just a suggestion.
    // Noticed your household, keeps only code and throws the rest away.
    // Then in the households.js route, /me queries the database again for the same document.
    // We could store the whole household object in req.household and avoid the second call
    // by adding req.household = household
    req.code = household.code;
    next();
  } catch (err) {
    next(err);
  }
}
