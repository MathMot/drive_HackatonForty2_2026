"""Utilities for stamping and drawing on PDF documents."""

import base64
import functools
import io
import logging
import os
from datetime import datetime
from pypdf import PdfReader, PdfWriter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
import requests
from PIL import Image

logger = logging.getLogger(__name__)

DEFAULT_CUSTOM_SIGNATURE_SRC = (
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQdJikztC8D_D_8TvYCYTN2jmsYWZaE7WkooIV7UXwbng&s=10"
)


@functools.lru_cache(maxsize=32)
def _fetch_image_bytes(url: str) -> bytes | None:
    try:
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            return resp.content
    except Exception as e:
        logger.warning("Failed to fetch signature image from %s: %s", url, e)
    return None


def _load_signature_image(source: str) -> Image.Image | None:
    """Load a PIL image from a URL, data URI, or local file path."""
    if not source:
        return None
    try:
        raw_bytes = None
        if source.startswith("data:image/"):
            if "," in source:
                base64_data = source.split(",", 1)[1]
                raw_bytes = base64.b64decode(base64_data)
        elif source.startswith("http://") or source.startswith("https://"):
            raw_bytes = _fetch_image_bytes(source)
        elif os.path.exists(source):
            with open(source, "rb") as f:
                raw_bytes = f.read()

        if raw_bytes:
            img = Image.open(io.BytesIO(raw_bytes))
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGBA")
            return img
    except Exception as e:
        logger.warning("Failed to load signature image: %s", e)
    return None



def get_display_name(user) -> str:
    """Extract human-readable name from User instance or string."""
    if user is None:
        return "Signataire"
    if isinstance(user, str):
        return user.strip() or "Signataire"

    full_name = getattr(user, "full_name", None)
    if full_name and full_name.strip():
        return full_name.strip()

    email = getattr(user, "email", None) or getattr(user, "admin_email", None)
    if email and email.strip():
        user_part = email.strip().split("@")[0]
        parts = user_part.split(".")
        if len(parts) > 1:
            return " ".join(p.capitalize() for p in parts)
        return user_part.capitalize()

    return "Signataire"


def get_last_name(display_name: str) -> str:
    """Extract surname from full name or email username."""
    trimmed = display_name.strip()
    if not trimmed:
        return ""

    if "@" in trimmed:
        user_part = trimmed.split("@")[0]
        dot_parts = user_part.split(".")
        if len(dot_parts) > 1:
            last = dot_parts[-1]
            return last[:1].upper() + last[1:]
        return user_part[:1].upper() + user_part[1:]

    parts = trimmed.split()
    if len(parts) > 1:
        return parts[-1]
    return parts[0]


# ==============================================================================
# DEVELOPER FONT CONFIGURATION FOR REAL PDF STAMP
# ==============================================================================
# Standard PDF Type 1 fonts matching clean administration / web typography:
# Option 1: Helvetica (Active - clean sans-serif default)
# PDF_STAMP_FONT_BOLD = "Helvetica-Bold"
# PDF_STAMP_FONT_REGULAR = "Helvetica"

# Option 2: Times (Uncomment below to use serif typography)
PDF_STAMP_FONT_BOLD = "Times-Bold"
PDF_STAMP_FONT_REGULAR = "Times-Roman"

# ==============================================================================


