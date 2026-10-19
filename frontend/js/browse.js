import { api } from "./api.js";
import { $, el, store } from "./dom.js";

const plural = (n, word) =>
  `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

const p = new URLSearchParams(location.search);
const q = p.get("q")?.trim() ?? "";
const tag = p.get("tag")?.trim().toLowerCase() ?? "";
const max = p.get("maxMinutes")?.trim() ?? "";

const query = (changes = {}) => {
  const u = new URLSearchParams();
  for (const k of ["q", "maxMinutes", "tag", "page"]) {
    const v = k in changes ? changes[k] : p.get(k)?.trim();
    if (v) u.set(k, v);
  }
  return u.toString();
};
const link = (changes) => {
  const s = query(changes);
  return s ? `browse.html?${s}` : "browse.html";
};

function setupForm() {
  $("q").value = q;
  const sel = $("maxMinutes");
  if (/^\d+$/.test(max) && ![...sel.options].some((o) => o.value === max))
    sel.append(new Option(`Up to ${max} minutes`, max));
  sel.value = max;
  if (tag) {
    const h = el("input");
    h.type = "hidden";
    h.name = "tag";
    h.value = tag;
    $("search").append(h);
  }
}

const fetchAll = () =>
  Promise.all([api("/api/recipes/tags"), api(`/api/recipes?${query()}`)]);

async function load() {
  try {
    return await fetchAll();
  } catch (e) {
    if (e.status !== 404 || e.message !== "Household not found") throw e;
    store.remove("householdCode");
    $("notice").textContent =
      "Your saved household code is no longer valid, showing catalog recipes only.";
    $("notice").hidden = false;
    return fetchAll();
  }
}

function renderTags(tags) {
  const list = tags.map((t) => [t.tag, t.count]);
  if (tag && !list.some(([t]) => t === tag)) list.unshift([tag, null]);
  const ul = el("ul");
  for (const [t, n] of list) {
    const on = t === tag;
    const a = el("a", on ? "chip on" : "chip", t);
    a.href = link({ tag: on ? "" : t, page: "" });
    if (n != null) a.append(el("span", "n", n.toLocaleString()));
    if (on) {
      a.setAttribute("aria-current", "true");
      a.append(el("span", "sr-only", " (selected, remove filter)"));
    }
    const li = el("li");
    li.append(a);
    ul.append(li);
  }
  $("tags").replaceChildren(ul);
}

function renderCount(total) {
  let s = plural(total, "recipe");
  if (q) s += ` for “${q}”`;
  if (tag) s += ` tagged ${tag}`;
  if (max) s += ` ready in ${max} minutes or less`;
  $("count").textContent = s;
}

function card(r) {
  const a = el("a", "card");
  a.href = `recipe.html?${new URLSearchParams({ src: r.src, id: r._id })}`;
  a.append(el("h2", null, r.name));
  a.append(
    el(
      "p",
      "meta",
      `${r.minutes} min · ${plural(r.nIngredients, "ingredient")}`,
    ),
  );
  if (r.tags?.length) {
    const ul = el("ul", "mini");
    for (const t of r.tags.slice(0, 3)) ul.append(el("li", null, t));
    a.append(ul);
  }
  if (r.src === "household") a.append(el("span", "badge", "Your household"));
  const li = el("li");
  li.append(a);
  return li;
}

function renderResults({ items, total }) {
  $("results").replaceChildren(...items.map(card));
  const empty = $("empty");
  if (items.length) return;
  if (!total) {
    empty.textContent =
      "No recipes match. Try removing the tag or time filter.";
  } else {
    const a = el("a", null, "Go to page 1");
    a.href = link({ page: "" });
    empty.replaceChildren("That page is past the end of the results. ", a);
  }
  empty.hidden = false;
}

function renderPager({ page, pages }) {
  const nav = $("pager");
  if (pages <= 1 || page > pages) return;
  const go = (n, text, rel) => {
    const a = el("a", "button quiet", text);
    a.href = link({ page: n === 1 ? "" : String(n) });
    a.rel = rel;
    return a;
  };
  nav.replaceChildren(
    page > 1 ? go(page - 1, "Previous", "prev") : el("span"),
    el("span", "pos", `Page ${page} of ${pages}`),
    page < pages ? go(page + 1, "Next", "next") : el("span"),
  );
  nav.hidden = false;
}

function showError(e) {
  const box = $("error");
  box.replaceChildren(
    el(
      "p",
      null,
      e.errors?.length
        ? "Couldn't load recipes:"
        : `Couldn't load recipes: ${e.message}`,
    ),
  );
  if (e.errors?.length) {
    const ul = el("ul");
    for (const m of e.errors) ul.append(el("li", null, m));
    box.append(ul);
  }
  box.hidden = false;
}

setupForm();
$("status").textContent = "Loading recipes…";
try {
  const [tags, res] = await load();
  renderTags(tags);
  renderCount(res.total);
  renderResults(res);
  renderPager(res);
} catch (e) {
  showError(e);
} finally {
  $("status").textContent = "";
}
