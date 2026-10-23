import { json, err, validatePlan, buildPlan } from "../lib/core.js";
const LIMIT = 32768;
export async function POST(request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return err("다른 출처에서의 요청은 허용하지 않습니다.", 403);
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().startsWith("application/json"))
    return err("JSON 요청만 허용합니다.", 415);
  const len = Number(request.headers.get("content-length") || 0);
  if (!Number.isFinite(len) || len > LIMIT)
    return err("요청이 너무 큽니다.", 413);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > LIMIT) return err("요청이 너무 큽니다.", 413);
    body = JSON.parse(raw);
  } catch {
    return err("일정 JSON 형식을 확인하세요.");
  }
  if (body?.transport && body.transport !== "car")
    return err(
      "대중교통 동선은 아직 지원하지 않아요. 자동차를 선택해 주세요.",
      422,
    );
  const problem = validatePlan(body);
  if (problem) return err(problem, 422);
  try {
    return json(await buildPlan(body, process.env));
  } catch {
    return err("경로 계산 중 오류가 발생했습니다.", 500);
  }
}
