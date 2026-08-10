"""AI-006: fallback-aware LLM entrypoint tests.

Covers the primary->fallback decision logic in llm/completion.py and the
hosted OpenAI-compatible fallback provider's request/parse contract in
llm/http_llm_client.py. No network or real provider is touched — the Groq
call and httpx.post are monkeypatched.
"""

import json

import groq
import httpx
import pytest

from llm import completion, http_llm_client
from llm.groq_client import GroqConfigError


def _groq_conn_error():
    """A real groq.APIConnectionError (a _FALLBACKABLE subclass of groq.APIError)."""
    return groq.APIConnectionError(request=httpx.Request("POST", "http://groq.test"))


def _raise(exc):
    def _fn(system, user, temperature=0.3):
        raise exc
    return _fn


# --- completion.complete_json: primary path ------------------------------


def test_primary_success_skips_fallback(monkeypatch):
    fallback_called = False

    def fake_fallback(system, user, temperature=0.3):
        nonlocal fallback_called
        fallback_called = True
        return {"from": "fallback"}

    monkeypatch.setattr(
        completion, "groq_complete_json",
        lambda system, user, temperature=0.3: {"from": "groq"},
    )
    monkeypatch.setattr(completion, "fallback_complete_json", fake_fallback)

    assert completion.complete_json("sys", "usr") == {"from": "groq"}
    assert fallback_called is False


# --- completion.complete_json: fallback path -----------------------------


@pytest.mark.parametrize(
    "primary_exc",
    [
        _groq_conn_error(),
        GroqConfigError("no key"),
        json.JSONDecodeError("bad", "doc", 0),
    ],
)
def test_falls_back_on_provider_failure(monkeypatch, primary_exc):
    monkeypatch.setattr(completion, "groq_complete_json", _raise(primary_exc))
    monkeypatch.setattr(completion, "LLM_FALLBACK_ENABLED", True)
    monkeypatch.setattr(
        completion, "fallback_complete_json",
        lambda system, user, temperature=0.3: {"from": "fallback"},
    )

    assert completion.complete_json("sys", "usr") == {"from": "fallback"}


def test_non_provider_error_propagates(monkeypatch):
    """A bug (e.g. TypeError) must NOT be masked by falling back."""
    monkeypatch.setattr(completion, "groq_complete_json", _raise(TypeError("caller bug")))
    with pytest.raises(TypeError):
        completion.complete_json("sys", "usr")


def test_fallback_disabled_raises_llmerror(monkeypatch):
    monkeypatch.setattr(completion, "groq_complete_json", _raise(_groq_conn_error()))
    monkeypatch.setattr(completion, "LLM_FALLBACK_ENABLED", False)
    with pytest.raises(completion.LLMError):
        completion.complete_json("sys", "usr")


def test_both_providers_fail_raises_llmerror(monkeypatch):
    monkeypatch.setattr(completion, "groq_complete_json", _raise(_groq_conn_error()))
    monkeypatch.setattr(completion, "LLM_FALLBACK_ENABLED", True)
    monkeypatch.setattr(
        completion, "fallback_complete_json",
        _raise(http_llm_client.FallbackLLMError("secondary down")),
    )
    with pytest.raises(completion.LLMError):
        completion.complete_json("sys", "usr")


# --- http_llm_client.fallback_complete_json: request + parse contract -----


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


def test_fallback_client_builds_openai_request_and_parses(monkeypatch):
    captured = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        # OpenAI-compatible shape: choices[0].message.content is a JSON string.
        return _FakeResponse({"choices": [{"message": {"content": '{"answer": 42}'}}]})

    monkeypatch.setattr(http_llm_client, "FALLBACK_LLM_API_KEY", "test-key")
    monkeypatch.setattr(http_llm_client.httpx, "post", fake_post)

    result = http_llm_client.fallback_complete_json("system prompt", "user prompt", temperature=0.5)

    assert result == {"answer": 42}
    assert captured["url"].endswith("/chat/completions")
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert captured["json"]["response_format"] == {"type": "json_object"}
    assert captured["json"]["temperature"] == 0.5
    assert captured["json"]["messages"][0] == {"role": "system", "content": "system prompt"}
    assert captured["json"]["messages"][1] == {"role": "user", "content": "user prompt"}


def test_fallback_client_requires_api_key(monkeypatch):
    monkeypatch.setattr(http_llm_client, "FALLBACK_LLM_API_KEY", "")
    with pytest.raises(http_llm_client.FallbackLLMError):
        http_llm_client.fallback_complete_json("s", "u")


def test_fallback_client_wraps_transport_error(monkeypatch):
    def fake_post(url, headers=None, json=None, timeout=None):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(http_llm_client, "FALLBACK_LLM_API_KEY", "test-key")
    monkeypatch.setattr(http_llm_client.httpx, "post", fake_post)
    with pytest.raises(http_llm_client.FallbackLLMError):
        http_llm_client.fallback_complete_json("s", "u")


def test_fallback_client_wraps_bad_payload(monkeypatch):
    def fake_post(url, headers=None, json=None, timeout=None):
        return _FakeResponse({"unexpected": "shape"})

    monkeypatch.setattr(http_llm_client, "FALLBACK_LLM_API_KEY", "test-key")
    monkeypatch.setattr(http_llm_client.httpx, "post", fake_post)
    with pytest.raises(http_llm_client.FallbackLLMError):
        http_llm_client.fallback_complete_json("s", "u")
