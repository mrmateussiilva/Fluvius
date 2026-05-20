import pytest
import asyncio
from app.core.circuit_breaker import CircuitBreaker, CircuitBreakerError, CircuitState

@pytest.mark.asyncio
async def test_circuit_breaker_success():
    cb = CircuitBreaker(failure_threshold=2, reset_timeout=1)
    
    async def succeed():
        return True
        
    result = await cb.call(succeed())
    assert result is True
    assert cb.state == CircuitState.CLOSED
    assert cb._failure_count == 0

@pytest.mark.asyncio
async def test_circuit_breaker_failure_and_open():
    cb = CircuitBreaker(failure_threshold=2, reset_timeout=1)
    
    async def fail():
        raise ValueError("error")
        
    with pytest.raises(ValueError):
        await cb.call(fail())
    assert cb._failure_count == 1
    assert cb.state == CircuitState.CLOSED
    
    with pytest.raises(ValueError):
        await cb.call(fail())
    assert cb._failure_count == 2
    assert cb.state == CircuitState.OPEN
    
    with pytest.raises(CircuitBreakerError):
        await cb.call(fail())

@pytest.mark.asyncio
async def test_circuit_breaker_recovery():
    cb = CircuitBreaker(failure_threshold=1, reset_timeout=0.1)
    
    async def fail():
        raise ValueError("error")
        
    async def succeed():
        return True
        
    with pytest.raises(ValueError):
        await cb.call(fail())
        
    assert cb.state == CircuitState.OPEN
    
    # Wait for recovery timeout
    await asyncio.sleep(0.15)
    
    # Half-open to closed
    result = await cb.call(succeed())
    assert result is True
    assert cb.state == CircuitState.CLOSED
    assert cb._failure_count == 0
