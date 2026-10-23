import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
test("map loader tolerates provider callback before namespace assignment", async () => {
  const { window } = parseHTML(
    '<html><head></head><body><div id="map"></div><p id="status"></p></body></html>',
  );
  Object.assign(globalThis, {
    window,
    document: window.document,
    Node: window.Node,
    ResizeObserver: class {
      observe() {}
    },
  });
  globalThis.fetch = async () => Response.json({ mapsKeyId: "test-public-id" });
  const { TravelMap } = await import("../public/static/v6/map.js");
  const map = new TravelMap(
    document.getElementById("map"),
    document.getElementById("status"),
  );
  const pending = map.init();
  await new Promise((r) => setTimeout(r, 0));
  assert.doesNotThrow(() => window.__travelMapReady());
  window.naver = {
    maps: {
      Map: class {
        setCenter() {}
        setZoom() {}
      },
      LatLng: class {},
      Event: { addListener() {} },
    },
  };
  document.querySelector("script").onload();
  await pending;
  assert.equal(map.ready, true);
  assert.equal(document.getElementById("status").hidden, true);
  map.showError("지도 인증을 확인해야 해요.");
  assert.equal(map.ready, false);
  assert.doesNotThrow(() => {
    map.render([{ name: "장소", lat: 33, lng: 126 }]);
    map.fit();
    map.move([33, 126]);
  });
});
