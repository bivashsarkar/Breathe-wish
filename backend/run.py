"""Development entry point.

Run from the backend directory:
    python run.py
"""

from __future__ import annotations

import os

from app import create_app
from config import Config

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    # Disable the Werkzeug debugger by default; enable explicitly for local work.
    app.run(
        host=os.getenv("HOST", "127.0.0.1"),
        port=port,
        debug=bool(Config.DEBUG),
    )
