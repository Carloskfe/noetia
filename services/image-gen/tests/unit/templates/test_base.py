import base64
import io

from PIL import Image

from templates.base import (
    render_card,
    text_color_for_bg,
    _logo_target_height,
    _LOGO_MIN_H,
    _WHITE,
    _DARK_NAVY,
)


def _png_data_uri(color=(120, 120, 120), size=(8, 8)) -> str:
    """A tiny solid-colour PNG as a data: URI, for image-background tests."""
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def _card(**kwargs) -> bytes:
    fragment = kwargs.pop("fragment", {"text": "Una cita.", "author": "Autor", "title": "Libro"})
    return render_card(fragment, 600, 600, **kwargs)


# ── text_color_for_bg ─────────────────────────────────────────────────────────

class TestTextColorForBg:
    def test_dark_background_gets_white_text(self):
        assert text_color_for_bg(["#0D1B2A"]) == _WHITE

    def test_light_background_gets_dark_text(self):
        assert text_color_for_bg(["#FFFFFF"]) == _DARK_NAVY

    def test_averages_multiple_colours(self):
        # Two dark colours average dark → white text.
        assert text_color_for_bg(["#000000", "#0D1B2A"]) == _WHITE


# ── render_card colour override ───────────────────────────────────────────────

class TestRenderCardOverride:
    def test_returns_valid_png(self):
        data = _card()
        assert data[:8] == b"\x89PNG\r\n\x1a\n"

    def test_override_changes_solid_render(self):
        # Same dark background, but forcing a dark (navy) text override must
        # differ from the auto white the background would otherwise pick.
        auto = _card(bg_type="solid", bg_colors=["#0D1B2A"])
        overridden = _card(bg_type="solid", bg_colors=["#0D1B2A"], text_color_override="#FF0000")
        assert auto != overridden

    def test_image_bg_honours_text_colour_override(self):
        # Bug fix: over a photo background the render used to force white and
        # ignore the override, so the download didn't match the preview. An
        # explicit navy override must now actually change the output.
        uri = _png_data_uri()
        forced_white = _card(bg_type="image", bg_image=uri)  # no override → white
        overridden = _card(bg_type="image", bg_image=uri, text_color_override="#0D1B2A")
        assert forced_white != overridden

    def test_italic_changes_the_render(self):
        # Italic must actually slant the quote text, so the output differs from
        # the upright render (previously italic was ignored entirely).
        upright = _card(fragment={"text": "Una cita en cursiva.", "author": "A", "title": "L"})
        italic = _card(fragment={"text": "Una cita en cursiva.", "author": "A", "title": "L", "italic": True})
        assert upright != italic

    def test_bold_and_italic_combine(self):
        italic = _card(fragment={"text": "Cita.", "author": "A", "title": "L", "italic": True})
        bold_italic = _card(fragment={"text": "Cita.", "author": "A", "title": "L", "italic": True, "bold": True})
        assert italic != bold_italic

    def test_non_italic_render_is_unchanged_by_the_flag(self):
        # italic=False must be byte-identical to omitting the flag.
        default = _card(fragment={"text": "Cita.", "author": "A", "title": "L"})
        explicit = _card(fragment={"text": "Cita.", "author": "A", "title": "L", "italic": False})
        assert default == explicit

    def test_image_bg_white_override_matches_auto_white(self):
        # Sanity: an explicit white override equals the auto-white default over
        # an image, so the fix doesn't change the common case.
        uri = _png_data_uri()
        auto = _card(bg_type="image", bg_image=uri)
        white_override = _card(bg_type="image", bg_image=uri, text_color_override="#FFFFFF")
        assert auto == white_override


# ── Watermark logo size ───────────────────────────────────────────────────────

class TestLogoTargetHeight:
    def test_height_is_3_9_percent_of_width(self):
        # 1080px card → int(1080 * 0.039) = 42px.
        assert _logo_target_height(1080) == 42

    def test_reduced_35_percent_from_the_old_6_percent(self):
        # The logo was 6% of card width; it is now ~35% smaller. Allow ±1px for
        # int() truncation across the size range.
        for width in (1000, 1080, 1200, 1920):
            old = int(width * 0.06)
            assert abs(_logo_target_height(width) - old * 0.65) <= 1

    def test_floors_at_the_minimum_height(self):
        # Very narrow cards clamp to the minimum so the mark stays legible.
        assert _logo_target_height(100) == _LOGO_MIN_H


# ── Background image sources (NEM-016 S12, review follow-up) ──────────────────

import socket

import pytest
from unittest import mock

from templates import base as base_mod