def _render_stamp_box(
    c: canvas.Canvas,
    x_pt: float,
    y_pt: float,
    width_pt: float,
    height_pt: float,
    line1_text: str,
    line2_text: str,
):
    """
    Renders the stamp box matching the frontend preview:
    - Light opacity / almost transparent black background
    - High transparency black outline
    - Full black centered text:
      * Line 1: signer name / title in bold
      * Line 2: date in regular font
    """
    # 1. Background & Border
    c.saveState()
    c.setFillAlpha(0.00)
    c.setStrokeAlpha(0.25)
    c.setFillColorRGB(0, 0, 0)
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(1.0)
    c.rect(x_pt, y_pt, width_pt, height_pt, fill=1, stroke=1)
    c.restoreState()

    # 2. Text
    c.saveState()
    c.setFillAlpha(1.0)
    c.setFillColorRGB(0, 0, 0)

    # Dynamic font sizing to fit box
    font_size_name = max(8.0, min(14.0, height_pt * 0.22, width_pt * 0.08))
    while (
        font_size_name > 6.0
        and c.stringWidth(line1_text, PDF_STAMP_FONT_BOLD, font_size_name)
        > (width_pt - 8)
    ):
        font_size_name -= 0.5

    font_size_date = max(6.0, font_size_name * 0.8)
    while (
        font_size_date > 5.0
        and c.stringWidth(line2_text, PDF_STAMP_FONT_REGULAR, font_size_date)
        > (width_pt - 8)
    ):
        font_size_date -= 0.5

    cx = x_pt + (width_pt / 2.0)
    cy = y_pt + (height_pt / 2.0)

    line1_y = cy + (font_size_name * 0.2)
    line2_y = cy - (font_size_name * 1.1)

    c.setFont(PDF_STAMP_FONT_BOLD, font_size_name)
    c.drawCentredString(cx, line1_y, line1_text)

    c.setFont(PDF_STAMP_FONT_REGULAR, font_size_date)
    c.drawCentredString(cx, line2_y, line2_text)
    c.restoreState()


# --- Local sign mode handlers ---

def stamp_no_stamp(c, x_pt, y_pt, width_pt, height_pt, display_name, date_str):
    """SignType 0: Electronic signature only (no visual stamp)."""
    pass


def stamp_full_name(c, x_pt, y_pt, width_pt, height_pt, display_name, date_str):
    """SignType 1: Full name."""
    _render_stamp_box(c, x_pt, y_pt, width_pt, height_pt, display_name, date_str)


def stamp_initials(c, x_pt, y_pt, width_pt, height_pt, display_name, date_str):
    """SignType 2: Initials (e.g. 'D. D.')."""
    parts = display_name.split()
    initials = " ".join(f"{p[0].upper()}." for p in parts if p)
    if not initials:
        initials = display_name[:1].upper() + "."
    _render_stamp_box(c, x_pt, y_pt, width_pt, height_pt, initials, date_str)


def stamp_mister(c, x_pt, y_pt, width_pt, height_pt, display_name, date_str):
    """SignType 3: Monsieur (e.g. 'M. Dardier')."""
    last_name = get_last_name(display_name)
    text = f"M. {last_name}" if last_name else "M."
    _render_stamp_box(c, x_pt, y_pt, width_pt, height_pt, text, date_str)


def stamp_missus(c, x_pt, y_pt, width_pt, height_pt, display_name, date_str):
    """SignType 4: Madame (e.g. 'Mme Dardier')."""
    last_name = get_last_name(display_name)
    text = f"Mme {last_name}" if last_name else "Mme"
    _render_stamp_box(c, x_pt, y_pt, width_pt, height_pt, text, date_str)


def stamp_doctor(c, x_pt, y_pt, width_pt, height_pt, display_name, date_str):
    """SignType 5: Docteur (e.g. 'Dr Dardier')."""
    last_name = get_last_name(display_name)
    text = f"Dr {last_name}" if last_name else "Dr"
    _render_stamp_box(c, x_pt, y_pt, width_pt, height_pt, text, date_str)


