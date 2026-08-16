const S = process.env.SITE || "https://chhaap-eight.vercel.app";
const email = `real-${Date.now()}@example.com`;
const password = "chhaap-real-test-9912";
let jar = "";

const call = async (path, opts = {}) => {
  const r = await fetch(S + path, {
    ...opts,
    redirect: "manual",
    headers: { "content-type": "application/json", ...(jar ? { cookie: jar } : {}), ...opts.headers },
  });
  const set = r.headers.getSetCookie?.() ?? [];
  if (set.length) jar = set.map((x) => x.split(";")[0]).join("; ");
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch {}
  return { status: r.status, json: j, text: t.slice(0, 200) };
};

let pass = 0, fail = 0;
const step = (label, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}${detail ? "  ·  " + detail : ""}`);
  ok ? pass++ : fail++;
  return ok;
};

const su = await call("/api/auth/signup", { method: "POST", body: JSON.stringify({ email, password, name: "Real Test" }) });
if (!step("signup", su.status === 201, su.json?.userId ? "user " + su.json.userId.slice(0, 8) : su.text)) process.exit(1);

const me = await call("/api/auth/session");
step("session persists", me.json?.user?.email === email, me.json?.user?.email ?? me.text);

const dup = await call("/api/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) });
step("duplicate email rejected", dup.status === 409, `${dup.status} ${dup.json?.error?.code ?? ""}`);

const cb = await call("/api/brands", { method: "POST", body: JSON.stringify({
  brief: { businessName: "Nukkad Chai", descriptor: "Chai & Snacks", industry: "cafe",
    audience: "office workers and students", personality: ["friendly", "warm"],
    colorMood: "auto", language: "hi", localName: "नुक्कड़ चाय", city: "Lucknow" }, count: 4 }) });
const brandId = cb.json?.brand?.id;
if (!step("create brand", cb.status === 201 && !!brandId, brandId ? `${cb.json.directions.length} directions` : cb.text)) process.exit(1);

const ls = await call("/api/brands");
step("list my brands", (ls.json?.brands?.length ?? 0) === 1, `${ls.json?.brands?.length ?? 0}`);

const dirs = await call(`/api/brands/${brandId}/directions`);
const first = dirs.json?.directions?.[0];
const sel = await call(`/api/brands/${brandId}/select`, { method: "POST", body: JSON.stringify({ directionId: first?.id }) });
step("select direction", sel.status === 200, sel.json?.brand ? `readiness ${sel.json.brand.qualityScore}/100` : sel.text);

await call("/api/auth/logout", { method: "POST" });
jar = "";
const li = await call("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
step("log out and back in", li.status === 200, li.json?.userId ? "signed in" : li.text);

const again = await call("/api/brands");
step("brand survived re-login", (again.json?.brands?.length ?? 0) === 1, `${again.json?.brands?.length ?? 0} brand(s)`);

const ex = await call(`/api/brands/${brandId}/export`, { method: "POST", body: JSON.stringify({ target: "logo", variation: "primary", format: "png", scale: 3 }) });
step("export logo", ex.status === 200 && ex.json?.mode === "raster", ex.json?.mode ? `${ex.json.width}x${ex.json.height}` : ex.text);

const wrong = await call("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password: "wrong-password-xx" }) });
step("wrong password rejected", wrong.status === 401, String(wrong.status));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
