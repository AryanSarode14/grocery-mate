import { api } from "./api.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const lines = (s) =>
  s
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
const commas = (s) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const detail = (id) =>
  `recipe.html?${new URLSearchParams({ src: "household", id })}`;

const id = new URLSearchParams(location.search).get("id");
const form = $("form");
const box = $("errors");
const save = $("save");

const stored = () => {
  try {
    return localStorage.getItem("householdCode");
  } catch {
    return null;
  }
};

function show(msg, items = [], href, label) {
  const p = el("p", null, msg);
  if (href) {
    const a = el("a", null, label);
    a.href = href;
    p.append(" ", a);
  }
  box.replaceChildren(p);
  if (items.length) {
    const ul = el("ul");
    for (const m of items) ul.append(el("li", null, m));
    box.append(ul);
  }
  box.hidden = false;
  box.focus();
}

function fill(r) {
  $("name").value = r.name;
  $("minutes").value = r.minutes;
  $("ingredients").value = r.ingredients.join("\n");
  $("steps").value = r.steps.join("\n");
  $("tags").value = r.tags.join(", ");
  $("description").value = r.description;
  $("createdBy").value = r.createdBy;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  box.hidden = true;
  save.disabled = true;
  save.textContent = "Saving…";
  const body = {
    name: $("name").value,
    minutes: Number($("minutes").value),
    ingredients: lines($("ingredients").value),
    steps: lines($("steps").value),
    tags: commas($("tags").value),
    description: $("description").value,
    createdBy: $("createdBy").value,
  };
  try {
    const r = await api(
      id
        ? `/api/household-recipes/${encodeURIComponent(id)}`
        : "/api/household-recipes",
      { method: id ? "PUT" : "POST", body },
    );
    location.replace(detail(r._id));
  } catch (err) {
    if (err.errors?.length) show("Please fix the following:", err.errors);
    else show(err.message);
    save.disabled = false;
    save.textContent = "Save recipe";
  }
});

const title = id ? "Edit recipe" : "Add a recipe";
$("title").textContent = title;
document.title = `${title} · Grocery Mate`;
$("cancel").href = id ? detail(id) : "browse.html";

if (!stored()) {
  $("join").hidden = false;
} else if (!id) {
  form.hidden = false;
} else {
  $("status").textContent = "Loading recipe…";
  try {
    fill(await api(`/api/recipes/household/${encodeURIComponent(id)}`));
    form.hidden = false;
  } catch (e) {
    if (e.status === 404 && e.message === "Recipe not found")
      show("Recipe not found.", [], "browse.html", "Browse recipes");
    else show(`Couldn't load this recipe: ${e.message}`);
  } finally {
    $("status").textContent = "";
  }
}
