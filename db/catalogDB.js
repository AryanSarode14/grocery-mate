import { getDB } from "./connection.js";

const SIZE = 20;
const HIDE = [
  "preparation",
  "time-to-make",
  "course",
  "dietary",
  "main-ingredient",
  "occasion",
  "cuisine",
  "low-in-something",
  "number-of-servings",
  "equipment",
  "taste-mood",
];
const fields = { _id: 1, name: 1, minutes: 1, tags: 1, nIngredients: 1 };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cat = async () => (await getDB()).collection("catalog");

function filter({ q, maxMinutes, tag }) {
  const f = {};
  const s = q?.trim();
  if (s) {
    // Ken: Nice, escaping the search text before new RegExp avoids regex injection
    const re = new RegExp(esc(s), "i");
    f.$or = [{ name: re }, { ingredients: re }];
  }
  if (maxMinutes) f.minutes = { $lte: maxMinutes };
  const t = tag?.trim().toLowerCase();
  if (t) f.tags = t;
  return f;
}

export async function search({ q, maxMinutes, tag, page = 1, code }) {
  const f = filter({ q, maxMinutes, tag });
  const p = [
    { $match: f },
    { $project: { ...fields, src: { $literal: "catalog" } } },
  ];
  if (code)
    p.push({
      $unionWith: {
        coll: "householdRecipes",
        pipeline: [
          { $match: { ...f, householdCode: code } },
          { $project: { ...fields, src: { $literal: "household" } } },
        ],
      },
    });
  p.push(
    { $sort: { name: 1, _id: 1 } },
    {
      $facet: {
        items: [{ $skip: (page - 1) * SIZE }, { $limit: SIZE }],
        total: [{ $count: "n" }],
      },
    },
  );
  const [{ items, total }] = await (await cat()).aggregate(p).toArray();
  const n = total[0]?.n ?? 0;
  return { items, total: n, page, pages: Math.ceil(n / SIZE) };
}

export async function tagCounts(code) {
  const p = [{ $project: { _id: 0, tags: 1 } }];
  if (code)
    p.push({
      $unionWith: {
        coll: "householdRecipes",
        pipeline: [
          { $match: { householdCode: code } },
          { $project: { _id: 0, tags: 1 } },
        ],
      },
    });
  p.push(
    { $unwind: "$tags" },
    { $match: { tags: { $nin: HIDE } } },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 30 },
    { $project: { _id: 0, tag: "$_id", count: 1 } },
  );
  return (await cat()).aggregate(p).toArray();
}

export async function getCatalog(id) {
  return (await cat()).findOne({ _id: id });
}
