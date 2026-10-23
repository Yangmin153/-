import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  fresh,
  validDays,
  cleanDays,
  contains,
  samePlace,
  fingerprint,
  duration,
  sequence,
  routeIsValid,
  clusterPoints,
  placeFrom,
  category,
} from "../public/static/v6/model.js";
import { buildPlan } from "../lib/core.js";
import { POST } from "../api/route.js";
const p = (id, lat = 33.4, lng = 126.4) => ({ id, name: id, lat, lng });
test("first visit starts with a blank collection, not example locations", () => {
  const ds = fresh();
  assert.equal(ds[0].origin, null);
  assert.equal(ds[0].destination, null);
  assert.deepEqual(ds[0].stops, []);
  assert.ok(validDays(ds));
});
test("existing plans preserve locations and dates without mutating stored data", () => {
  const old = [
    {
      id: "old",
      date: "2026-10-23",
      origin: p("a"),
      destination: p("b"),
      stops: [{ ...p("c"), locked: true }],
      departure: "10:00",
      mode: "manual",
      result: {},
    },
  ];
  const before = JSON.stringify(old);
  const migrated = cleanDays(old);
  assert.equal(JSON.stringify(old), before);
  assert.equal(migrated[0].date, old[0].date);
  assert.equal(migrated[0].origin.name, "a");
  assert.equal(migrated[0].stops[0].locked, false);
  assert.equal(migrated[0].result, undefined);
});
test("duplicates are detected across origin, stops and destination, despite generated ids", () => {
  const original = p("provider-id"),
    saved = placeFrom(original);
  assert.ok(samePlace(original, saved));
  assert.ok(samePlace(saved, placeFrom(original)));
  for (const d of [
    { origin: saved, stops: [] },
    { destination: saved, stops: [] },
    { stops: [saved] },
  ])
    assert.ok(contains(d, original));
  assert.ok(!contains({ stops: [saved] }, p("other", 35, 129)));
});
test("route fingerprint invalidates after additions/deletions/endpoints but not region change", () => {
  const d = { origin: p("a"), destination: p("b"), stops: [p("c")] };
  const key = fingerprint(d);
  assert.equal(fingerprint({ ...d, region: "부산" }), key);
  assert.notEqual(fingerprint({ ...d, stops: [] }), key);
  assert.notEqual(fingerprint({ ...d, origin: p("d") }), key);
  assert.notEqual(fingerprint({ ...d, stops: [...d.stops, p("e")] }), key);
});
test("duration uses hours and never represents missing data as zero", () => {
  assert.equal(duration(75), "1시간 15분");
  assert.equal(duration(60), "1시간");
  assert.equal(duration(35), "35분");
  assert.equal(duration(undefined), "시간 확인 안 됨");
  assert.equal(sequence(1), "①");
  assert.equal(sequence(20), "⑳");
  assert.equal(sequence(32), "㉜");
});
test("overlapping pins retain exact coordinates and all visit numbers", () => {
  const points = [
    { x: 0, y: 0, lat: 33, lng: 126, order: 1 },
    { x: 5, y: 5, lat: 33.001, lng: 126, order: 4 },
    { x: 80, y: 40, order: 2 },
  ];
  const groups = clusterPoints(points);
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups[0].map((p) => p.order),
    [1, 4],
  );
  assert.equal(groups[0][1].lat, 33.001);
  assert.equal(points[0].x, 0);
});
test("route validation rejects missing/duplicated stops and wrong endpoints", async () => {
  const d = {
    origin: p("a"),
    destination: p("b", 33.6),
    stops: [p("c", 33.5)],
    departure: "09:00",
    mode: "auto",
  };
  const result = await buildPlan(d, {});
  assert.ok(routeIsValid(result, d));
  assert.ok(!routeIsValid({ ...result, entries: result.entries.slice(1) }, d));
  assert.ok(
    !routeIsValid(
      {
        ...result,
        entries: [result.entries[0], result.entries[0], result.entries[2]],
      },
      d,
    ),
  );
});
test("public transit cannot silently calculate as a car", async () => {
  const res = await POST(
    new Request("https://example.com/api/route", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transport: "transit" }),
    }),
  );
  assert.equal(res.status, 422);
  assert.match(await res.text(), /대중교통/);
});
test("invalid imports rejected, legacy categories readable", () => {
  assert.ok(!validDays([{ origin: p("a", Infinity), stops: [] }]));
  assert.ok(!validDays([{ stops: Array(31).fill(p("a")) }]));
  assert.equal(category({ category: "cafe" }), "카페");
});
test("entry loads one active design, region gates the planner, map controls are external", async () => {
  const html = await readFile(
    new URL("../public/index.html", import.meta.url),
    "utf8",
  );
  assert.equal((html.match(/rel="stylesheet"/g) || []).length, 1);
  assert.match(html, /<section id="planner" hidden>/);
  for (const id of [
    "onboarding",
    "place-query",
    "search-map",
    "search-list-view",
    "btn-route",
    "map",
    "timeline",
  ])
    assert.ok(html.includes(`id="${id}"`));
  for (const id of [
    "travel-date",
    "departure-time",
    "place-scope",
    "mode-manual",
  ])
    assert.ok(!html.includes(`id="${id}"`));
  assert.ok(html.indexOf('id="map-fit"') < html.indexOf('id="map"'));
});
