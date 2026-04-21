"""
Machine-locked license utilities.

How it works:
  1. App generates a unique fingerprint for the current machine.
  2. Customer shares their fingerprint with you.
  3. You run generate_license.py to produce a license key for that fingerprint.
  4. Customer enters the key in the app — validated and stored locally.
"""

import base64
import hashlib
import hmac
import os
import platform
import sys
import uuid
from pathlib import Path

# ── Private signing secret (embedded in the binary) ──────────────────────────
# WARNING: keep this value identical in generate_license.py.
# To rotate: change it here, in generate_license.py, and re-issue all licenses.
_SIGNING_SECRET = "ac5f2b8551820cef365de5b7aca1dd1771dd3f9682a1763a13c068d9b7af2ae8"


def get_machine_fingerprint() -> str:
    """Returns a stable, unique ID for this machine (SHA-256 hex, 64 chars)."""
    components = [
        str(uuid.getnode()),  # MAC address as integer
        platform.node(),  # Hostname
        platform.system(),  # OS  (Windows / Darwin / Linux)
        platform.machine(),  # CPU architecture (AMD64, arm64 …)
    ]
    raw = ":".join(components)
    return hashlib.sha256(raw.encode()).hexdigest()


def _compute_key(fingerprint: str) -> str:
    """Derives the expected license key from a fingerprint."""
    sig = hmac.new(
        _SIGNING_SECRET.encode(),
        fingerprint.encode(),
        hashlib.sha256,
    ).digest()
    # 10 bytes → base32 → 16 uppercase chars → XXXX-XXXX-XXXX-XXXX
    encoded = base64.b32encode(sig[:10]).decode().upper().rstrip("=")[:16]
    return "-".join(encoded[i : i + 4] for i in range(0, 16, 4))


def validate_license(license_key: str) -> bool:
    """Returns True if *license_key* is valid for the current machine."""
    fingerprint = get_machine_fingerprint()
    expected = _compute_key(fingerprint)
    given = license_key.upper().replace("-", "").replace(" ", "")
    return hmac.compare_digest(given, expected.replace("-", ""))


# ── Persistent storage ────────────────────────────────────────────────────────


def _license_file_path() -> Path:
    if getattr(sys, "_MEIPASS", None):  # PyInstaller bundle
        return Path(sys.executable).parent / "license.key"
    return Path(os.path.abspath(__file__)).parent / "license.key"


def load_stored_license() -> str | None:
    path = _license_file_path()
    try:
        return path.read_text(encoding="utf-8").strip() if path.exists() else None
    except Exception:
        return None


def save_license(license_key: str) -> None:
    _license_file_path().write_text(license_key.strip(), encoding="utf-8")


def is_licensed() -> bool:
    """True if a valid license file exists for this machine."""
    stored = load_stored_license()
    return bool(stored) and validate_license(stored)
