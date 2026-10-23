export const $ = (id) => document.getElementById(id);
export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null)
      n.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) {
    if (c != null)
      n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}
let timer;
export function toast(msg) {
  $("toast").textContent = msg;
  $("toast").hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => ($("toast").hidden = true), 3200);
}
export async function json(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok)
    throw Error(
      body.detail || body.error || "연결이 잠시 끊겼어요. 다시 시도해 주세요.",
    );
  return body;
}
