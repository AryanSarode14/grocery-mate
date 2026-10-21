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

const DAY = 864e5;

export async function summary(code, today) {
  const soon = new Date(+today + 3 * DAY);
  const week = new Date(+today + 7 * DAY);
  const has = { $ne: [{ $ifNull: ["$expiry", null] }, null] };
  const count = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });
  const within = (end) => ({
    $and: [has, { $gte: ["$expiry", today] }, { $lte: ["$expiry", end] }],
  });
  const [s] = await (
    await col()
  )
    .aggregate([
      { $match: { householdCode: code } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          expired: count({ $and: [has, { $lt: ["$expiry", today] }] }),
          soon: count(within(soon)),
          thisWeek: count(within(week)),
          noExpiry: count({ $not: [has] }),
        },
      },
      { $project: { _id: 0 } },
    ])
    .toArray();
  return s ?? { total: 0, expired: 0, soon: 0, thisWeek: 0, noExpiry: 0 };
}

export async function get(code, id) {
  // Ken: I noticed every read, update and delete includes householdCode.
  // So one household can’t touch another’s data. This is great!
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
