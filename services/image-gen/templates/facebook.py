from templates.base import render_card

_DIMENSIONS = {
    'post':  (1200, 630),
    'story': (1080, 1920),
}


def render(fragment: dict, format: str = 'post', font: str = 'lato',
           bg_type: str = 'solid', bg_colors: list | None = None) -> bytes:
    """Facebook quote card — post: 1200×630px, story: 1080×1920px."""
    w, h = _DIMENSIONS.get(format, _DIMENSIONS['post'])
    return render_card(fragment, w, h, font=font, bg_type=bg_type, bg_colors=bg_colors)
