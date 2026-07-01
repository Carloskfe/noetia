from templates.base import render_card

_DIMENSIONS = {
    'post':    (800, 800),
    'story':   (800, 800),
    'wa-pic':  (1080, 1080),
    'wa-story':(1080, 1920),
}


def render(fragment: dict, format: str = 'post', font: str = 'lato',
           bg_type: str = 'solid', bg_colors: list | None = None,
           text_color_override: str | None = None,
           bg_gradient_dir: str = 'to-bottom', bg_image: str | None = None,
           bg_flip: bool = False) -> bytes:
    """WhatsApp quote card — 800×800px."""
    w, h = _DIMENSIONS.get(format, _DIMENSIONS['post'])
    return render_card(fragment, w, h, font=font, bg_type=bg_type, bg_colors=bg_colors,
                       text_color_override=text_color_override,
                       bg_gradient_dir=bg_gradient_dir, bg_image=bg_image, bg_flip=bg_flip)
