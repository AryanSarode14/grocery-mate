import { api } from "./api.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

const getItem = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const setItem = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // storage blocked, nothing to remember
  }
};
const clearCode = () => {
  try {
    localStorage.removeItem("householdCode");
  } catch {
    // storage blocked, nothing to remove
  }
};
const isGone = (e) => e?.status === 404 && e.message === "Household not found";
const isMissing = (e) =>
  e?.status === 404 && e.message === "Pantry item not found";

const id = new URLSearchParams(location.search).get("id");
const form = $("form");
const box = $("errors");
const save = $("save");

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

function showJoin() {
  clearCode();
  box.hidden = true;
  form.hidden = true;
  $("join").hidden = false;
}

const notFound = () => {
  form.hidden = true;
  show("Item not found.", [], "pantry.html", "Back to pantry");
};

function fill(it) {
  $("name").value = it.name;
  $("quantity").value = it.quantity;
  $("category").value = it.category;
  $("boughtBy").value = it.boughtBy;
  $("expiry").value = it.expiry ?? "";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  box.hidden = true;
  save.disabled = true;
  save.textContent = "Saving…";
  const body = {
    name: $("name").value,
    quantity: $("quantity").value,
    category: $("category").value,
    boughtBy: $("boughtBy").value,
    expiry: $("expiry").value || null,
  };
  try {
    await api(id ? `/api/pantry/${encodeURIComponent(id)}` : "/api/pantry", {
      method: id ? "PUT" : "POST",
      body,
    });
    if (body.boughtBy.trim()) setItem("boughtBy", body.boughtBy.trim());
    location.replace("pantry.html");
    return;
  } catch (err) {
    if (isGone(err)) showJoin();
    else if (isMissing(err)) notFound();
    else if (err.errors?.length) show("Please fix the following:", err.errors);
    else show(err.message);
  }
  save.disabled = false;
  save.textContent = "Save item";
});

const title = id ? "Edit item" : "Add an item";
$("title").textContent = title;
document.title = `${title} · Grocery Mate`;

if (!getItem("householdCode")) {
  showJoin();
} else if (!id) {
  $("boughtBy").value = getItem("boughtBy") ?? "";
  form.hidden = false;
} else {
  $("status").textContent = "Loading item…";
  try {
    fill(await api(`/api/pantry/${encodeURIComponent(id)}`));
    form.hidden = false;
  } catch (e) {
    if (isGone(e)) showJoin();
    else if (isMissing(e)) notFound();
    else show(`Couldn't load this item: ${e.message}`);
  } finally {
    $("status").textContent = "";
  }
}
