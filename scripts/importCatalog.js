import "dotenv/config";
import { createReadStream } from "node:fs";
import { getDB, closeDB } from "../db/connection.js";

const CSV_PATH = new URL("../data/RAW_recipes.csv", import.meta.url);
const LIMIT = 5000;
const MAX_MINUTES = 1440;
const COLUMNS = [
  "name",
  "id",
  "minutes",
  "tags",
  "steps",
  "description",
  "ingredients",
  "n_ingredients",
];

function createCSVParser() {
  let field = "";
  let row = [];
  let inQuotes = false;
  let quotePending = false;

  function write(chunk) {
    const rows = [];
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];
      if (inQuotes) {
        if (quotePending) {
          quotePending = false;
          if (ch === '"') {
            field += '"';
            continue;
          }
          inQuotes = false;
        } else if (ch === '"') {
          quotePending = true;
          continue;
        } else {
          field += ch;
          continue;
        }
      }
      if (ch === '"' && field === "") {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        field = "";
        row = [];
      } else if (ch !== "\r") {
        field += ch;
      }
    }
    return rows;
  }

  function end() {
    if (inQuotes && !quotePending)
      throw new Error("CSV ends inside a quoted field");
    if (field === "" && row.length === 0) return [];
    row.push(field);
    return [row];
  }

  return { write, end };
}

const ESCAPES = { n: "\n", t: "\t", r: "\r", "\\": "\\", "'": "'", '"': '"' };

function parsePyList(text) {
  const s = text.trim();
  if (!s.startsWith("[") || !s.endsWith("]")) return [];
  const items = [];
  const end = s.length - 1;
  let i = 1;
  while (i < end) {
    const quote = s[i];
    if (quote === "," || /\s/.test(quote)) {
      i++;
      continue;
    }
    if (quote !== "'" && quote !== '"') return [];
    let item = "";
    i++;
    while (i < end && s[i] !== quote) {
      if (s[i] === "\\" && i + 1 < end) {
        item += ESCAPES[s[i + 1]] ?? "\\" + s[i + 1];
        i += 2;
      } else {
        item += s[i++];
      }
    }
    if (i >= end) return [];
    items.push(item);
    i++;
  }
  return items;
}

function indexColumns(header) {
  const col = {};
  header.forEach((h, i) => (col[h.replace(/^\uFEFF/, "").trim()] = i));
  const missing = COLUMNS.filter((name) => !(name in col));
  if (missing.length)
    throw new Error(`CSV is missing columns: ${missing.join(", ")}`);
  return col;
}

function toDoc(row, col) {
  const get = (name) => row[col[name]] ?? "";
  const trimAll = (list) => list.map((s) => s.trim()).filter(Boolean);

  const idText = get("id").trim();
  const id = Number(idText);
  const name = get("name").trim().replace(/\s+/g, " ").toLowerCase();
  const minutes = Number(get("minutes"));
  const ingredients = trimAll(parsePyList(get("ingredients"))).map((s) =>
    s.toLowerCase(),
  );
  const steps = trimAll(parsePyList(get("steps")));

  if (!idText || !Number.isInteger(id)) return null;
  if (!name || !ingredients.length || !steps.length) return null;
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > MAX_MINUTES)
    return null;

  return {
    _id: id,
    name,
    minutes,
    tags: trimAll(parsePyList(get("tags"))),
    ingredients,
    steps,
    description: get("description").replace(/\r\n?/g, "\n").trim(),
    nIngredients: Number(get("n_ingredients")),
  };
}

async function readRecipes() {
  const parser = createCSVParser();
  const docs = [];
  const seen = new Set();
  let col;

  const handle = (row) => {
    if (row.length === 1 && row[0] === "") return;
    if (!col) {
      col = indexColumns(row);
      return;
    }
    const doc = toDoc(row, col);
    if (doc && !seen.has(doc._id)) {
      seen.add(doc._id);
      docs.push(doc);
    }
  };

  read: for await (const chunk of createReadStream(CSV_PATH, {
    encoding: "utf8",
  })) {
    for (const row of parser.write(chunk)) {
      handle(row);
      if (docs.length === LIMIT) break read;
    }
  }
  if (docs.length < LIMIT) parser.end().forEach(handle);

  return docs;
}

async function main() {
  const docs = await readRecipes();
  if (!docs.length)
    throw new Error("No valid recipes found; catalog left unchanged");

  const catalog = (await getDB()).collection("catalog");
  await catalog.deleteMany({});
  const { insertedCount } = await catalog.insertMany(docs);
  await catalog.createIndex({ name: 1 });
  await catalog.createIndex({ tags: 1 });

  console.log(`Inserted ${insertedCount} recipes into catalog`);
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await closeDB();
}
