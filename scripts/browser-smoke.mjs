#!/usr/bin/env node
/**
 * Browser smoke test against the built `dist/`.
 *
 * The Vitest suite runs in jsdom, which proves logic but never proves the
 * bundle boots. This drives the real production build in headless Chrome over
 * the DevTools Protocol and asserts that every route mounts, that the pages
 * degrade instead of crashing when the backend is unreachable, and that
 * nothing throws.
 *
 * No dependencies: Node 18+ ships a global `WebSocket`, which is all CDP needs.
 *
 *   npm run build && npm run smoke
 *
 * Environment:
 *   CHROME_BIN       path to a Chrome/Chromium binary
 *   SMOKE_BASE_URL   test a deployed origin instead of local dist/
 *                    (e.g. SMOKE_BASE_URL=https://creative-puzzle-studio.vercel.app)
 *   SMOKE_VERBOSE=1  stream progress
 */

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, mkdtemp, rm, access } from "node:fs/promises";
import { constants } from "node:fs";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "..", "dist");
const VERBOSE = process.env.SMOKE_VERBOSE === "1";

/* When SMOKE_BASE_URL is set we skip the local server entirely and drive the
   deployed origin, which is the only way to prove what users actually get. */
const DEPLOYED = process.env.SMOKE_BASE_URL?.replace(/\/+$/, "") || null;

const CHROME =
  process.env.CHROME_BIN ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const log = (m) => { if (VERBOSE) console.log(`  · ${m}`); };

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/* ---------------------------------------------------------------- preflight */

if (!DEPLOYED) {
  try {
    await access(join(DIST, "index.html"), constants.R_OK);
  } catch {
    console.error(`No build found at ${DIST}\nRun \`npm run build\` first.`);
    process.exit(2);
  }
}

try {
  await access(CHROME, constants.X_OK);
} catch {
  console.error(
    `Chrome not found at ${CHROME}\nSet CHROME_BIN to a Chrome or Chromium binary.`,
  );
  process.exit(2);
}

/* ------------------------------------------------------------ static server */

let server = null;
let BASE;

