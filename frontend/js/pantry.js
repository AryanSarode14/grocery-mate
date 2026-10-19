import { api } from "./api.js";
import { $, el, store } from "./dom.js";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const KEY = "householdCode";
const getCode = () => store.get(KEY);
const clearCode = () => store.remove(KEY);
const isGone = (e) => e?.status === 404 && e.message === "Household not found";

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const now = new Date();
const today = ymd(now);
const soonEnd = ymd(
  new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3),
);

const pantryApi = (path, opts) =>
  api(`/api/pantry${path}?today=${today}`, opts);

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
function niceDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}${y === now.getFullYear() ? "" : `, ${y}`}`;
}

function expiryInfo(expiry) {
  if (!expiry) return { state: "", text: "No expiry" };
  if (expiry < today)
    return { state: "expired", text: `Expired ${niceDate(expiry)}` };
  const state = expiry <= soonEnd ? "soon" : "";
  return { state, text: `Expires ${niceDate(expiry)}` };
}

function showErrors(msgs) {
  const box = $("error");
  box.replaceChildren(...msgs.map((m) => el("p", null, m)));
  box.hidden = !msgs.length;
  if (msgs.length) box.focus();
}

function showJoin() {
  clearCode();
  showErrors([]);
  $("status").textContent = "";
  $("pantry").hidden = true;
  $("join").hidden = false;
}

function renderHousehold({ name, code }) {
  const a = el("a", null, "Switch household");
  a.href = "index.html";
  $("household").replaceChildren(
    el("strong", null, name),
    " · Code ",
    el("span", "code", code),
    " · ",
    a,
  );
}

function renderSummary(s) {
  $("summary").textContent =
    `${s.thisWeek} expiring this week · ${s.expired} expired · ${plural(s.total, "item")}`;
}

function itemRow(it) {
  const { state, text } = expiryInfo(it.expiry);
  const li = el("li", `item ${state}`.trim());
  li.append(el("h3", null, it.name));
  const meta = [
    it.quantity,
    it.category,
    it.boughtBy && `Bought by ${it.boughtBy}`,
  ].filter(Boolean);
  if (meta.length) li.append(el("p", "meta", meta.join(" · ")));

  const exp = el("p", "expiry");
  if (state === "soon") exp.append(el("span", "badge", "Use soon"), " ");
  if (state === "expired") {
    const b = el("span", "badge", "Expired");
    b.setAttribute("aria-hidden", "true");
    exp.append(b, " ");
  }
  exp.append(el("span", "date", text));
  li.append(exp);

  const edit = el("a", "button quiet", "Edit");
  edit.href = `pantry-form.html?${new URLSearchParams({ id: it._id })}`;
  edit.append(el("span", "sr-only", ` ${it.name}`));
  const del = el("button", "delete", "Delete");
  del.type = "button";
  del.append(el("span", "sr-only", ` ${it.name}`));
  del.addEventListener("click", () => removeItem(it, li, del));
  const actions = el("div", "actions");
  actions.append(edit, del);
  li.append(actions);
  return li;
}

function renderItems(items) {
  $("items").replaceChildren(...items.map(itemRow));
  $("empty").hidden = items.length > 0;
}

function ideaCard(r) {
  const a = el("a", "card");
  a.href = `recipe.html?${new URLSearchParams({ src: "catalog", id: r._id })}`;
  a.append(
    el("h3", null, r.name),
    el("p", "meta", `${r.minutes} min`),
    el("p", "uses", `Uses ${r.uses.join(", ")}`),
    el(
      "p",
      "have",
      `You have ${Math.min(r.have, r.nIngredients)} of ${r.nIngredients} ingredients`,
    ),
  );
  const li = el("li");
  li.append(a);
  return li;
}

function renderIdeas({ using, recipes }) {
  $("using").textContent = `Using: ${using.join(", ")}`;
  $("using").hidden = !using.length;
  $("no-ideas").hidden = using.length > 0;
  $("no-match").hidden = !using.length || recipes.length > 0;
  $("ideas").replaceChildren(...recipes.map(ideaCard));
}

const HOUSEHOLD = {
  label: "Couldn't load your household",
  get: () => api("/api/households/me"),
  render: renderHousehold,
};
const SUMMARY = {
  label: "Couldn't load the summary",
  get: () => pantryApi("/summary"),
  render: renderSummary,
};
const ITEMS = {
  label: "Couldn't load your items",
  get: () => pantryApi(""),
  render: renderItems,
};
const IDEAS = {
  label: "Couldn't load recipe ideas",
  get: () => pantryApi("/suggestions"),
  render: renderIdeas,
};

async function load(parts) {
  const res = await Promise.allSettled(parts.map((p) => p.get()));
  if (res.some((r) => isGone(r.reason))) {
    showJoin();
    return false;
  }
  const errs = [];
  res.forEach((r, i) => {
    if (r.status === "fulfilled") parts[i].render(r.value);
    else errs.push(`${parts[i].label}: ${r.reason.message}`);
  });
  showErrors(errs);
  return true;
}

async function removeItem(it, li, btn) {
  if (!confirm(`Delete “${it.name}”?`)) return;
  btn.disabled = true;
  try {
    await pantryApi(`/${it._id}`, { method: "DELETE" });
  } catch (e) {
    if (isGone(e)) {
      showJoin();
      return;
    }
    if (e.status !== 404) {
      btn.disabled = false;
      showErrors([`Couldn't delete ${it.name}: ${e.message}`]);
      return;
    }
  }
  li.remove();
  $("empty").hidden = $("items").children.length > 0;
  $("status").textContent = `Deleted ${it.name}.`;
  $("items-title").focus();
  await load([SUMMARY, IDEAS]);
}

if (!getCode()) {
  showJoin();
} else {
  $("status").textContent = "Loading your pantry…";
  if (await load([HOUSEHOLD, SUMMARY, ITEMS, IDEAS])) {
    $("status").textContent = "";
    $("pantry").hidden = false;
  }
}
