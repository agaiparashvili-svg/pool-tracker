#!/usr/bin/env python3
"""Generate PWA icons (PNG) for the warehouse app using only the stdlib.
Draws a warehouse/box glyph on a blue gradient background, full-bleed so the
same image works as a maskable icon. Run: python3 gen_icons.py"""
import struct, zlib, os

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def make_png(size, path):
    top = (0x00, 0xb4, 0xd8)      # --accent2
    bottom = (0x00, 0x77, 0xb6)   # --accent
    white = (255, 255, 255)
    # pixel buffer (RGBA)
    px = bytearray()
    cx = size / 2
    # box geometry (centered, ~52% of canvas, within maskable safe zone)
    bw = size * 0.52
    bh = size * 0.42
    bx0 = cx - bw / 2
    bx1 = cx + bw / 2
    by0 = size * 0.30
    by1 = by0 + bh
    lid = by0 + bh * 0.26          # lid fold line
    stroke = max(2, size // 64)
    for y in range(size):
        px.append(0)  # PNG filter byte (none)
        # vertical gradient background
        bg = lerp(top, bottom, y / size)
        for x in range(size):
            r, g, b = bg
            a = 255
            inside = bx0 <= x <= bx1 and by0 <= y <= by1
            if inside:
                # box face
                r, g, b = white
                # lid line
                if abs(y - lid) <= stroke:
                    r, g, b = bottom
                # vertical tape line in upper flap area
                if y <= lid and abs(x - cx) <= stroke:
                    r, g, b = bottom
            px += bytes((r, g, b, a))

    raw = bytes(px)
    comp = zlib.compress(raw, 9)

    def chunk(typ, data):
        c = typ + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    png = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", comp) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path, len(png), "bytes")

here = os.path.dirname(os.path.abspath(__file__))
make_png(192, os.path.join(here, "icons", "icon-192.png"))
make_png(512, os.path.join(here, "icons", "icon-512.png"))
make_png(180, os.path.join(here, "icons", "apple-touch-icon.png"))
