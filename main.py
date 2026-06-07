import os
import sys
import webbrowser
import threading
import uvicorn
from dotenv import load_dotenv

load_dotenv()

PORT = int(os.getenv("PORT", 8000))


def open_browser():
    webbrowser.open(f"http://localhost:{PORT}")


if __name__ == "__main__":
    # Open browser after a short delay to let the server start
    t = threading.Timer(1.5, open_browser)
    t.daemon = True
    t.start()

    uvicorn.run(
        "backend.app:app",
        host="0.0.0.0",
        port=PORT,
        reload="--dev" in sys.argv,
    )
