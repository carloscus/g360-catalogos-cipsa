#!/usr/bin/env python3
"""
Generador optimizado de paginas de catalogo desde PDF.

Renderiza cada PDF de `catalogs/` a alta resolucion (suficiente para zoom 2x
y pantallas retina), y lo guarda como JPEG optimizado en `images/{theme}/`.

Uso:
    python tools/generate_pages.py                     # Todos los catalogos
    python tools/generate_pages.py --only vinifan      # Solo un tema
    python tools/generate_pages.py --dry-run           # Solo muestra que haria
    python tools/generate_pages.py --quality 85        # Ajustar calidad JPEG

Requisitos: pip install pymupdf pillow
"""

import argparse
import shutil
import sys
from pathlib import Path

try:
    import pymupdf  # PyMuPDF moderno
except ImportError:
    try:
        import fitz as pymupdf  # API legacy
    except ImportError:
        sys.exit("Falta PyMuPDF. Instala con: pip install pymupdf")

try:
    from PIL import Image
except ImportError:
    sys.exit("Falta Pillow. Instala con: pip install pillow")

ROOT = Path(__file__).resolve().parent.parent

# catalogo-N.pdf -> tema (images_dir)
CATALOG_MAP = {
    "catalogo-1.pdf": "vinifan",
    "catalogo-2.pdf": "viniball",
    "catalogo-3.pdf": "representadas",
    "catalogo-4.pdf": "institucional",
    "catalogo-5.pdf": "industriales",
}

# Anchos objetivo (px) segun orientacion de la pagina
WIDTH_PORTRAIT = 2000
WIDTH_LANDSCAPE = 2600
WIDTH_DETAIL = 2800  # version de detalle para la lupa (zoom profundo nitido)

QUALITY = 85
QUALITY_DETAIL = 82


def detect_orientation(rect):
    """Portrait si el alto supera el ancho, si no landscape."""
    return "portrait" if rect.height > rect.width else "landscape"


def compute_scale(rect):
    """Escala para lograr el ancho objetivo segun orientacion."""
    width = WIDTH_PORTRAIT if detect_orientation(rect) == "portrait" else WIDTH_LANDSCAPE
    return width / rect.width


def compute_detail_scale(rect):
    """Escala para la version de detalle (zoom profundo de la lupa)."""
    return WIDTH_DETAIL / rect.width


def render_page(doc, index, scale):
    """Renderiza la pagina `index` del PDF a PIL.Image con la escala dada."""
    page = doc[index]
    matrix = pymupdf.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=matrix, alpha=False)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def save_optimized_jpeg(img, dest, quality=QUALITY):
    """Guarda JPEG optimizado: progressive, 4:2:0, sin metadatos."""
    img.save(
        dest,
        format="JPEG",
        quality=quality,
        optimize=True,
        progressive=True,
        subsampling=2,  # 4:2:0 chroma
    )


def process_pdf(pdf_path, theme, dry_run=False, quality=QUALITY, detail=True):
    images_dir = ROOT / "images" / theme
    detail_dir = images_dir / "detail"
    images_dir.mkdir(parents=True, exist_ok=True)
    if detail:
        detail_dir.mkdir(parents=True, exist_ok=True)

    doc = pymupdf.open(pdf_path)
    total = len(doc)
    print(f"\n[{theme}] {pdf_path.name}: {total} paginas -> {images_dir.name}")

    generated = []
    for i in range(total):
        page_num = i + 1
        dest = images_dir / f"page_{page_num:03d}.jpg"
        if dry_run:
            print(f"  [dry-run] page_{page_num:03d}.jpg")
            if detail:
                print(f"  [dry-run] detail/page_{page_num:03d}.jpg")
            continue
        scale = compute_scale(doc[i].rect)
        img = render_page(doc, i, scale)
        save_optimized_jpeg(img, dest, quality)
        generated.append((dest, img.size))

        if detail:
            dscale = compute_detail_scale(doc[i].rect)
            dimg = render_page(doc, i, dscale)
            ddest = detail_dir / f"page_{page_num:03d}.jpg"
            save_optimized_jpeg(dimg, ddest, QUALITY_DETAIL)
            generated.append((ddest, dimg.size))

    # Cover = pagina 1 (misma imagen optimizada, copia)
    cover_src = images_dir / "page_001.jpg"
    cover_dest = images_dir / "cover.jpg"
    if not dry_run and cover_src.exists():
        shutil.copy2(cover_src, cover_dest)
        print("  cover.jpg <- page_001.jpg")

    doc.close()
    return generated


def main():
    parser = argparse.ArgumentParser(description="Genera paginas optimizadas desde PDFs")
    parser.add_argument("--only", nargs="+", choices=CATALOG_MAP.values(),
                        help="Solo regenerar estos temas (ej: vinifan viniball)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Mostrar que se generaria sin escribir archivos")
    parser.add_argument("--quality", type=int, default=QUALITY,
                        help=f"Calidad JPEG (default {QUALITY})")
    parser.add_argument("--no-detail", action="store_true",
                        help="No generar version de detalle (lupa)")
    args = parser.parse_args()

    catalogs_dir = ROOT / "catalogs"
    pdfs = sorted(catalogs_dir.glob("catalogo-*.pdf"))

    if args.only:
        pdfs = [p for p in pdfs if CATALOG_MAP.get(p.name) in args.only]

    for pdf in pdfs:
        theme = CATALOG_MAP.get(pdf.name)
        if not theme:
            print(f"[!] Ignorando {pdf.name}: sin mapeo")
            continue
        try:
            generated = process_pdf(pdf, theme, args.dry_run, args.quality, not args.no_detail)
            if not args.dry_run:
                total_kb = sum(f.stat().st_size / 1024 for f, _ in generated)
                avg_kb = total_kb / len(generated) if generated else 0
                print(f"  -> {len(generated)} paginas, {total_kb/1024:.1f}MB total, "
                      f"{avg_kb:.0f}KB/pag promedio")
        except Exception as e:
            print(f"  [x] Error en {pdf.name}: {e}")

    print("\n[OK] Listo.")


if __name__ == "__main__":
    main()