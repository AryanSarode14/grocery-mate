import { getDB } from "./connection.js";

const col = async () => (await getDB()).collection("householdRecipes");

export async function list(code) {
  return (await col())
    .find({ householdCode: code })
    .sort({ createdAt: -1, _id: -1 })
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