if (DEPLOYED) {
  BASE = DEPLOYED;
  log(`testing deployed origin ${BASE}`);
} else {
  server = createServer(async (req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    let file = join(DIST, url);
    // SPA fallback: every unknown path serves index.html, mirroring the rewrite
    // rule a static host needs for deep links.
    if (url === "/" || !extname(url)) file = join(DIST, "index.html");
    try {
      const body = await readFile(file);
      res.writeHead(200, {
        "content-type": MIME[extname(file)] ?? "application/octet-stream",
      });
      res.end(body);
    } catch {
      try {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(await readFile(join(DIST, "index.html")));
      } catch {
        res.writeHead(404).end("not found");
      }
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  BASE = `http://127.0.0.1:${server.address().port}`;
  log(`serving dist on ${BASE}`);
}

/* ------------------------------------------------------------- chrome + cdp */

const PROFILE = await mkdtemp(join(tmpdir(), "puzzle-smoke-"));
const CDP_PORT = await freePort();

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    /* Renderer sandboxing and the multi-process model do not survive every
       environment — on some hosts Chrome dies the moment a renderer is
       spawned. Single-process is acceptable here: the smoke test needs one
       page and no isolation. */
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--single-process",
    "--window-size=1280,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);

function freePort() {
  return new Promise((resolve) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function waitForCdp() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Chrome DevTools endpoint never came up");
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        for (const h of this.handlers.get(msg.method) ?? []) h(msg.params);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }
}

/* ------------------------------------------------------------------ cleanup */

let cdp;
let targetId;
let serverClosed = false;

async function shutdown(code) {
  try { if (targetId) await cdp?.send("Target.closeTarget", { targetId }); } catch {}
  try { cdp?.ws.close(); } catch {}
  try { chrome.kill("SIGKILL"); } catch {}
  if (!serverClosed) { serverClosed = true; try { server?.close(); } catch {} }
  try { await rm(PROFILE, { recursive: true, force: true }); } catch {}
  process.exit(code);
}

process.on("SIGINT", () => void shutdown(130));

/* --------------------------------------------------------------------- run */

try {
  const browserWs = await waitForCdp();
  const ws = new WebSocket(browserWs);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("error", () => rej(new Error("CDP websocket failed")));
  });
  cdp = new Cdp(ws);

  ({ targetId } = await cdp.send("Target.createTarget", { url: "about:blank" }));
  const { sessionId: S } = await cdp.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });

  await cdp.send("Page.enable", {}, S);
  await cdp.send("Runtime.enable", {}, S);
  await cdp.send("Log.enable", {}, S);

  let consoleErrors = [];
  let exceptions = [];

  cdp.on("Runtime.consoleAPICalled", (p) => {
    if (p.type === "error") {
      consoleErrors.push(p.args.map((a) => a.value ?? a.description ?? a.type).join(" "));
    }
  });
  cdp.on("Runtime.exceptionThrown", (p) => {
    const d = p.exceptionDetails;
    exceptions.push(d.exception?.description ?? d.text ?? "unknown exception");
  });
  cdp.on("Log.entryAdded", (p) => {
    if (p.entry.level === "error") consoleErrors.push(p.entry.text);
  });

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await cdp.send(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
      S,
    );
    if (exceptionDetails) throw new Error(exceptionDetails.text);
    return result.value;
  };

  const snapshot = () =>
    evaluate(`({
      title: document.title,
      text: document.body.textContent || "",
      buttons: [...document.querySelectorAll("button")]
        .map(b => (b.getAttribute("aria-label") || b.textContent || "").trim().replace(/\\s+/g, " "))
        .filter(Boolean),
      inputs: document.querySelectorAll("input").length,
      rootChildren: document.getElementById("root")?.children.length ?? 0
    })`);

  async function goto(path) {
    consoleErrors = [];
    exceptions = [];
    await cdp.send("Page.navigate", { url: `${BASE}${path}` }, S);
    /* Poll for the app to mount instead of sleeping a fixed amount: a cold
       single-process Chrome can take seconds to paint the first route, and a
       fixed delay produced false "0 buttons" readings. */
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 250));
      try {
        if (await evaluate(`(document.getElementById("root")?.children.length ?? 0) > 0`)) break;
      } catch {
        /* execution context swaps during navigation */
      }
    }
    await new Promise((r) => setTimeout(r, 1200)); // effects + lazy chunks
    log(`navigated ${path}`);
    return snapshot();
  }

  /* The landing page reveals its CTAs in a staged entrance animation, so the
     text paints before the buttons exist. Poll rather than assume. */
  async function waitForButtons(min, timeout = 12000) {
    const deadline = Date.now() + timeout;
    let n = 0;
    while (Date.now() < deadline) {
      try {
        n = await evaluate(`document.querySelectorAll("button").length`);
        if (n >= min) return n;
      } catch {
        /* context swap */
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    return n;
  }

  const results = [];
  const check = (name, pass, detail = "") => results.push({ name, pass, detail });

  /* With no backend reachable, Supabase requests fail. That is the expected
     state for this check, not an app error — filter it out so a real console
     error still fails the run. */
  const isBackendNoise = (msg) =>
    /supabase|Failed to fetch|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|net::/i.test(msg);

  // 1 — landing
  await goto("/");
  await waitForButtons(3);
  let r = await snapshot();
  check("/ renders content", r.text.length > 50, `${r.text.length} chars`);
  check("/ has interactive controls", r.buttons.length >= 3, `${r.buttons.length} buttons`);
  check("/ title set", /creativ|puzzle/i.test(r.title), r.title);
  check("/ no uncaught exceptions", exceptions.length === 0, exceptions.slice(0, 2).join(" | "));
  const landingErrors = consoleErrors.filter((e) => !isBackendNoise(e));
  check("/ no unexpected console errors", landingErrors.length === 0, landingErrors.slice(0, 3).join(" | "));

  // 2 — leaderboard degrades without a backend
  r = await goto("/leaderboard");
  check("/leaderboard mounts", r.rootChildren > 0);
  check("/leaderboard renders a message", r.text.length > 20, `${r.text.length} chars`);
  check("/leaderboard no uncaught exceptions", exceptions.length === 0, exceptions.slice(0, 2).join(" | "));

  // 3 — teacher login form
  r = await goto("/teacher/login");
  check("/teacher/login mounts", r.rootChildren > 0);
  check("/teacher/login has an input", r.inputs >= 1, `${r.inputs} inputs`);
  check(
    "/teacher/login has a submit",
    r.buttons.some((b) => /sign in|log in|submit|enter/i.test(b)),
    r.buttons.join(", ").slice(0, 120),
  );

  // 4 — 404
  r = await goto("/this-route-does-not-exist");
  /* Must match OUR NotFound copy, not the host's 404 page. A loose
     /not found|page.*exist/ test passes on Vercel's own 404 screen, which is
     how a missing SPA rewrite stayed invisible. */
  check(
    "unknown route renders the app's 404",
    /oops!?\s*page not found/i.test(r.text) && /return to home/i.test(r.text),
    r.text.slice(0, 90).replace(/\n/g, " "),
  );
  check("unknown route no uncaught exceptions", exceptions.length === 0, exceptions.slice(0, 2).join(" | "));

  // 5 — game route with a bogus session id must not crash
  r = await goto("/game/does-not-exist");
  check("/game/:badId mounts", r.rootChildren > 0);
  check("/game/:badId no uncaught exceptions", exceptions.length === 0, exceptions.slice(0, 2).join(" | "));

  // 6 — dashboard with a bogus session id
  r = await goto("/dashboard/does-not-exist");
  check("/dashboard/:badId mounts", r.rootChildren > 0);
  check("/dashboard/:badId no uncaught exceptions", exceptions.length === 0, exceptions.slice(0, 2).join(" | "));

  // 7 — SPA fallback serves a nested deep link
  r = await goto("/results/does-not-exist");
  check("SPA fallback serves nested routes", r.rootChildren > 0);

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) {
    console.log(`${x.pass ? "PASS" : "FAIL"}  ${x.name}${x.detail ? `   [${x.detail}]` : ""}`);
  }
  console.log(`\n${passed}/${results.length} checks passed`);

  await shutdown(passed === results.length ? 0 : 1);
} catch (err) {
  console.error(`\nSmoke test failed to run: ${err.message}`);
  await shutdown(1);
}
