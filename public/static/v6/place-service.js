import { json } from "./dom.js";
import "../search-utils.js";
// Keep address search usable even when the place provider is unavailable.
export async function findPlaces(q, page, signal) {
  const keyword = json("/api/places?" + new URLSearchParams({ q, page }), {
    signal,
  });
  const address =
    page === 1 && globalThis.TripSearch.looksLikeAddress(q)
      ? json("/api/geocode?" + new URLSearchParams({ q }), { signal })
      : null;
  const [places, geo] = await Promise.allSettled([keyword, address]);
  if (signal.aborted) throw new DOMException("검색 취소", "AbortError");
  let data =
    places.status === "fulfilled"
      ? places.value
      : { items: [], hasNext: false };
  if (geo.status === "fulfilled" && geo.value)
    data = {
      ...data,
      items: globalThis.TripSearch.combine(data.items, geo.value.results),
    };
  if (!data.items.length && page === 1 && !address) {
    try {
      const fallback = await json(
        "/api/geocode?" + new URLSearchParams({ q }),
        { signal },
      );
      data = {
        ...data,
        items: globalThis.TripSearch.combine([], fallback.results),
      };
    } catch (e) {
      if (places.status === "rejected") throw places.reason;
    }
  }
  if (places.status === "rejected" && !data.items.length) throw places.reason;
  return data;
}
