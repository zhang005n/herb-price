# -*- coding: utf-8 -*-
"""生成 PWA 图标（纯 Pillow，无外部依赖）
用法： python tools/make_icons.py
"""
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "icons")

GREEN = (47, 125, 93)
WHITE = (255, 255, 255)

# 折线形状（归一化坐标），走势：低位盘整 -> 拉升 -> 回落
SHAPE = [
    (0.18, 0.74),
    (0.32, 0.63),
    (0.43, 0.69),
    (0.57, 0.35),
    (0.66, 0.25),
    (0.83, 0.55),
]


def draw_icon(size, scale=1.0, out_name=None):
    """scale < 1 时把图形缩小居中（给 maskable 用，保证安全区）"""
    S = 2048  # 超采样画布
    img = Image.new("RGB", (S, S), GREEN)
    d = ImageDraw.Draw(img)

    cx = cy = S / 2
    pts = []
    for x, y in SHAPE:
        px = cx + (x * S - cx) * scale
        py = cy + (y * S - cy) * scale
        pts.append((px, py))

    width = max(2, int(S * 0.055 * scale))
    d.line(pts, fill=WHITE, width=width, joint="curve")

    # 两端圆头
    r = width / 2.0
    for p in (pts[0], pts[-1]):
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=WHITE)

    # 末端数据点
    rd = width * 0.95
    last = pts[-1]
    d.ellipse([last[0] - rd, last[1] - rd, last[0] + rd, last[1] + rd], fill=WHITE)

    img = img.resize((size, size), Image.LANCZOS)
    if out_name:
        path = os.path.join(OUT, out_name)
        img.save(path, "PNG", optimize=True)
        print("wrote", out_name, img.size)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    draw_icon(192, 1.0, "icon-192.png")
    draw_icon(512, 1.0, "icon-512.png")
    # maskable：图形缩到 68%，四周留出安全区
    draw_icon(512, 0.68, "icon-maskable-512.png")
    # iOS 主屏图标
    draw_icon(180, 1.0, "apple-touch-icon.png")


if __name__ == "__main__":
    main()
