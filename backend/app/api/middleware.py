from typing import Callable
import time
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.status import HTTP_429_TOO_MANY_REQUESTS
import ipaddress
import secrets

from app.core.config import settings

# Rate limiting class
class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self, 
        app: FastAPI, 
        requests_limit: int = 100, 
        time_window: int = 60
    ):
        super().__init__(app)
        self.requests_limit = requests_limit
        self.time_window = time_window  # seconds
        self.clients = {}  # Store client requests

    async def dispatch(
        self, request: Request, call_next: Callable
    ) -> Response:
        # Skip rate limiting for certain paths if needed
        if request.url.path.startswith("/docs") or request.url.path.startswith("/redoc"):
            return await call_next(request)
        
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        
        # Check if IP is private (for development/testing)
        try:
            ip_obj = ipaddress.ip_address(client_ip)
            # Don't rate limit private IPs during development
            if ip_obj.is_private:
                return await call_next(request)
        except ValueError:
            pass  # Not a valid IP, continue with rate limiting
            
        # Get current timestamp
        current_time = time.time()
        
        # Initialize client data if not exists
        if client_ip not in self.clients:
            self.clients[client_ip] = {"requests": [], "blocked_until": 0}
            
        client_data = self.clients[client_ip]
        
        # Check if client is currently blocked
        if client_data["blocked_until"] > current_time:
            return Response(
                content="Rate limit exceeded. Please try again later.",
                status_code=HTTP_429_TOO_MANY_REQUESTS,
                headers={"Retry-After": str(int(client_data["blocked_until"] - current_time))}
            )
            
        # Remove requests outside the time window
        client_data["requests"] = [
            req_time for req_time in client_data["requests"] 
            if current_time - req_time <= self.time_window
        ]
        
        # Check if requests limit is reached
        if len(client_data["requests"]) >= self.requests_limit:
            # Block client for twice the time window
            client_data["blocked_until"] = current_time + (self.time_window * 2)
            return Response(
                content="Rate limit exceeded. Please try again later.",
                status_code=HTTP_429_TOO_MANY_REQUESTS,
                headers={"Retry-After": str(self.time_window * 2)}
            )
            
        # Add current request timestamp
        client_data["requests"].append(current_time)
        
        # Continue with request
        return await call_next(request)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable
    ) -> Response:
        response = await call_next(request)
        
        # Skip strict CSP for documentation pages or use a more permissive policy
        if request.url.path.startswith("/docs") or request.url.path.startswith("/redoc"):
            # More permissive CSP for Swagger UI and ReDoc
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "img-src 'self' data: https://fastapi.tiangolo.com; "
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net blob:; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
                "font-src 'self' data: https://fonts.gstatic.com; "
                "worker-src blob:; "
                "connect-src 'self';"
            )
        else:
            # Regular strict CSP for other routes
            response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data:; script-src 'self'"
        
        # Common security headers for all routes
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), interest-cohort=()"
        
        return response
    
    async def dispatch(
        self, request: Request, call_next: Callable
    ) -> Response:
        response = await call_next(request)
        
        # Skip strict CSP for documentation pages or use a more permissive policy
        if request.url.path.startswith("/docs") or request.url.path.startswith("/redoc"):
            # More permissive CSP for Swagger UI and ReDoc
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "img-src 'self' data: https://fastapi.tiangolo.com; "
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "font-src 'self' data:;"
            )
        else:
            # Regular strict CSP for other routes
            response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data:; script-src 'self'"
        
        # Common security headers for all routes
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), interest-cohort=()"
        
        return response

def setup_middleware(app: FastAPI) -> None:
    """Configure middleware for the application"""
    
    # CORS
    origins = [str(origin) for origin in settings.BACKEND_CORS_ORIGINS]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"], # In production, specify actual origins
        # allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Security headers
    if settings.SECURITY_HEADERS:
        app.add_middleware(SecurityHeadersMiddleware)
    
    # Rate limiting
    if settings.RATE_LIMIT_ENABLED:
        app.add_middleware(
            RateLimitMiddleware,
            requests_limit=settings.RATE_LIMIT_REQUESTS,
            time_window=settings.RATE_LIMIT_PERIOD,
        )
    
    # Session middleware for CSRF protection
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.SECRET_KEY,
        session_cookie="session",
        max_age=1800,  # 30 minutes
        same_site=settings.SESSION_COOKIE_SAMESITE,
        https_only=settings.SESSION_COOKIE_SECURE,
    )
    
    # Trusted hosts
    if origins:
        app.add_middleware(
            TrustedHostMiddleware, allowed_hosts=["*"]  # In production, specify actual hosts
        )