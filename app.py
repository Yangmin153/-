"""여행길 v2 — 초보자도 실행 가능한 단일 FastAPI 서버.
네이버 지도 JS는 브라우저에, Directions/Geocode 인증은 서버에 보관합니다.
"""
import asyncio
import math
import os
from datetime import datetime, timedelta
from itertools import permutations
from pathlib import Path
from typing import Literal

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator, model_validator

BASE = Path(__file__).resolve().parent
load_dotenv(BASE / ".env")
CLIENT_ID = os.getenv("NAVER_MAPS_CLIENT_ID", "").strip()
CLIENT_SECRET = os.getenv("NAVER_MAPS_CLIENT_SECRET", "").strip()
MAP_JS_KEY = os.getenv("NAVER_MAPS_JS_KEY_ID", "").strip() or CLIENT_ID
DIR_URL = os.getenv("NAVER_DIRECTIONS_URL", "https://maps.apigw.ntruss.com/map-direction/v1/driving")
GEO_URL = os.getenv("NAVER_GEOCODE_URL", "https://maps.apigw.ntruss.com/map-geocode/v2/geocode")
NAVER_READY = bool(CLIENT_ID and CLIENT_SECRET)

app = FastAPI(title="여행길 — 네이버 여행 동선 최적화", version="2.0.0")
app.mount("/static", StaticFiles(directory=BASE / "web"), name="static")


class Place(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=100)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    stayMinutes: int = Field(default=0, ge=0, le=720)
    locked: bool = False


class PlanRequest(BaseModel):
    origin: Place
    destination: Place
    stops: list[Place] = Field(default_factory=list, max_length=12)
    departure: str = "09:00"
    mode: Literal["auto", "manual"] = "auto"

    @field_validator("departure")
    @classmethod
    def check_departure(cls, v):
        try:
            datetime.strptime(v, "%H:%M")
        except ValueError as exc:
            raise ValueError("출발시각은 HH:MM 형식이어야 합니다") from exc
        return v

    @model_validator(mode="after")
    def unique_stop_ids(self):
        ids = [p.id for p in self.stops]
        if len(ids) != len(set(ids)):
            raise ValueError("관광지 ID는 중복될 수 없습니다")
        return self


def coord(p):
    return f"{p.lng:.7f},{p.lat:.7f}"


def haversine_km(a: Place, b: Place) -> float:
    r1, r2 = math.radians(a.lat), math.radians(b.lat)
    dy = r2 - r1
    dx = math.radians(b.lng - a.lng)
    x = math.sin(dy / 2) ** 2 + math.cos(r1) * math.cos(r2) * math.sin(dx / 2) ** 2
    return 6371.0 * 2.0 * math.asin(min(1.0, math.sqrt(x)))


def estimate(a: Place, b: Place):
    """공식 도로 데이터가 없을 때의 명시적인 추정치. 실제 도로 시간으로 표시하지 않음."""
    km = haversine_km(a, b)
    distance = round(km * 1.33 * 1000)
    minutes = (km * 1.33 / 42.0 * 60.0) + (4.0 if km else 0.0)
    return {"durationMinutes": round(minutes, 1), "distanceMeters": distance,
            "path": [[a.lng, a.lat], [b.lng, b.lat]], "source": "estimate"}


async def road_leg(client: httpx.AsyncClient, a: Place, b: Place, gate: asyncio.Semaphore):
    if haversine_km(a, b) < 0.005:
        return {"durationMinutes": 0.0, "distanceMeters": 0,
                "path": [[a.lng, a.lat]], "source": "same_point"}
    if not NAVER_READY:
        return estimate(a, b)
    headers = {"x-ncp-apigw-api-key-id": CLIENT_ID,
               "x-ncp-apigw-api-key": CLIENT_SECRET, "Accept": "application/json"}
    async with gate:
        try:
            r = await client.get(DIR_URL, params={"start": coord(a), "goal": coord(b),
                                                  "option": "traoptimal"}, headers=headers)
            r.raise_for_status()
            data = r.json()
            routes = data.get("route", {}).get("traoptimal") or []
            if data.get("code") != 0 or not routes:
                raise ValueError(data.get("message") or "도로 경로를 찾지 못했습니다")
            route = routes[0]
            summary = route["summary"]
            path = route.get("path") or [[a.lng, a.lat], [b.lng, b.lat]]
            return {"durationMinutes": round(summary["duration"] / 60000, 1),
                    "distanceMeters": summary["distance"],
                    "path": path, "source": "naver"}
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            # API 오류를 정상적인 네이버 경로로 가장하지 않습니다.
            return estimate(a, b)


