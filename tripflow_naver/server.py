"""모바일 여행 동선 앱: Naver Maps SDK + NAVER API HUB Local Search + Directions.

Run: uvicorn server:app --reload
All secret credentials stay in server-side environment variables.
"""
from __future__ import annotations

import asyncio
import html
import itertools
import math
import os
import re
import time
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

load_dotenv()
ROOT = Path(__file__).parent
WEB = ROOT / 'web'
app = FastAPI(title='여행길 지도 API', version='1.0.0', docs_url='/api/docs')

NAVER_MAP_ID = os.getenv('NAVER_MAP_CLIENT_ID', '').strip()
MAP_KEY_ID = os.getenv('NAVER_MAP_API_KEY_ID', '').strip()
MAP_KEY = os.getenv('NAVER_MAP_API_KEY', '').strip()
SEARCH_KEY_ID = os.getenv('NAVER_SEARCH_API_KEY_ID', '').strip()
SEARCH_KEY = os.getenv('NAVER_SEARCH_API_KEY', '').strip()
SEARCH_MODE = os.getenv('NAVER_SEARCH_MODE', 'hub').lower()  # hub or legacy
LEGACY_CLIENT_ID = os.getenv('NAVER_SEARCH_CLIENT_ID', '').strip()
LEGACY_CLIENT_SECRET = os.getenv('NAVER_SEARCH_CLIENT_SECRET', '').strip()

MAX_STOPS = 15
SEARCH_LIMIT_PER_MINUTE = 30
_search_calls: dict[str, list[float]] = {}


class Point(BaseModel):
    id: str = Field(min_length=1, max_length=140)
    name: str = Field(min_length=1, max_length=120)
    lat: float = Field(ge=32, le=39)
    lng: float = Field(ge=124, le=132)
    category: str = Field(default='방문 장소', max_length=80)
    stay: int = Field(default=60, ge=10, le=360)


