"""Errors raised by the data provider layer.

The FastAPI layer maps these to user-facing HTTP responses; tests use the
same codes to assert behaviour without a real Supabase project.
"""


class ProviderError(Exception):
    """Base error for failed data operations."""

    def __init__(self, code: str, message: str = "") -> None:
        self.code = code
        self.message = message or code
        super().__init__(f"{self.code}: {self.message}")