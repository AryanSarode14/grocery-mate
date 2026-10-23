/*
I like how you segmented the functionality around localStorage into its own
file. It is a nice way to separate your concerns and makes what you are doing
clear.
*/

export const $ = (id) => document.getElementById(id);

export const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
      return true;
    } catch {
      return false;
    }
  },
  remove(k) {
    try {
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  },
};