def seeded_order(stops, origin, destination):
    """고정 장소의 인덱스를 유지하면서 자유 장소를 직선거리로 먼저 정렬."""
    unlocked = [p for p in stops if not p.locked]
    slots = [p if p.locked else None for p in stops]
    remaining = unlocked[:]
    prior = origin
    for i, p in enumerate(slots):
        if p is None:
            # 뒤쪽에 고정 지점이 있다면 그 지점으로의 거리도 고려
            next_fixed = next((q for q in slots[i + 1:] if q is not None), destination)
            picked = min(remaining, key=lambda x: haversine_km(prior, x) + 0.4 * haversine_km(x, next_fixed))
            slots[i] = picked
            remaining.remove(picked)
        prior = slots[i]
    return slots


def optimize_with_matrix(stops, origin, destination, matrix):
    """최대 6곳: 고정 위치를 유지한 모든 자유 순서를 정확히 평가."""
    indices = range(len(stops))
    free_positions = [i for i in indices if not stops[i].locked]
    free_stops = [stops[i] for i in free_positions]
    by_id = {p.id: p for p in [origin, destination, *stops]}

    def score(order):
        route = [origin, *order, destination]
        return sum(matrix[(route[i].id, route[i + 1].id)]["durationMinutes"]
                   for i in range(len(route) - 1))

    if not free_positions:
        return list(stops)
    best, best_cost = None, float("inf")
    for perm in permutations(free_stops):
        candidate = list(stops)
        for index, point in zip(free_positions, perm):
            candidate[index] = point
        cost = score(candidate)
        if cost < best_cost:
            best, best_cost = candidate, cost
    return best


def optimize_geo(stops, origin, destination):
    """7~12곳: API 호출량을 제한하기 위한 거리 휴리스틱(도로 최적 보장 없음)."""
    ordered = seeded_order(stops, origin, destination)
    def cost(arr):
        seq = [origin, *arr, destination]
        return sum(haversine_km(seq[k], seq[k+1]) for k in range(len(seq)-1))
    best = cost(ordered)
    for _ in range(5):
        improved = False
        for a in range(len(ordered)):
            for b in range(a+1, len(ordered)):
                if any(p.locked for p in ordered[a:b+1]):
                    continue
                trial = ordered[:a] + list(reversed(ordered[a:b+1])) + ordered[b+1:]
                v = cost(trial)
                if v + 1e-8 < best:
                    ordered, best = trial, v
                    improved = True
        if not improved:
            break
    return ordered


def time_at(departure: str, minutes: float):
    start = datetime.strptime(departure, "%H:%M")
    final = start + timedelta(minutes=minutes)
    suffix = " (+1일)" if final.date() != start.date() else ""
    return final.strftime("%H:%M") + suffix


