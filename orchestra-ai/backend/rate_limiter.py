import time
import asyncio
import logging

logger = logging.getLogger("orchestra.rate_limiter")

class SlidingWindowLimiter:
    def __init__(self):
        # Maps key -> list of float timestamps
        self.history = {}
        self.lock = asyncio.Lock()
        
        # Periodically clean up extremely old keys
        self.last_cleanup = time.time()

    async def is_allowed(self, key: str, limit: int, window_seconds: int = 60) -> tuple[bool, float]:
        """
        Thread-safe check to verify if a request under 'key' stays within 'limit' per 'window_seconds'.
        Returns:
            (allowed: bool, retry_after: float)
            retry_after represents the number of seconds the client must wait before making another request.
        """
        now = time.time()
        
        # Trigger cleanup every 10 minutes to prevent memory leaks
        if now - self.last_cleanup > 600:
            asyncio.create_task(self.cleanup(now))

        async with self.lock:
            # Initialize or retrieve timestamp history for the key
            timestamps = self.history.get(key, [])
            
            # Filter out timestamps outside the active window
            cutoff = now - window_seconds
            active_timestamps = [t for t in timestamps if t > cutoff]
            
            if len(active_timestamps) < limit:
                # Add current request timestamp
                active_timestamps.append(now)
                self.history[key] = active_timestamps
                return True, 0.0
            
            # Calculate remaining time for the oldest active request to expire
            oldest_timestamp = active_timestamps[0]
            retry_after = max(0.1, window_seconds - (now - oldest_timestamp))
            
            # Save the filtered timestamps
            self.history[key] = active_timestamps
            
            return False, round(retry_after, 1)

    async def cleanup(self, now: float):
        """Purges keys that haven't been active in the last 1 hour."""
        async with self.lock:
            logger.info("Triggering rate limiter memory cleanup...")
            cutoff = now - 3600  # 1 hour
            to_delete = []
            
            for key, timestamps in self.history.items():
                # If all requests are older than 1 hour, mark for deletion
                if not timestamps or max(timestamps) < cutoff:
                    to_delete.append(key)
            
            for key in to_delete:
                del self.history[key]
                
            self.last_cleanup = now
            logger.info(f"Rate limiter memory cleanup complete. Purged {len(to_delete)} stale keys.")

# Single global instance for memory persistence
rate_limiter = SlidingWindowLimiter()
