import sys
from pathlib import Path

# Add project root to sys.path so we can import backend.app
ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

# Vercel Python function entry point
from backend.app import app  # noqa: F401
