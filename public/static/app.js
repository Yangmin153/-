import { $, el, json, toast } from "./v6/dom.js";
import {
  STORAGE,
  REGIONS,
  fresh,
  validDays,
  cleanDays,
  contains,
  placeFrom,
  fingerprint,
  duration,
  sequence,
  category,
  routeIsValid,
} from "./v6/model.js";
import { TravelMap } from "./v6/map.js";
import { PlaceSearch } from "./v6/search.js";
import { encodeTrip, decodeTrip, tripSnapshot } from "./trip-utils.js";
function load() {
  try {
    const ds = JSON.parse(localStorage.getItem(STORAGE));
    return validDays(ds) ? cleanDays(ds) : fresh();
  } catch {
    return fresh();
  }
}
let days = load(),
  active = 0,
  region = null,
  view = "collect",
  busy = false,
  requestId = 0;
const results = new Map();
const day = () => days[active];
const map = new TravelMap($("map"), $("map-message"), (group) => {
  $("map-selection").hidden = false;
  $("map-selection").replaceChildren(
    ...group.map((p) =>
      el(
        "div",
        {},
        el("strong", {}, p.order ? `${sequence(p.order)} ${p.name}` : p.name),
        el("small", {}, p.address || category(p)),
      ),
    ),
    el(
      "button",
      {
        onclick: () => {
          $("map-selection").hidden = true;
        },
      },
      "닫기",
    ),
  );
});
function persist() {
  if (window.YeoAccount?.isSignedIn()) return;
  try {
    localStorage.setItem(STORAGE, JSON.stringify(tripSnapshot(days)));
  } catch {
    toast("이 기기에 저장할 공간이 부족해요. 파일로 저장해 주세요.");
  }
}
function currentResult() {
  const r = results.get(day().id);
  return r?.key === fingerprint(day()) ? r.data : null;
}
function addPlace(place, target) {
  const d = day();
  if (target === "stop") {
    if (contains(d, place)) {
      toast("이미 담은 장소예요.");
      return false;
    }
    if (d.stops.length >= 30) {
      toast("한 코스에 30곳까지 담을 수 있어요.");
      return false;
    }
    d.stops.push(placeFrom(place));
  } else {
    const p = placeFrom(place);
    d[target] = p;
    d.stops = d.stops.filter(
      (s) => !contains({ origin: p, destination: null, stops: [] }, s),
    );
    toast(target === "origin" ? "출발지를 정했어요." : "도착지를 정했어요.");
  }
  persist();
  render();
  $("stop-count").classList.remove("bump");
  requestAnimationFrame(() => $("stop-count").classList.add("bump"));
  return true;
}
const search = new PlaceSearch({ day, region: () => region, onAdd: addPlace });
function removeStop(id) {
  day().stops = day().stops.filter((s) => s.id !== id);
  persist();
  render();
  toast("방문지를 지웠어요. 동선을 다시 만들 수 있어요.");
}
function selectView(next) {
  view = next;
  render();
}
function render() {
  $("planner").dataset.view = view;
  const d = day(),
    r = currentResult(),
    stale = results.has(d.id) && !r;
  $("current-region").textContent = region?.name || d.region || "여행지역";
  $("origin-name").textContent = d.origin?.name || "출발지 선택";
  $("destination-name").textContent = d.destination?.name || "도착지 선택";
  $("stop-count").textContent = d.stops.length;
  $("collection-panel").hidden = view !== "collect";
  $("result-panel").hidden = view !== "result";
  $("tab-collect").setAttribute(
    "aria-current",
    view === "collect" ? "page" : "false",
  );
  $("tab-result").setAttribute(
    "aria-current",
    view === "result" ? "page" : "false",
  );
  $("course-label").hidden = days.length < 2;
  $("course-select").replaceChildren(
    ...days.map((d, i) =>
      el("option", { value: i, selected: i === active }, `코스 ${i + 1}`),
    ),
  );
  $("stops-list").replaceChildren(
    ...d.stops.map((p) =>
      el(
        "article",
        { class: "stop-row" },
        el("span", { class: "place-icon", "aria-hidden": "true" }, "⌖"),
        el(
          "div",
          { class: "place-copy" },
          el("strong", {}, p.name),
          el("small", {}, category(p)),
        ),
        el(
          "button",
          {
            class: "delete-place",
            "aria-label": p.name + " 삭제",
            onclick: () => removeStop(p.id),
          },
          "×",
        ),
      ),
    ),
  );
  if (!d.stops.length)
    $("stops-list").append(
      el(
        "div",
        { class: "empty-state" },
        el("span", { "aria-hidden": "true" }, "＋"),
        el("strong", {}, "가고 싶은 곳을 모아보세요"),
        el("p", {}, "장소만 고르면, 편한 방문 순서를 찾아드려요."),
      ),
    );
  $("btn-route").disabled = busy;
  $("btn-route").setAttribute("aria-busy", String(busy));
  $("btn-route").textContent = busy
    ? "편한 동선을 찾고 있어요…"
    : stale
      ? "변경한 장소로 다시 만들기"
      : r
        ? "동선 다시 만들기"
        : "최적 동선 만들기";
  $("map-title").textContent =
    view === "result" && r ? "나의 여행 동선" : "가고 싶은 곳 지도";
  $("map-selection").hidden = true;
  const summary = $("route-summary"),
    timeline = $("timeline");
  summary.replaceChildren();
  timeline.replaceChildren();
  if (view === "result") {
    if (!r) {
      summary.append(
        el(
          "div",
          { class: "notice" },
          el(
            "strong",
            {},
            stale ? "방문지가 바뀌었어요" : "아직 동선을 만들지 않았어요",
          ),
          el(
            "p",
            {},
            stale
              ? "바뀐 장소로 다시 계산하면 새로운 순서를 볼 수 있어요."
              : "출발지와 도착지, 가고 싶은 곳을 고른 뒤 동선을 만들어 주세요.",
          ),
        ),
      );
      timeline.append(
        ...d.stops.map((p) =>
          el(
            "article",
            { class: "stop-row" },
            el(
              "div",
              { class: "place-copy" },
              el("strong", {}, p.name),
              el("small", {}, category(p)),
            ),
            el(
              "button",
              {
                "aria-label": p.name + " 삭제",
                onclick: () => removeStop(p.id),
              },
              "×",
            ),
          ),
        ),
      );
    } else {
      const estimated = r.entries.some((e) => e.leg?.source === "estimate");
      summary.append(
        el(
          "div",
          { class: "route-total" },
          el(
            "span",
            {},
            estimated ? "자동차 · 예상 이동시간" : "자동차 · 이동시간",
          ),
          el("strong", {}, duration(r.drivingMinutes)),
          el(
            "small",
            {},
            Number.isFinite(r.totalDistanceMeters)
              ? (r.totalDistanceMeters / 1000).toFixed(1) + " km"
              : "",
          ),
        ),
      );
      summary.append(
        el(
          "p",
          { class: estimated ? "notice" : "muted" },
          estimated
            ? "일부 구간의 실제 길을 확인하지 못했어요. 예상 시간과 점선은 실제 도로 경로와 다를 수 있어요."
            : "네이버 자동차 경로 기준 · 교통 상황에 따라 달라질 수 있어요.",
        ),
      );
      r.entries.forEach((entry, index) => {
        if (entry.leg) {
          const leg = entry.leg;
          timeline.append(
            el(
              "p",
              { class: "travel-leg" },
              `↓ 자동차 · ${leg.source === "estimate" ? "예상 " : ""}${duration(leg.durationMinutes)}`,
            ),
          );
        }
        timeline.append(
          el(
            "article",
            { class: "timeline-stop" },
            el(
              "span",
              { class: "sequence", "aria-label": `${index + 1}번째` },
              sequence(index + 1),
            ),
            el(
              "div",
              { class: "place-copy" },
              el(
                "small",
                {},
                entry.kind === "origin"
                  ? "출발"
                  : entry.kind === "destination"
                    ? "도착"
                    : category(entry.place),
              ),
              el("strong", {}, entry.place.name),
            ),
            entry.kind === "stop"
              ? el(
                  "button",
                  {
                    "aria-label": entry.place.name + " 삭제",
                    onclick: () => removeStop(entry.place.id),
                  },
                  "×",
                )
              : null,
          ),
        );
      });
    }
  }
  const points =
    view === "result" && r
      ? r.entries.map((e, i) => ({ ...e.place, order: i + 1 }))
      : [d.origin, ...d.stops, d.destination].filter(Boolean);
  map.render(
    points,
    view === "result" && r ? r.entries.map((e) => e.leg).filter(Boolean) : [],
  );
}
async function calculate() {
  if (busy) return;
  if (!day().origin) {
    toast("먼저 출발지를 골라주세요.");
    search.open("origin");
    return;
  }
  if (!day().destination) {
    toast("마지막으로 도착할 곳을 골라주세요.");
    search.open("destination");
    return;
  }
  const d = structuredClone(day()),
    key = fingerprint(d),
    token = ++requestId;
  busy = true;
  render();
  $("route-feedback").hidden = false;
  $("route-feedback").textContent =
    "도로와 이동시간을 확인하고 있어요. 잠시만 기다려 주세요.";
  try {
    const response = await json("/api/route", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...d,
        mode: "auto",
        transport: "car",
        stops: d.stops.map(({ stayMinutes, ...s }) => ({
          ...s,
          locked: false,
        })),
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (token !== requestId) return;
    if (!routeIsValid(response, d))
      throw Error("동선을 끝까지 확인하지 못했어요. 다시 시도해 주세요.");
    results.set(d.id, { key, data: response });
    if (day().id === d.id) {
      view = "result";
      $("route-feedback").textContent =
        key === fingerprint(day())
          ? "동선을 만들었어요."
          : "계산하는 동안 장소가 바뀌었어요. 다시 만들어 주세요.";
      render();
      map.fit();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  } catch (e) {
    if (token === requestId)
      $("route-feedback").textContent =
        e.name === "TimeoutError"
          ? "계산이 오래 걸리고 있어요. 아래 버튼을 눌러 다시 시도해 주세요."
          : e.message;
  } finally {
    if (token === requestId) {
      busy = false;
      render();
    }
  }
}
function confirmRegion(name, center) {
  region = { name, center };
  day().region = name;
  persist();
  $("onboarding").hidden = true;
  $("planner").hidden = false;
  map.move(center);
  void map.init().then(() => map.move(center));
  render();
  window.scrollTo(0, 0);
  $("add-place").focus({ preventScroll: true });
}
function showRegions() {
  search.close();
  $("planner").hidden = true;
  $("onboarding").hidden = false;
  $("region-cancel").hidden = !region;
  $("region-input").focus({ preventScroll: true });
}
$("region-input").addEventListener("input", () => {
  regionVersion++;
  $("region-results").replaceChildren();
});
$("region-tags").replaceChildren(
  ...Object.entries(REGIONS).map(([name, center]) =>
    el(
      "button",
      { class: "region-tag", onclick: () => confirmRegion(name, center) },
      el("span", {}, name),
      el("span", { "aria-hidden": "true" }, "↗"),
    ),
  ),
);
let regionVersion = 0;
$("region-form").onsubmit = async (e) => {
  e.preventDefault();
  const q = $("region-input").value.trim();
  if (!q) return;
  const version = ++regionVersion;
  $("region-submit").disabled = true;
  $("region-feedback").textContent = "지역을 찾고 있어요…";
  $("region-results").replaceChildren();
  try {
    if (REGIONS[q]) {
      confirmRegion(q, REGIONS[q]);
      $("region-feedback").textContent = "";
      return;
    }
    const data = await json("/api/geocode?" + new URLSearchParams({ q }), {
      signal: AbortSignal.timeout(12000),
    });
    if (version !== regionVersion) return;
    const items = data.results || [];
    $("region-feedback").textContent = items.length
      ? "여행할 지역을 골라주세요."
      : "찾지 못했어요. 시·군 이름이나 주소를 입력해 주세요.";
    $("region-results").replaceChildren(
      ...items.map((p) =>
        el(
          "button",
          {
            class: "region-result",
            onclick: () => confirmRegion(q, [p.lat, p.lng]),
          },
          p.roadAddress || p.jibunAddress || p.address || q,
        ),
      ),
    );
  } catch {
    $("region-feedback").textContent =
      "지역을 찾지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.";
  } finally {
    $("region-submit").disabled = false;
  }
};
$("change-region").onclick = showRegions;
$("region-cancel").onclick = () => confirmRegion(region.name, region.center);
$("origin-button").onclick = () => search.open("origin");
$("destination-button").onclick = () => search.open("destination");
$("add-place").onclick = $("result-add").onclick = () => search.open();
$("tab-collect").onclick = () => selectView("collect");
$("tab-result").onclick = () => {
  selectView("result");
  map.fit();
};
$("btn-route").onclick = calculate;
$("map-fit").onclick = () => map.fit();
$("map-minus").onclick = () => map.zoom(-1);
$("map-plus").onclick = () => map.zoom(1);
$("course-select").onchange = (e) => {
  active = Number(e.target.value);
  view = "collect";
  render();
  map.fit();
};
function importDays(ds) {
  if (!validDays(ds)) return false;
  days = cleanDays(ds);
  active = 0;
  requestId++;
  busy = false;
  results.clear();
  persist();
  render();
  showRegions();
  return true;
}
$("export-trip").onclick = () => {
  const blob = new Blob(
    [JSON.stringify({ v: 1, days: tripSnapshot(days) }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: "여행길.json" });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("여행 파일을 저장했어요.");
};
$("import-trip").onclick = () => $("import-file").click();
$("import-file").onchange = async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500000) throw Error("여행 파일이 너무 커요.");
    const data = JSON.parse(await file.text());
    if (!validDays(data.days || data))
      throw Error("여행길 파일인지 확인해 주세요.");
    if (!confirm("파일의 여행으로 현재 화면을 바꿀까요?")) return;
    importDays(data.days || data);
    toast("여행을 불러왔어요.");
  } catch (e) {
    toast(e.message);
  } finally {
    e.target.value = "";
  }
};
$("share-trip").onclick = async () => {
  try {
    await navigator.clipboard.writeText(
      location.origin + location.pathname + "#trip=" + encodeTrip(days),
    );
    toast("여행 링크를 복사했어요.");
  } catch {
    toast("링크를 복사하지 못했어요. 파일로 저장해 공유해 주세요.");
  }
};
window.TripApp = {
  getDays: () => days,
  getRegion: () => region?.name || day().region || "",
  validateDays: validDays,
  importDays,
  restoreGuestDays: () => {
    days = load();
    active = 0;
    results.clear();
    requestId++;
    busy = false;
    render();
    showRegions();
  },
  newTrip: () => {
    days = fresh();
    active = 0;
    region = null;
    results.clear();
    requestId++;
    busy = false;
    persist();
    render();
    showRegions();
  },
  toast,
};
// Cloud storage keeps the existing API contract, which requires both endpoints.
document.addEventListener(
  "click",
  (e) => {
    if (
      e.target.closest('#cloud-save,[data-account-action="save"]') &&
      days.some((d) => !d.origin || !d.destination)
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      toast("여행을 저장하려면 출발지와 도착지를 먼저 골라주세요.");
    }
  },
  true,
);
const guest = el(
  "p",
  { id: "account-guest" },
  "로그인 없이도 이 기기에 여행이 자동 저장돼요.",
);
$("account-auth-form").append(guest);
if (location.hash.startsWith("#trip=")) {
  try {
    const shared = decodeTrip(location.hash.slice(6));
    if (!validDays(shared)) throw Error();
    days = cleanDays(shared);
    history.replaceState(null, "", location.pathname + location.search);
    toast("공유받은 여행이에요. 지역을 고르면 이어서 볼 수 있어요.");
  } catch {
    toast("여행 링크를 읽지 못했어요. 링크를 다시 확인해 주세요.");
  }
}
render();
await import("./accounts.js");
