"""
Regenerates every icon from the master logo (public/logo.png, a square PNG of at least 512 x 512).

    pip install pillow
    python scripts/generate-icons.py

Writes: public/favicon.ico (16, 32, 48), public/favicon-16.png, public/favicon-32.png, public/apple-touch-icon.png,
public/icons/icon-192.png, public/icons/icon-512.png, build/icon.png (desktop installer) and src/assets/logo.png
(the 128 px copy bundled into the app). Run it from the draco-slides folder after replacing public/logo.png.
"""
import io
import struct
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parent.parent
src = Image.open(root / "public" / "logo.png").convert("RGBA")
if src.width != src.height or src.width < 512:
    raise SystemExit(f"public/logo.png must be square and at least 512 px (got {src.width}x{src.height})")


def save(path: str, size: int) -> None:
    out = root / path
    out.parent.mkdir(parents=True, exist_ok=True)
    src.resize((size, size), Image.LANCZOS).save(out, optimize=True)


for path, size in [
    ("public/icons/icon-512.png", 512),
    ("public/icons/icon-192.png", 192),
    ("public/apple-touch-icon.png", 180),
    ("public/favicon-32.png", 32),
    ("public/favicon-16.png", 16),
    ("build/icon.png", 512),
    ("src/assets/logo.png", 128),
]:
    save(path, size)

sizes = [16, 32, 48]
blobs = []
for s in sizes:
    buf = io.BytesIO()
    src.resize((s, s), Image.LANCZOS).save(buf, format="PNG", optimize=True)
    blobs.append(buf.getvalue())
offset = 6 + 16 * len(sizes)
directory = b""
for s, data in zip(sizes, blobs):
    directory += struct.pack("<BBBBHHII", s, s, 0, 0, 1, 32, len(data), offset)
    offset += len(data)
(root / "public" / "favicon.ico").write_bytes(struct.pack("<HHH", 0, 1, len(sizes)) + directory + b"".join(blobs))
print("Icons regenerated from public/logo.png")
