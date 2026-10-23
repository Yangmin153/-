import { el, json } from "./dom.js";
import { clusterPoints } from "./model.js";
let sdk;
function loadSDK() {
  if (sdk) return sdk;
  sdk = new Promise(async (resolve, reject) => {
    let timeout;
    const fail = (message) => {
      clearTimeout(timeout);
      reject(Error(message));
    };
    window.navermap_authFailure = () => {
      window.dispatchEvent(new Event("naver-map-auth-failed"));
      fail("지도를 연결하지 못했어요. 목록에서 장소를 선택할 수 있어요.");
    };
    try {
      const config = await json("/api/config");
      if (!config.mapsKeyId)
        return fail(
          "지도 연결 설정을 확인해야 해요. 목록에서 장소를 선택해 주세요.",
        );
      window.__travelMapReady = () => {
        clearTimeout(timeout);
        resolve(window.naver.maps);
      };
      const script = document.createElement("script");
      script.src =
        "https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=" +
        encodeURIComponent(config.mapsKeyId) +
        "&callback=__travelMapReady";
      script.onerror = () =>
        fail("지도를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.");
      timeout = setTimeout(
        () =>
          fail("지도 연결이 늦어지고 있어요. 새로고침 후 다시 시도해 주세요."),
        15000,
      );
      document.head.append(script);
    } catch {
      fail("지도를 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  });
  return sdk;
}
export class TravelMap {
  constructor(container, message, onSelect) {
    this.container = container;
    this.message = message;
    this.onSelect = onSelect;
    this.points = [];
    this.markers = [];
    this.lines = [];
    this.center = [37.5665, 126.978];
    this.ready = false;
    window.addEventListener("naver-map-auth-failed", () =>
      this.showError(
        "지도 인증을 확인해야 해요. 장소 목록은 계속 사용할 수 있어요.",
      ),
    );
  }
  showError(text) {
    this.failed = true;
    this.message.hidden = false;
    this.message.textContent = text;
  }
  async init() {
    if (this.promise) return this.promise;
    this.promise = (async () => {
      try {
        this.api = await loadSDK();
        const n = this.api;
        this.map = new n.Map(this.container, {
          center: new n.LatLng(...this.center),
          zoom: 11,
          zoomControl: false,
          mapTypeControl: false,
          scaleControl: false,
        });
        this.ready = true;
        if (!this.failed) this.message.hidden = true;
        this.resize = new ResizeObserver(() => {
          if (this.container.clientWidth && this.container.clientHeight) {
            this.map.setSize(
              new n.Size(
                this.container.clientWidth,
                this.container.clientHeight,
              ),
            );
            this.drawMarkers();
          }
        });
        this.resize.observe(this.container);
        n.Event.addListener(this.map, "idle", () => this.drawMarkers());
        this.render(this.points, this.legs);
        this.fit();
      } catch (e) {
        this.showError(e.message);
      }
    })();
    return this.promise;
  }
  move(center, zoom = 12) {
    this.center = center;
    if (this.ready) {
      this.map.setCenter(new this.api.LatLng(...center));
      this.map.setZoom(zoom);
    }
  }
  zoom(amount) {
    if (this.ready) this.map.setZoom(this.map.getZoom() + amount);
  }
  fit() {
    if (!this.ready) return;
    if (!this.points.length) return this.move(this.center);
    if (this.points.length === 1)
      return this.move([this.points[0].lat, this.points[0].lng], 14);
    const b = new this.api.LatLngBounds();
    this.points.forEach((p) => b.extend(new this.api.LatLng(p.lat, p.lng)));
    this.map.fitBounds(b, { top: 45, right: 45, bottom: 45, left: 45 });
  }
  render(points = [], legs = []) {
    this.points = points;
    this.legs = legs;
    if (!this.ready) return;
    this.lines.forEach((l) => l.setMap(null));
    this.lines = [];
    for (const leg of legs || []) {
      if (!Array.isArray(leg?.path) || leg.path.length < 2) continue;
      this.lines.push(
        new this.api.Polyline({
          map: this.map,
          path: leg.path.map(([lng, lat]) => new this.api.LatLng(lat, lng)),
          strokeColor: leg.source === "naver" ? "#087f75" : "#7c8491",
          strokeWeight: 5,
          strokeOpacity: 0.85,
          strokeStyle: leg.source === "naver" ? "solid" : "shortdash",
        }),
      );
    }
    this.drawMarkers();
  }
  drawMarkers() {
    if (!this.ready || !this.container.clientWidth) return;
    this.markers.forEach((m) => m.setMap(null));
    this.markers = [];
    const n = this.api,
      projection = this.map.getProjection();
    const projected = this.points.map((p) => {
      const offset = projection.fromCoordToOffset(new n.LatLng(p.lat, p.lng));
      return { ...p, x: offset.x, y: offset.y };
    });
    for (const group of clusterPoints(projected, 34)) {
      const p = group[0],
        labels = group.map((x) => x.order || "").filter(Boolean);
      const label =
        group.length > 1
          ? labels.length
            ? labels.join("·")
            : String(group.length)
          : p.order || "•";
      const button = el(
        "button",
        {
          class: "map-pin" + (group.length > 1 ? " clustered" : ""),
          "aria-label": group
            .map((x) => (x.order ? x.order + "번 " : "") + x.name)
            .join(", "),
          type: "button",
        },
        el("span", {}, label),
      );
      const marker = new n.Marker({
        map: this.map,
        position: new n.LatLng(p.lat, p.lng),
        icon: { content: button, anchor: new n.Point(24, 40) },
        zIndex: p.selected ? 200 : 100,
        title: p.name,
      });
      button.addEventListener("click", () => this.onSelect?.(group));
      this.markers.push(marker);
    }
  }
}
