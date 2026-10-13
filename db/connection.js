import { MongoClient } from "mongodb";

const c = new MongoClient(process.env.MONGO_URI);
let db;

export async function getDB() {
  if (!db) {
    await c.connect();
    db = c.db("groceryMate");
  }
  return db;
}
