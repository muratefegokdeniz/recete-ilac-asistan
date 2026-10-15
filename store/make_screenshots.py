"""App Store ekran görüntüleri: logo yeşili arka plan + başlık + yuvarlatılmış ekran.

Kullanım:
    python3 store/make_screenshots.py <girdi_klasörü>

Girdi klasöründe SLIDES listesindeki dosya adları (01.png veya image01.png, ...) olmalı.
Çıktı: store/screenshots/ altında 6.9" iPhone boyutu (1320x2868), App Store
Connect'in kabul ettiği RGB PNG'ler.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1320, 2868
BG = (11, 110, 110)          # #0b6e6e — ikon arka planı
TITLE_COLOR = (255, 255, 255)
SUB_COLOR = (207, 238, 233)
FONT_PATH = "/System/Library/Fonts/SFNS.ttf"
# iPhone durum çubuğu (saat, pil, Dynamic Island, "◀ TestFlight") — 1320 px
# genişlikteki ekran görüntüsünde üstten bu kadar kesilir.
STATUS_BAR_PX_AT_1320 = 186

# Tab sırasıyla: Ana Sayfa → Takip → Reçete → Dolabım → Takvim → Asistan
SLIDES = [
    ("01", "İlaçların tek ekranda", "Günlük programın, dozların ve dolabın"),
    ("02", "Hiçbir dozu kaçırma", "Hatırlatma gelsin, tek dokunuşla işaretle"),
    ("03", "Reçeteni fotoğrafla,\nyapay zeka okusun", "İlaçlar, dozlar ve kullanım saatleri"),
    ("04", "Evdeki ilaç dolabın", "Son kullanma tarihi ve stok takibi"),
    ("05", "Takvimde tüm aile", "Kendi ve çocuklarının ilaçları bir arada"),
    ("06", "Aklına takılanı sor", "İlaçlar hakkında yapay zeka asistanı"),
]


def font(size: int, bold: bool) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(FONT_PATH, size)
    try:
        f.set_variation_by_name("Bold" if bold else "Regular")
    except (OSError, ValueError):
        pass
    return f


def draw_centered(draw: ImageDraw.ImageDraw, text: str, y: int, f, color, line_gap: int) -> int:
    for line in text.split("\n"):
        w = draw.textlength(line, font=f)
        draw.text(((W - w) / 2, y), line, font=f, fill=color)
        y += f.size + line_gap
    return y


def rounded(im: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *im.size), radius=radius, fill=255)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out


def make(src: str, title: str, subtitle: str, dst: str) -> None:
    canvas = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(canvas)

    y = draw_centered(draw, title, 170, font(92, True), TITLE_COLOR, 18)
    y = draw_centered(draw, subtitle, y + 22, font(48, False), SUB_COLOR, 12)

    shot = Image.open(src).convert("RGB")
    crop = round(STATUS_BAR_PX_AT_1320 * shot.width / 1320)
    shot = shot.crop((0, crop, shot.width, shot.height))
    target_w = 1040
    shot = shot.resize((target_w, round(shot.height * target_w / shot.width)), Image.LANCZOS)
    frame_pad = 14
    framed = Image.new("RGB", (shot.width + 2 * frame_pad, shot.height + 2 * frame_pad), (255, 255, 255))
    framed.paste(shot, (frame_pad, frame_pad))
    framed = rounded(framed, 78)

    x = (W - framed.width) // 2
    top = max(y + 70, 560)

    # Yumuşak gölge
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (x, top + 24, x + framed.width, top + 24 + framed.height), radius=78, fill=(0, 0, 0, 90)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(36))
    canvas.paste(shadow, (0, 0), shadow)
    canvas.paste(framed, (x, top), framed)  # alt kısım kenardan taşabilir, bilinçli

    canvas.save(dst, "PNG")


def main() -> None:
    src_dir = sys.argv[1]
    out_dir = os.path.join(os.path.dirname(__file__), "screenshots", "6.9-inch-1320x2868")
    os.makedirs(out_dir, exist_ok=True)
    for name, title, subtitle in SLIDES:
        candidates = [prefix + name + ext for prefix in ("", "image")
                      for ext in (".png", ".PNG", ".jpg", ".jpeg", ".JPG")]
        src = next((os.path.join(src_dir, c) for c in candidates
                    if os.path.exists(os.path.join(src_dir, c))), None)
        if not src:
            print(f"atlandı: {name} bulunamadı")
            continue
        dst = os.path.join(out_dir, f"{name}.png")
        make(src, title, subtitle, dst)
        print(f"{dst} ({W}x{H})")


if __name__ == "__main__":
    main()
