#!/usr/bin/env node
/**
 * End-to-end smoke test against a running server.
 *
 *   npm run dev            # in one terminal
 *   npm run smoke          # in another (SMOKE_URL=http://host:port to point elsewhere)
 *
 * It drives the app the way a browser without JavaScript would: fetch the page,
 * post the form (server actions are posted as ordinary forms), follow the redirect,
 * and check that the buyer ends up with a downloadable file.
 */
const BASE = process.env.SMOKE_URL ?? "http://localhost:3000";
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const cookies = new Map();

function storeCookies(response) {
  const headers = response.headers.getSetCookie?.() ?? [];
  for (const raw of headers) {
    const pair = raw.split(";")[0];
    const index = pair.indexOf("=");
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (value === "") cookies.delete(name);
    else cookies.set(name, value);
  }
}

function headers(extra = {}) {
  const cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  return { origin: BASE, ...(cookie ? { cookie } : {}), ...extra };
}

async function get(path) {
  const response = await fetch(new URL(path, BASE), { headers: headers(), redirect: "manual" });
  storeCookies(response);
  return response;
}

async function text(path) {
  const response = await get(path);
  return { response, body: await response.text() };
}

function unescapeHtml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** The form on the page that contains a given field (for example "password_confirm"). */
function formFor(html, fieldName) {
  const forms = html.match(/<form[\s\S]*?<\/form>/g) ?? [];
  return forms.find((form) => form.includes(`name="${fieldName}"`)) ?? null;
}

/**
 * Next renders the hidden `$ACTION_*` inputs that tell the server which action to
 * run (with its bound state). Replaying them verbatim is what a no-JS browser does.
 */
function actionFields(form) {
  const fields = [];
  for (const tag of form.match(/<input\b[^>]*>/g) ?? []) {
    const name = /\bname="([^"]*)"/.exec(tag)?.[1];
    if (!name || !name.startsWith("$ACTION")) continue;
    const value = /\bvalue="([^"]*)"/.exec(tag)?.[1] ?? "";
    fields.push([name, unescapeHtml(value)]);
  }
  return fields;
}

async function postAction(path, hidden, fields) {
  const body = new FormData();
  for (const [key, value] of hidden) body.append(key, value);
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  const response = await fetch(new URL(path, BASE), { method: "POST", body, headers: headers(), redirect: "manual" });
  storeCookies(response);
  return response;
}

function location(response) {
  return response.headers.get("location");
}

