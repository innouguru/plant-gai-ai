"""Tests for sanitized provider error diagnostics."""

import logging

import httpx
import pytest
from fastapi import Request
from fastapi.responses import JSONResponse

from app.api.errors import provider_error_to_response
from app.db.errors import ProviderError
from app.db.supabase_provider import SupabaseDataProvider


def _make_response(status_code: int, json_data: dict | None = None) -> httpx.Response:
    request = httpx.Request("GET", "https://example.supabase.co/rest/v1/profiles")
    if json_data is None:
        json_data = {"code": "PGRST116", "message": "Row not found"}
    # httpx.Response requires content as bytes for json()
    import json as _json

    content = _json.dumps(json_data).encode("utf-8")
    return httpx.Response(status_code, request=request, content=content, headers={"Content-Type": "application/json"})


def test_raise_for_status_retains_supabase_status_and_code():
    provider = SupabaseDataProvider(url="https://example.supabase.co", anon_key="anon", service_role_key="service")
    resp_401 = _make_response(401, {"code": "401", "message": "Invalid API key"})
    with pytest.raises(ProviderError) as exc:
        provider._raise_for_status(resp_401)
    assert exc.value.code == "401"
    assert exc.value.supabase_status == 401
    assert exc.value.status_code if hasattr(exc.value, "status_code") else True  # dummy

    resp_403 = _make_response(403, {"code": "42501", "message": "permission denied"})
    with pytest.raises(ProviderError) as exc2:
        provider._raise_for_status(resp_403)
    assert exc2.value.code == "42501"
    assert exc2.value.supabase_status == 403

    resp_500 = _make_response(500, {"code": "500", "message": "Internal Server Error"})
    with pytest.raises(ProviderError) as exc3:
        provider._raise_for_status(resp_500)
    assert exc3.value.supabase_status == 500


def test_provider_error_unknown_code_maps_to_502_generic_detail(caplog):
    # Simulate ProviderError from supabase_provider with upstream 401
    err = ProviderError("401", "Invalid API key", supabase_status=401)
    # Build minimal Request
    scope = {"type": "http", "method": "GET", "path": "/api/v1/auth/me", "headers": []}
    request = Request(scope)
    request.state.request_id = "test-diagnostic-123"

    with caplog.at_level(logging.WARNING, logger="app.observability"):
        response = provider_error_to_response(request, err)

    assert response.status_code == 502
    # Client detail must remain generic, not leak upstream message/code
    import json as _json

    body = _json.loads(response.body)
    assert body == {"detail": "An external service error occurred. Please try again."}
    # Logging must contain sanitized fields only
    record = next(r for r in caplog.records if r.message == "provider_error")
    assert record.error_code == "401"
    assert record.supabase_status == 401
    assert record.status_code == 502  # mapped HTTP status
    # Ensure no secrets in log text
    assert "Bearer" not in caplog.text
    assert "apikey" not in caplog.text.lower()
    assert "Invalid API key" not in caplog.text  # message not logged, only code


def test_provider_error_known_code_still_uses_specific_detail(caplog):
    err = ProviderError("farm_statistics_failed", "Could not load farm statistics.", supabase_status=500)
    scope = {"type": "http", "method": "GET", "path": "/api/v1/farms/1/stats", "headers": []}
    request = Request(scope)
    request.state.request_id = "test-known-456"
    with caplog.at_level(logging.WARNING, logger="app.observability"):
        response = provider_error_to_response(request, err)
    assert response.status_code == 502  # mapped from _STATUS_BY_CODE
    import json as _json

    assert _json.loads(response.body) == {"detail": "Could not load farm statistics."}
    record = next(r for r in caplog.records if r.message == "provider_error")
    assert record.supabase_status == 500
    assert record.error_code == "farm_statistics_failed"


def test_provider_error_without_supabase_status_still_logs_safely(caplog):
    err = ProviderError("not_authenticated", "profile not found")
    scope = {"type": "http", "method": "GET", "path": "/api/v1/auth/me", "headers": []}
    request = Request(scope)
    request.state.request_id = "test-no-status"
    with caplog.at_level(logging.WARNING, logger="app.observability"):
        response = provider_error_to_response(request, err)
    assert response.status_code == 401
    record = next(r for r in caplog.records if r.message == "provider_error")
    # supabase_status is None when not provided
    assert getattr(record, "supabase_status", None) is None


def test_get_profile_502_includes_supabase_status_via_provider(monkeypatch, caplog):
    # Integration-style: mock Supabase REST to return 401, ensure provider raises with status
    import httpx as _httpx

    provider = SupabaseDataProvider(url="https://example.supabase.co", anon_key="anon-key-should-not-log", service_role_key="service")
    # Mock _client.get to return 401 response
    def fake_get(url, params=None, headers=None):
        # Ensure Authorization header not logged via our code (we check caplog later)
        assert "apikey" in headers
        assert "Authorization" in headers
        return _make_response(401, {"code": "PGRST301", "message": "No rows"})

    monkeypatch.setattr(provider._client, "get", fake_get)

    with pytest.raises(ProviderError) as exc:
        provider.get_profile(token="Bearer secret-should-not-log", user_id="user-123")
    assert exc.value.supabase_status == 401
    assert exc.value.code == "PGRST301"
    # Now ensure handling via error mapper still 502 and logging does not leak token
    scope = {"type": "http", "method": "GET", "path": "/api/v1/auth/me", "headers": []}
    request = Request(scope)
    request.state.request_id = "test-profile-502"
    with caplog.at_level(logging.WARNING, logger="app.observability"):
        response = provider_error_to_response(request, exc.value)
    assert response.status_code == 502
    assert "secret-should-not-log" not in caplog.text
    assert "anon-key-should-not-log" not in caplog.text
    assert "Bearer" not in caplog.text
