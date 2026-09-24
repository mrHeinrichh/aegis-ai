"""Rasterise build/icon.svg to a transparent 1024px PNG (4x supersampled)."""
import numpy as np, zlib, struct, sys

SIZE, SS, VB = 1024, 4, 64.0
N = SIZE * SS
scale = N / VB

# Sample centres in viewBox units.
ax = (np.arange(N) + 0.5) / scale
X, Y = np.meshgrid(ax, ax)

# --- rounded rect, r=15 -----------------------------------------------------
r = 15.0
cx = np.clip(X, r, VB - r)
cy = np.clip(Y, r, VB - r)
d = np.hypot(X - cx, Y - cy)
rect = (d <= r) & (X >= 0) & (X <= VB) & (Y >= 0) & (Y <= VB)

def poly_mask(points):
    """Even-odd fill via crossing count."""
    pts = np.asarray(points, dtype=float)
    inside = np.zeros_like(X, dtype=bool)
    for i in range(len(pts)):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % len(pts)]
        if y1 == y2:
            continue
        straddles = ((Y >= min(y1, y2)) & (Y < max(y1, y2)))
        xint = x1 + (Y - y1) * (x2 - x1) / (y2 - y1)
        inside ^= straddles & (X < xint)
    return inside

# M13 12 h38 v24 L32 54 L13 36 Z
shield = poly_mask([(13, 12), (51, 12), (51, 36), (32, 54), (13, 36)])
# m22 39 l10-23 l10 23 h-7 l-3-8 l-3 8 Z  (even-odd hole = the "A")
letter = poly_mask([(22, 39), (32, 16), (42, 39), (35, 39), (32, 31), (29, 39)])

white = shield & ~letter

# --- linear gradient (8,2) -> (56,62) --------------------------------------
gx, gy = 56 - 8, 62 - 2
t = np.clip(((X - 8) * gx + (Y - 2) * gy) / (gx * gx + gy * gy), 0, 1)
stops = [(0.0, (0xF2, 0x48, 0x5E)), (0.55, (0xE0, 0x1B, 0x35)), (1.0, (0x97, 0x0F, 0x21))]
rgb = np.zeros(X.shape + (3,), dtype=float)
for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
    seg = (t >= t0) & (t <= t1)
    f = np.where(seg, (t - t0) / (t1 - t0), 0.0)
    for ch in range(3):
        rgb[..., ch] += seg * (c0[ch] + (c1[ch] - c0[ch]) * f)

for ch in range(3):
    rgb[..., ch] = np.where(white, 255.0, rgb[..., ch])
alpha = rect.astype(float) * 255.0

# Premultiply so downsampling never bleeds colour out past the rounded edge.
prem = rgb * (alpha[..., None] / 255.0)

def box(a):
    return a.reshape(SIZE, SS, SIZE, SS).mean(axis=(1, 3))

A = box(alpha)
P = np.stack([box(prem[..., c]) for c in range(3)], axis=-1)
with np.errstate(divide="ignore", invalid="ignore"):
    C = np.where(A[..., None] > 0, P / (A[..., None] / 255.0), 0.0)

out = np.concatenate([np.clip(C, 0, 255), np.clip(A, 0, 255)[..., None]], axis=-1)
out = np.rint(out).astype(np.uint8)

# --- write PNG --------------------------------------------------------------
raw = b"".join(b"\x00" + out[y].tobytes() for y in range(SIZE))
def chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))
png = (b"\x89PNG\r\n\x1a\n"
       + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0))
       + chunk(b"IDAT", zlib.compress(raw, 9))
       + chunk(b"IEND", b""))
open(sys.argv[1], "wb").write(png)
print(f"wrote {sys.argv[1]} {SIZE}x{SIZE} ({len(png)/1024:.0f} KB)")
