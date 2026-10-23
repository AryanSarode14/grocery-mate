/* 
I like how you separated your database connection logic from the operations found in the other "DB" files.
The separation is a nice division that keeps things easy to understand and maintain.
*/

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

export async function closeDB() {
  await c.close();
  db = undefined;
}
