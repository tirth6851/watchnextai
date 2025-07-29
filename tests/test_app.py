import json
import types
import pytest

from backend.app import app

class FakeResponse:
    def __init__(self, data):
        self._data = data
    def json(self):
        return self._data


def fake_get(url, *args, **kwargs):
    if 'trending/movie/week' in url:
        return FakeResponse({"results": [{"id": 1, "title": "Movie 1", "poster_path": "/a.jpg", "vote_average": 8}]})
    if 'search/movie' in url:
        return FakeResponse({"results": [{"id": 2, "title": "Search Movie", "poster_path": "/b.jpg", "vote_average": 7}]})
    if '/movie/' in url and 'recommendations' in url:
        return FakeResponse({"results": [{"id": 3, "title": "Recommended", "poster_path": "/c.jpg"}]})
    if '/movie/' in url and 'append_to_response' in url:
        return FakeResponse({
            "id": 1,
            "title": "Movie 1",
            "overview": "Desc",
            "vote_average": 8,
            "videos": {"results": [{"type": "Trailer", "site": "YouTube", "key": "abc"}]},
            "reviews": {"results": []}
        })
    return FakeResponse({})


@pytest.fixture(autouse=True)
def patch_requests(monkeypatch):
    monkeypatch.setattr('backend.app.requests.get', fake_get)
    monkeypatch.setattr('backend.recommender.requests.get', fake_get)
    yield

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_home_page(client):
    res = client.get('/')
    assert res.status_code == 200
    assert b'<html' in res.data

def test_load_more(client):
    res = client.get('/load_more?page=2')
    assert res.status_code == 200
    data = res.get_json()
    assert 'movies' in data
    assert isinstance(data['movies'], list)


def test_search(client):
    res = client.get('/search?query=test')
    assert res.status_code == 200
    data = res.get_json()
    assert 'movies' in data


def test_movie_details(client):
    res = client.get('/movie/1')
    assert res.status_code == 200
    assert b'<html' in res.data
