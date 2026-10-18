# Importing config loads backend/.env into os.environ before anything else runs.
from .config import load_env  # noqa: F401