PUBLIC_IP = "84.247.140.175"


def _png_bytes(color=(10, 200, 10)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (4, 4), color).save(buf, format="PNG")
    return buf.getvalue()


def _addrinfo(*ips):
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 443)) for ip in ips]


class _FakeResp:
    def __init__(self, status=200, data=b""):
        self.status = status
        self._data = data

    def read(self, n=-1):
        return self._data if n < 0 else self._data[:n]


class _FakeConn:
    """Stands in for the pinned connection classes; records what was requested."""
    instances = []

    def __init__(self, host, port, ip, timeout, resp=None):
        self.host, self.port, self.ip, self.timeout = host, port, ip, timeout
        self.resp = resp or _FakeResp(200, _png_bytes())
        self.requests = []
        self.closed = False
        _FakeConn.instances.append(self)

    def request(self, method, path, headers=None):
        self.requests.append((method, path, headers))

    def getresponse(self):
        return self.resp

    def close(self):
        self.closed = True


@pytest.fixture
def no_env(monkeypatch):
    monkeypatch.delenv("SHARE_BG_ALLOWED_HOSTS", raising=False)
    monkeypatch.delenv("BG_IMAGE_ALLOWED_HOSTS", raising=False)


@pytest.fixture
def fake_net(monkeypatch):
    """Public DNS + fake pinned connections; returns a setter for the response."""
    _FakeConn.instances = []
    state = {"resp": None}
    monkeypatch.setattr(base_mod.socket, "getaddrinfo", lambda *a, **k: _addrinfo(PUBLIC_IP))
    factory = lambda host, port, ip, timeout: _FakeConn(host, port, ip, timeout, state["resp"])  # noqa: E731
    monkeypatch.setattr(base_mod, "_PinnedHTTPSConnection", factory)
    monkeypatch.setattr(base_mod, "_PinnedHTTPConnection", factory)
    return state


class TestLoadBgImageDataUri:
    def test_accepts_inline_png_data_uri_without_network(self, monkeypatch):
        monkeypatch.setattr(base_mod.socket, "getaddrinfo", mock.Mock(side_effect=AssertionError("no DNS")))
        img = base_mod._load_bg_image(_png_data_uri((1, 2, 3)))
        assert img.getpixel((0, 0)) == (1, 2, 3)

    @pytest.mark.parametrize("uri", [
        "data:text/html;base64,PGgxPg==",
        "data:image/svg+xml;base64,PHN2Zz4=",
    ])
    def test_rejects_non_raster_data_uris(self, uri):
        with pytest.raises(ValueError):
            base_mod._load_bg_image(uri)

    def test_rejects_oversized_data_uri(self, monkeypatch):
        monkeypatch.setattr(base_mod, "_BG_MAX_BYTES", 10)
        with pytest.raises(ValueError):
            base_mod._load_bg_image(_png_data_uri())


