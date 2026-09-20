import sys
import os

# Ensure the root project directory is in sys.path so app.py and database.py can be imported
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from app import app

# Vercel serverless function expects a WSGI callable named 'app'
# When deployed to Vercel, requests to / will route here
