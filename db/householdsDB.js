import { randomInt } from "node:crypto";
import { getDB } from "./connection.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
let indexReady;

export async function findByCode(code) {
  const db = await getDB();
  return db.collection("households").findOne({ code });
}

const newCode = () =>
  Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(
    "",
  );

// Ken: Just a suggestion. Since this function handles the household creation
// and join code logic, maybe adding a short comment explaining the process
// would make it easier for another developer to understand and maintain.
export async function create(name) {
  const col = (await getDB()).collection("households");
  indexReady ??= col.createIndex({ code: 1 }, { unique: true }).catch((e) => {
    indexReady = undefined;
    throw e;
  });
  await indexReady;
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    try {
      await col.insertOne({ name, code, createdAt: new Date() });
      return { name, code };
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
  }
  throw new Error("Could not generate a unique household code");
}
