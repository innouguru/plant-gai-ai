"""Tests for ES256/JWKS JWT verification."""

import base64
import json
import time
import uuid

import jwt
import pytest
from fastapi import HTTPException

from app.core import security
from app.core.security import _clear_jwks_cache, decode_access_token


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _generate_ec_keypair(kid: str = "test-kid-1"):
    """Generate EC P-256 keypair and return (private_pem, jwk_dict)."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    private_key = ec.generate_private_key(ec.SECP256R1())
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    public_key = private_key.public_key()
    numbers = public_key.public_numbers()
    x = numbers.x.to_bytes(32, "big")
    y = numbers.y.to_bytes(32, "big")

    jwk = {
        "kty": "EC",
        "crv": "P-256",
        "kid": kid,
        "x": _b64url(x),
        "y": _b64url(y),
        "alg": "ES256",
        "use": "sig",
    }
    return private_pem, jwk


PRIVATE_PEM, PUBLIC_JWK = _generate_ec_keypair(kid="test-kid-1")
PRIVATE_PEM_2, PUBLIC_JWK_2 = _generate_ec_keypair(kid="test-kid-2")


def _create_es256_token(private_pem: str, kid: str, sub: str, expires_seconds: int = 3600) -> str:
    now = int(time.time())
    payload = {
        "aud": "authenticated",
        "role": "authenticated",
        "email": f"{sub}@example.com",
        "exp": now + expires_seconds,
        "iat": now,
        "sub": sub,
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, private_pem, algorithm="ES256", headers={"kid": kid})


def _mock_jwks(monkeypatch, jwks_dict):
    def fake_get(url, timeout=5.0):
        class FakeResp:
            def raise_for_status(self):
                pass

            def json(self):
                return jwks_dict

        return FakeResp()

    monkeypatch.setattr("app.core.security.httpx.get", fake_get)
    _clear_jwks_cache()


def test_valid_es256_token(monkeypatch):
    _mock_jwks(monkeypatch, {"keys": [PUBLIC_JWK]})
    token = _create_es256_token(PRIVATE_PEM, "test-kid-1", "user-123")
    claims = decode_access_token(token, secret=None)
    assert claims["sub"] == "user-123"


def test_expired_es256_token(monkeypatch):
    _mock_jwks(monkeypatch, {"keys": [PUBLIC_JWK]})
    token = _create_es256_token(PRIVATE_PEM, "test-kid-1", "user-123", expires_seconds=-60)
    with pytest.raises(HTTPException) as exc:
        decode_access_token(token, secret=None)
    assert exc.value.status_code == 401
    assert "expired" in exc.value.detail.lower()


def test_invalid_signature_es256(monkeypatch):
    _mock_jwks(monkeypatch, {"keys": [PUBLIC_JWK]})
    token = _create_es256_token(PRIVATE_PEM, "test-kid-1", "user-123")
    # Corrupt signature
    bad_token = token[:-5] + "XXXXX"
    with pytest.raises(HTTPException) as exc:
        decode_access_token(bad_token, secret=None)
    assert exc.value.status_code == 401


def test_unknown_kid(monkeypatch):
    _mock_jwks(monkeypatch, {"keys": [PUBLIC_JWK]})
    token = _create_es256_token(PRIVATE_PEM_2, "test-kid-2", "user-123")
    with pytest.raises(HTTPException) as exc:
        decode_access_token(token, secret=None)
    assert exc.value.status_code == 401


def test_missing_token():
    _clear_jwks_cache()
    with pytest.raises(HTTPException) as exc:
        decode_access_token("", secret=None)
    assert exc.value.status_code == 401
    with pytest.raises(HTTPException) as exc2:
        decode_access_token(None, secret=None)  # type: ignore
    assert exc2.value.status_code == 401


def test_malformed_token(monkeypatch):
    _mock_jwks(monkeypatch, {"keys": [PUBLIC_JWK]})
    with pytest.raises(HTTPException) as exc:
        decode_access_token("not.a.jwt", secret=None)
    assert exc.value.status_code == 401


def test_jwks_fetch_failure(monkeypatch):
    def fake_get_fail(url, timeout=5.0):
        raise RuntimeError("network down")

    monkeypatch.setattr("app.core.security.httpx.get", fake_get_fail)
    _clear_jwks_cache()
    token = _create_es256_token(PRIVATE_PEM, "test-kid-1", "user-123")
    with pytest.raises(HTTPException) as exc:
        decode_access_token(token, secret=None)
    assert exc.value.status_code == 401


def test_auth_me_with_valid_es256_token(monkeypatch, client, provider):
    _mock_jwks(monkeypatch, {"keys": [PUBLIC_JWK]})
    # Seed a farmer and use ES256 token for auth
    farm = provider.seed_farm(name="Yam Farm", admin_id=provider.new_id("a-"))
    farmer = provider.seed_farmer(email="farmer@example.com", farm_id=farm.id)
    provider.seed_admin(farm_id=farm.id)
    token = _create_es256_token(PRIVATE_PEM, "test-kid-1", farmer.id)

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["id"] == farmer.id


def test_auth_me_rejects_es256_without_kid(monkeypatch, client, provider):
    _mock_jwks(monkeypatch, {"keys": [PUBLIC_JWK]})
    # Create token without kid header
    now = int(time.time())
    payload = {"sub": "some-id", "aud": "authenticated", "exp": now + 3600, "iat": now}
    token = jwt.encode(payload, PRIVATE_PEM, algorithm="ES256")  # no kid
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_jwks_caching(monkeypatch):
    call_count = {"n": 0}

    def fake_get(url, timeout=5.0):
        call_count["n"] += 1

        class FakeResp:
            def raise_for_status(self):
                pass

            def json(self):
                return {"keys": [PUBLIC_JWK]}

        return FakeResp()

    monkeypatch.setattr("app.core.security.httpx.get", fake_get)
    _clear_jwks_cache()

    t1 = _create_es256_token(PRIVATE_PEM, "test-kid-1", "u1")
    t2 = _create_es256_token(PRIVATE_PEM, "test-kid-1", "u2")
    decode_access_token(t1, secret=None)
    decode_access_token(t2, secret=None)
    # Second call should be cached, not fetch again
    assert call_count["n"] == 1

    # After clearing cache, next call fetches again
    _clear_jwks_cache()
    decode_access_token(t1, secret=None)
    assert call_count["n"] == 2