def stamp_custom_signature(
    c,
    x_pt: float,
    y_pt: float,
    width_pt: float,
    height_pt: float,
    display_name: str,
    date_str: str,
    image_url: str | None = None,
    **kwargs,
):
    """SignType 6: Custom signature (image / svg placeholder or stamp)."""
    # 1. Background & Border
    c.saveState()
    c.setFillAlpha(0.00)
    c.setStrokeAlpha(0.25)
    c.setFillColorRGB(0, 0, 0)
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(1.0)
    c.rect(x_pt, y_pt, width_pt, height_pt, fill=1, stroke=1)
    c.restoreState()

    # 2. Signature image
    effective_url = image_url or DEFAULT_CUSTOM_SIGNATURE_SRC
    font_size_date = max(6.0, min(10.0, height_pt * 0.18))
    pil_img = _load_signature_image(effective_url)

    if pil_img:
        try:
            orig_w, orig_h = pil_img.size
            if orig_w > 0 and orig_h > 0:
                date_margin = 4.0
                date_h = font_size_date + 2.0
                y_bottom_img = y_pt + date_margin + date_h
                y_top_img = y_pt + height_pt - 4.0
                avail_w = max(10.0, width_pt - 8.0)
                avail_h = max(10.0, y_top_img - y_bottom_img)

                scale = min(avail_w / orig_w, avail_h / orig_h)
                draw_w = orig_w * scale
                draw_h = orig_h * scale
                draw_x = x_pt + (width_pt - draw_w) / 2.0
                draw_y = y_bottom_img + (avail_h - draw_h) / 2.0

                c.saveState()
                img_reader = ImageReader(pil_img)
                c.drawImage(
                    img_reader,
                    draw_x,
                    draw_y,
                    width=draw_w,
                    height=draw_h,
                    mask="auto",
                )
                c.restoreState()
        except Exception as e:
            logger.warning("Failed to draw signature image on canvas: %s", e)

    # 3. Text / Date
    c.saveState()
    c.setFillAlpha(1.0)
    c.setFillColorRGB(0, 0, 0)
    cx = x_pt + (width_pt / 2.0)
    c.setFont(PDF_STAMP_FONT_REGULAR, font_size_date)
    c.drawCentredString(cx, y_pt + 4, date_str)
    c.restoreState()


SIGN_MODE_HANDLERS = {
    0: stamp_no_stamp,
    1: stamp_full_name,
    2: stamp_initials,
    3: stamp_mister,
    4: stamp_missus,
    5: stamp_doctor,
    6: stamp_custom_signature,
}


def stamp_pdf(pdf_bytes: bytes, zone: dict, user=None) -> bytes:
    """
    Stamp the PDF document at the specified zone according to the selected signType.
    If signType is NoStamp (0), returns the exact same bytes unmodified.
    """
    sign_type = zone.get("signType", 1)

    # If NoStamp (0), return original bytes unmodified
    if sign_type == 0:
        return pdf_bytes

    handler = SIGN_MODE_HANDLERS.get(sign_type, stamp_full_name)
    display_name = get_display_name(user)
    date_str = datetime.now().strftime("%d/%m/%Y")

    reader = PdfReader(io.BytesIO(pdf_bytes))
    writer = PdfWriter()

    target_page_idx = zone.get("pageIndex", 0)
    target_page_idx = min(max(0, target_page_idx), len(reader.pages) - 1)

    for idx, page in enumerate(reader.pages):
        if idx == target_page_idx:
            page_w = float(page.mediabox.width)
            page_h = float(page.mediabox.height)
            x0 = float(page.mediabox.left)
            y0 = float(page.mediabox.bottom)

            width_pt = (zone.get("widthPct", 25.0) / 100.0) * page_w
            height_pt = (zone.get("heightPct", 10.0) / 100.0) * page_h
            x_pt = x0 + (zone.get("xPct", 0.0) / 100.0) * page_w
            top_offset_pt = (zone.get("yPct", 0.0) / 100.0) * page_h
            y_pt = y0 + page_h - top_offset_pt - height_pt

            overlay_io = io.BytesIO()
            c = canvas.Canvas(overlay_io, pagesize=(page_w, page_h))

            # Dispatch to local sign mode handler
            if sign_type == 6:
                image_url = (
                    zone.get("imageUrl")
                    or zone.get("image")
                    or DEFAULT_CUSTOM_SIGNATURE_SRC
                )
                handler(
                    c,
                    x_pt,
                    y_pt,
                    width_pt,
                    height_pt,
                    display_name,
                    date_str,
                    image_url=image_url,
                )
            else:
                handler(c, x_pt, y_pt, width_pt, height_pt, display_name, date_str)

            c.save()

            overlay_io.seek(0)
            overlay_reader = PdfReader(overlay_io)
            page.merge_page(overlay_reader.pages[0])

        writer.add_page(page)

    output_io = io.BytesIO()
    writer.write(output_io)
    return output_io.getvalue()
