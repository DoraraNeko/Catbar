"""白猫の素材（assets/white）の形はそのままに、色だけ塗り替えて黒猫・八割れを作る。

実行: python tools/recolor.py
必要: Pillow（pip install pillow）
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "assets"
SRC = ROOT / "white"

# 元素材の色
BODY = (0xFF, 0xFF, 0xFF)  # 体（白）
DARK = (0x14, 0x14, 0x1C)  # 目・耳の中・鼻と口

# 塗り替えに使う色
BLACK = (0x2A, 0x2A, 0x33)
WHITE = (0xFF, 0xFF, 0xFF)
INK = (0x14, 0x14, 0x1C)
PINK = (0xF0, 0x8A, 0x9A)
YELLOW = (0xF2, 0xC2, 0x30)
BLUE = (0x4A, 0x9C, 0xF0)
GRAY = (0xA8, 0xA8, 0xB4)

# 上半身の目・耳・口の位置（表情ごとに頭の位置が違う）
FACES = {
    # 通常・閉じ目: 耳は行13まで、目は行17〜19、鼻と口は行20以降
    "normal": {"ear_max_row": 13, "eye_rows": (17, 19), "eye_boxes": [], "v_center": 24.5, "v_top": 14},
    "closed": {"ear_max_row": 13, "eye_rows": (17, 19), "eye_boxes": [], "v_center": 24.5, "v_top": 14},
    # 丸目: 頭が6行上がる。目は行11〜17の左右、間が鼻と口
    "wide": {
        "ear_max_row": 9,
        "eye_rows": (11, 17),
        "eye_boxes": [(10, 11, 16, 17), (22, 11, 28, 17)],  # (x0, y0, x1, y1)
        "v_center": 19.5,
        "v_top": 8,
    },
}
HEAD_MAX_ROW = {"normal": 24, "closed": 24, "wide": 23}

# 目の色（瞳はどちらも黒）
EYE_COLOR = {"black": BLUE, "hachiware": YELLOW}

# 通常の目（2×3ドット）には瞳を入れない（丸目だけ瞳を黒にする）
NORMAL_PUPIL_COLUMNS = (21, 29)
NORMAL_PUPIL_ROWS = ()


def is_pupil(img, face, x, y, highlights):
    """目のピクセルが瞳（黒）か。丸目は、周りを目に囲まれた内側を瞳にする"""
    if face == "normal":
        return x in NORMAL_PUPIL_COLUMNS and y in NORMAL_PUPIL_ROWS
    w, h = img.size
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if not (0 <= nx < w and 0 <= ny < h):
            return False
        if (nx, ny) in highlights:
            continue
        if img.getpixel((nx, ny))[:3] != DARK or img.getpixel((nx, ny))[3] == 0:
            return False
    return True


def components(img):
    """不透明ピクセルの連結成分（4近傍）ごとの大きさを返す"""
    w, h = img.size
    seen = {}
    sizes = []
    for y in range(h):
        for x in range(w):
            if img.getpixel((x, y))[3] == 0 or (x, y) in seen:
                continue
            idx = len(sizes)
            stack = [(x, y)]
            seen[(x, y)] = idx
            n = 0
            while stack:
                cx, cy = stack.pop()
                n += 1
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and img.getpixel((nx, ny))[3]:
                        seen[(nx, ny)] = idx
                        stack.append((nx, ny))
            sizes.append(n)
    return seen, sizes


def eye_highlights(img, boxes):
    """目の枠の中で、暗い色に囲まれた白（瞳のハイライト）の位置を返す"""
    result = set()
    for x0, y0, x1, y1 in boxes:
        body = {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)
                if img.getpixel((x, y))[:3] == BODY and img.getpixel((x, y))[3]}
        # 枠の端から体の色でつながっている部分は顔。それ以外がハイライト
        outside = set()
        stack = [p for p in body if p[0] in (x0, x1) or p[1] in (y0, y1)]
        while stack:
            p = stack.pop()
            if p in outside:
                continue
            outside.add(p)
            x, y = p
            for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if q in body and q not in outside:
                    stack.append(q)
        result |= body - outside
    return result


def classify_dark(part, face, x, y):
    """暗い色のピクセルが、目・耳・鼻と口のどれかを返す"""
    if part != "upper":
        return "mouth"
    f = FACES[face]
    if y <= f["ear_max_row"]:
        return "ear"
    if f["eye_boxes"]:
        if any(x0 <= x <= x1 and y0 <= y <= y1 for x0, y0, x1, y1 in f["eye_boxes"]):
            return "eye"
        return "mouth"
    lo, hi = f["eye_rows"]
    return "eye" if lo <= y <= hi else "mouth"


def hachiware_is_white(part, face, x, y):
    """八割れの白い部分か。頭は額から逆V字に白、体は背中が黒でお腹・脚が白"""
    if part == "upper" and y <= HEAD_MAX_ROW[face] and (face == "wide" or x >= 12):
        f = FACES[face]
        return y >= f["v_top"] and abs(x - f["v_center"]) <= (y - f["v_top"]) * 0.75
    # 胴体の帯は行20〜31。背中（行25まで）は黒、それより下は白（3パーツで揃える）
    return y >= 26


def recolor(breed, part, face, img):
    out = img.copy()
    w, h = img.size
    seen, sizes = components(img)
    main = max(range(len(sizes)), key=lambda i: sizes[i]) if sizes else -1
    highlights = eye_highlights(img, FACES[face]["eye_boxes"]) if part == "upper" else set()

    for y in range(h):
        for x in range(w):
            r, g, b, a = img.getpixel((x, y))
            if a == 0:
                continue
            if (r, g, b) == DARK:
                kind = classify_dark(part, face, x, y)
                if kind == "eye":
                    if face == "closed":
                        color = GRAY if breed == "black" or not hachiware_is_white(part, face, x, y) else INK
                    else:
                        color = INK if is_pupil(img, face, x, y, highlights) else EYE_COLOR[breed]
                elif kind == "ear":
                    color = PINK
                else:  # 鼻と口
                    if breed == "black":
                        color = PINK
                    else:
                        color = INK if hachiware_is_white(part, face, x, y) else PINK
            else:
                # ひげ: 頭の高さで、体から離れている小さな塊（離れた足先は含めない）
                whisker = part == "upper" and y <= HEAD_MAX_ROW[face] and seen.get((x, y)) != main
                if (x, y) in highlights or whisker:
                    color = WHITE if breed == "hachiware" else GRAY
                    if (x, y) in highlights:
                        color = WHITE
                elif breed == "black":
                    color = BLACK
                else:
                    color = WHITE if hachiware_is_white(part, face, x, y) else BLACK
            out.putpixel((x, y), (*color, a))
    return out


def main():
    files = {
        "cat-lower.png": ("lower", "normal"),
        "cat-body-tile.png": ("body", "normal"),
        "cat-upper-normal.png": ("upper", "normal"),
        "cat-upper-wide.png": ("upper", "wide"),
        "cat-upper-closed.png": ("upper", "closed"),
    }
    for breed in ("black", "hachiware"):
        dst = ROOT / breed
        dst.mkdir(exist_ok=True)
        for name, (part, face) in files.items():
            img = Image.open(SRC / name).convert("RGBA")
            recolor(breed, part, face, img).save(dst / name, optimize=True)
        print("wrote", dst)


if __name__ == "__main__":
    main()
