from templates.base import render_card

_DIMENSIONS = {
    'pin':        (1000, 1500),  # Standard Pinterest pin (2:3)
    'pin-square': (1000, 1000),  # Square pin
}


def render(fragment: dict, format: str = 'pin', font: str = 'lato',
           bg_type: str = 'solid', bg_colors: list | None = None,
           text_color_override: str | None = None,
           bg_gradient_dir: str = 'to-bottom', bg_image: str | None = None,
           bg_flip: bool = False) -> bytes:
    """Pinterest quote card — 1000×1500px (pin) or 1000×1000px (square)."""
    w, h = _DIMENSIONS.get(format, _DIMENSIONS['pin'])
    return render_card(fragment, w, h, font=font, bg_type=bg_type, bg_colors=bg_colors,
                       text_color_override=text_color_override,
                       bg_gradient_dir=bg_gradient_dir, bg_image=bg_image, bg_flip=bg_flip)
