from fastapi.testclient import TestClient
from server import app, Point, km, optimize_order, group_places, approximate_leg

client = TestClient(app)

A = {"id":"a","name":"A","lat":33.51,"lng":126.49,"stay":60}
B = {"id":"b","name":"B","lat":33.41,"lng":126.59,"stay":60}
C = {"id":"c","name":"C","lat":33.30,"lng":126.32,"stay":60}
D = {"id":"d","name":"D","lat":33.46,"lng":126.95,"stay":60}
O = {"id":"origin","name":"공항","lat":33.5104,"lng":126.4914,"stay":10}
H = {"id":"hotel","name":"숙소","lat":33.2493,"lng":126.4118,"stay":10}


def payload(places=None, days=2):
    return {'places': places or [A,B,C,D], 'origin':O,'lodging':H, 'days':days, 'pace':'normal', 'start_time':'09:30'}


def test_health():
    r=client.get('/api/health')
    assert r.status_code == 200
    assert r.json()['ok']


def test_index_assets_are_served():
    assert client.get('/').status_code == 200
    assert '여행길' in client.get('/').text
    assert 'NAVER_SEARCH_API_KEY' not in client.get('/app.js').text
    assert client.get('/app.css').status_code == 200


def test_route_returns_days_and_stops():
    r=client.post('/api/plan',json=payload())
    assert r.status_code == 200, r.text
    data=r.json()
    assert len(data['days']) == 2
    assert sum(len(day['stops'])-2 for day in data['days']) == 4
    assert data['distance_km']>0
    assert data['drive_minutes']>0
    assert data['legs_total'] >= 4
    assert all(not leg['actual'] for day in data['days'] for leg in day['legs'])
    for day in data['days']:
        assert day['stops'][0]['place']['id'] in {'origin','hotel'}
        assert day['stops'][-1]['place']['id']=='hotel'


def test_return_to_origin():
    q=payload(); q['return_origin']=True
    response=client.post('/api/plan',json=q)
    assert response.status_code==200
    assert response.json()['days'][-1]['stops'][-1]['place']['id']=='origin'


def test_limits_and_validation():
    q=payload([A]*16)
    assert client.post('/api/plan',json=q).status_code==422
    q=payload([A,A])
    assert client.post('/api/plan',json=q).status_code==422
    q=payload([A]);q['start_time']='99:45'
    assert client.post('/api/plan',json=q).status_code==422
    q=payload([dict(A,lat=100)])
    assert client.post('/api/plan',json=q).status_code==422


def test_coordinate_distance_and_greedy():
    o=Point(**O);hotel=Point(**H);places=[Point(**x) for x in [A,B,C]]
    assert km(o,o)<0.0001
    assert 0 < km(o,hotel)<100
    result=optimize_order(places,o,hotel)
    assert {p.id for p in result} == {'a','b','c'}
    groups=group_places(places,2,o,hotel,False)
    assert len(groups)==2
    assert sum(len(g[1]) for g in groups)==3


def test_search_requires_credentials_when_unconfigured():
    # In CI credentials are unset. Ensure a meaningful error; skip if configured.
    status=client.get('/api/config').json()
    if not status['searchConfigured']:
        response=client.get('/api/search',params={'q':'제주 성산일출봉'})
        assert response.status_code==503


def test_live_search_proxy_contract_with_mock(monkeypatch):
    import server
    import httpx
    monkeypatch.setattr(server, 'SEARCH_MODE', 'hub')
    monkeypatch.setattr(server, 'SEARCH_KEY_ID', 'test-public-id')
    monkeypatch.setattr(server, 'SEARCH_KEY', 'test-secret')
    server._search_calls.clear()
    requests=[]
    def responder(request: httpx.Request):
        requests.append(request)
        assert request.headers['X-NCP-APIGW-API-KEY-ID']=='test-public-id'
        assert request.headers['X-NCP-APIGW-API-KEY']=='test-secret'
        assert request.url.path == '/search/v1/local'
        return httpx.Response(200,json={'items':[{'title':'성산일출봉','mapx':'1269425000','mapy':'334581000','category':'관광'}]})
    real_client = httpx.AsyncClient
    def mock_client(*args,**kwargs):
        return real_client(transport=httpx.MockTransport(responder))
    monkeypatch.setattr(server.httpx,'AsyncClient',mock_client)
    response=client.get('/api/search',params={'q':'제주 성산일출봉'})
    assert response.status_code==200
    assert response.json()['items'][0]['mapx']=='1269425000'
    assert len(requests)==1


def test_directions_proxy_contract_with_mock(monkeypatch):
    import server
    import httpx
    monkeypatch.setattr(server, 'MAP_KEY_ID','my-map-id')
    monkeypatch.setattr(server, 'MAP_KEY','my-map-secret')
    routes=[]
    def responder(request: httpx.Request):
        routes.append(request)
        assert request.headers['X-NCP-APIGW-API-KEY-ID']=='my-map-id'
        assert request.url.path=='/map-direction/v1/driving'
        return httpx.Response(200,json={'route':{'traoptimal':[{'summary':{'distance':12120,'duration':1190000},'path':[[126.49,33.51],[126.54,33.43],[126.59,33.41]]}]}})
    real_client = httpx.AsyncClient
    def mock_client(*args,**kwargs):
        return real_client(transport=httpx.MockTransport(responder))
    monkeypatch.setattr(server.httpx,'AsyncClient',mock_client)
    response=client.post('/api/plan',json=payload([A,B],days=1))
    assert response.status_code==200
    data=response.json()
    assert data['legs_actual'] > 0
    assert data['days'][0]['legs'][0]['path'][0] == [33.51,126.49]
    assert len(routes)==3
