import { api } from "./api.js";
import { $, el } from "./dom.js";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const p = new URLSearchParams(location.search);
const src = p.get("src");
const id = p.get("id");

// Ken: I like this setupBack() function. 
// It checks if the user came from browse.html and adds a back button to go back to that page. 
// This is a nice touch for user experience.
function setupBack() {
  let ref;
  try {
    ref = new URL(document.referrer);
  } catch {
    return;
  }
  if (ref.origin !== location.origin || !ref.pathname.endsWith("/browse.html"))
    return;
  $("back").addEventListener("click", (e) => {
    e.preventDefault();
    history.back();
  });
}

function fail(msg, href, label) {
  const box = $("error");
  box.replaceChildren(el("p", null, msg));
  if (href) {
    const a = el("a", null, label);
    a.href = href;
    box.firstChild.append(" ", a);
  }
  box.hidden = false;
}

const list = (tag, items, cls) => {
  const l = el(tag, cls);
  for (const t of items) l.append(el("li", null, t));
  return l;
};

function actions(r) {
  const div = el("div", "actions");
  const edit = el("a", "button", "Edit");
  edit.href = `recipe-form.html?${new URLSearchParams({ id: r._id })}`;
  const del = el("button", "danger", "Delete");
  del.type = "button";
  del.addEventListener("click", async () => {
    if (!confirm(`Delete “${r.name}”? This can't be undone.`)) return;
    del.disabled = true;
    del.textContent = "Deleting…";
    try {
      await api(`/api/household-recipes/${encodeURIComponent(r._id)}`, {
        method: "DELETE",
      });
      location.replace("browse.html");
    } catch (e) {
      del.disabled = false;
      del.textContent = "Delete";
      fail(`Couldn't delete this recipe: ${e.message}`);
    }
  });
  div.append(edit, del);
  return div;
}

function render(r) {
  document.title = `${r.name} · Grocery Mate`;
  const art = $("recipe");
  const own = src === "household";
  art.append(el("h1", null, r.name));
  art.append(
    el(
      "p",
      "meta",
      `${r.minutes} min · ${plural(r.nIngredients, "ingredient")}`,
    ),
  );
  if (r.tags?.length) art.append(list("ul", r.tags, "tags"));
  if (r.description) art.append(el("p", "description", r.description));
  if (own && r.createdBy) art.append(el("p", "by", `Added by ${r.createdBy}`));
  if (!own) art.append(el("p", "by", "From the Food.com catalog."));
  art.append(el("h2", null, "Ingredients"), list("ul", r.ingredients));
  art.append(el("h2", null, "Steps"), list("ol", r.steps));
  if (own) art.append(actions(r));
  art.hidden = false;
}

setupBack();
if (!src || !id) {
  fail("Recipe not found.", "browse.html", "Browse recipes");
} else {
  $("status").textContent = "Loading recipe…";
  try {
    render(
      await api(
        `/api/recipes/${encodeURIComponent(src)}/${encodeURIComponent(id)}`,
      ),
    );
  } catch (e) {
    if (e.status === 401 || e.message === "Household not found")
      fail("Join a household to see this recipe.", "index.html", "Join one");
    else if (e.status === 404)
      fail("Recipe not found.", "browse.html", "Browse recipes");
    else fail(`Couldn't load this recipe: ${e.message}`);
  } finally {
    $("status").textContent = "";
  }
}
