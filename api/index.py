import sys
import os

# Ensure the root project directory is in the Python module search path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from app import app

# Vercel Serverless Function entry point
# 'app' is the WSGI Flask application instance
if __name__ == "__main__":
    app.run()
