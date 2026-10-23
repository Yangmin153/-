import { parseHTML } from "linkedom";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const { window } = parseHTML(
  await fs.readFile(root + "/public/index.html", "utf8"),
);
const { document } = window;
Object.assign(globalThis, {
  document,
  Node: window.Node,
  HTMLElement: window.HTMLElement,
});
globalThis.window = window;
window.scrollY = 0;
window.scrollTo = () => {};
window.innerHeight = 780;
window.visualViewport = {
  height: 780,
  offsetTop: 0,
  addEventListener() {},
  removeEventListener() {},
};
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, v),
};
globalThis.location = {
  origin: "http://localhost",
  pathname: "/",
  hash: "",
  search: "",
};
globalThis.history = {
  state: null,
  pushState(s) {
    this.state = s;
  },
  back() {
    this.state = null;
  },
  replaceState() {},
};
globalThis.requestAnimationFrame = (f) => f();
globalThis.confirm = () => true;
const points = {
  공항: {
    id: "airport",
    name: "제주공항",
    category: "공항",
    lat: 33.51,
    lng: 126.49,
    address: "제주 공항로 2",
  },
  카페: {
    id: "cafe",
    name: "애월 카페",
    category: "카페",
    lat: 33.46,
    lng: 126.31,
    address: "제주 애월읍",
  },
  해변: {
    id: "beach",
    name: "협재해수욕장",
    category: "해수욕장",
    lat: 33.39,
    lng: 126.24,
    address: "제주 한림읍",
  },
  숙소: {
    id: "hotel",
    name: "제주 숙소",
    category: "호텔",
    lat: 33.25,
    lng: 126.56,
    address: "서귀포",
  },
};
const { buildPlan } = await import(root + "/lib/core.js");
let routeCalls = 0;
globalThis.fetch = async (raw, opts = {}) => {
  const u = new URL(raw, "http://localhost");
  if (u.pathname === "/api/config")
    return Response.json({ mapsKeyId: "", supabaseReady: false });
  if (u.pathname === "/api/places")
    return Response.json({
      items: [points[u.searchParams.get("q")]].filter(Boolean),
      hasNext: false,
    });
  if (u.pathname === "/api/geocode") return Response.json({ results: [] });
  if (u.pathname === "/api/route") {
    routeCalls++;
    return Response.json(await buildPlan(JSON.parse(opts.body), {}));
  }
  throw Error(u.pathname);
};
await import(root + "/public/static/app.js");
const $ = (id) => document.getElementById(id),
  tick = () => new Promise((r) => setTimeout(r, 15));
assert.equal($("planner").hidden, true);
$("region-tags").querySelector("button").click();
await tick();
assert.equal($("onboarding").hidden, true);
assert.equal($("planner").hidden, false);
async function select(query, buttonId) {
  $(buttonId).click();
  assert.equal($("app-shell").inert, true);
  $("place-query").value = query;
  $("place-search-form").dispatchEvent(
    new window.Event("submit", { cancelable: true }),
  );
  await tick();
  assert.ok($("selected-place").textContent.includes(points[query].name));
  $("selected-place").querySelector("button").click();
  await tick();
}
await select("공항", "origin-button");
await select("숙소", "destination-button");
await select("카페", "add-place");
assert.equal($("search-screen").hidden, false);
assert.match($("selected-place").textContent, /추가됨/);
assert.equal(window.TripApp.getDays()[0].stops.length, 1);
$("place-query").value = "해변";
$("place-search-form").dispatchEvent(
  new window.Event("submit", { cancelable: true }),
);
await tick();
$("search-view-toggle").click();
assert.equal($("search-list-view").hidden, false);
$("search-results").querySelector("button").click();
assert.equal($("search-map-view").hidden, false);
$("selected-place").querySelector("button").click();
assert.equal(window.TripApp.getDays()[0].stops.length, 2);
$("search-close").click();
assert.equal($("app-shell").inert, false);
$("change-region").click();
$("region-tags").querySelectorAll("button")[2].click();
assert.equal(window.TripApp.getDays()[0].stops.length, 2);
assert.equal($("current-region").textContent, "부산");
$("btn-route").click();
$("btn-route").click();
await tick();
assert.equal(routeCalls, 1);
assert.equal($("result-panel").hidden, false);
assert.equal($("timeline").querySelectorAll(".timeline-stop").length, 4);
assert.match($("route-summary").textContent, /예상/);
assert.match($("timeline").textContent, /①/);
$("timeline").querySelector("button").click();
assert.match($("route-summary").textContent, /방문지가 바뀌었어요/);
assert.equal($("timeline").querySelectorAll(".sequence").length, 0);
$("btn-route").click();
await tick();
assert.equal(routeCalls, 2);
assert.equal($("timeline").querySelectorAll(".timeline-stop").length, 3);
console.log(
  "PASS: region gate, endpoints, continuous adds, duplicate disabled, list/map switch, scroll lock, preserved region change, route double-click, stale results, recalculate. Mock APIs; DOM integration only.",
);