async def build_plan(req: PlanRequest):
    # origin/destination의 ID와 관광지 ID가 겹치지 않도록 서버 내부 전용 ID 사용
    origin = req.origin.model_copy(update={"id": "__origin__"})
    destination = req.destination.model_copy(update={"id": "__destination__"})
    stops = [p.model_copy(update={"id": f"stop_{i}"}) for i, p in enumerate(req.stops)]
    positions = [origin, *stops, destination]
    gate = asyncio.Semaphore(4)
    matrix = {}
    warnings = []
    async with httpx.AsyncClient(timeout=httpx.Timeout(12.0)) as client:
        # 0~6곳: 경로의 모든 가능한 인접 구간을 조사해 해당 이동시간 행렬에서 최적해 선택.
        # 7곳 이상: 요금/대기시간을 고려해 지리적 휴리스틱 후 실제 이동 구간만 조회.
        full_matrix = req.mode == "auto" and len(stops) <= 6
        if full_matrix:
            pairs = [(origin, s) for s in stops]
            pairs += [(a, b) for a in stops for b in stops if a.id != b.id]
            pairs += [(s, destination) for s in stops]
            if not stops:
                pairs.append((origin, destination))
            results = await asyncio.gather(*(road_leg(client, a, b, gate) for a, b in pairs))
            matrix = {(a.id, b.id): leg for (a, b), leg in zip(pairs, results)}
            order = optimize_with_matrix(stops, origin, destination, matrix)
        else:
            order = list(stops) if req.mode == "manual" else optimize_geo(stops, origin, destination)

        seq = [origin, *order, destination]
        missing = [(a, b) for a, b in zip(seq[:-1], seq[1:]) if (a.id, b.id) not in matrix]
        if missing:
            results = await asyncio.gather(*(road_leg(client, a, b, gate) for a, b in missing))
            matrix.update({(a.id, b.id): leg for (a, b), leg in zip(missing, results)})

    elapsed = 0.0
    total_distance = 0
    driving = 0.0
    entries = [{"kind": "origin", "place": req.origin.model_dump(),
                "arrival": req.departure, "departure": req.departure, "leg": None}]
    road_count = 0
    estimated_count = 0
    for i in range(len(seq) - 1):
        source, target = seq[i], seq[i + 1]
        leg = matrix[(source.id, target.id)]
        total_distance += leg["distanceMeters"]
        driving += leg["durationMinutes"]
        elapsed += leg["durationMinutes"]
        target_ui = req.destination if i == len(seq) - 2 else req.stops[int(target.id[5:])]
        arrival = time_at(req.departure, elapsed)
        if leg["source"] == "naver":
            road_count += 1
        if leg["source"] == "estimate":
            estimated_count += 1
        kind = "destination" if i == len(seq) - 2 else "stop"
        if kind == "stop":
            elapsed += target_ui.stayMinutes
        entries.append({"kind": kind, "place": target_ui.model_dump(), "arrival": arrival,
                        "departure": time_at(req.departure, elapsed), "leg": leg})
    candidate_estimates = sum(1 for leg in matrix.values() if leg["source"] == "estimate")
    if not NAVER_READY:
        warnings.append("네이버 길찾기 키가 없어 직선거리 기반 예상 이동시간을 표시합니다.")
    elif estimated_count:
        warnings.append(f"네이버 길찾기에 실패한 {estimated_count}개 구간은 추정치입니다. API 권한·좌표·사용량을 확인하세요.")
    if req.mode == "auto" and len(stops) > 6:
        warnings.append("관광지 7곳 이상은 API 호출량 절감을 위해 거리 휴리스틱으로 순서를 정합니다. 도로 시간 기준 최적해는 보장되지 않습니다.")
    if req.mode == "auto" and len(stops) <= 6 and candidate_estimates:
        warnings.append("최적화에 사용한 일부 후보 구간에 추정치가 포함돼 도로 이동시간 기준 최적해를 보장하지 않습니다.")

    status = ("estimated" if road_count == 0 else
              "mixed" if estimated_count else
              "road_partial" if full_matrix and candidate_estimates else
              "road_exact" if full_matrix else
              "road_order")
    # 계산이 끝나도 이용자 입력의 원래 ID·표기는 유지
    return {"entries": entries, "orderIds": [req.stops[int(p.id[5:])].id for p in order],
            "totalDistanceMeters": total_distance, "drivingMinutes": round(driving, 1),
            "stayMinutes": sum(p.stayMinutes for p in req.stops),
            "totalMinutes": round(elapsed, 1), "status": status, "warnings": warnings,
            "apiLegs": road_count, "estimatedLegs": estimated_count,
            "calculatedAt": datetime.now().isoformat(timespec="seconds")}


@app.get("/")
async def index():
    return FileResponse(BASE / "web" / "index.html")


@app.get("/api/health")
async def health():
    return {"ok": True, "version": "2.0.0"}


@app.get("/api/config")
async def config():
    return {"mapsKeyId": MAP_JS_KEY, "directionsReady": NAVER_READY,
            "geocodeReady": NAVER_READY, "version": "2.0.0"}


@app.get("/api/geocode")
async def geocode(q: str = Query(min_length=2, max_length=120)):
    if not NAVER_READY:
        raise HTTPException(status_code=503, detail="네이버 지도 API 키가 설정되지 않았습니다.")
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(GEO_URL, params={"query": q}, headers={
                "x-ncp-apigw-api-key-id": CLIENT_ID,
                "x-ncp-apigw-api-key": CLIENT_SECRET, "Accept": "application/json"})
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError):
            raise HTTPException(status_code=502, detail="네이버 주소 검색 요청에 실패했습니다.")
    if payload.get("status") != "OK":
        raise HTTPException(status_code=502, detail="네이버 주소 검색 결과를 받지 못했습니다.")
    return {"results": [{"address": item.get("roadAddress") or item.get("jibunAddress") or "",
                          "lat": float(item["y"]), "lng": float(item["x"])}
                         for item in payload.get("addresses", [])[:8]]}


@app.post("/api/route")
async def route(req: PlanRequest):
    return await build_plan(req)