class TestPresetUrlValidation:
    @pytest.mark.parametrize("n", list(range(1, 19)))
    def test_all_18_noetia_presets_are_accepted(self, no_env, fake_net, n):
        img = base_mod._load_bg_image(f"https://noetia.app/backgrounds/imagen-{n}.jpg")
        assert img.size == (4, 4)
        conn = _FakeConn.instances[-1]
        assert (conn.host, conn.port, conn.ip) == ("noetia.app", 443, PUBLIC_IP)
        assert conn.requests == [("GET", f"/backgrounds/imagen-{n}.jpg",
                                  {"Host": "noetia.app", "User-Agent": "noetia-image-gen"})]
        assert conn.closed

    def test_staging_preset_is_accepted(self, no_env, fake_net):
        assert base_mod._load_bg_image("https://staging.noetia.app/backgrounds/imagen-1.jpg")

    @pytest.mark.parametrize("url", [
        "file:///etc/passwd",
        "ftp://noetia.app/backgrounds/imagen-1.jpg",
        "gopher://noetia.app/backgrounds/imagen-1.jpg",
        "http://noetia.app/backgrounds/imagen-1.jpg",            # built-in hosts: https only
        "https://evil.example/backgrounds/imagen-1.jpg",         # unlisted host
        "https://noetia.app.evil.example/backgrounds/imagen-1.jpg",
        "https://api:4000/backgrounds/imagen-1.jpg",             # internal service name
        "https://169.254.169.254/backgrounds/imagen-1.jpg",      # metadata IP literal
        "https://127.0.0.1/backgrounds/imagen-1.jpg",
        "https://noetia.app/backgrounds/imagen-0.jpg",
        "https://noetia.app/backgrounds/imagen-19.jpg",
        "https://noetia.app/backgrounds/../secret.jpg",
        "https://noetia.app/backgrounds/imagen-1.jpg?x=1",
        "https://noetia.app/backgrounds/imagen-1.jpg#f",
        "https://user:pw@noetia.app/backgrounds/imagen-1.jpg",
        "https://noetia.app:99999/backgrounds/imagen-1.jpg",
        "https://noetia.app/images/abc.png",
    ])
    def test_rejects_without_dns_or_connection(self, no_env, monkeypatch, url):
        dns = mock.Mock(side_effect=AssertionError("must not resolve"))
        monkeypatch.setattr(base_mod.socket, "getaddrinfo", dns)
        monkeypatch.setattr(base_mod, "_PinnedHTTPSConnection", mock.Mock(side_effect=AssertionError("no connect")))
        monkeypatch.setattr(base_mod, "_PinnedHTTPConnection", mock.Mock(side_effect=AssertionError("no connect")))
        with pytest.raises(ValueError):
            base_mod._load_bg_image(url)
        dns.assert_not_called()

    @pytest.mark.parametrize("value", ["", " ", ",", " , "])
    def test_empty_allowlist_variable_never_widens_access(self, monkeypatch, value):
        monkeypatch.setenv("SHARE_BG_ALLOWED_HOSTS", value)
        with pytest.raises(ValueError):
            base_mod._validate_bg_url("https://evil.example/backgrounds/imagen-1.jpg")
        assert base_mod._validate_bg_url("https://noetia.app/backgrounds/imagen-1.jpg")[4] is False

    def test_legacy_variable_name_is_not_honoured(self, monkeypatch):
        monkeypatch.delenv("SHARE_BG_ALLOWED_HOSTS", raising=False)
        monkeypatch.setenv("BG_IMAGE_ALLOWED_HOSTS", "evil.example")
        with pytest.raises(ValueError):
            base_mod._validate_bg_url("https://evil.example/backgrounds/imagen-1.jpg")


class TestDnsAndNetwork:
    @pytest.mark.parametrize("ip", [
        "127.0.0.1", "10.0.0.5", "172.18.0.4", "192.168.1.20", "169.254.169.254",
        "100.64.0.1", "0.0.0.0", "::1", "fc00::1", "fe80::1%eth0",
    ])
    def test_builtin_host_resolving_to_non_public_address_is_refused(self, no_env, monkeypatch, ip):
        monkeypatch.setattr(base_mod.socket, "getaddrinfo", lambda *a, **k: _addrinfo(ip))
        monkeypatch.setattr(base_mod, "_PinnedHTTPSConnection", mock.Mock(side_effect=AssertionError("no connect")))
        with pytest.raises(ValueError):
            base_mod._load_bg_image("https://noetia.app/backgrounds/imagen-1.jpg")

    def test_any_non_public_address_in_the_answer_is_refused(self, no_env, monkeypatch):
        monkeypatch.setattr(base_mod.socket, "getaddrinfo", lambda *a, **k: _addrinfo(PUBLIC_IP, "10.0.0.5"))
        with pytest.raises(ValueError):
            base_mod._load_bg_image("https://noetia.app/backgrounds/imagen-1.jpg")

    def test_unresolvable_host_is_refused(self, no_env, monkeypatch):
        monkeypatch.setattr(base_mod.socket, "getaddrinfo", lambda *a, **k: [])
        with pytest.raises(ValueError):
            base_mod._load_bg_image("https://noetia.app/backgrounds/imagen-1.jpg")

    def test_connection_is_pinned_to_the_checked_address(self, no_env, fake_net, monkeypatch):
        answers = iter([_addrinfo(PUBLIC_IP), _addrinfo("127.0.0.1")])  # rebinding attempt
        monkeypatch.setattr(base_mod.socket, "getaddrinfo", lambda *a, **k: next(answers))
        base_mod._load_bg_image("https://noetia.app/backgrounds/imagen-1.jpg")
        assert _FakeConn.instances[-1].ip == PUBLIC_IP

    @pytest.mark.parametrize("status", [301, 302, 307, 308, 401, 404, 500])
    def test_non_200_including_redirects_is_refused(self, no_env, fake_net, status):
        fake_net["resp"] = _FakeResp(status, b"")
        with pytest.raises(ValueError):
            base_mod._load_bg_image("https://noetia.app/backgrounds/imagen-1.jpg")
        assert _FakeConn.instances[-1].closed

    def test_oversized_download_is_refused(self, no_env, fake_net, monkeypatch):
        monkeypatch.setattr(base_mod, "_BG_MAX_BYTES", 5)
        with pytest.raises(ValueError):
            base_mod._load_bg_image("https://noetia.app/backgrounds/imagen-1.jpg")

    def test_configured_dev_host_may_use_http_and_a_private_address(self, monkeypatch, fake_net):
        monkeypatch.setenv("SHARE_BG_ALLOWED_HOSTS", "192.168.1.20")
        monkeypatch.setattr(base_mod.socket, "getaddrinfo", lambda *a, **k: _addrinfo("192.168.1.20"))
        assert base_mod._load_bg_image("http://192.168.1.20:3000/backgrounds/imagen-2.jpg")
        conn = _FakeConn.instances[-1]
        assert (conn.port, conn.ip) == (3000, "192.168.1.20")

    def test_configured_host_still_restricted_to_preset_paths(self, monkeypatch):
        monkeypatch.setenv("SHARE_BG_ALLOWED_HOSTS", "localhost")
        with pytest.raises(ValueError):
            base_mod._validate_bg_url("http://localhost:4000/admin")


