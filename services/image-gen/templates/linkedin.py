from templates.base import render_card

_DIMENSIONS = {
    'post':  (1200, 627),
    'story': (1200, 627),  # LinkedIn has no story; falls back to post dimensions
}


def render(fragment: dict, format: str = 'post', font: str = 'lato',
           bg_type: str = 'solid', bg_colors: list | None = None) -> bytes:
    """LinkedIn quote card — 1200×627px."""
    w, h = _DIMENSIONS.get(format, _DIMENSIONS['post'])
    return render_card(fragment, w, h, font=font, bg_type=bg_type, bg_colors=bg_colors)