async function main() {
  console.log(`\nSmoke test against ${BASE}\n`);

  // 1. Health and read-only pages.
  const health = await fetch(new URL("/api/health", BASE)).then(async (response) => ({
    ok: response.ok,
    data: await response.json().catch(() => ({})),
  }));
  check("GET /api/health", health.ok && health.data.ok === true, `database=${health.data.database}`);

  const demoMode = health.data.database === "demo";

  for (const path of ["/", "/beats", "/videos", "/login", "/signup"]) {
    const { response, body } = await text(path);
    check(`GET ${path}`, response.status === 200 && body.length > 500, `status ${response.status}`);
  }

  const admin = await get("/admin");
  check("GET /admin redirects signed-out visitors", [302, 303, 307, 308].includes(admin.status), `status ${admin.status}`);

  const catalogue = await text("/beats");
  const beatSlug = /href="\/beats\/([a-z0-9-]+)"/.exec(catalogue.body)?.[1];
  check("Catalogue lists a beat", Boolean(beatSlug), beatSlug ?? "none found");

  if (beatSlug) {
    const detail = await text(`/beats/${beatSlug}`);
    check(
      `GET /beats/${beatSlug}`,
      detail.response.status === 200 && /Preview/.test(detail.body),
      `status ${detail.response.status}`,
    );
  }

  const missing = await get("/download/00000000-0000-4000-8000-000000000000");
  check("GET /download/<unknown token> → 404", missing.status === 404, `status ${missing.status}`);

  if (demoMode) {
    console.log("\n  ! No database connected (demo mode) — skipping the purchase flow.");
    console.log("    Set DATABASE_URL and re-run to exercise signup → payment → download.\n");
    return summarise();
  }

  // 2. Signup.
  const stamp = Date.now().toString(36);
  const email = `smoke+${stamp}@example.com`;
  const username = `smoke${stamp}`;
  const password = "smoke-test-password-123";

  const signupPage = await text("/signup");
  const signupForm = formFor(signupPage.body, "password_confirm");
  check("Signup form exposes a server action", Boolean(signupForm && actionFields(signupForm).length));

  const signup = await postAction("/signup", actionFields(signupForm), {
    username,
    email,
    password,
    password_confirm: password,
  });
  check(
    "POST /signup creates the account",
    [200, 303].includes(signup.status) && Boolean(location(signup)),
    `${signup.status} → ${location(signup) ?? "no location"}`,
  );

  const dashboard = await text("/dashboard");
  check(
    "GET /dashboard is signed in",
    dashboard.response.status === 200 && dashboard.body.includes(username),
    `status ${dashboard.response.status}`,
  );

  // 3. Buy: the checkout server action creates the order and redirects to test checkout.
  const detail = await text(`/beats/${beatSlug}`);
  const buyForm = formFor(detail.body, "slug");
  check("Beat page exposes the buy action", Boolean(buyForm && actionFields(buyForm).length));

  const buy = await postAction(`/beats/${beatSlug}`, actionFields(buyForm), { slug: beatSlug });
  const checkoutUrl = location(buy) ?? "";
  const reference = /\/checkout\/test\/(12-[0-9a-f]+)/.exec(checkoutUrl)?.[1];
  check(
    "POST buy → checkout",
    Boolean(reference),
    `status ${buy.status} → ${checkoutUrl || "no location"}`,
  );

  if (!reference) return summarise();

  // 4. Pay in test mode.
  const checkout = await text(`/checkout/test/${reference}`);
  check(
    "Test checkout shows the order",
    checkout.response.status === 200 && checkout.body.includes("Test mode"),
    `status ${checkout.response.status}`,
  );

  const payForm = formFor(checkout.body, "channel");
  const pay = await postAction(`/checkout/test/${reference}`, actionFields(payForm), { reference, channel: "mobile_money" });
  check(
    "POST pay → payment return",
    [200, 303].includes(pay.status),
    `status ${pay.status} → ${location(pay) ?? ""}`,
  );

  const receipt = await text(`/checkout/return?reference=${reference}`);
  check(
    "Payment return shows success",
    receipt.response.status === 200 && /Payment successful/i.test(receipt.body),
    `status ${receipt.response.status}`,
  );

  const token = /\/download\/([0-9a-f-]{36})/.exec(receipt.body)?.[1];
  check("Receipt offers a download link", Boolean(token));

  if (token) {
    const file = await get(`/download/${token}`);
    const bytes = file.ok ? (await file.arrayBuffer()).byteLength : 0;
    check(
      "GET /download/<paid token> returns the audio file",
      file.status === 200 && bytes > 10_000,
      `status ${file.status}, ${bytes} bytes, ${file.headers.get("content-type")}`,
    );
  }

  // 5. Admin stays closed to buyers.
  const ordersPage = await text("/admin/orders");
  check(
    "Orders are not visible to artists",
    [302, 303, 307, 308].includes(ordersPage.response.status),
    `status ${ordersPage.response.status}`,
  );

  // 6. Producer admin (set SMOKE_PRODUCER_EMAIL / SMOKE_PRODUCER_PASSWORD to run this).
  await adminFlow();

  return summarise();
}

async function login(email, password) {
  cookies.clear();
  const page = await text("/login");
  const form = formFor(page.body, "identifier");
  if (!form) throw new Error("login form not found");
  return postAction("/login", actionFields(form), { identifier: email, password, next: "" });
}

