import { getDB } from "./connection.js";

export async function findByCode(code) {
  const db = await getDB();
  return db.collection("households").findOne({ code });
}
