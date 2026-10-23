import { $, el, json, toast } from "./dom.js";
import { findPlaces } from "./place-service.js";
import { TravelMap } from "./map.js";
import { category, contains, samePlace } from "./model.js";
export class PlaceSearch {
  constructor({ day, region, onAdd, onClose }) {
    Object.assign(this, { day, region, onAdd, onClose });
    this.cache = new Map();
    this.items = [];
    this.selected = null;
    this.version = 0;
    this.map = new TravelMap(
      $("search-map"),
      $("search-map-message"),
      (group) => {
        if (group.length === 1) this.select(group[0]);
        else {
          this.toggle(true);
          $("search-results").replaceChildren(
            ...group.map((p) => this.resultRow(p)),
          );
          $("search-feedback").textContent =
            "같은 위치의 장소예요. 하나를 골라주세요.";
          $("search-more").hidden = true;
        }
      },
    );
    $("search-close").onclick = () => this.close();
    $("search-view-toggle").onclick = () => this.toggle(!this.list);
    $("place-search-form").onsubmit = (e) => {
      e.preventDefault();
      clearTimeout(this.timer);
      $("place-query").blur();
      void this.search();
    };
    const input = $("place-query");
    input.addEventListener("compositionstart", () => {
      this.composing = true;
      clearTimeout(this.timer);
    });
    input.addEventListener("compositionend", () => {
      this.composing = false;
      this.schedule();
    });
    input.oninput = () => {
      if (!this.composing) this.schedule();
    };
    $("search-more").onclick = () => this.search(true);
    window.addEventListener("popstate", () => {
      if (!$("search-screen").hidden) this.close(true);
    });
    this.viewport = () => {
      const v = window.visualViewport;
      $("search-screen").style.height =
        (v?.height || window.innerHeight) + "px";
      $("search-screen").style.top = (v?.offsetTop || 0) + "px";
    };
    document.addEventListener("keydown", (e) => {
      if ($("search-screen").hidden) return;
      if (e.key === "Escape") this.close();
      if (e.key === "Tab") {
        const nodes = [
          ...$("search-screen").querySelectorAll("button:not(:disabled),input"),
        ].filter((n) => n.getClientRects().length);
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }
  schedule() {
    clearTimeout(this.timer);
    this.controller?.abort();
    this.version++;
    this.selected = null;
    this.items = [];
    this.map.render([]);
    this.renderList();
    this.renderSelected();
    $("search-more").hidden = true;
    this.timer = setTimeout(() => this.search(), 250);
  }
  open(target = "stop") {
    this.target = target;
    this.returnFocus = document.activeElement;
    history.pushState({ travelSearch: true }, "");
    this.scrollY = window.scrollY;
    document.body.style.top = `-${this.scrollY}px`;
    document.body.classList.add("search-open");
    $("app-shell").inert = true;
    $("search-screen").hidden = false;
    $("search-title").textContent =
      target === "origin"
        ? "출발지 선택"
        : target === "destination"
          ? "도착지 선택"
          : "방문지 추가";
    this.items = [];
    this.selected = null;
    this.version++;
    $("place-query").value = "";
    $("search-results").replaceChildren();
    $("search-more").hidden = true;
    $("search-feedback").textContent =
      `${this.region().name}에서 가고 싶은 곳을 찾아보세요.`;
    this.renderSelected();
    this.toggle(false);
    this.map.move(this.region().center);
    this.map.render([]);
    void this.map.init();
    this.viewport();
    window.visualViewport?.addEventListener("resize", this.viewport);
    window.visualViewport?.addEventListener("scroll", this.viewport);
    this.updateCount();
    $("place-query").focus({ preventScroll: true });
  }
  close(fromHistory = false) {
    if ($("search-screen").hidden) return;
    if (!fromHistory && history.state?.travelSearch) history.back();
    clearTimeout(this.timer);
    this.controller?.abort();
    this.version++;
    $("search-screen").hidden = true;
    $("app-shell").inert = false;
    document.body.classList.remove("search-open");
    document.body.style.top = "";
    window.scrollTo(0, this.scrollY);
    window.visualViewport?.removeEventListener("resize", this.viewport);
    window.visualViewport?.removeEventListener("scroll", this.viewport);
    this.returnFocus?.focus({ preventScroll: true });
    this.onClose?.();
  }
  toggle(list) {
    this.list = list;
    $("search-list-view").hidden = !list;
    $("search-map-view").hidden = list;
    $("search-view-toggle").textContent = list ? "지도보기" : "목록보기";
    $("search-view-toggle").setAttribute("aria-pressed", String(list));
    if (!list) requestAnimationFrame(() => this.map.drawMarkers());
  }
  async search(more = false) {
    const q = $("place-query").value.trim();
    this.controller?.abort();
    const version = ++this.version;
    if (q.length < 2) {
      this.items = [];
      this.selected = null;
      this.map.render([]);
      this.renderList();
      this.renderSelected();
      $("search-feedback").textContent = "두 글자 이상 입력해 주세요.";
      return;
    }
    this.controller = new AbortController();
    const signal = this.controller.signal;
    const page = more ? this.page + 1 : 1;
    $("search-feedback").textContent = "장소를 찾고 있어요…";
    $("search-more").disabled = true;
    if (!more) {
      this.selected = null;
      this.items = [];
      this.renderList();
      this.renderSelected();
      this.map.render([]);
    }
    try {
      const key = q + ":" + page;
      let data = this.cache.get(key);
      if (!data || Date.now() - data.time > 120000) {
        data = await findPlaces(q, page, signal);
        data.time = Date.now();
        this.cache.set(key, data);
        if (this.cache.size > 30)
          this.cache.delete(this.cache.keys().next().value);
      }
      if (version !== this.version) return;
      this.page = page;
      this.items = more
        ? [
            ...this.items,
            ...data.items.filter(
              (p) => !this.items.some((x) => samePlace(x, p)),
            ),
          ]
        : data.items;
      $("search-feedback").textContent = this.items.length
        ? `${this.items.length}곳 · 핀이나 목록에서 골라주세요`
        : "찾은 장소가 없어요. 다른 이름이나 주소로 검색해 주세요.";
      this.renderList();
      this.map.render(this.items);
      this.map.fit();
      $("search-more").hidden = !data.hasNext;
      if (this.items.length) this.select(this.items[0], false);
    } catch (e) {
      if (e.name === "AbortError" || version !== this.version) return;
      $("search-feedback").textContent = e.message;
      $("search-more").hidden = !more;
    } finally {
      if (version === this.version) $("search-more").disabled = false;
    }
  }
  select(place, move = true) {
    this.selected = place;
    this.renderSelected();
    if (move) {
      this.toggle(false);
      this.map.move([place.lat, place.lng], 16);
    }
    $("place-query").blur();
  }
  resultRow(p) {
    return el(
      "button",
      { class: "search-result", type: "button", onclick: () => this.select(p) },
      el("span", { class: "place-icon" }, "⌖"),
      el(
        "span",
        { class: "place-copy" },
        el("strong", {}, p.name),
        el("small", {}, category(p)),
        el("span", {}, p.address || p.roadAddress || "주소 정보 없음"),
      ),
      el("span", { class: "result-check" }, contains(this.day(), p) ? "✓" : ""),
    );
  }
  renderList() {
    $("search-results").replaceChildren(
      ...this.items.map((p) => this.resultRow(p)),
    );
  }
  updateCount() {
    $("search-count").textContent = `${this.day().stops.length}곳 담음`;
  }
  renderSelected() {
    const p = this.selected;
    if (!p) {
      $("selected-place").replaceChildren(
        el("p", { class: "muted" }, "검색한 장소의 핀을 눌러보세요."),
      );
      return;
    }
    const exists = this.target === "stop" && contains(this.day(), p);
    const button = el(
      "button",
      {
        class: "primary" + (exists ? " added" : ""),
        disabled: exists,
        type: "button",
        onclick: () => {
          if (this.onAdd(p, this.target)) {
            if (this.target !== "stop") {
              this.close();
              return;
            }
            this.renderSelected();
            this.renderList();
            this.updateCount();
            toast(`${p.name}이(가) 여행 코스에 들어갔어요!`);
          }
        },
      },
      exists
        ? "✓ 추가됨"
        : this.target === "stop"
          ? "＋ 방문지 추가"
          : this.target === "origin"
            ? "여기서 출발"
            : "여기로 도착",
    );
    $("selected-place").replaceChildren(
      el(
        "div",
        { class: "place-copy" },
        el("small", {}, category(p)),
        el("strong", {}, p.name),
        el("span", {}, p.address || p.roadAddress || "주소 정보 없음"),
      ),
      button,
    );
  }
}
