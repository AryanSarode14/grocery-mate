import { getDB } from "./connection.js";

const DAY = 864e5;
const LIMIT = 12;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Ken: This is alright, just a suggestion.
// word() won’t match plurals (‘egg’ vs ‘eggs’), so a lot of real pantry items will never produce suggestions. 
// We could add (?:e?s)? before the lookahead to resolve this issue
const word = (names) =>
  `(?<![a-z0-9])(${names.map(esc).join("|")})(?![a-z0-9])`;
const anyIngredient = (re) => ({
  $anyElementTrue: {
    $map: {
      input: "$ingredients",
      in: { $regexMatch: { input: "$$this", regex: re, options: "i" } },
    },
  },
});

// Ken: This is alright, just a suggestion.
// I noticed this loads all pantry items into JavaScript and then filters the items expiring this week. 
// May be we can let MongoDB filter the expiry range instead? 
// This might reduce the amount of data returned as the pantry gets larger.
export async function suggestions(code, today) {
  const db = await getDB();
  const week = new Date(+today + 7 * DAY);
  const items = await db
    .collection("pantryItems")
    .find({ householdCode: code }, { projection: { name: 1, expiry: 1 } })
    .toArray();
  const all = [...new Set(items.map((d) => d.name))];
  const using = [
    ...new Set(
      items
        .filter((d) => d.expiry && d.expiry >= today && d.expiry <= week)
        .map((d) => d.name),
    ),
  ];
  if (!using.length) return { using, recipes: [] };

  const list = using.map((name) => ({ name, re: word([name]) }));
  const recipes = await db
    .collection("catalog")
    .aggregate([
      { $match: { ingredients: { $regex: word(using), $options: "i" } } },
      {
        $addFields: {
          uses: {
            $map: {
              input: {
                $filter: {
                  input: { $literal: list },
                  as: "p",
                  cond: anyIngredient("$$p.re"),
                },
              },
              in: "$$this.name",
            },
          },
          have: {
            $size: {
              $filter: {
                input: "$ingredients",
                cond: {
                  $regexMatch: {
                    input: "$$this",
                    regex: word(all),
                    options: "i",
                  },
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          nUses: { $size: "$uses" },
          ratio: { $divide: ["$have", { $max: ["$nIngredients", 1] }] },
        },
      },
      { $sort: { nUses: -1, ratio: -1, nIngredients: 1, _id: 1 } },
      { $limit: LIMIT },
      {
        $project: {
          _id: 1,
          name: 1,
          minutes: 1,
          nIngredients: 1,
          uses: 1,
          have: 1,
        },
      },
    ])
    .toArray();
  return { using, recipes };
}
