import { getDB } from "./connection.js";

let indexReady;

async function col() {
  const c = (await getDB()).collection("pantryItems");
  indexReady ??= c.createIndex({ householdCode: 1, expiry: 1 }).catch((e) => {
    indexReady = undefined;
    throw e;
  });
  await indexReady;
  return c;
}

export async function list(code) {
  return (await col())
    .aggregate([
      { $match: { householdCode: code } },
      {
        $addFields: {
          noExpiry: { $cond: [{ $ifNull: ["$expiry", false] }, 0, 1] },
        },
      },
      { $sort: { noExpiry: 1, expiry: 1, name: 1, _id: 1 } },
      { $project: { noExpiry: 0 } },
    ])
    .toArray();
}

export async function get(code, id) {
  return (await col()).findOne({ _id: id, householdCode: code });
}

export async function create(code, doc) {
  const d = { ...doc, householdCode: code, createdAt: new Date() };
  const { insertedId } = await (await col()).insertOne(d);
  return { _id: insertedId, ...d };
}

export async function update(code, id, fields) {
  const { matchedCount } = await (
    await col()
  ).updateOne({ _id: id, householdCode: code }, { $set: fields });
  return matchedCount;
}

export async function remove(code, id) {
  const { deletedCount } = await (
    await col()
  ).deleteOne({ _id: id, householdCode: code });
  return deletedCount;
}
