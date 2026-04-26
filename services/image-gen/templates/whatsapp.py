from templates.base import render_card

_DIMENSIONS = {
    'post':  (800, 800),
    'story': (800, 800),  # WhatsApp has no story; falls back to post dimensions
}


def render(fragment: dict, format: str = 'post', font: str = 'lato',
           bg_type: str = 'solid', bg_colors: list | None = None) -> bytes:
    """WhatsApp quote card — 800×800px."""
    w, h = _DIMENSIONS.get(format, _DIMENSIONS['post'])
    return render_card(fragment, w, h, font=font, bg_type=bg_type, bg_colors=bg_colors)
