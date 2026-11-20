"""HTTP blueprints for the BreatheWise API."""

from .air import air_bp
from .assistant import assistant_bp
from .family import family_bp
from .geo import geo_bp
from .health import health_bp
from .indoor import indoor_bp
from .planner import planner_bp

__all__ = [
    "air_bp",
    "assistant_bp",
    "family_bp",
    "geo_bp",
    "health_bp",
    "indoor_bp",
    "planner_bp",
]
