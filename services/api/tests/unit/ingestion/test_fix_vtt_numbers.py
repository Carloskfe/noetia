"""Unit tests for fix-vtt-numbers.py"""
import importlib.util
import sys
import os
import tempfile
import pytest

# Load the script as a module from its path
_SCRIPT = os.path.join(
    os.path.dirname(__file__),
    '../../../src/ingestion/fix-vtt-numbers.py',
)
spec = importlib.util.spec_from_file_location('fix_vtt_numbers', _SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

convert_numbers = mod.convert_numbers
is_skip_line = mod.is_skip_line
process = mod.process


class TestIsSkipLine:
    def test_webvtt_header(self):
        assert is_skip_line('WEBVTT\n') is True

    def test_blank_line(self):
        assert is_skip_line('\n') is True
        assert is_skip_line('') is True

    def test_timestamp_line(self):
        assert is_skip_line('00:00:01.199 --> 00:00:03.199\n') is True

    def test_text_line(self):
        assert is_skip_line('mas los que 1 no come, otro se\n') is False


class TestConvertNumbers:
    def test_single_digit_uno(self):
        assert convert_numbers('para 1 solo') == 'para uno solo'

    def test_single_digit_dos(self):
        assert convert_numbers('en 2 bocados') == 'en dos bocados'

    def test_multiple_digits_same_line(self):
        assert convert_numbers('2 a 2 y 3 a 3') == 'dos a dos y tres a tres'

    def test_large_number_mil(self):
        assert convert_numbers('1000 importunidades') == 'mil importunidades'

    def test_large_number_cien(self):
        assert convert_numbers('100 y tantas oraciones') == 'cien y tantas oraciones'

    def test_doscientos(self):
        assert convert_numbers('200 palominos') == 'doscientos palominos'

    def test_quince(self):
        assert convert_numbers('más de 15 años') == 'más de quince años'

    def test_dieciseis(self):
        assert convert_numbers('16 leguas') == 'dieciséis leguas'

    def test_veinte(self):
        assert convert_numbers('solas 20 personas') == 'solas veinte personas'

    def test_treinta(self):
        assert convert_numbers('30 bulas') == 'treinta bulas'

    def test_no_partial_match(self):
        # "1000" should not become "unooco" (i.e. 1→uno, then 0 left over)
        # Longest-first ordering prevents this
        assert convert_numbers('1000 males') == 'mil males'

    def test_no_digit_in_number_word(self):
        # "doce" contains no digits — should be untouched
        assert convert_numbers('tiene doce') == 'tiene doce'

    def test_punctuation_preserved(self):
        assert convert_numbers('3.') == 'tres.'
        assert convert_numbers('¿2?') == '¿dos?'

    def test_no_change_when_no_digits(self):
        text = 'Yo por bien tengo que cosas tan señaladas'
        assert convert_numbers(text) == text


class TestProcessFile:
    def _make_vtt(self, content: str) -> str:
        f = tempfile.NamedTemporaryFile(mode='w', suffix='.vtt',
                                        encoding='utf-8', delete=False)
        f.write(content)
        f.close()
        return f.name

    def test_converts_text_lines_only(self):
        vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\npara 1 solo\n'
        in_path = self._make_vtt(vtt)
        out_path = in_path + '.out.vtt'
        process(in_path, out_path)
        with open(out_path, encoding='utf-8') as f:
            result = f.read()
        os.unlink(in_path)
        os.unlink(out_path)
        assert 'WEBVTT\n' in result
        assert '00:00:01.000 --> 00:00:03.000\n' in result
        assert 'para uno solo\n' in result

    def test_timestamp_digits_unchanged(self):
        vtt = 'WEBVTT\n\n00:01:30.500 --> 00:01:32.000\ntexto normal\n'
        in_path = self._make_vtt(vtt)
        out_path = in_path + '.out.vtt'
        process(in_path, out_path)
        with open(out_path, encoding='utf-8') as f:
            result = f.read()
        os.unlink(in_path)
        os.unlink(out_path)
        assert '00:01:30.500 --> 00:01:32.000\n' in result
