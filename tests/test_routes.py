import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pytest
from fastapi.testclient import TestClient
import app as project

client = TestClient(project.app)

def spot(i, lng=126.0, lat=33.3, stay=0, locked=False):
    return {"id":str(i),"name":f"spot_{i}","lat":lat,"lng":lng,"stayMinutes":stay,"locked":locked}

def test_health_and_config_do_not_leak_secrets():
    assert client.get('/api/health').json()['ok'] is True
    c = client.get('/api/config').json()
    assert 'mapsKeyId' in c
    assert 'Client Secret' not in str(c)

def test_manual_order_and_finish_time():
    payload={"origin":spot('start',126),"destination":spot('end',126.9),
             "stops":[spot('a',126.1,stay=60),spot('b',126.8,stay=30)],"mode":"manual","departure":"09:00"}
    r=client.post('/api/route',json=payload)
    assert r.status_code==200, r.text
    result=r.json()
    assert result['orderIds']==['a','b']
    assert [x['kind'] for x in result['entries']]==['origin','stop','stop','destination']
    assert result['stayMinutes']==90
    assert result['totalMinutes']>=90
    assert result['entries'][0]['arrival']=='09:00'

def test_zero_stops_same_start_and_finish():
    payload={"origin":spot('a'),"destination":spot('b'),"stops":[],"mode":"auto"}
    r=client.post('/api/route',json=payload)
    assert r.status_code==200,r.text
    assert r.json()['totalDistanceMeters']==0


def test_locked_position_respected():
    payload={"origin":spot('start',126),"destination":spot('end',127),"stops":[
             spot('a',126.8), spot('b',126.5,locked=True),spot('c',126.1)],"mode":"auto"}
    r=client.post('/api/route',json=payload)
    assert r.status_code==200,r.text
    assert r.json()['orderIds'][1]=='b'


def test_invalid_coordinate_and_time_rejected():
    payload={"origin":spot('start',126),"destination":spot('end',126.5),"stops":[],"departure":"25:99"}
    assert client.post('/api/route',json=payload).status_code==422
    payload['departure']='09:00';payload['origin']['lat']=105
    assert client.post('/api/route',json=payload).status_code==422


def test_browser_page_served():
    r=client.get('/')
    assert r.status_code==200
    assert '여행길' in r.text

@pytest.mark.asyncio
async def test_full_road_matrix_picks_cheapest_route(monkeypatch):
    """사용자 배열 순서보다 도로 비용을 우선하는지 검증."""
    async def fake_leg(_client, a, b, _gate):
        # 도로 시뮬레이션 비용: start → b → a → end 경로가 유리
        key = (a.id,b.id)
        cost = {('__origin__','stop_1'):1,('stop_1','stop_0'):1,
                ('stop_0','__destination__'):1}.get(key,30)
        return {'durationMinutes':cost,'distanceMeters':cost*1000,
                'path':[[a.lng,a.lat],[b.lng,b.lat]],'source':'naver'}
    monkeypatch.setattr(project,'road_leg',fake_leg)
    payload={'origin':spot('s',126.0),'destination':spot('e',127.0),
             'stops':[spot('a',126.1),spot('b',126.9)],'mode':'auto'}
    req=project.PlanRequest(**payload)
    result=await project.build_plan(req)
    assert result['orderIds']==['b','a']
    assert result['drivingMinutes']==3
    assert result['status']=='road_exact'
