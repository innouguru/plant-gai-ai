import logging

from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.db.errors import ProviderError
from app.main import app


async def provider_error_route(request: Request) -> JSONResponse:
    raise ProviderError("message_forbidden", "provider details must stay private")


async def unexpected_error_route(request: Request) -> JSONResponse:
    raise RuntimeError("password=password-secret jwt=jwt-secret api_key=api-secret")


app.add_api_route("/test-observability/provider-error", provider_error_route, methods=["GET"])
app.add_api_route("/test-observability/unexpected-error", unexpected_error_route, methods=["POST"])


def test_request_id_is_generated_and_returned(client, caplog) -> None:
    with caplog.at_level(logging.INFO, logger="app.observability"):
        response = client.get("/api/v1/health")

    request_id = response.headers["X-Request-ID"]
    record = next(record for record in caplog.records if record.message == "request_completed")

    assert response.status_code == 200
    assert request_id == record.request_id
    assert record.method == "GET"
    assert record.path == "/api/v1/health"
    assert record.status_code == 200
    assert record.duration_ms >= 0
    assert not [record for record in caplog.records if record.name == "app.observability" and record.message == "error_event"]


def test_supplied_request_id_is_preserved(client) -> None:
    response = client.get("/api/v1/health", headers={"X-Request-ID": "test-request-123"})

    assert response.headers["X-Request-ID"] == "test-request-123"


def test_oversized_request_id_is_regenerated(client) -> None:
    response = client.get("/api/v1/health", headers={"X-Request-ID": "a" * 129})

    request_id = response.headers["X-Request-ID"]
    assert request_id != "a" * 129
    assert len(request_id) == 36


def test_unsafe_request_id_is_regenerated(client) -> None:
    response = client.get("/api/v1/health", headers={"X-Request-ID": "unsafe\nrequest"})

    request_id = response.headers["X-Request-ID"]
    assert request_id != "unsafe\nrequest"
    assert len(request_id) == 36


def test_provider_errors_keep_mapping_and_log_safely(client, caplog) -> None:
    with caplog.at_level(logging.WARNING, logger="app.observability"):
        response = client.get(
            "/test-observability/provider-error",
            headers={"X-Request-ID": "provider-request"},
        )

    assert response.status_code == 403
    assert response.json() == {"detail": "You do not have permission to use messaging with this user."}
    assert response.headers["X-Request-ID"] == "provider-request"
    record = next(record for record in caplog.records if record.message == "provider_error")
    assert record.request_id == "provider-request"
    assert record.error_code == "message_forbidden"
    assert record.event_type == "provider_error"
    assert record.status_code == 403
    assert "provider details must stay private" not in caplog.text


def test_unexpected_errors_are_logged_without_exposing_details(client, caplog) -> None:
    client = TestClient(app, raise_server_exceptions=False)
    with caplog.at_level(logging.ERROR, logger="app.observability"):
        response = client.post(
            "/test-observability/unexpected-error",
            headers={"Authorization": "Bearer jwt-secret", "X-Request-ID": "unexpected-request"},
            json={"password": "password-secret", "token": "body-secret"},
        )

    assert response.status_code == 500
    assert response.json() == {"detail": "An unexpected server error occurred. Please try again."}
    assert response.headers["X-Request-ID"] == "unexpected-request"
    record = next(record for record in caplog.records if record.message == "unexpected_error")
    assert record.exception_type == "RuntimeError"
    assert record.event_type == "unexpected_error"
    assert record.status_code == 500
    assert "test_observability.py" in record.traceback_locations
    assert "password-secret" not in caplog.text
    assert "jwt-secret" not in caplog.text
    assert "api-secret" not in caplog.text
    assert "password-secret" not in caplog.text
    assert "body-secret" not in caplog.text


def test_health_behavior_remains_unchanged(client) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "message": "Plant-GAI-AI API is running",
    }