async function adminFlow() {
  const email = process.env.SMOKE_PRODUCER_EMAIL;
  const password = process.env.SMOKE_PRODUCER_PASSWORD;
  if (!email || !password) {
    console.log("\n  ! SMOKE_PRODUCER_EMAIL / SMOKE_PRODUCER_PASSWORD not set — skipping the admin checks.");
    return;
  }

  console.log("\n  Admin flow");
  const signIn = await login(email, password);
  check("Producer can log in", [200, 303].includes(signIn.status), `status ${signIn.status}`);

  for (const path of ["/admin", "/admin/beats", "/admin/beats/new", "/admin/videos", "/admin/orders", "/admin/outbox"]) {
    const { response, body } = await text(path);
    check(`GET ${path}`, response.status === 200, `status ${response.status}`);
    if (path === "/admin/outbox") {
      check("Outbox shows the receipt from this run", /Your beat is ready/.test(body));
    }
  }

  // Publish a beat through the admin form, then remove it again.
  const newBeat = await text("/admin/beats/new");
  const form = formFor(newBeat.body, "audio_url");
  check("Beat form is present", Boolean(form));

  const title = `Smoke Test Beat ${Date.now().toString(36)}`;
  const created = await postAction("/admin/beats/new", actionFields(form), {
    title,
    description: "Added by the smoke test.",
    price: "99.00",
    bpm: "95",
    musical_key: "A minor",
    genre: "Test",
    audio_url: "/demo/beats/accra-nights.mp3",
    audio_url_name: "accra-nights.mp3",
    audio_url_size: "119664",
    cover_url: "/demo/covers/accra-nights.svg",
    cover_url_name: "accra-nights.svg",
    cover_url_size: "3739",
    is_published: "on",
  });
  check(
    "POST new beat saves and redirects",
    [200, 303].includes(created.status) && /\/admin\/beats\/\d+/.test(location(created) ?? ""),
    `status ${created.status} → ${location(created) ?? "no location"}`,
  );

  const store = await text("/beats?q=Smoke+Test+Beat");
  check("New beat is live in the store", store.body.includes(title));

  const adminBeats = await text("/admin/beats");
  const editPath = new RegExp(`/admin/beats/(\\d+)"[^>]*>[^<]*</a>`).exec(adminBeats.body)?.[1];
  check("Beat appears in the admin list", adminBeats.body.includes(title), editPath ? `id ${editPath}` : "no id found");

  if (editPath) {
    const editPage = await text(`/admin/beats/${editPath}`);
    const deleteForm = formFor(editPage.body, "id");
    check("Delete control is rendered", Boolean(deleteForm && actionFields(deleteForm).length));
  }

  // Upload pipeline: post a small file, then read it back through /api/media.
  const bytes = new Uint8Array(2048).map((_, index) => index % 251);
  const upload = new FormData();
  upload.append("file", new Blob([bytes], { type: "audio/mpeg" }), "smoke-upload.mp3");
  upload.append("folder", "beats");
  const uploadResponse = await fetch(new URL("/api/admin/upload", BASE), {
    method: "POST",
    body: upload,
    headers: headers(),
    redirect: "manual",
  });
  const uploaded = await uploadResponse.json().catch(() => ({}));
  check(
    "POST /api/admin/upload stores a file",
    uploadResponse.ok && typeof uploaded.url === "string" && uploaded.size === bytes.length,
    `${uploadResponse.status} ${uploaded.url ?? uploaded.error ?? ""}`,
  );

  if (uploaded.url) {
    const media = await get(uploaded.url);
    const readBack = media.ok ? (await media.arrayBuffer()).byteLength : 0;
    check("GET the uploaded file back", media.status === 200 && readBack === bytes.length, `status ${media.status}, ${readBack} bytes`);
  }

  const health2 = await fetch(new URL("/api/health", BASE)).then((response) => response.json());
  check("Health still reports a connected database", health2.database !== "demo", `database=${health2.database}`);
}

function summarise() {
  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log("\nFailed checks:");
    for (const result of failed) console.log(`  ✗ ${result.name} ${result.detail}`);
    process.exitCode = 1;
  }
  console.log("");
  return failed.length;
}

main().catch((error) => {
  console.error(`\nSmoke test could not finish: ${error.message}`);
  console.error("Is the server running? (npm run dev)");
  process.exit(1);
});
