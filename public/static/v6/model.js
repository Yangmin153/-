export const STORAGE = "yeohaenggil.v2.days";
export const REGIONS = {
  제주: [33.489, 126.498],
  서울: [37.5665, 126.978],
  부산: [35.1796, 129.0756],
  강릉: [37.7519, 128.8761],
  경주: [35.8562, 129.2247],
  속초: [38.207, 128.5918],
  여수: [34.7604, 127.6622],
  전주: [35.8242, 127.148],
  인천: [37.4563, 126.7052],
  대전: [36.3504, 127.3845],
  대구: [35.8714, 128.6014],
  광주: [35.1595, 126.8526],
  춘천: [37.8813, 127.7298],
  통영: [34.8544, 128.4332],
  서귀포: [33.254, 126.559],
  포항: [36.019, 129.3435],
};
export const fresh = () => [
  {
    id: crypto.randomUUID(),
    name: "나의 여행",
    region: "",
    origin: null,
    destination: null,
    stops: [],
    departure: "09:00",
    mode: "auto",
  },
];
export const validPlace = (p) =>
  !!p &&
  typeof p.name === "string" &&
  p.name.length > 0 &&
  p.name.length <= 100 &&
  typeof p.lat === "number" &&
  typeof p.lng === "number" &&
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lng) &&
  Math.abs(p.lat) <= 90 &&
  Math.abs(p.lng) <= 180;
export const validDays = (ds) =>
  Array.isArray(ds) &&
  ds.length > 0 &&
  ds.length <= 10 &&
  ds.every(
    (d) =>
      d &&
      (!d.origin || validPlace(d.origin)) &&
      (!d.destination || validPlace(d.destination)) &&
      Array.isArray(d.stops) &&
      d.stops.length <= 30 &&
      d.stops.every(validPlace),
  );
export const cleanDays = (ds) =>
  ds.map(({ result, ...d }) => ({
    ...d,
    id: d.id || crypto.randomUUID(),
    departure: /^([01]\d|2[0-3]):[0-5]\d$/.test(d.departure)
      ? d.departure
      : "09:00",
    mode: "auto",
    stops: d.stops.map((s) => ({ ...s, locked: false })),
  }));
export const samePlace = (a, b) =>
  !!a &&
  !!b &&
  (((a.sourceId || a.id) &&
    (b.sourceId || b.id) &&
    String(a.sourceId || a.id) === String(b.sourceId || b.id)) ||
    (a.name === b.name &&
      Math.abs(a.lat - b.lat) < 0.00003 &&
      Math.abs(a.lng - b.lng) < 0.00003));
export const contains = (d, p) =>
  [d.origin, ...d.stops, d.destination].some((x) => samePlace(x, p));
export const placeFrom = (p) => ({
  ...p,
  sourceId: String(p.sourceId || p.id || ""),
  id: crypto.randomUUID(),
  locked: false,
  category: String(p.category || "장소"),
  lat: Number(p.lat),
  lng: Number(p.lng),
});
export const fingerprint = (d) =>
  JSON.stringify(
    [d.origin, d.destination, d.stops].map((p) =>
      Array.isArray(p)
        ? p.map((x) => [x.id, x.name, x.lat, x.lng])
        : p
          ? [p.id, p.name, p.lat, p.lng]
          : null,
    ),
  );
export function duration(minutes) {
  if (!Number.isFinite(minutes) || minutes < 0) return "시간 확인 안 됨";
  const n = Math.round(minutes);
  if (n === 0) return "1분 미만";
  return [
    n >= 60 ? Math.floor(n / 60) + "시간" : "",
    n % 60 ? (n % 60) + "분" : "",
  ]
    .filter(Boolean)
    .join(" ");
}
export const sequence = (n) =>
  n >= 1 && n <= 20
    ? String.fromCodePoint(0x2460 + n - 1)
    : n >= 21 && n <= 35
      ? String.fromCodePoint(0x3251 + n - 21)
      : String(n);
export const category = (p) =>
  ({
    restaurant: "식당",
    cafe: "카페",
    hotel: "숙소",
    sight: "관광지",
    shopping: "쇼핑",
    transport: "교통",
    activity: "즐길 거리",
    other: "장소",
  })[p.category] ||
  String(p.category || p.categoryName || "장소")
    .split(" > ")
    .at(-1);
export function routeIsValid(result, d) {
  return (
    Array.isArray(result?.entries) &&
    result.entries.length === d.stops.length + 2 &&
    result.entries.every((e) => validPlace(e.place)) &&
    result.entries[0].place.id === d.origin.id &&
    result.entries.at(-1).place.id === d.destination.id &&
    new Set(result.entries.slice(1, -1).map((e) => e.place.id)).size ===
      d.stops.length &&
    d.stops.every((s) => result.entries.some((e) => e.place.id === s.id))
  );
}
// Group nearby screen coordinates instead of moving geographic positions.
export function clusterPoints(points, radius = 30) {
  const groups = [];
  for (const p of points) {
    const g = groups.find(
      (g) => Math.hypot(g[0].x - p.x, g[0].y - p.y) < radius,
    );
    if (g) g.push(p);
    else groups.push([p]);
  }
  return groups;
}
