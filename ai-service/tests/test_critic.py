"""CRITIC-001: vision-model quality-gate tests (critic/vision_client.py).

No network is touched — httpx.post is monkeypatched, mirroring
tests/test_llm.py's pattern for the fallback LLM client.
"""

import httpx
import pytest

from critic import vision_client


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def json(self):
        return self._payload


def _cloudflare_ok(response_field):
    return _FakeResponse(
        {"success": True, "result": {"response": response_field}, "errors": []}
    )


def test_evaluate_frame_passes_through_object_response(monkeypatch):
    captured = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        return _cloudflare_ok({"pass": True, "reason": "matches the description"})

    monkeypatch.setattr(vision_client, "CLOUDFLARE_ACCOUNT_ID", "acct123")
    monkeypatch.setattr(vision_client, "CLOUDFLARE_API_TOKEN", "token123")
    monkeypatch.setattr(vision_client.httpx, "post", fake_post)

    result = vision_client.evaluate_frame("base64data", "a wide shot of a mountain")

    assert result == {"passed": True, "reason": "matches the description"}
    assert captured["url"] == (
        "https://api.cloudflare.com/client/v4/accounts/acct123"
        "/ai/run/@cf/meta/llama-4-scout-17b-16e-instruct"
    )
    assert captured["headers"]["Authorization"] == "Bearer token123"
    user_content = captured["json"]["messages"][1]["content"]
    assert user_content[0]["text"] == "Intended shot description: a wide shot of a mountain"
    assert user_content[1]["image_url"]["url"] == "data:image/jpeg;base64,base64data"


def test_evaluate_frame_parses_stringified_json_response(monkeypatch):
    def fake_post(url, headers=None, json=None, timeout=None):
        return _cloudflare_ok('{"pass": false, "reason": "mismatch"}')

    monkeypatch.setattr(vision_client, "CLOUDFLARE_ACCOUNT_ID", "acct123")
    monkeypatch.setattr(vision_client, "CLOUDFLARE_API_TOKEN", "token123")
    monkeypatch.setattr(vision_client.httpx, "post", fake_post)

    result = vision_client.evaluate_frame("base64data", "desc")

    assert result == {"passed": False, "reason": "mismatch"}


def test_evaluate_frame_requires_credentials(monkeypatch):
    monkeypatch.setattr(vision_client, "CLOUDFLARE_ACCOUNT_ID", "")
    monkeypatch.setattr(vision_client, "CLOUDFLARE_API_TOKEN", "")
    with pytest.raises(vision_client.CriticConfigError):
        vision_client.evaluate_frame("base64data", "desc")


def test_evaluate_frame_wraps_transport_error(monkeypatch):
    def fake_post(url, headers=None, json=None, timeout=None):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(vision_client, "CLOUDFLARE_ACCOUNT_ID", "acct123")
    monkeypatch.setattr(vision_client, "CLOUDFLARE_API_TOKEN", "token123")
    monkeypatch.setattr(vision_client.httpx, "post", fake_post)

    with pytest.raises(vision_client.CriticEvaluationError):
        vision_client.evaluate_frame("base64data", "desc")


def test_evaluate_frame_raises_on_cloudflare_error_envelope(monkeypatch):
    def fake_post(url, headers=None, json=None, timeout=None):
        return _FakeResponse(
            {"success": False, "result": {}, "errors": [{"message": "model agreement required"}]}
        )

    monkeypatch.setattr(vision_client, "CLOUDFLARE_ACCOUNT_ID", "acct123")
    monkeypatch.setattr(vision_client, "CLOUDFLARE_API_TOKEN", "token123")
    monkeypatch.setattr(vision_client.httpx, "post", fake_post)

    with pytest.raises(vision_client.CriticEvaluationError, match="model agreement required"):
        vision_client.evaluate_frame("base64data", "desc")


def test_evaluate_frame_rejects_malformed_verdict(monkeypatch):
    def fake_post(url, headers=None, json=None, timeout=None):
        return _cloudflare_ok({"unexpected": "shape"})

    monkeypatch.setattr(vision_client, "CLOUDFLARE_ACCOUNT_ID", "acct123")
    monkeypatch.setattr(vision_client, "CLOUDFLARE_API_TOKEN", "token123")
    monkeypatch.setattr(vision_client.httpx, "post", fake_post)

    with pytest.raises(vision_client.CriticEvaluationError):
        vision_client.evaluate_frame("base64data", "desc")


def test_evaluate_frame_rejects_non_json_string_verdict(monkeypatch):
    def fake_post(url, headers=None, json=None, timeout=None):
        return _cloudflare_ok("not json at all")

    monkeypatch.setattr(vision_client, "CLOUDFLARE_ACCOUNT_ID", "acct123")
    monkeypatch.setattr(vision_client, "CLOUDFLARE_API_TOKEN", "token123")
    monkeypatch.setattr(vision_client.httpx, "post", fake_post)

    with pytest.raises(vision_client.CriticEvaluationError):
        vision_client.evaluate_frame("base64data", "desc")
