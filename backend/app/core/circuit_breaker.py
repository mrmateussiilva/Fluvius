"""
Circuit Breaker para chamadas externas à Evolution API.

Estados:
  - CLOSED  (normal): requisições passam livremente.
  - OPEN    (falho):  bloqueia chamadas por `reset_timeout` segundos.
  - HALF_OPEN       : permite 1 requisição de teste; se falhar → OPEN novamente.
"""

import asyncio
import time
import logging
from enum import Enum

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreakerError(Exception):
    """Levantado quando o circuit breaker está OPEN."""
    pass


class CircuitBreaker:
    def __init__(
        self,
        name: str = "default",
        failure_threshold: int = 5,
        reset_timeout: float = 30.0,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._opened_at: float | None = None
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        return self._state

    def _should_attempt_reset(self) -> bool:
        return (
            self._opened_at is not None
            and (time.monotonic() - self._opened_at) >= self.reset_timeout
        )

    async def call(self, coro):
        """
        Executa `coro` respeitando o estado do circuit breaker.

        Uso:
            result = await cb.call(httpx_client.get(url))
        """
        async with self._lock:
            if self._state == CircuitState.OPEN:
                if self._should_attempt_reset():
                    self._state = CircuitState.HALF_OPEN
                    logger.info(
                        f"[CircuitBreaker:{self.name}] HALF_OPEN — tentando recuperação"
                    )
                else:
                    remaining = self.reset_timeout - (time.monotonic() - self._opened_at)
                    raise CircuitBreakerError(
                        f"[CircuitBreaker:{self.name}] OPEN — aguardando {remaining:.1f}s"
                    )

        try:
            result = await coro
            await self._on_success()
            return result
        except CircuitBreakerError:
            raise
        except Exception as exc:
            await self._on_failure(exc)
            raise

    async def _on_success(self):
        async with self._lock:
            if self._state == CircuitState.HALF_OPEN:
                logger.info(
                    f"[CircuitBreaker:{self.name}] Recuperado → CLOSED"
                )
            self._state = CircuitState.CLOSED
            self._failure_count = 0
            self._opened_at = None

    async def _on_failure(self, exc: Exception):
        async with self._lock:
            self._failure_count += 1
            logger.warning(
                f"[CircuitBreaker:{self.name}] Falha {self._failure_count}/{self.failure_threshold}: {exc}"
            )
            if self._failure_count >= self.failure_threshold or self._state == CircuitState.HALF_OPEN:
                self._state = CircuitState.OPEN
                self._opened_at = time.monotonic()
                logger.error(
                    f"[CircuitBreaker:{self.name}] OPEN após {self._failure_count} falha(s)"
                )

    def reset(self):
        """Reset manual do circuit breaker (útil para testes)."""
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._opened_at = None


# Instância global para a Evolution API
evolution_circuit_breaker = CircuitBreaker(
    name="evolution_api",
    failure_threshold=5,
    reset_timeout=30.0,
)
