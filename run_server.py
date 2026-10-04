#!/usr/bin/env python3
"""Run the ScholarSift server, excluding incompatible hermes-agent site-packages."""
import sys
import os

# Remove the hermes-agent venv from path — it has a broken pydantic_core for this Python
sys.path = [p for p in sys.path if '.hermes/hermes-agent' not in p]

import uvicorn

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    # Add current dir to sys.path so we can use absolute imports
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    # Remove relative imports from main.py by running with the project root on path
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
