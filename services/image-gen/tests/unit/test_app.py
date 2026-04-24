import pytest
from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def test_health_returns_200(client):
    response = client.get("/health")
    assert response.status_code == 200


def test_health_returns_ok_json(client):
    response = client.get("/health")
    data = response.get_json()
    assert data == {"status": "ok"}


def test_health_content_type_is_json(client):
    response = client.get("/health")
    assert "application/json" in response.content_type


def test_unknown_route_returns_404(client):
    response = client.get("/unknown-route")
    assert response.status_code == 404
