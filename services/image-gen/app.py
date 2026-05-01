import json
import subprocess

from flask import Flask, jsonify, request

from storage import MinioClient
from templates import facebook, instagram, linkedin, whatsapp
from templates.base import VALID_FONTS, VALID_BG_TYPES

app = Flask(__name__)

_RENDERERS = {
    "linkedin":  linkedin.render,
    "instagram": instagram.render,
    "facebook":  facebook.render,
    "whatsapp":  whatsapp.render,
}

_REQUIRED_FIELDS = ("text", "author", "title", "platform")
_VALID_FORMATS = {"post", "story", "wa-pic", "wa-story", "reel", "twitter-card"}


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

    font = (body.get("font") or "lato").lower()
    if font not in VALID_FONTS:
        return jsonify({"error": f"unsupported font: {font}"}), 400

    bg_type = (body.get("bgType") or "solid").lower()
    if bg_type not in VALID_BG_TYPES:
        return jsonify({"error": f"unsupported bgType: {bg_type}"}), 400

    bg_colors = body.get("bgColors") or ["#0D1B2A"]
    if not isinstance(bg_colors, list) or not bg_colors:
        return jsonify({"error": "bgColors must be a non-empty array"}), 400

    text_color = body.get("textColor") or None

    fragment = {
        "text":   body["text"],
        "author": body["author"],
        "title":  body["title"],
    }

    try:
        png_bytes = renderer(fragment, format=fmt, font=font,
                             bg_type=bg_type, bg_colors=bg_colors,
                             text_color_override=text_color)
        client = MinioClient()
        url = client.upload(png_bytes)
    except Exception:
        return jsonify({"error": "image generation failed"}), 500

    return jsonify({"url": url}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