class PlanRequest(BaseModel):
    places: list[Point] = Field(min_length=1, max_length=MAX_STOPS)
    origin: Point
    lodging: Point
    days: int = Field(default=2, ge=1, le=5)
    start_time: str = Field(default='09:30', pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    pace: str = Field(default='normal', pattern=r'^(relaxed|normal|packed)$')
    return_origin: bool = False

    @field_validator('places')
    @classmethod
    def no_duplicate(cls, val: list[Point]):
        keys = [(round(p.lat, 5), round(p.lng, 5), p.name) for p in val]
        if len(set(keys)) != len(keys):
            raise ValueError('같은 장소가 중복되었습니다.')
        return val


def km(a: Point, b: Point) -> float:
    rad1, rad2 = math.radians(a.lat), math.radians(b.lat)
    dlat, dlng = rad2 - rad1, math.radians(b.lng - a.lng)
    x = math.sin(dlat / 2) ** 2 + math.cos(rad1) * math.cos(rad2) * math.sin(dlng / 2) ** 2
    return 6371.0088 * 2 * math.asin(min(1, math.sqrt(x)))


def optimize_order(places: list[Point], start: Point, end: Point) -> list[Point]:
    """Nearest-neighbor + 2-opt, with fixed start and destination. Not globally optimal."""
    remaining = list(places)
    result = []
    current = start
    while remaining:
        nearest = min(remaining, key=lambda p: km(current, p))
        result.append(nearest)
        remaining.remove(nearest)
        current = nearest
    def score(path: list[Point]):
        points = [start, *path, end]
        return sum(km(a, b) for a, b in zip(points, points[1:]))
    # Local improvement includes the destination penalty.
    improved = True
    while improved:
        improved = False
        best = score(result)
        for i in range(len(result)):
            for j in range(i + 1, len(result)):
                trial = result[:i] + result[i:j+1][::-1] + result[j+1:]
                trial_score = score(trial)
                if trial_score + 1e-9 < best:
                    result, best = trial, trial_score
                    improved = True
    return result


def group_places(places: list[Point], days: int, origin: Point, lodging: Point, return_origin: bool):
    """Balanced geographical groups, then best of up to 5! group-day permutations."""
    n_groups = min(days, len(places))
    # Compare spans in kilometers (not raw degrees) to select the meaningful axis.
    lat_span = (max(p.lat for p in places) - min(p.lat for p in places)) * 111
    lng_span = (max(p.lng for p in places) - min(p.lng for p in places)) * 111 * math.cos(math.radians(origin.lat))
    key = (lambda p: p.lng) if lng_span >= lat_span else (lambda p: p.lat)
    ordered = sorted(places, key=key)
    q, r = divmod(len(ordered), n_groups)
    chunks: list[list[Point]] = []
    offset = 0
    for i in range(n_groups):
        count = q + int(i < r)
        chunks.append(ordered[offset:offset+count])
        offset += count

    best_total, best_routes = math.inf, []
    for perm in itertools.permutations(chunks):
        routes = []
        total = 0.
        for day, chunk in enumerate(perm):
            s = origin if day == 0 else lodging
            e = origin if return_origin and day == n_groups-1 else lodging
            order = optimize_order(chunk, s, e)
            seq = [s, *order, e]
            total += sum(km(a,b) for a,b in zip(seq, seq[1:]))
            routes.append((s, order, e))
        if total < best_total:
            best_total, best_routes = total, routes
    return best_routes


def can_drive():
    return bool(MAP_KEY_ID and MAP_KEY)


def can_search():
    if SEARCH_MODE == 'legacy':
        return bool(LEGACY_CLIENT_ID and LEGACY_CLIENT_SECRET)
    return bool(SEARCH_KEY_ID and SEARCH_KEY)


@app.get('/api/health')
async def health():
    return {'ok': True, 'search_configured': can_search(), 'directions_configured': can_drive(), 'map_configured': bool(NAVER_MAP_ID)}


@app.get('/api/config')
async def config():
    return {
        'naverMapClientId': NAVER_MAP_ID,
        'searchConfigured': can_search(),
        'directionsConfigured': can_drive(),
        'searchMode': SEARCH_MODE,
        'maxStops': MAX_STOPS,
    }


@app.get('/api/search')
async def search(q: str = Query(min_length=2, max_length=80)):
    """Proxy original NAVER results. Do not persist or manipulate result ranking."""
    if not can_search():
        raise HTTPException(503, '장소 검색 API 키가 아직 설정되지 않았습니다. NAVER API HUB의 지역 검색 키를 등록하세요.')
    # Basic process-local rate limit. For large services place at gateway / Redis layer.
    client_key = 'global'
    now = time.monotonic()
    calls = [t for t in _search_calls.get(client_key, []) if now - t < 60]
    if len(calls) >= SEARCH_LIMIT_PER_MINUTE:
        raise HTTPException(429, '검색 요청이 잠시 많습니다. 1분 뒤 다시 검색해주세요.')
    calls.append(now)
    _search_calls[client_key] = calls
    if SEARCH_MODE == 'legacy':
        url = 'https://openapi.naver.com/v1/search/local.json'
        headers = {'X-Naver-Client-Id': LEGACY_CLIENT_ID, 'X-Naver-Client-Secret': LEGACY_CLIENT_SECRET}
        params = {'query': q, 'display': 5, 'start': 1, 'sort': 'random'}
    else:
        url = 'https://naverapihub.apigw.ntruss.com/search/v1/local'
        headers = {'X-NCP-APIGW-API-KEY-ID': SEARCH_KEY_ID, 'X-NCP-APIGW-API-KEY': SEARCH_KEY}
        params = {'query': q, 'display': 5, 'start': 1, 'sort': 'random', 'format': 'json'}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            res = await client.get(url, params=params, headers=headers)
        if res.status_code in (401, 403):
            raise HTTPException(502, '네이버 검색 API 인증 또는 사용 권한을 확인하세요.')
        if res.status_code == 429:
            raise HTTPException(429, '네이버 검색 API 요청 한도에 도달했습니다.')
        res.raise_for_status()
        data = res.json()
    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, '네이버 장소 검색에 연결하지 못했습니다.')
    return {'items': data.get('items', []), 'source': 'NAVER 검색 API'}


def approximate_leg(a: Point, b: Point) -> dict[str, Any]:
    d = km(a,b) * 1.32
    return {
        'distance_m': round(d * 1000),
        'duration_min': 0 if d < 0.1 else max(5, round(d / 38 * 60)),
        'path': [[a.lat, a.lng], [b.lat, b.lng]],
        'actual': False,
    }


