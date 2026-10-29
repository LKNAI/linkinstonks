"""Cliente HTTP com timeouts, retry exponencial com jitter, `Retry-After` e circuit breaker por fonte.

- Retry (até 5 tentativas) em erro de rede, 429 e 5xx. 404 e demais 4xx voltam ao chamador (um 404 de
  COTAHIST num dia útil não é erro: ver `sources/b3_cotahist.py`).
- Circuit breaker: 5 falhas seguidas abortam a fonte sem derrubar as outras.
- `PAINEL_HTTP_BASE_PROXY` (opcional, plano B da seção 9.4): reescreve para `{proxy}/{url}`.
"""

from __future__ import annotations

import os
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

import httpx
from tenacity import (
    RetryCallState,
    Retrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

USER_AGENT = os.environ.get("PAINEL_USER_AGENT", "painel-b3/0.1 (projeto de dados abertos, uso nao comercial)")
CONNECT_TIMEOUT = 10.0
READ_TIMEOUT = 60.0
READ_TIMEOUT_COTAHIST = 180.0
MAX_ATTEMPTS = 5
BREAKER_LIMIT = 5


class CircuitOpenError(RuntimeError):
    """Falhas seguidas demais nesta fonte; ela é abandonada nesta execução."""


class RetryableStatusError(Exception):
    def __init__(self, response: httpx.Response) -> None:
        super().__init__(f"HTTP {response.status_code} em {response.request.url}")
        self.response = response


def _wait_retry_after(base: Callable[[RetryCallState], float]) -> Callable[[RetryCallState], float]:
    def wait(state: RetryCallState) -> float:
        exc = state.outcome.exception() if state.outcome else None
        if isinstance(exc, RetryableStatusError):
            ra = exc.response.headers.get("Retry-After", "")
            if ra.isdigit():
                return min(float(ra), 120.0)
        return base(state)

    return wait


class Http:
    def __init__(
        self,
        fonte: str,
        *,
        client: httpx.Client | None = None,
        wait: Callable[[RetryCallState], float] | None = None,
        sleep: Callable[[float], None] = time.sleep,
        proxy_base: str | None = None,
    ) -> None:
        self.fonte = fonte
        self.falhas_seguidas = 0
        self.proxy_base = proxy_base if proxy_base is not None else os.environ.get("PAINEL_HTTP_BASE_PROXY")
        self._sleep = sleep
        self._wait = _wait_retry_after(wait or wait_exponential_jitter(initial=1, max=30))
        self.client = client or httpx.Client(
            http2=True,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "pt-BR"},
            timeout=httpx.Timeout(READ_TIMEOUT, connect=CONNECT_TIMEOUT),
            follow_redirects=True,
        )

    def _url(self, url: str) -> str:
        return f"{self.proxy_base.rstrip('/')}/{url}" if self.proxy_base else url

    def _retrying(self) -> Retrying:
        return Retrying(
            stop=stop_after_attempt(MAX_ATTEMPTS),
            wait=self._wait,
            sleep=self._sleep,
            retry=retry_if_exception_type((httpx.TransportError, RetryableStatusError)),
            reraise=True,
        )

    def _checar_disjuntor(self) -> None:
        if self.falhas_seguidas >= BREAKER_LIMIT:
            raise CircuitOpenError(f"{self.fonte}: {self.falhas_seguidas} falhas seguidas")

    def request(self, method: str, url: str, *, read_timeout: float | None = None, **kw: Any) -> httpx.Response:
        self._checar_disjuntor()
        timeout = httpx.Timeout(read_timeout or READ_TIMEOUT, connect=CONNECT_TIMEOUT)
        try:
            for tentativa in self._retrying():
                with tentativa:
                    r = self.client.request(method, self._url(url), timeout=timeout, **kw)
                    if r.status_code == 429 or r.status_code >= 500:
                        raise RetryableStatusError(r)
        except (httpx.TransportError, RetryableStatusError):
            self.falhas_seguidas += 1
            raise
        self.falhas_seguidas = 0
        return r

    def get(self, url: str, **kw: Any) -> httpx.Response:
        return self.request("GET", url, **kw)

    def head(self, url: str, **kw: Any) -> httpx.Response:
        return self.request("HEAD", url, **kw)

    def download(self, url: str, destino: Path, *, read_timeout: float | None = None) -> httpx.Response:
        """Baixa em streaming para o disco (os COTAHIST mensais descompactam para ~90 MB)."""
        self._checar_disjuntor()
        destino.parent.mkdir(parents=True, exist_ok=True)
        tmp = destino.with_suffix(destino.suffix + ".part")
        timeout = httpx.Timeout(read_timeout or READ_TIMEOUT_COTAHIST, connect=CONNECT_TIMEOUT)
        try:
            for tentativa in self._retrying():
                with tentativa, self.client.stream("GET", self._url(url), timeout=timeout) as r:
                    if r.status_code == 429 or r.status_code >= 500:
                        r.read()
                        raise RetryableStatusError(r)
                    if r.status_code == 200:
                        with tmp.open("wb") as f:
                            for chunk in r.iter_bytes(1 << 20):
                                f.write(chunk)
        except (httpx.TransportError, RetryableStatusError):
            self.falhas_seguidas += 1
            tmp.unlink(missing_ok=True)
            raise
        self.falhas_seguidas = 0
        if r.status_code == 200:
            tmp.replace(destino)
        return r
