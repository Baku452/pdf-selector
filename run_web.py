#!/usr/bin/env python3
"""
Entry-point para ejecutar la app web local.

Útil para empaquetar con PyInstaller (Windows) y abrir el navegador automáticamente.
"""

import os
import threading
import webbrowser

from app import app


def _open_browser(port: int):
    try:
        webbrowser.open(f"http://127.0.0.1:{port}", new=1)
    except Exception:
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5001"))
    threading.Timer(1.0, _open_browser, args=(port,)).start()
    app.run(debug=False, host="127.0.0.1", port=port)

