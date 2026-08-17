"""Tests for the health endpoint."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "message" in body


def test_health_message() -> None:
    response = client.get("/api/v1/health")

    body = response.json()
    assert body["message"] == "Plant-GAI-AI API is running"