#!/usr/bin/env python3
"""Noetia — Quiet Editorial prototype generator (DESIGN PROTOTYPE ONLY; stdlib only).

Writes static HTML pages in Spanish and English to ../src/. Not production code; isolated from services/web.
Images and fonts are referenced from the repository's existing assets (no copies, no external requests).
Run:  python3 tools/build_prototypes.py   (from docs/design/ecosystem-ux/prototypes)
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'src'))
ROOT = '../../../../../'                     # from src/*.html to repository root
BG = ROOT + 'services/web/public/backgrounds/'
CV = ROOT + 'services/web/public/covers/'

BOOKS = [  # public-domain titles with existing local covers
    ('quijote-vol-1.png', 'Don Quijote de la Mancha', 'Miguel de Cervantes', 64),
    ('la-divina-comedia.png', 'La Divina Comedia', 'Dante Alighieri', 22),
    ('la-edad-de-oro.png', 'La Edad de Oro', 'José Martí', 100),
    ('don-juan-tenorio.png', 'Don Juan Tenorio', 'José Zorrilla', 8),
    ('cuentos-selva.png', 'Cuentos de la Selva', 'Horacio Quiroga', 41),
    ('fabulas-pombo.png', 'Fábulas y Verdades', 'Rafael Pombo', 0),
    ('literatura-infantil.png', 'Literatura infantil', 'Pombo · Martí · Quiroga', 0),
    ('biblia-reina-valera.png', 'Santa Biblia', 'Reina-Valera', 12),
    ('bible-kjv.png', 'Holy Bible', 'King James Version', 0),
    ('quijote-vol-2.png', 'Don Quijote — Vol. II', 'Miguel de Cervantes', 0),
]

ICONS = {
    'book': '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M8 7h7"/>',
    'compass': '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    'research': '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/><path d="M8 10.5h5M10.5 8v5"/>',
    'users': '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    'user': '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    'search': '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    'headphones': '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/>',
    'pen': '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/><path d="m14 6 4 4"/>',
    'share': '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    'play': '<path d="M7 4.5v15l12-7.5z"/>',
    'back10': '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><text x="12" y="15.5" font-size="7" text-anchor="middle" stroke="none" fill="currentColor" font-family="sans-serif">10</text>',
    'fwd10': '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/><text x="12" y="15.5" font-size="7" text-anchor="middle" stroke="none" fill="currentColor" font-family="sans-serif">10</text>',
    'type': '<path d="M4 7V5h16v2"/><path d="M12 5v14"/><path d="M9 19h6"/>',
    'list': '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
    'arrow-left': '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    'check': '<path d="m5 12 5 5L20 7"/>',
    'lock': '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    'plus': '<path d="M12 5v14M5 12h14"/>',
    'quote': '<path d="M7 7h4v5c0 3-2 5-4 5"/><path d="M15 7h4v5c0 3-2 5-4 5"/>',
    'file': '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="M8 13h8M8 17h6"/>',
    'menu': '<path d="M4 7h16M4 12h16M4 17h16"/>',
    'chat': '<path d="M4 5h16v11H9l-5 4z"/>',
    'vote': '<path d="M4 12h16v8H4z"/><path d="m8 12 3-7 5 2-2 5"/>',
    'paw': '<circle cx="7" cy="9" r="1.8"/><circle cx="11" cy="6" r="1.8"/><circle cx="15" cy="6.5" r="1.8"/><circle cx="18" cy="10" r="1.8"/><path d="M8 17c0-3 2-5 4.5-5s4.5 2 4.5 5c0 2-2 3-4.5 3S8 19 8 17z"/>',
    'child': '<circle cx="12" cy="5" r="2.5"/><path d="M12 8v7M8 11h8M10 21l2-6 2 6"/>',
    'leaf': '<path d="M20 4C10 4 4 9 4 16c0 2 1 4 1 4s2-1 4-1c7 0 11-6 11-15z"/><path d="M4 20 14 10"/>',
    'card': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
    'shield': '<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z"/>',
    'globe': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    'columns': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
    'alert': '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
    'info': '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
    'sliders': '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    'bookmark': '<path d="M6 3h12v18l-6-4-6 4z"/>',
    'layers': '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    'x': '<path d="M6 6l12 12M18 6 6 18"/>',
}


def ic(name, cls='icon'):
    return f'<svg class="{cls}" aria-hidden="true"><use href="#i-{name}"/></svg>'


SPRITE = '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' + ''.join(
    f'<symbol id="i-{k}" viewBox="0 0 24 24">{v}</symbol>' for k, v in ICONS.items()) + '</svg>'


def page(name, lang, title, body, body_cls=''):
    other = 'en' if lang == 'es' else 'es'
    flag = {'es': 'Prototipo de diseño — no es la aplicación en producción', 'en': 'Design prototype — not the production application'}[lang]
    html = f'''<!doctype html>
<html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — Noetia prototype ({lang.upper()})</title>
<link rel="stylesheet" href="assets/proto.css"></head>
<body class="{body_cls}">{SPRITE}
<div class="proto-flag neutral">{flag} · <a href="{name}.{other}.html">{other.upper()}</a> · <a href="index.{lang}.html">Index</a></div>
{body}
</body></html>
'''
    with open(os.path.join(OUT, f'{name}.{lang}.html'), 'w', encoding='utf-8') as f:
        f.write(html)


def T(lang, es, en):
    return es if lang == 'es' else en


# ───────────────────────────── shared chrome ─────────────────────────────
def site_header(L):
    t = lambda es, en: T(L, es, en)
    return f'''<header class="site-header"><div class="wrap">
  <a class="wordmark" href="#">NOETIA</a>
  <nav class="nav" aria-label="{t('Principal', 'Main')}"><a href="#como">{t('Cómo funciona', 'How it works')}</a><a href="#">{t('Biblioteca', 'Library')}</a><a href="#eco">Noetia+ {t('y', '&')} NoetiaX</a><a href="#">{t('Planes', 'Plans')}</a></nav>
  <div class="row"><span class="lang" role="group" aria-label="{t('Idioma', 'Language')}"><span class="{'on' if L == 'es' else ''}">ES</span><span class="{'on' if L == 'en' else ''}">EN</span></span>
    <a class="hide-m" href="#" style="color:var(--on-navy-2);text-decoration:none;font-size:15px">{t('Iniciar sesión', 'Sign in')}</a>
    <a class="btn primary sm" href="#">{t('Crear cuenta', 'Create account')}</a>
    <button class="iconbtn menu-btn" style="color:#fff" aria-label="{t('Abrir menú', 'Open menu')}">{ic('menu', 'icon lg')}</button></div>
</div></header>'''


def site_footer(L):
    t = lambda es, en: T(L, es, en)
    return f'''<footer class="site-footer"><div class="wrap">
  <div class="fgrid">
    <div><a class="wordmark" style="color:#fff" href="#">NOETIA</a><p style="margin:14px 0 0;max-width:32ch">{t('Lee, escucha, captura y comparte las ideas que te mueven.', 'Read, listen, capture and share the ideas that move you.')}</p><p class="small" style="margin-top:14px">info@noetia.app</p></div>
    <div><h5>{t('Plataforma', 'Platform')}</h5><ul><li><a href="#">{t('Biblioteca', 'Library')}</a></li><li><a href="#">{t('Clubes de Lectura', 'Reading Clubs')}</a></li><li><a href="#">Causas Noetia</a></li><li><a href="#">{t('Planes', 'Plans')}</a></li><li><a href="#">{t('Para autores', 'For authors')}</a></li></ul></div>
    <div><h5>{t('Empresa', 'Company')}</h5><ul><li><a href="#">{t('Sobre Noetia', 'About')}</a></li><li><a href="#">{t('Cómo construimos', 'How we build')}</a></li><li><a href="#">{t('Equipo', 'Team')}</a></li><li><a href="#">{t('Carreras', 'Careers')}</a></li><li><a href="#">{t('Contacto', 'Contact')}</a></li></ul></div>
    <div><h5>Legal</h5><ul><li><a href="#">{t('Términos de Servicio', 'Terms of Service')}</a></li><li><a href="#">{t('Privacidad', 'Privacy')}</a></li><li><a href="#">Cookies</a></li><li><a href="#">{t('Confianza y seguridad', 'Trust & safety')}</a></li></ul></div>
  </div>
  <div class="fbottom"><span>© 2026 Noetia</span><span>{t('Español · English', 'English · Español')}</span></div>
</div></footer>'''


def app_shell(L, active, content, tier=None):
    t = lambda es, en: T(L, es, en)
    items = [('library', 'book', t('Biblioteca', 'Library')), ('discover', 'compass', t('Descubrir', 'Discover')),
             ('research', 'research', t('Investigar', 'Research')), ('clubs', 'users', t('Clubes', 'Clubs')), ('profile', 'user', t('Perfil', 'Profile'))]
    rail = ''.join(f'<a class="{"on" if k == active else ""}" href="#">{ic(i)}<span>{lab}</span>{"<span class=tier-tag>" + tier + "</span>" if (k == "research" and tier) else ""}</a>' for k, i, lab in items)
    tabs = ''.join(f'<span class="{"on" if k == active else ""}">{ic(i)}{lab}</span>' for k, i, lab in items)
    return f'''<div class="app"><aside class="rail" aria-label="{t('Navegación', 'Navigation')}"><a class="wordmark" href="#">NOETIA</a>{rail}
<div class="bottom"><a href="#">{ic('bookmark')}<span>{t('Mis fragmentos', 'My highlights')}</span></a><a href="#">{ic('card')}<span>{t('Cuenta y facturación', 'Account & billing')}</span></a></div></aside>
<main class="main">{content}</main></div><nav class="tabbar" aria-label="{t('Navegación', 'Navigation')}">{tabs}</nav>'''


def claim(L):
    return '<sup class="claim" title="' + T(L, 'Afirmación pendiente de aprobación (PO y asesoría jurídica) antes de publicarse', 'Claim pending approval (PO and legal counsel) before publication') + '">†</sup>'


def concept(L, text_es, text_en, kind='concept'):
    return f'<div class="proto-flag" style="border-radius:10px;margin-bottom:20px">{T(L, text_es, text_en)}</div>'


# ───────────────────────────── A. public website ─────────────────────────────
def public(L):
    t = lambda es, en: T(L, es, en)
    quote = t('«En un lugar de la Mancha, de cuyo nombre no quiero acordarme…»', '“It is a truth universally acknowledged…”')
    by = t('— Miguel de Cervantes', '— Jane Austen')
    sheet = t('En un lugar de la Mancha, <span class="phrase-on">de cuyo nombre no quiero acordarme,</span> no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor.',
              'It is a truth universally acknowledged, <span class="phrase-on">that a single man in possession of a good fortune,</span> must be in want of a wife. However little known the feelings or views of such a man may be…')
    src = t('Don Quijote · Cap. I', 'Pride and Prejudice · Ch. 1')
    body = f'''<div class="dark">{site_header(L)}
<section class="hero"><div class="wrap hero-grid">
  <div><span class="eyebrow" style="color:var(--emerald)">{t('Lectura que se convierte en ideas', 'Reading that becomes ideas')}</span>
    <h1>{t('Lo que lees te define.<br><em>Noetia lo hace visible.</em>', 'What you read defines you.<br><em>Noetia makes it visible.</em>')}</h1>
    <p class="lede">{t('Lee y escucha a la vez, guarda los pasajes que te mueven y compártelos como tarjetas visuales.', 'Read and listen at the same time, save the passages that move you and share them as visual cards.')}</p>
    <div class="row" style="flex-wrap:wrap"><a class="btn primary" href="#">{t('Crear cuenta gratis', 'Create free account')}</a><a class="btn secondary" href="#">{t('Explorar la biblioteca', 'Explore the library')} {ic('arrow-right', 'icon sm')}</a></div></div>
  <figure style="margin:0" aria-label="{t('Ilustración del producto', 'Product illustration')}">
    <div class="demo">
      <div><div class="demo-sheet"><div class="src"><span>{src}</span><span>{ic('headphones', 'icon sm')}</span></div><p>{sheet}</p>
        <div class="demo-audio" aria-hidden="true">{ic('play', 'icon sm')}<div class="track"><i></i></div><span>0:42</span><b>1.0×</b></div></div>
        <div style="margin-top:12px"><span class="chip saved">{ic('check', 'icon sm')} {t('Fragmento guardado', 'Highlight saved')}</span></div></div>
      <div class="quote-card" style="background-image:url('{BG}imagen-13.jpg')"><span class="mark">NOETIA</span><blockquote>{quote}</blockquote><span class="by">{by}</span></div>
    </div>
    <div class="demo-steps"><span><b>1</b>{t('Escucha y lee', 'Listen and read')}</span><span><b>2</b>{t('Captura', 'Capture')}</span><span><b>3</b>{t('Comparte', 'Share')}</span></div>
    <figcaption class="caption">{t('Ilustración del producto con un texto de dominio público.', 'Product illustration using a public-domain text.')}</figcaption>
  </figure>
</div></section>
<section class="section" id="como"><div class="wrap"><span class="eyebrow" style="color:var(--on-navy-3)">{t('Cómo funciona', 'How it works')}</span>
  <h2>{t('Tres gestos. Una forma nueva de leer.', 'Three gestures. A new way to read.')}</h2>
  <p class="intro">{t('Con el tiempo, tus fragmentos forman un mapa de las ideas que te mueven — privado y bajo tu control.', 'Over time, your highlights form a map of the ideas that move you — private and under your control.')}{claim(L)}</p>
  <div class="steps">
    <div class="step"><div class="num">{ic('headphones')}</div><h3>{t('Absorbe', 'Absorb')}</h3><p>{t('Lee y escucha a la vez, frase por frase.', 'Read and listen together, phrase by phrase.')}</p></div>
    <div class="step"><div class="num">{ic('pen')}</div><h3>{t('Captura', 'Capture')}</h3><p>{t('Guarda con un toque el pasaje que te movió.', 'Save the passage that moved you in one tap.')}</p></div>
    <div class="step"><div class="num">{ic('share')}</div><h3>{t('Expresa', 'Express')}</h3><p>{t('Conviértelo en una tarjeta visual para compartir.', 'Turn it into a visual card to share.')}</p></div>
  </div></div></section>
<section class="section" id="eco"><div class="wrap"><span class="eyebrow" style="color:var(--emerald)">{t('Ecosistema', 'Ecosystem')}</span>
  <h2>{t('Un ecosistema para leer, comprender e investigar', 'One ecosystem to read, understand and investigate')}</h2>
  <div class="tiers" style="margin-top:32px">
    <div class="card tier"><span class="badge ok">{t('Disponible', 'Available')}</span><h3>Noetia</h3><p class="verb">{t('Lee, escucha, captura y comparte.', 'Read, listen, capture and share.')}</p>
      <ul><li>{ic('check', 'icon sm')}{t('Lectura y audio sincronizados', 'Synchronized reading and audio')}</li><li>{ic('check', 'icon sm')}{t('Fragmentos y tarjetas visuales', 'Highlights and visual cards')}</li><li>{ic('check', 'icon sm')}{t('Clubes de Lectura', 'Reading Clubs')}</li></ul>
      <a class="btn primary sm" href="#">{t('Crear cuenta', 'Create account')}</a></div>
    <div class="card tier"><span class="badge dev">{t('En desarrollo', 'In development')}</span><h3>Noetia+</h3><p class="verb">{t('Comprende, pregunta y conecta ideas.', 'Understand, ask and connect ideas.')}</p>
      <ul><li>{ic('check', 'icon sm')}{t('Preguntas sobre hasta 3 libros por sesión, con citas', 'Questions across up to 3 books per session, with citations')}</li><li>{ic('check', 'icon sm')}{t('Respuestas que indican su fuente', 'Answers that show their source')}</li></ul>
      <p class="req">{t('Requiere una suscripción Noetia.', 'Requires a Noetia subscription.')}</p></div>
    <div class="card tier"><span class="badge dev">{t('En desarrollo', 'In development')}</span><h3>NoetiaX</h3><p class="verb">{t('Investiga en profundidad y compara fuentes.', 'Investigate in depth and compare sources.')}</p>
      <ul><li>{ic('check', 'icon sm')}{t('Investigación con hasta 10 libros por sesión', 'Research with up to 10 books per session')}</li><li>{ic('check', 'icon sm')}{t('Análisis más profundo entre libros, con citas', 'Deeper analysis across books, with citations')}</li></ul>
      <p class="req">{t('Requiere una suscripción Noetia.', 'Requires a Noetia subscription.')}</p></div>
  </div>
  <p class="fine">{t('Noetia+ y NoetiaX están en desarrollo; las funciones y la disponibilidad pueden cambiar. Tus libros adquiridos son tuyos para siempre, con o sin servicios premium.', 'Noetia+ and NoetiaX are in development; features and availability may change. Books you acquire are yours forever, with or without premium services.')}{claim(L)}<br>{t('† Afirmaciones pendientes de aprobación del PO y asesoría jurídica antes de publicarse.', '† Claims pending PO and legal approval before publication.')}</p>
</div></section>
<section class="section"><div class="wrap split">
  <div><span class="eyebrow" style="color:var(--on-navy-3)">{t('Clubes de Lectura', 'Reading Clubs')}</span><h2>{t('Las ideas crecen cuando se comparten.', 'Ideas grow when they are shared.')}</h2><a class="btn secondary" href="#">{t('Explorar clubes', 'Explore clubs')}</a></div>
  <div class="feature-rows">
    <div class="frow"><div class="ic">{ic('chat')}</div><div><h4>{t('Conversaciones ancladas', 'Anchored discussions')}</h4><p>{t('Comenta la frase exacta que te inspiró.', 'Discuss the exact phrase that inspired you.')}</p></div></div>
    <div class="frow"><div class="ic">{ic('headphones')}</div><div><h4>{t('Escucha Juntos', 'Listen Together')}</h4><p>{t('Sesiones en vivo con la misma frase al mismo tiempo.', 'Live sessions on the same phrase at the same time.')}</p></div></div>
    <div class="frow"><div class="ic">{ic('vote')}</div><div><h4>{t('Elijan juntos', 'Choose together')}</h4><p>{t('El grupo vota el próximo libro.', 'The group votes on the next book.')}</p></div></div>
  </div></div></section>
<section class="section"><div class="wrap split">
  <div><span class="eyebrow" style="color:var(--emerald)">Causas Noetia</span><h2>{t('Compartir también es ayudar.', 'Sharing is also helping.')}</h2>
    <p class="intro" style="margin-bottom:20px">{t('Destinamos el 2,22% de cada pago a causas sociales. Forma parte del modelo financiero de Noetia desde el primer día.', 'We commit 2.22% of every payment to social causes. It has been part of Noetia’s financial model from day one.')}</p>
    <div class="ph" style="background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.25);color:var(--on-navy-2)">{t('[Mecanismo de distribución — pendiente de decisión del PO (LPD-6)]', '[Distribution mechanism — pending PO decision (LPD-6)]')}</div>
    <a class="btn text" href="#">{t('Conoce Causas Noetia', 'Learn about Causas Noetia')} {ic('arrow-right', 'icon sm')}</a></div>
  <div class="feature-rows">
    <div class="frow"><div class="ic">{ic('paw')}</div><div><h4>{t('Bienestar animal', 'Animal welfare')}</h4><p>{t('Rescate, cuidado y protección de animales.', 'Rescue, care and protection of animals.')}</p></div></div>
    <div class="frow"><div class="ic">{ic('child')}</div><div><h4>{t('Niñez y juventud', 'Children and youth')}</h4><p>{t('Protección, educación y oportunidades.', 'Protection, education and opportunity.')}</p></div></div>
    <div class="frow"><div class="ic">{ic('leaf')}</div><div><h4>{t('Medio ambiente', 'Environment')}</h4><p>{t('Ecosistemas y biodiversidad.', 'Ecosystems and biodiversity.')}</p></div></div>
  </div></div></section>
<section class="section"><div class="wrap split">
  <div><span class="eyebrow" style="color:var(--on-navy-3)">{t('Para autores y editoriales', 'For authors and publishers')}</span><h2>{t('Tus lectores lo resaltan y lo comparten.', 'Your readers highlight it and share it.')}</h2></div>
  <div><p class="intro" style="margin-bottom:20px">{t('Publica en Noetia con analíticas de lectura y de fragmentos compartidos.', 'Publish on Noetia with reading and sharing analytics.')}</p><a class="btn secondary" href="#">{t('Ver guía de publicación', 'View publishing guide')}</a></div>
</div></section>
<section class="cta-band"><div class="wrap"><h2>{t('Empieza a leer de otra manera.', 'Start reading differently.')}</h2><a class="btn primary" href="#">{t('Crear cuenta gratis', 'Create free account')}</a></div></section>
{site_footer(L)}</div>'''
    page('public', L, t('Sitio público', 'Public website'), body, 'dark')


def public_menu(L):
    t = lambda es, en: T(L, es, en)
    body = f'''<div class="dark" style="min-height:100vh"><header class="site-header"><div class="wrap"><a class="wordmark" href="#">NOETIA</a>
<button class="iconbtn" style="color:#fff" aria-label="{t('Cerrar menú', 'Close menu')}">{ic('x', 'icon lg')}</button></div></header>
<nav class="wrap" style="padding-top:24px;padding-bottom:40px" aria-label="{t('Menú', 'Menu')}">
<ul style="list-style:none;padding:0;margin:0;display:grid;gap:4px;font:700 24px/1.3 var(--display)">
<li style="padding:12px 0;border-bottom:1px solid var(--navy-line)">{t('Cómo funciona', 'How it works')}</li><li style="padding:12px 0;border-bottom:1px solid var(--navy-line)">{t('Biblioteca', 'Library')}</li>
<li style="padding:12px 0;border-bottom:1px solid var(--navy-line)">Noetia+ {t('y', '&')} NoetiaX</li><li style="padding:12px 0;border-bottom:1px solid var(--navy-line)">{t('Planes', 'Plans')}</li></ul>
<div style="display:grid;gap:12px;margin:28px 0"><a class="btn primary block" href="#">{t('Crear cuenta', 'Create account')}</a><a class="btn secondary block" href="#">{t('Iniciar sesión', 'Sign in')}</a></div>
<div class="row between"><span class="eyebrow" style="color:var(--on-navy-3)">{t('Idioma', 'Language')}</span><span class="lang"><span class="{'on' if L == 'es' else ''}">ES</span><span class="{'on' if L == 'en' else ''}">EN</span></span></div>
<p class="eyebrow" style="color:var(--on-navy-3);margin-top:32px">{t('Empresa', 'Company')}</p>
<p style="color:var(--on-navy-2);display:grid;gap:10px;margin:0">{t('<span>Sobre Noetia</span><span>Cómo construimos</span><span>Equipo</span><span>Carreras</span><span>Contacto</span>', '<span>About</span><span>How we build</span><span>Team</span><span>Careers</span><span>Contact</span>')}</p>
</nav></div>'''
    page('public-menu', L, t('Menú móvil', 'Mobile menu'), body, 'dark')


# ───────────────────────────── B. Noetia core ─────────────────────────────
def covers(L, idx, show_progress=False):
    out = []
    for i in idx:
        f, ti, au, pr = BOOKS[i]
        prog = f'<div class="progress"><i style="width:{pr}%"></i></div>' if show_progress else ''
        out.append(f'<div class="cover"><img src="{CV}{f}" alt="{ti}"><p class="t">{ti}</p><p class="a">{au}</p>{prog}</div>')
    return ''.join(out)


def mobile_top(L, title):
    return f'<div class="mobile-top"><span class="wordmark">NOETIA</span><span class="iconbtn boxed">{ic("search")}</span></div>'


def core_library(L):
    t = lambda es, en: T(L, es, en)
    f, ti, au, pr = BOOKS[0]
    content = f'''{mobile_top(L, '')}<div class="page-head"><div><h1>{t('Tu biblioteca', 'Your library')}</h1><p>{t('Tus libros son tuyos para siempre.', 'Your books are yours forever.')}{claim(L)}</p></div>
<div class="search">{ic('search')}<span>{t('Buscar en tu biblioteca', 'Search your library')}</span></div></div>
<div class="card continue"><img src="{CV}{f}" alt=""><div><span class="eyebrow muted">{t('Continuar', 'Continue')}</span><h3 class="display" style="font-size:24px;margin:6px 0 4px">{ti}</h3><p class="muted" style="margin:0">{au} · {t('Capítulo VIII · 64%', 'Chapter VIII · 64%')}</p><div class="progress" style="max-width:320px"><i style="width:64%"></i></div></div>
<a class="btn primary" href="#">{ic('headphones', 'icon sm')} {t('Seguir con Escucha Activa', 'Resume Escucha Activa')}</a></div>
<h2 class="h2">{t('Leyendo', 'Reading')}</h2><div class="covers">{covers(L, [1, 2, 3, 4, 7, 9], True)}</div>
<h2 class="h2">{t('Descubrir · Clásicos gratuitos', 'Discover · Free classics')}</h2><div class="covers">{covers(L, [5, 6, 8, 0, 1, 2])}</div><p class="small muted" style="margin-top:28px">{t('† Afirmación pendiente de aprobación del PO y asesoría jurídica antes de publicarse.', '† Claim pending PO and legal approval before publication.')}</p>'''
    page('core-library', L, t('Biblioteca', 'Library'), app_shell(L, 'library', content))


def core_reader(L):
    t = lambda es, en: T(L, es, en)
    paras = t(['En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor.',
               'Una olla de algo más vaca que carnero, salpicón las más noches, duelos y quebrantos los sábados, lantejas los viernes, algún palomino de añadidura los domingos, <span class="phrase-on">consumían las tres partes de su hacienda.</span>',
               'El resto della concluían sayo de velarte, calzas de velludo para las fiestas, con sus pantuflos de lo mesmo, y los días de entresemana se honraba con su vellorí de lo más fino.'],
              ['It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
               'However little known the feelings or views of such a man may be on his first entering a neighbourhood, <span class="phrase-on">this truth is so well fixed in the minds of the surrounding families,</span> that he is considered as the rightful property of some one or other of their daughters.',
               '“My dear Mr. Bennet,” said his lady to him one day, “have you heard that Netherfield Park is let at last?”'])
    body = f'''<div class="reader" style="position:relative">
<div class="reader-top"><a class="iconbtn" href="#" aria-label="{t('Volver', 'Back')}">{ic('arrow-left')}</a><span class="title">{t('Don Quijote de la Mancha', 'Pride and Prejudice')}</span>
<div class="tools"><button class="iconbtn boxed" aria-label="{t('Ajustes de lectura', 'Reading settings')}">{ic('type')}</button><button class="iconbtn hide-m" aria-label="{t('Contenido', 'Contents')}">{ic('list')}</button><button class="iconbtn hide-m" aria-label="{t('Fragmentos', 'Highlights')}">{ic('bookmark')}</button></div></div>
<div class="settings-sheet"><b>{t('Ajustes de lectura', 'Reading settings')}</b><div class="small muted" style="margin-top:12px">{t('Tamaño', 'Size')}</div><div class="seg"><span>A−</span><span class="on">A</span><span>A+</span></div>
<div class="small muted">{t('Tema', 'Theme')}</div><div class="seg"><span class="on">{t('Papel', 'Paper')}</span><span>{t('Sepia', 'Sepia')}</span><span>{t('Noche', 'Night')}</span></div>
<div class="small muted">{t('Diseño', 'Layout')}</div><div class="seg" style="margin-bottom:0"><span class="on">{t('Páginas', 'Pages')}</span><span>{t('Continuo', 'Scroll')}</span></div></div>
<article class="sheet"><h2>{t('Capítulo primero', 'Chapter 1')}</h2><p>{paras[0]}</p><p>{paras[1]}</p>
<div class="popover at-phrase" role="menu"><a href="#">{ic('bookmark', 'icon sm')} {t('Guardar fragmento', 'Save highlight')}</a><a href="#">{ic('share', 'icon sm')} {t('Compartir', 'Share')}</a><a href="#"><span class="plus">{ic('research', 'icon sm')}</span> {t('Preguntar', 'Ask')}<span class="badge concept" style="margin-left:4px">Noetia+</span></a></div><p>{paras[2]}</p>
<p class="small muted" style="text-align:center;margin-top:28px">{t('Página 3 de 412', 'Page 3 of 412')}</p></article>
<div class="audio-bar"><div class="small muted hide-m">{ic('headphones', 'icon sm')} Escucha Activa · {t('frase 18 de 2.310', 'phrase 18 of 2,310')}</div>
<div class="ctrl"><button class="iconbtn" aria-label="{t('Atrás 10 segundos', 'Back 10 seconds')}">{ic('back10', 'icon lg')}</button><span class="play" aria-label="{t('Reproducir', 'Play')}">{ic('play', 'icon lg')}</span><button class="iconbtn" aria-label="{t('Adelante 10 segundos', 'Forward 10 seconds')}">{ic('fwd10', 'icon lg')}</button></div>
<div class="row" style="justify-content:flex-end"><span class="speed">1.0×</span></div></div></div>'''
    page('core-reader', L, t('Lector', 'Reader'), body)


def core_fragments(L):
    t = lambda es, en: T(L, es, en)
    frs = t([('consumían las tres partes de su hacienda.', 'Don Quijote · Cap. I'), ('La libertad, Sancho, es uno de los más preciosos dones que a los hombres dieron los cielos.', 'Don Quijote · Cap. LVIII'),
             ('Nel mezzo del cammin di nostra vita mi ritrovai per una selva oscura.', 'La Divina Comedia · Canto I')],
            [('this truth is so well fixed in the minds of the surrounding families,', 'Pride and Prejudice · Ch. 1'), ('I declare after all there is no enjoyment like reading!', 'Pride and Prejudice · Ch. 11'),
             ('Midway upon the journey of our life I found myself within a forest dark.', 'The Divine Comedy · Canto I')])
    items = ''.join(f'<div class="card frag"><q>{q}</q><div class="meta"><span>{s}</span><a class="btn text" href="#">{ic("share", "icon sm")} {t("Crear tarjeta", "Create card")}</a><a class="btn text" href="#">{ic("pen", "icon sm")} {t("Nota", "Note")}</a></div></div>' for q, s in frs)
    content = f'''{mobile_top(L, '')}<div class="page-head"><div><h1>{t('Mis fragmentos', 'My highlights')}</h1><p>{t('42 fragmentos en 6 libros', '42 highlights across 6 books')}</p></div><div class="search">{ic('search')}<span>{t('Buscar fragmentos', 'Search highlights')}</span></div></div>
<div class="row" style="gap:8px;margin-bottom:18px;flex-wrap:wrap"><span class="badge ok">{t('Todos', 'All')}</span><span class="badge dev">Don Quijote · 18</span><span class="badge dev">La Divina Comedia · 9</span></div>
<div class="list">{items}</div>
<div class="notice" style="margin-top:24px">{ic('research')}<div><b>{t('Preguntar a mis fragmentos', 'Ask my highlights')}</b> <span class="badge concept">Noetia+ · {t('en desarrollo', 'in development')}</span><br>{t('Busca y pregunta sobre tus fragmentos de toda tu biblioteca.', 'Search and ask about your highlights across your library.')}</div></div>'''
    page('core-fragments', L, t('Fragmentos', 'Highlights'), app_shell(L, 'profile', content))


def core_editor(L):
    t = lambda es, en: T(L, es, en)
    thumbs = ''.join(f'<img class="{"on" if n == 13 else ""}" src="{BG}imagen-{n}.jpg" alt="">' for n in [13, 9, 17, 3, 5, 14])
    q = t('«La libertad, Sancho, es uno de los más preciosos dones que a los hombres dieron los cielos.»', '“I declare after all there is no enjoyment like reading!”')
    content = f'''{mobile_top(L, '')}<div class="page-head"><div><h1>{t('Crear tarjeta', 'Create card')}</h1><p>{t('Formato → Fondo → Texto', 'Format → Background → Text')}</p></div></div>
<div class="editor"><div class="preview-stage"><div class="quote-card" style="background-image:url('{BG}imagen-13.jpg')"><span class="mark">NOETIA</span><blockquote style="font-size:26px">{q}</blockquote><span class="by">{t('— Miguel de Cervantes · Don Quijote', '— Jane Austen · Pride and Prejudice')}</span></div></div>
<div><div class="stepper"><span class="done">1 {t('Formato', 'Format')}</span><span class="on">2 {t('Fondo', 'Background')}</span><span>3 {t('Texto', 'Text')}</span></div>
<div class="card"><div class="row between"><b>{t('Fondo', 'Background')}</b><span class="small muted">{t('Tono: oscuro', 'Tone: dark')}</span></div><div class="thumbs" style="margin-top:12px">{thumbs}</div>
<div class="small muted" style="margin-top:16px">{t('Ajuste', 'Fit')}</div><div class="seg"><span class="on">{t('Completa', 'Full')}</span><span>{t('Recortar', 'Crop')}</span><span>{t('Borde', 'Matte')}</span></div>
<div class="contrast-ok">{ic('check', 'icon sm')} {t('Texto legible sobre este fondo', 'Text is legible on this background')}</div></div>
<div class="row" style="margin-top:16px;justify-content:flex-end"><a class="btn secondary" href="#">{t('Atrás', 'Back')}</a><a class="btn primary" href="#">{t('Siguiente', 'Next')}</a></div>
<p class="small muted" style="margin-top:12px">{t('Opciones avanzadas (alineación, cursiva, tamaño) en el paso 3.', 'Advanced options (alignment, italics, size) in step 3.')}</p></div></div>'''
    page('core-editor', L, t('Editor de tarjetas', 'Card editor'), app_shell(L, 'profile', content))


def core_clubs(L):
    t = lambda es, en: T(L, es, en)
    f = BOOKS[0][0]
    content = f'''{mobile_top(L, '')}<div class="page-head"><div><h1>{t('Club Cervantino', 'Cervantes Circle')}</h1><p>{t('Privado · 12 miembros', 'Private · 12 members')}</p></div><a class="btn primary" href="#">{ic('headphones', 'icon sm')} {t('Unirse a la sesión en vivo', 'Join live session')}</a></div>
<div class="grid2"><div class="card"><div class="row" style="align-items:flex-start;gap:16px"><img src="{CV}{f}" alt="" style="width:72px;border-radius:6px"><div><span class="eyebrow muted">{t('Leyendo ahora', 'Now reading')}</span><h3 class="display" style="margin:6px 0">Don Quijote de la Mancha</h3><p class="muted small" style="margin:0">{t('Próxima sesión: jueves 19:00', 'Next session: Thursday 7 pm')}</p></div></div></div>
<div class="card"><span class="eyebrow muted">{t('Votación', 'Vote')}</span><p style="margin:8px 0 12px"><b>{t('Próximo libro', 'Next book')}</b></p><div class="small">La Divina Comedia <span class="muted">· 7</span></div><div class="meter"><i style="width:58%"></i></div><div class="small">Cuentos de la Selva <span class="muted">· 5</span></div><div class="meter"><i style="width:42%"></i></div></div></div>
<h2 class="h2">{t('Conversación anclada', 'Anchored discussion')}</h2>
<div class="card"><div class="frag" style="margin-bottom:16px"><q>{t('consumían las tres partes de su hacienda.', 'consumed three-quarters of his income.')}</q><div class="meta"><span>{t('Frase 18 · Cap. I', 'Phrase 18 · Ch. I')}</span></div></div>
<div class="list"><div><b>Lucía</b> <span class="muted small">· 2 h</span><p style="margin:4px 0 0">{t('Me encanta cómo Cervantes describe la economía del hidalgo en una sola frase.', 'I love how Cervantes sums up his finances in one sentence.')}</p></div>
<div><b>Andrés</b> <span class="muted small">· 1 h</span><p style="margin:4px 0 0">{t('Y eso prepara todo lo que viene después.', 'And it sets up everything that follows.')}</p></div></div></div>'''
    page('core-clubs', L, t('Clubes de Lectura', 'Reading Clubs'), app_shell(L, 'clubs', content))


def core_account(L):
    t = lambda es, en: T(L, es, en)
    content = f'''{mobile_top(L, '')}<div class="page-head"><div><h1>{t('Cuenta y facturación', 'Account & billing')}</h1></div></div>
<div class="grid2"><div class="card"><div class="row between"><b>{t('Suscripción Noetia', 'Noetia subscription')}</b><span class="badge ok">{t('Activa', 'Active')}</span></div>
<dl class="kv" style="margin-top:16px"><dt>{t('Plan', 'Plan')}</dt><dd>Individual · $8.99 / {t('mes', 'month')}</dd><dt>{t('Renovación', 'Renews')}</dt><dd>{t('[fecha]', '[date]')}</dd><dt>Tokens</dt><dd>{t('1 disponible · vence en [n] días', '1 available · expires in [n] days')}</dd></dl>
<div class="row" style="margin-top:18px;flex-wrap:wrap"><a class="btn secondary sm" href="#">{t('Gestionar suscripción', 'Manage subscription')}</a><a class="btn text" href="#">{t('Ver términos de suscripción', 'View subscription terms')}</a></div></div>
<div class="card"><div class="row between"><b>{t('Servicios premium', 'Premium services')}</b><span class="badge dev">{t('En desarrollo', 'In development')}</span></div><p class="muted" style="margin:12px 0 0">{t('Noetia+ y NoetiaX requieren una suscripción Noetia activa. Tus libros adquiridos son tuyos para siempre, con o sin servicios premium.', 'Noetia+ and NoetiaX require an active Noetia subscription. Books you acquire are yours forever, with or without premium services.')}{claim(L)}</p></div></div>
<h2 class="h2">{t('Privacidad', 'Privacy')}</h2><div class="card"><div class="row between"><div><b>{t('Contribuir a Noetia Insights', 'Contribute to Noetia Insights')}</b><p class="muted small" style="margin:4px 0 0">{t('Usa tus patrones de lectura para tu perfil y recomendaciones.', 'Uses your reading patterns for your profile and recommendations.')}</p></div><span class="badge ok">{t('Activado', 'On')}</span></div></div>
<h2 class="h2">{t('Eliminar cuenta', 'Delete account')}</h2><div class="notice warn">{ic('alert')}<div>{t('Antes de eliminar tu cuenta verás el estado de tu suscripción y cómo cancelarla.', 'Before deleting your account you will see your subscription status and how to cancel it.')} <span class="badge concept">{t('Propuesta (NC-12)', 'Proposal (NC-12)')}</span></div></div><p class="small muted" style="margin-top:28px">{t('† Afirmación pendiente de aprobación del PO y asesoría jurídica antes de publicarse.', '† Claim pending PO and legal approval before publication.')}</p>'''
    page('core-account', L, t('Cuenta', 'Account'), app_shell(L, 'profile', content))


# ───────────────────────────── C. Noetia+ ─────────────────────────────
PLUS_FLAG = ('Prototipo conceptual · Noetia+ está APROBADO y NO implementado (lanzamiento bloqueado). Etiquetas y textos pendientes de decisión del PO.',
             'Conceptual prototype · Noetia+ is APPROVED and NOT implemented (release blocked). Labels and copy pending PO decision.')
X_FLAG = ('Prototipo conceptual · NoetiaX está APROBADO como nivel y NO implementado. Los elementos marcados X-P requieren aprobación del PO.',
          'Conceptual prototype · NoetiaX is APPROVED as a tier and NOT implemented. Elements marked X-P require PO approval.')


def plus_entry(L):
    t = lambda es, en: T(L, es, en)
    content = f'''{concept(L, *PLUS_FLAG)}{mobile_top(L, '')}<div class="page-head"><div><h1>{t('Investigar', 'Research')}</h1><p>{t('Comprende, pregunta y conecta ideas con citas de tus libros.', 'Understand, ask and connect ideas with citations from your books.')}</p></div><a class="btn primary" href="#">{ic('plus', 'icon sm')} {t('Nueva sesión', 'New session')}</a></div>
<div class="grid3"><div class="card"><span class="eyebrow muted">{t('Uso este mes', 'Usage this month')}</span><div class="meter"><i style="width:35%"></i></div><p class="small muted" style="margin:0">{t('[unidades de uso pendientes de decisión D10]', '[usage units pending decision D10]')}</p></div>
<div class="card"><span class="eyebrow muted">{t('Sesiones recientes', 'Recent sessions')}</span><p style="margin:10px 0 0"><b>{t('El honor en el Siglo de Oro', 'Honour in the Golden Age')}</b><br><span class="small muted">{t('3 libros · bloqueados', '3 books · locked')}</span></p></div>
<div class="card"><span class="eyebrow muted">{t('Informes de investigación', 'Research Briefs')}</span><p style="margin:10px 0 0"><b>2</b> <span class="small muted">{t('guardados', 'saved')}</span></p></div></div>
<h2 class="h2">{t('Estados de acceso', 'Access states')}</h2><div class="grid3">
<div class="card state-card">{ic('card', 'icon lg')}<h3>{t('Necesitas una suscripción Noetia', 'You need a Noetia subscription')}</h3><p>{t('Noetia+ es un complemento de tu suscripción Individual, Dúo o Familia.', 'Noetia+ is an add-on to your Individual, Duo or Family subscription.')}</p><a class="btn secondary sm" href="#">{t('Ver planes', 'See plans')}</a></div>
<div class="card state-card">{ic('research', 'icon lg')}<h3>{t('Disponible con Noetia+', 'Available with Noetia+')}</h3><p>{t('Pregunta sobre hasta 3 libros por sesión, con citas verificadas.', 'Ask across up to 3 books per session, with verified citations.')}</p><a class="btn secondary sm" href="#">{t('Conocer Noetia+', 'Learn about Noetia+')}</a></div>
<div class="card state-card">{ic('info', 'icon lg')}<h3>{t('Has alcanzado tu límite de uso', 'You have reached your usage limit')}</h3><p>{t('Tu lectura no se ve afectada. [Detalles de renovación pendientes de decisión.]', 'Your reading is not affected. [Renewal details pending decision.]')}</p><a class="btn text" href="#">{t('Ver detalles', 'View details')}</a></div></div>'''
    page('plus-entry', L, t('Noetia+ — Investigar', 'Noetia+ — Research'), app_shell(L, 'research', content, 'Noetia+'))


def picker(L, limit, chosen, x=False):
    t = lambda es, en: T(L, es, en)
    elig = [t('Disponible para investigar', 'Available for research'), t('Dominio público verificado', 'Verified public domain')]
    tiles = []
    for i, (f, ti, au, _) in enumerate(BOOKS[:10]):
        on = i in chosen
        off = (not on) and len(chosen) >= limit
        tiles.append(f'<div class="pick {"on" if on else ""} {"off" if off else ""}"><img src="{CV}{f}" alt="">{("<span class=check>" + ic("check", "icon sm") + "</span>") if on else ""}<div class="t">{ti}</div><div class="elig">{elig[i % 2]}</div></div>')
    return ''.join(tiles)


def plus_select(L):
    t = lambda es, en: T(L, es, en)
    chosen = [0, 1, 4]
    content = f'''{concept(L, *PLUS_FLAG)}{mobile_top(L, '')}<div class="page-head"><div><h1>{t('Nueva sesión', 'New session')}</h1><p>{t('Elige hasta 3 libros. Los libros de dominio público verificados no necesitan estar en tu biblioteca.', 'Choose up to 3 books. Verified public-domain books do not need to be in your library.')}</p></div><div class="search">{ic('search')}<span>{t('Buscar libros', 'Search books')}</span></div></div>
<div class="picker"><div class="pick-grid">{picker(L, 3, chosen)}</div>
<aside class="card"><span class="counter">3 <span class="muted" style="font-size:18px">{t('de 3', 'of 3')}</span></span><p class="muted" style="margin:6px 0 16px">{t('libros seleccionados', 'books selected')}</p>
<div class="list">{''.join(f'<div class="book-pill"><img src="{CV}{BOOKS[i][0]}" alt="">{BOOKS[i][1]}</div>' for i in chosen)}</div>
<div class="notice" style="margin:18px 0">{ic('lock')}<div>{t('Tras tu primera pregunta no podrás cambiar los libros. Para usar otros, crea una sesión nueva.', 'After your first question the books cannot be changed. To use others, start a new session.')}</div></div>
<a class="btn primary block" href="#">{t('Empezar sesión', 'Start session')}</a></aside></div>'''
    page('plus-select', L, t('Noetia+ — Selección', 'Noetia+ — Selection'), app_shell(L, 'research', content, 'Noetia+'))


def answer(L):
    t = lambda es, en: T(L, es, en)
    return f'''<p class="illustrative">{ic('info', 'icon sm')}<span>{t('Ejemplo ilustrativo: respuesta, citas y estados de verificación simulados. No es un resultado real del sistema.', 'Illustrative example: answer, citations and verification states are simulated. Not real system output.')}</span></p><p class="turn-q">{t('¿Qué papel tiene el honor en estos libros?', 'What role does honour play in these books?')}</p>
<div class="answer"><div class="seg-block"><span class="prov books">{t('De tus libros', 'From your books')}</span><p>{t('En <i>Don Quijote</i>, el honor se presenta a través del ideal caballeresco que el protagonista intenta encarnar', 'In <i>Don Quijote</i>, honour appears through the chivalric ideal the protagonist tries to embody')}<sup class="cite on">1</sup>{t(', mientras que en <i>Don Juan Tenorio</i> aparece ligado a la reputación y al desafío', ', while in <i>Don Juan Tenorio</i> it is tied to reputation and challenge')}<sup class="cite">2</sup>.</p></div>
<div class="seg-block"><span class="prov general">{t('Contexto general — no proviene de tus libros', 'General context — not from your books')}</span><p>{t('El honor fue un tema central del teatro y la narrativa del Siglo de Oro español.', 'Honour was a central theme in Spanish Golden Age theatre and fiction.')}</p></div>
<div class="seg-block"><span class="prov notes">{t('Tus notas', 'Your notes')}</span><p>{t('Guardaste 3 fragmentos sobre este tema en <i>Don Quijote</i>', 'You saved 3 highlights on this theme in <i>Don Quijote</i>')}<sup class="cite">3</sup>.</p></div></div>
<div class="row small muted" style="gap:16px;margin-top:4px">{ic('check', 'icon sm')} {t('Respuesta lista', 'Answer ready')} · {t('1 libro no estaba disponible y se excluyó', '1 book was unavailable and was excluded')}</div>'''


def passage(L, n, loc, q, extra=''):
    t = lambda es, en: T(L, es, en)
    return f'''<div class="passage"><div class="loc"><span><b>{t('Cita', 'Citation')} {n}</b> · {loc}</span>{extra}</div><q>{q}</q>
<div class="row" style="margin-top:12px;gap:16px"><a class="btn text" href="#">{t('Ir al pasaje', 'Go to passage')} {ic('arrow-right', 'icon sm')}</a><a class="btn text" href="#" style="color:var(--ink-2)">{t('Abrir libro', 'Open book')}</a></div></div>'''


def plus_workspace(L):
    t = lambda es, en: T(L, es, en)
    head = ''.join(f'<span class="book-pill"><img src="{CV}{BOOKS[i][0]}" alt="">{BOOKS[i][1]}</span>' for i in [0, 3, 1])
    body = f'''{concept(L, *PLUS_FLAG)}<div class="research"><section class="convo"><div class="convo-head">{head}<span class="mode">{ic('lock', 'icon sm')} {t('Bloqueados', 'Locked')}</span><span class="mode">{t('Modo: Mis libros', 'Mode: My books')} <span class="badge concept">{t('nombre pendiente', 'name pending')}</span></span></div>
{answer(L)}
<p class="turn-q" style="margin-top:32px">{t('¿Y cómo se presenta en La Divina Comedia?', 'And how is it presented in La Divina Comedia?')}</p><div class="stage"><span class="dots"><i></i><i></i><i></i></span>{t('Buscando pasajes…', 'Searching passages…')} <a class="btn text" href="#" style="color:var(--ink-2)">{t('Cancelar', 'Cancel')}</a></div>
<div class="composer"><span class="grow">{t('Escribe tu pregunta…', 'Type your question…')}</span><a class="btn primary sm" href="#">{t('Preguntar', 'Ask')}</a></div></section>
<aside class="sources"><h3>{t('Fuentes', 'Sources')}</h3><div class="legend"><span class="prov books">{t('De tus libros', 'From your books')}</span><span class="prov general">{t('Contexto general', 'General context')}</span><span class="prov notes">{t('Tus notas', 'Your notes')}</span></div>
{passage(L, 1, t('Don Quijote · Cap. I', 'Don Quijote · Ch. I'), t('…y fue luego a ver su rocín, y aunque tenía más cuartos que un real…', '…and then went to see his nag, and though it had more quarters than a real…'), f'<span class="badge ok">{t("Verificado (ejemplo)", "Verified (example)")}</span>')}
{passage(L, 2, t('Don Juan Tenorio · Acto I', 'Don Juan Tenorio · Act I'), t('Por donde quiera que fui, la razón atropellé…', 'Wherever I went, I trampled reason…'), f'<span class="badge ok">{t("Verificado (ejemplo)", "Verified (example)")}</span>')}
</aside></div>'''
    page('plus-workspace', L, t('Noetia+ — Conversación', 'Noetia+ — Conversation'), app_shell(L, 'research', body, 'Noetia+').replace('<main class="main">', '<main class="main" style="padding:0">'))


def brief(L, x=False):
    t = lambda es, en: T(L, es, en)
    flag = X_FLAG if x else PLUS_FLAG
    extra = ''
    if x:
        extra = f'''<h2>{t('Donde los libros discrepan', 'Where the books disagree')} <span class="badge concept">X-P4 · {t('requiere aprobación', 'requires approval')}</span></h2>
<p>{t('<i>Don Quijote</i> trata el honor caballeresco con ironía<sup class="cite">1</sup>, mientras que <i>Don Juan Tenorio</i> lo presenta como motor dramático<sup class="cite">4</sup>. Las fuentes no permiten concluir cuál visión predominaba.', '<i>Don Quijote</i> treats chivalric honour with irony<sup class="cite">1</sup>, while <i>Don Juan Tenorio</i> presents it as a dramatic driver<sup class="cite">4</sup>. The sources do not establish which view prevailed.')}</p>'''
    content = f'''{concept(L, *flag)}<article class="brief"><span class="eyebrow muted">{t('Informe de investigación', 'Research Brief')} · {'NoetiaX' if x else 'Noetia+'}</span>
<h1>{t('El honor en el Siglo de Oro', 'Honour in the Golden Age')}</h1><p class="illustrative">{ic('info', 'icon sm')}<span>{t('Ejemplo ilustrativo: respuesta, citas y estados de verificación simulados. No es un resultado real del sistema.', 'Illustrative example: answer, citations and verification states are simulated. Not real system output.')}</span></p><p class="muted small" style="font-family:var(--sans)">{t('3 libros' if not x else '7 libros', '3 books' if not x else '7 books')} · {t('[fecha]', '[date]')} · <a class="btn text" href="#">{t('Exportar (futuro)', 'Export (future)')}</a></p>
<div class="legend"><span class="prov books">{t('De tus libros', 'From your books')}</span><span class="prov general">{t('Contexto general', 'General context')}</span><span class="prov notes">{t('Tus notas', 'Your notes')}</span><span class="muted">{t('Cada afirmación lleva cita o se marca como contexto general.', 'Every claim is cited or labelled as general context.')}</span></div>
<h2>{t('Síntesis', 'Summary')}</h2><p><span class="prov books">{t('De tus libros', 'From your books')}</span><br>{t('El honor aparece como ideal en <i>Don Quijote</i>', 'Honour appears as an ideal in <i>Don Quijote</i>')}<sup class="cite">1</sup>{t(' y como reputación pública en <i>Don Juan Tenorio</i>', ' and as public reputation in <i>Don Juan Tenorio</i>')}<sup class="cite">2</sup>.</p>
<p><span class="prov general">{t('Contexto general', 'General context')}</span><br>{t('El tema fue central en la literatura española de los siglos XVI y XVII.', 'The theme was central to 16th and 17th-century Spanish literature.')}</p>{extra}
<h2>{t('Fuentes', 'Sources')}</h2><ol style="font-family:var(--sans);font-size:15px;color:var(--ink-2)"><li>Don Quijote · {t('Cap. I', 'Ch. I')}</li><li>Don Juan Tenorio · {t('Acto I', 'Act I')}</li><li>{t('Tus fragmentos (3)', 'Your highlights (3)')}</li>{'<li>Don Juan Tenorio · ' + t('Acto IV', 'Act IV') + '</li>' if x else ''}</ol></article>'''
    page('x-brief' if x else 'plus-brief', L, t('Informe de investigación', 'Research Brief'), app_shell(L, 'research', content, 'NoetiaX' if x else 'Noetia+'))


# ───────────────────────────── D. NoetiaX ─────────────────────────────
def x_select(L):
    t = lambda es, en: T(L, es, en)
    chosen = [0, 1, 2, 3, 4, 7, 9]
    content = f'''{concept(L, *X_FLAG)}{mobile_top(L, '')}<div class="page-head"><div><h1>{t('Nueva investigación profunda', 'New deep research')}</h1><p>{t('Elige hasta 10 libros. Agrupa por autor, época o colección.', 'Choose up to 10 books. Group by author, period or collection.')} <span class="badge concept">X-P2</span></p></div><div class="search">{ic('search')}<span>{t('Buscar libros', 'Search books')}</span></div></div>
<div class="row" style="gap:8px;margin-bottom:16px;flex-wrap:wrap"><span class="badge ok">{t('Todos', 'All')}</span><span class="badge dev">{t('Siglo de Oro', 'Golden Age')}</span><span class="badge dev">{t('Poesía', 'Poetry')}</span><span class="badge dev">{t('Literatura infantil', 'Children’s literature')}</span></div>
<div class="picker"><div class="pick-grid">{picker(L, 10, chosen, True)}</div>
<aside class="card"><span class="counter">7 <span class="muted" style="font-size:18px">{t('de 10', 'of 10')}</span></span><p class="muted" style="margin:6px 0 16px">{t('libros seleccionados', 'books selected')}</p>
<div class="notice" style="margin-bottom:18px">{ic('lock')}<div>{t('Tras tu primera pregunta no podrás cambiar los libros.', 'After your first question the books cannot be changed.')}</div></div><a class="btn primary block" href="#">{t('Empezar investigación', 'Start research')}</a></aside></div>'''
    page('x-select', L, t('NoetiaX — Selección', 'NoetiaX — Selection'), app_shell(L, 'research', content, 'NoetiaX'))


def x_workspace(L):
    t = lambda es, en: T(L, es, en)
    srcs = ''.join(f'<div class="src {"on" if i == 0 else ""}"><img src="{CV}{BOOKS[i][0]}" alt=""><span>{BOOKS[i][1]}</span><span class="n">{n}</span></div>' for i, n in zip([0, 3, 1, 2, 4, 7, 9], [4, 3, 1, 0, 2, 0, 1]))
    sup, con, sil = (f'<span class="cell sup">{ic("check", "icon sm")}{t("apoya", "supports")}</span>', f'<span class="cell con">{ic("x", "icon sm")}{t("contradice", "contradicts")}</span>', f'<span class="cell sil">{t("sin evidencia", "no evidence")}</span>')
    claims = [t('El honor depende de la reputación pública', 'Honour depends on public reputation'), t('El honor puede ridiculizarse', 'Honour can be ridiculed'), t('El honor justifica la violencia', 'Honour justifies violence')]
    matrix = f'''<div class="matrix-wrap"><table class="matrix"><thead><tr><th>{t('Afirmación', 'Claim')}</th><th>Quijote</th><th>Tenorio</th><th>Comedia</th></tr></thead><tbody>
<tr><td>{claims[0]}</td><td>{sil}</td><td>{sup}<sup class="cite">2</sup></td><td>{sil}</td></tr>
<tr><td>{claims[1]}</td><td>{sup}<sup class="cite">1</sup></td><td>{con}<sup class="cite">4</sup></td><td>{sil}</td></tr>
<tr><td>{claims[2]}</td><td>{sil}</td><td>{sup}<sup class="cite">5</sup></td><td>{sil}</td></tr></tbody></table></div>
<div class="claim-cards">{''.join(f'<div class="card" style="padding:16px"><b>{c}</b><div class="small" style="margin-top:8px;display:grid;gap:4px"><span>Quijote: {a}</span><span>Tenorio: {b}</span></div></div>' for c, a, b in [(claims[0], sil, sup), (claims[1], sup, con), (claims[2], sil, sup)])}</div>'''
    body = f'''{concept(L, *X_FLAG)}<div class="research x"><aside class="rail-src"><h3 style="font:700 16px var(--display);margin:0 0 12px">{t('Fuentes (7)', 'Sources (7)')}</h3>{srcs}</aside>
<section class="convo"><div class="convo-head"><span class="mode">{ic('lock', 'icon sm')} {t('7 libros bloqueados', '7 books locked')}</span><span class="mode">{ic('layers', 'icon sm')} {t('Investigación profunda', 'Deep research')}</span></div>
{answer(L)}<div class="composer"><span class="grow">{t('Pregunta o pide una comparación…', 'Ask or request a comparison…')}</span><a class="btn primary sm" href="#">{t('Preguntar', 'Ask')}</a></div></section>
<aside class="evidence"><div class="row between"><h3>{t('Evidencia', 'Evidence')}</h3><span class="badge concept">X-P3 · {t('concepto', 'concept')}</span></div>
<p class="small muted" style="margin-top:0">{t('Cómo se relacionan los libros con cada afirmación. Cada celda enlaza a su pasaje.', 'How the books relate to each claim. Each cell links to its passage.')}</p>{matrix}
<h3 style="margin-top:24px">{t('Donde los libros discrepan', 'Where the books disagree')} <span class="badge concept">X-P4</span></h3><p class="small" style="color:var(--ink-2)">{t('Quijote ironiza sobre el honor caballeresco; Tenorio lo usa como motor dramático. No hay evidencia suficiente para un juicio general.', 'Quijote is ironic about chivalric honour; Tenorio uses it as a dramatic driver. Evidence is insufficient for a general judgement.')}</p>
{passage(L, 4, 'Don Juan Tenorio · ' + t('Acto IV', 'Act IV'), t('…llamé al cielo y no me oyó…', '…I called on heaven and it did not hear me…'))}</aside></div>'''
    page('x-workspace', L, t('NoetiaX — Espacio de investigación', 'NoetiaX — Research workspace'), app_shell(L, 'research', body, 'NoetiaX').replace('<main class="main">', '<main class="main" style="padding:0">'))


# ───────────────────────────── E. legal ─────────────────────────────
def legal_document(L):
    t = lambda es, en: T(L, es, en)
    sections = [t('Descripción del servicio', 'Description of the service'), t('Elegibilidad', 'Eligibility'), t('Planes, tokens y facturación', 'Plans, tokens and billing'),
                t('Propiedad de los libros', 'Book ownership'), t('Servicios premium (Noetia+ y NoetiaX)', 'Premium services (Noetia+ and NoetiaX)'), t('Contacto', 'Contact')]
    toc = ''.join(f'<li class="{"on" if i == 2 else ""}">{s}</li>' for i, s in enumerate(sections))
    body = f'''<div style="background:var(--paper)"><div class="wrap" style="padding-top:28px;padding-bottom:64px">
<div class="row between" style="margin-bottom:28px;flex-wrap:wrap"><a class="wordmark" style="color:var(--navy)" href="#">NOETIA</a>
<div class="row"><span class="small muted">{t('Leer en', 'Read in')}</span><span class="lang-light"><span class="{'on' if L == 'es' else ''}">Español</span><span class="{'on' if L == 'en' else ''}">English</span></span></div></div>
<div class="legal"><nav class="toc" aria-label="{t('Contenido', 'Contents')}"><span class="eyebrow muted">{t('Contenido', 'Contents')}</span><ol>{toc}</ol>
<p class="small muted" style="margin-top:20px">{t('Otros documentos', 'Other documents')}</p><p style="display:grid;gap:6px;margin:0;font-size:15px"><a href="#">{t('Política de Privacidad', 'Privacy Policy')}</a><a href="#">{t('Política de Cookies', 'Cookie Policy')}</a></p></nav>
<article class="doc"><span class="eyebrow muted">Legal</span><h1>{t('Términos de Servicio', 'Terms of Service')}</h1>
<div class="doc-meta"><span><b>{t('Versión', 'Version')}</b> [ToS-AAAA-MM-DD]</span><span><b>{t('Vigente desde', 'Effective')}</b> [{t('fecha', 'date')}]</span><span><a href="#">{t('Resumen de cambios', 'Summary of changes')}</a></span><span><a href="#">{t('Versiones anteriores', 'Previous versions')}</a></span></div>
<div class="ph">{t('[Texto legal pendiente de revisión por asesoría jurídica cualificada. Este prototipo no contiene términos aprobados.]', '[Legal text pending review by qualified legal counsel. This prototype contains no approved terms.]')}</div>
<h2>1. {sections[0]}</h2><div class="ph">{t('[Párrafo de descripción del servicio]', '[Service description paragraph]')}</div>
<h2>2. {sections[1]}</h2><div class="ph">{t('[Requisitos de elegibilidad]', '[Eligibility requirements]')}</div>
<h2>3. {sections[2]}</h2><p>{t('Ejemplo de tabla semántica (valores de marcador):', 'Example of a semantic table (placeholder values):')}</p>
<table class="doc-table"><thead><tr><th>{t('Plan', 'Plan')}</th><th>{t('Mensual', 'Monthly')}</th><th>{t('Anual', 'Annual')}</th></tr></thead><tbody><tr><td>Individual</td><td>[$]</td><td>[$]</td></tr><tr><td>{t('Dúo', 'Duo')}</td><td>[$]</td><td>[$]</td></tr><tr><td>{t('Familia', 'Family')}</td><td>[$]</td><td>[$]</td></tr></tbody></table>
<h2>4. {sections[3]}</h2><div class="ph">{t('[Cláusula de propiedad permanente — pendiente de asesoría jurídica (DL-05)]', '[Permanent-ownership clause — pending legal counsel (DL-05)]')}</div>
<h2>5. {sections[4]}</h2><div class="ph">{t('[Términos premium — pendientes de asesoría jurídica (DL-08)]', '[Premium terms — pending legal counsel (DL-08)]')}</div></article></div></div></div>'''
    page('legal-document', L, t('Documento legal', 'Legal document'), body)


def legal_disclosures(L):
    t = lambda es, en: T(L, es, en)
    body = f'''<div style="background:var(--paper)"><div class="wrap" style="padding-top:28px;padding-bottom:64px"><a class="wordmark" style="color:var(--navy)" href="#">NOETIA</a>
<div class="grid2" style="margin-top:28px;align-items:start">
<section class="card"><span class="eyebrow muted">{t('Registro', 'Registration')}</span><h2 class="display" style="margin:8px 0 18px">{t('Crea tu cuenta', 'Create your account')}</h2>
<div class="form"><div class="field"><label>{t('Nombre', 'Name')}</label><div class="in">Lucía</div></div><div class="field"><label>{t('Correo electrónico', 'Email')}</label><div class="in">lucia@example.invalid</div></div><div class="field"><label>{t('Contraseña', 'Password')}</label><div class="in">••••••••</div></div>
<div class="check-row"><span class="box"></span><span><span class="callout-num">1</span>{t('Acepto los <a href="#">Términos de Servicio</a> y he leído la <a href="#">Política de Privacidad</a>.', 'I agree to the <a href="#">Terms of Service</a> and have read the <a href="#">Privacy Policy</a>.')}</span></div>
<div class="check-row"><span class="box"></span><span><span class="callout-num">2</span>{t('[Declaración de edad — redacción pendiente de asesoría jurídica]', '[Age attestation — wording pending legal counsel]')}</span></div>
<a class="btn primary block" href="#">{t('Crear cuenta', 'Create account')}</a></div></section>
<section class="card"><span class="eyebrow muted">{t('Pago', 'Checkout')}</span><h2 class="display" style="margin:8px 0 18px">{t('Suscripción Noetia · Individual', 'Noetia subscription · Individual')}</h2>
<dl class="kv"><dt>{t('Precio', 'Price')}</dt><dd>$8.99 / {t('mes', 'month')}</dd><dt>{t('Prueba', 'Trial')}</dt><dd>[{t('condiciones pendientes', 'terms pending')}]</dd></dl>
<div class="ph" style="margin-top:16px"><span class="callout-num">3</span>{t('[Divulgación de renovación automática, prueba y cancelación — junto al botón, pendiente de asesoría jurídica (DL-04)]', '[Auto-renewal, trial and cancellation disclosure — next to the button, pending legal counsel (DL-04)]')}</div>
<a class="btn primary block" href="#" style="margin-top:12px">{t('Continuar al pago', 'Continue to payment')}</a><p class="small muted" style="margin-top:10px"><a href="#">{t('Términos de Servicio', 'Terms of Service')}</a> · <a href="#">{t('Privacidad', 'Privacy')}</a></p></section></div>
<div class="card" style="margin-top:20px"><b>{t('Colocación de las divulgaciones', 'Disclosure placement')}</b><ol class="small" style="color:var(--ink-2);margin:8px 0 0"><li>{t('Aceptación obligatoria en el registro, con enlaces en el idioma activo.', 'Required acceptance at registration, with links in the active language.')}</li><li>{t('Declaración de edad según asesoría jurídica.', 'Age attestation per legal counsel.')}</li><li>{t('Divulgación adyacente al botón de pago.', 'Disclosure adjacent to the payment button.')}</li></ol></div></div></div>'''
    page('legal-disclosures', L, t('Divulgaciones legales', 'Legal disclosures'), body)


# ───────────────────────────── index ─────────────────────────────
PAGES = [
    ('A', 'public', 'Sitio público', 'Public website'), ('A', 'public-menu', 'Menú móvil', 'Mobile menu'),
    ('B', 'core-library', 'Biblioteca y descubrir', 'Library and discovery'), ('B', 'core-reader', 'Lector sincronizado y audio', 'Synchronized reader and audio'),
    ('B', 'core-fragments', 'Fragmentos', 'Highlights'), ('B', 'core-editor', 'Editor de tarjetas', 'Quote-card editor'),
    ('B', 'core-clubs', 'Clubes de Lectura', 'Reading Clubs'), ('B', 'core-account', 'Cuenta y suscripción', 'Account and subscription'),
    ('C', 'plus-entry', 'Entrada, uso y acceso', 'Entry, usage and access'), ('C', 'plus-select', 'Selección de 3 libros', 'Three-book selection'),
    ('C', 'plus-workspace', 'Conversación, fuentes y citas', 'Conversation, sources and citations'), ('C', 'plus-brief', 'Informe de investigación', 'Research Brief'),
    ('D', 'x-select', 'Selección de 10 libros', 'Ten-book selection'), ('D', 'x-workspace', 'Espacio de investigación y evidencia', 'Research workspace and evidence'),
    ('D', 'x-brief', 'Informe NoetiaX', 'NoetiaX Research Brief'),
    ('E', 'legal-document', 'Documento legal', 'Legal document'), ('E', 'legal-disclosures', 'Registro y pago', 'Registration and checkout'),
]


def index(L):
    t = lambda es, en: T(L, es, en)
    groups = {'A': t('Sitio público', 'Public website'), 'B': 'Noetia', 'C': 'Noetia+ (' + t('conceptual', 'conceptual') + ')', 'D': 'NoetiaX (' + t('conceptual', 'conceptual') + ')', 'E': t('Experiencia legal bilingüe', 'Bilingual legal experience')}
    blocks = ''
    for g, gname in groups.items():
        rows = ''.join(f'<li><a href="{p}.{L}.html">{T(L, es, en)}</a></li>' for gg, p, es, en in PAGES if gg == g)
        blocks += f'<div class="card"><h3 class="display" style="margin:0 0 10px">{g}. {gname}</h3><ul style="margin:0;padding-left:18px;display:grid;gap:6px">{rows}</ul></div>'
    body = f'<div class="wrap" style="padding-top:32px;padding-bottom:64px"><h1 class="display">Noetia — Quiet Editorial · {t("Prototipos", "Prototypes")}</h1><p class="muted">{t("Prototipos estáticos de diseño. No son la aplicación en producción.", "Static design prototypes. Not the production application.")}</p><div class="grid3" style="margin-top:24px">{blocks}</div></div>'
    page('index', L, 'Index', body)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for L in ('es', 'en'):
        public(L); public_menu(L)
        core_library(L); core_reader(L); core_fragments(L); core_editor(L); core_clubs(L); core_account(L)
        plus_entry(L); plus_select(L); plus_workspace(L); brief(L); x_select(L); x_workspace(L); brief(L, x=True)
        legal_document(L); legal_disclosures(L); index(L)
    print('written', len(os.listdir(OUT)) - 1, 'html files to', OUT)
