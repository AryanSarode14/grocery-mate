const stored = () => {
  try {
    return localStorage.getItem("householdCode");
  } catch {
    return null;
  }
};

export async function api(path, opts = {}) {
  const o = { ...opts, headers: { ...opts.headers } };
  const code = stored();
  if (code) o.headers["x-household-code"] = code;
  const b = o.body;
  if (Array.isArray(b) || b?.constructor === Object) {
    o.body = JSON.stringify(b);
    o.headers["Content-Type"] = "application/json";
  }
  const res = await fetch(path, o);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const errs = Array.isArray(data?.errors) ? data.errors : [];
    const e = new Error(
      data?.error || errs.join(", ") || `Request failed (${res.status})`,
    );
    e.status = res.status;
    e.errors = errs;
    throw e;
  }
  return data;
}