async def driving_leg(a: Point, b: Point, client: httpx.AsyncClient, sem: asyncio.Semaphore) -> dict[str, Any]:
    if km(a, b) < .08:
        return {'distance_m':0,'duration_min':0,'path':[[a.lat,a.lng],[b.lat,b.lng]],'actual':True}
    if not can_drive():
        return approximate_leg(a, b)
    async with sem:
        try:
            response = await client.get(
                'https://maps.apigw.ntruss.com/map-direction/v1/driving',
                params={'start':f'{a.lng:.7f},{a.lat:.7f}', 'goal':f'{b.lng:.7f},{b.lat:.7f}', 'option':'traoptimal'},
                headers={'X-NCP-APIGW-API-KEY-ID':MAP_KEY_ID,'X-NCP-APIGW-API-KEY':MAP_KEY},
            )
            response.raise_for_status()
            payload = response.json()
            routes = payload.get('route') or {}
            first = (routes.get('traoptimal') or routes.get('trafast') or [])
            if not first: return approximate_leg(a,b)
            result = first[0]
            summary = result['summary']
            coords = result.get('path') or []   # Naver returns [lng,lat].
            step = max(1, math.ceil(len(coords) / 220))
            path = [[float(pair[1]),float(pair[0])] for pair in coords[::step] if len(pair)>=2]
            if coords and len(coords)>1 and path[-1] != [float(coords[-1][1]),float(coords[-1][0])]:
                path.append([float(coords[-1][1]),float(coords[-1][0])])
            return {
                'distance_m':round(summary['distance']),
                'duration_min':max(1,round(summary['duration']/60000)),
                'path':path or [[a.lat,a.lng],[b.lat,b.lng]],
                'actual':True,
            }
        except (httpx.HTTPError, ValueError, TypeError, KeyError, IndexError, ZeroDivisionError):
            return approximate_leg(a,b)


def hhmm(t: int):
    return f'{(t//60)%24:02d}:{t%60:02d}'


@app.post('/api/plan')
async def plan(body: PlanRequest):
    groups = group_places(body.places, body.days, body.origin, body.lodging, body.return_origin)
    all_pairs = []
    for start, stops, end in groups:
        seq = [start, *stops, end]
        all_pairs.extend(list(zip(seq, seq[1:])))
    semaphore = asyncio.Semaphore(3)
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
        legs = await asyncio.gather(*(driving_leg(a,b,client,semaphore) for a,b in all_pairs))

    results = []
    pos = 0
    all_distance, all_duration, actual_count = 0,0,0
    multiplier = {'relaxed':1.3,'normal':1.0,'packed':0.8}[body.pace]
    h,m = map(int,body.start_time.split(':'))
    for i,(start,stops,end) in enumerate(groups):
        curtime = h*60+m
        day_items = [{'place': start.model_dump(), 'arrival': hhmm(curtime), 'kind':'start', 'stay':0}]
        day_legs = []
        for j,stop in enumerate([*stops,end]):
            leg = legs[pos]
            pos += 1
            day_legs.append(leg)
            all_distance += leg['distance_m']
            all_duration += leg['duration_min']
            actual_count += int(leg['actual'])
            curtime += leg['duration_min']
            dwell = round(stop.stay * multiplier) if j<len(stops) else 0
            day_items.append({'place':stop.model_dump(), 'arrival':hhmm(curtime), 'kind':'stop' if j<len(stops) else 'end', 'stay':dwell, 'travel_min':leg['duration_min'], 'actual':leg['actual']})
            curtime += dwell
        results.append({'day':i+1,'stops':day_items,'legs':day_legs,'end_time':hhmm(curtime),'overloaded':curtime>21*60})
    return {
        'days': results,
        'distance_km': round(all_distance/1000,1),
        'drive_minutes': all_duration,
        'legs_actual': actual_count,
        'legs_total': len(legs),
        'method': 'haversine-2opt+naver-driving' if can_drive() else 'haversine-2opt+approximate-legs',
        'note':'방문 순서는 거리 기반 휴리스틱이며 전역 최적 보장은 없습니다. 실제 도로 시간은 설정된 Naver Directions API가 반환한 구간에만 반영됩니다.',
    }


@app.get('/')
async def index():
    return FileResponse(WEB / 'index.html')


app.mount('/', StaticFiles(directory=WEB), name='static')
