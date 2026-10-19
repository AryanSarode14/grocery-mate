import { api } from "./api.js";
import { $, el, store } from "./dom.js";

const KEY = "householdCode";
const getCode = () => store.get(KEY);
const setCode = (c) => store.set(KEY, c);
const clearCode = () => store.remove(KEY);
const isGone = (e) => e.status === 404 && e.message === "Household not found";

function hideError() {
  $("error").hidden = true;
  $("error").replaceChildren();
}

function showError(e, prefix = "Something went wrong") {
  const box = $("error");
  const list = e.errors?.length;
  const lead = prefix ? `${prefix}: ` : "";
  box.replaceChildren(el("p", null, list ? lead.trim() : lead + e.message));
  if (list) {
    const ul = el("ul");
    for (const m of e.errors) ul.append(el("li", null, m));
    box.append(ul);
  }
  box.hidden = false;
  box.focus();
}

function showJoined({ name, code }) {
  $("joined-title").textContent = `You're in ${name}`;
  $("code-show").textContent = code;
  $("copied").textContent = "";
  $("start").hidden = true;
  $("joined").hidden = false;
}

function showForms(note = "") {
  $("note").textContent = note;
  $("note").hidden = !note;
  $("joined").hidden = true;
  $("start").hidden = false;
}

function busy(form, on) {
  form.querySelector("button[type=submit]").disabled = on;
}

$("create-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  hideError();
  busy(form, true);
  try {
    const h = await api("/api/households", {
      method: "POST",
      body: { name: $("name").value },
    });
    setCode(h.code);
    form.reset();
    showJoined(h);
  } catch (e) {
    showError(e, "Couldn't create household");
  } finally {
    busy(form, false);
  }
});

$("code").addEventListener("input", (ev) => {
  const i = ev.target;
  i.value = i.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});

$("join-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  hideError();
  busy(form, true);
  setCode($("code").value.trim().toUpperCase());
  try {
    const h = await api("/api/households/me");
    form.reset();
    showJoined(h);
  } catch (e) {
    clearCode();
    if (isGone(e)) showError({ message: "No household with that code." }, "");
    else showError(e, "Couldn't join household");
  } finally {
    busy(form, false);
  }
});

let copiedTimer;
$("copy").addEventListener("click", async () => {
  const msg = $("copied");
  try {
    await navigator.clipboard.writeText($("code-show").textContent);
    msg.textContent = "Copied";
  } catch {
    msg.textContent = "Couldn't copy, select the code instead.";
  }
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => (msg.textContent = ""), 2000);
});

$("leave").addEventListener("click", () => {
  clearCode();
  hideError();
  showForms();
  $("name").focus();
});

if (getCode()) {
  $("status").textContent = "Checking your household…";
  try {
    showJoined(await api("/api/households/me"));
  } catch (e) {
    if (isGone(e)) {
      clearCode();
      showForms(
        "Your saved household no longer exists. Create or join one below.",
      );
    } else {
      showForms();
      showError(e, "Couldn't check your household");
    }
  } finally {
    $("status").textContent = "";
  }
} else {
  showForms();
}