class TestPinnedConnections:
    def test_https_connect_uses_pinned_ip_and_verifies_original_hostname(self, monkeypatch):
        raw_sock = object()
        create = mock.Mock(return_value=raw_sock)
        monkeypatch.setattr(base_mod.socket, "create_connection", create)
        conn = base_mod._PinnedHTTPSConnection("noetia.app", 443, PUBLIC_IP, 5)
        conn._context = mock.Mock()
        conn.connect()
        create.assert_called_once_with((PUBLIC_IP, 443), 5)
        conn._context.wrap_socket.assert_called_once_with(raw_sock, server_hostname="noetia.app")

    def test_https_context_verifies_certificates(self):
        conn = base_mod._PinnedHTTPSConnection("noetia.app", 443, PUBLIC_IP, 5)
        import ssl
        assert conn._context.verify_mode == ssl.CERT_REQUIRED
        assert conn._context.check_hostname is True

    def test_http_connect_uses_pinned_ip(self, monkeypatch):
        create = mock.Mock(return_value=object())
        monkeypatch.setattr(base_mod.socket, "create_connection", create)
        conn = base_mod._PinnedHTTPConnection("localhost", 3000, "127.0.0.1", 5)
        conn.connect()
        create.assert_called_once_with(("127.0.0.1", 3000), 5)


class TestRenderFallback:
    def test_rejected_source_falls_back_to_default_card_without_network(self, no_env, monkeypatch):
        monkeypatch.setattr(base_mod.socket, "getaddrinfo", mock.Mock(side_effect=AssertionError("no DNS")))
        rejected = _card(bg_type="image", bg_image="http://api:4000/internal")
        unloadable = _card(bg_type="image", bg_image="data:image/png;base64,AAAA")
        assert rejected == unloadable


# ── Static checks on templates/base.py (pre-merge verification) ───────────────

import ast
import builtins
import inspect


def _base_tree():
    return ast.parse(inspect.getsource(base_mod))


class TestNoDeadCode:
    def test_no_statement_follows_return_or_raise(self):
        offenders = []

        def walk_block(stmts, where):
            for i, st in enumerate(stmts):
                if isinstance(st, (ast.Return, ast.Raise)) and i < len(stmts) - 1:
                    offenders.append(f"{where}: line {stmts[i + 1].lineno}")
                for field in ("body", "orelse", "finalbody"):
                    walk_block(getattr(st, field, []) or [], where)
                for h in getattr(st, "handlers", []) or []:
                    walk_block(h.body, where)

        for node in ast.walk(_base_tree()):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                walk_block(node.body, node.name)
        assert offenders == [], f"unreachable code after return/raise: {offenders}"

    def test_every_module_level_name_used_is_defined(self):
        tree = _base_tree()
        defined = set(dir(builtins)) | set(vars(base_mod))
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                defined.add(node.name)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
                args = node.args
                for a in args.args + args.kwonlyargs + args.posonlyargs:
                    defined.add(a.arg)
                for a in (args.vararg, args.kwarg):
                    if a:
                        defined.add(a.arg)
            elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
                defined.add(node.id)
            elif isinstance(node, (ast.ExceptHandler,)) and node.name:
                defined.add(node.name)
            elif isinstance(node, ast.comprehension):
                for t in ast.walk(node.target):
                    if isinstance(t, ast.Name):
                        defined.add(t.id)
        loaded = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load)}
        assert loaded - defined == set()

    def test_legacy_urllib_fetch_path_is_gone(self):
        src = inspect.getsource(base_mod)
        assert "_BG_OPENER" not in src
        assert "urlopen" not in src
        assert "urllib.request" not in src
