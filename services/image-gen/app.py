import json
import subprocess

from flask import Flask, jsonify, request

from storage import MinioClient
from templates import facebook, instagram, linkedin, pinterest, whatsapp
from templates.base import VALID_FONTS, VALID_BG_TYPES, VALID_BG_FITS

app = Flask(__name__)

_RENDERERS = {
    "linkedin":  linkedin.render,
    "instagram": instagram.render,
    "facebook":  facebook.render,
    "pinterest": pinterest.render,
    "whatsapp":  whatsapp.render,  # kept for backwards compatibility
}

_REQUIRED_FIELDS = ("text", "author", "title", "platform")
_VALID_FORMATS = {"post", "story", "pin", "pin-square", "reel", "twitter-card"}


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/align/chapters")
def align_chapters():
    url = request.args.get("url", "").strip()
    if not url:
        return jsonify({"error": "url parameter required"}), 400

    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-print_format", "json",
                "-show_chapters",
                "-loglevel", "quiet",
                url,
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            return jsonify({"error": "ffprobe failed", "detail": result.stderr[:500]}), 500

        data = json.loads(result.stdout or "{}")
        chapters = []
        for ch in data.get("chapters", []):
            chapters.append({
                "title": ch.get("tags", {}).get("title", ""),
                "startMs": int(float(ch["start_time"]) * 1000),
                "endMs": int(float(ch["end_time"]) * 1000),
            })
        return jsonify({"chapters": chapters})
    except subprocess.TimeoutExpired:
        return jsonify({"error": "ffprobe timed out"}), 504
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.post("/generate")
def generate():
    body = request.get_json(silent=True) or {}

    for field in _REQUIRED_FIELDS:
        if not body.get(field):
            return jsonify({"error": f"missing required field: {field}"}), 400

    platform = body["platform"].lower()
    renderer = _RENDERERS.get(platform)
    if renderer is None:
        return jsonify({"error": "unsupported platform"}), 400

    fmt = (body.get("format") or "post").lower()
    if fmt not in _VALID_FORMATS:
        return jsonify({"error": f"unsupported format: {fmt}"}), 400

    font = (body.get("font") or "playfair").lower()
    if font not in VALID_FONTS:
        return jsonify({"error": f"unsupported font: {font}"}), 400

    bg_type = (body.get("bgType") or "solid").lower()
    if bg_type not in VALID_BG_TYPES:
        return jsonify({"error": f"unsupported bgType: {bg_type}"}), 400

    bg_colors = body.get("bgColors") or ["#0D1B2A"]
    if not isinstance(bg_colors, list) or not bg_colors:
        return jsonify({"error": "bgColors must be a non-empty array"}), 400

    text_color    = body.get("textColor")    or None
    citation      = body.get("citation")      or None
    text_bold     = bool(body.get("textBold",   False))
    text_italic   = bool(body.get("textItalic", False))
    text_align    = body.get("textAlign") or "center"
    if text_align not in ("left", "center", "right"):
        text_align = "center"
    gradient_dir  = body.get("gradientDir") or "to-bottom"
    bg_image      = body.get("bgImage")     or None
    bg_flip       = bool(body.get("bgFlip", False))
    # How a photo background maps onto the card. Defaults to 'blur' (fit the
    # whole image, no edge cropping); unknown values fall back to that default
    # rather than failing the render.
    bg_fit        = (body.get("bgFit") or "blur").lower()
    if bg_fit not in VALID_BG_FITS:
        bg_fit = "blur"
    try:
        text_scale = float(body.get("textScale", 1.0))
    except (TypeError, ValueError):
        text_scale = 1.0

    fragment = {
        "text":         body["text"],
        "author":       body["author"],
        "title":        body["title"],
        "citation":     citation,
        "bold":         text_bold,
        "italic":       text_italic,
        "textAlign":    text_align,
        "textScale":    text_scale,
    }

    try:
        png_bytes = renderer(fragment, format=fmt, font=font,
                             bg_type=bg_type, bg_colors=bg_colors,
                             text_color_override=text_color,
                             bg_gradient_dir=gradient_dir,
                             bg_image=bg_image, bg_flip=bg_flip, bg_fit=bg_fit)
        client = MinioClient()
        url = client.upload(png_bytes)
    except Exception:
        # Log the real cause — a bare 500 with no server-side traceback made a
        # prod render failure impossible to diagnose (2026-07-12).
        app.logger.exception("image generation failed (platform=%s format=%s)", platform, fmt)
        return jsonify({"error": "image generation failed"}), 500

    return jsonify({"url": url}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
