import sys
from pathlib import Path

# Make the backend/ directory importable as the package root when running
# pytest from any working directory (project root or backend/).
sys.path.insert(0, str(Path(__file__).parent))
