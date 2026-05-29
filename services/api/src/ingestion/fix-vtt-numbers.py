"""
Post-process a Whisper VTT file: replace Arabic digit tokens with Spanish words.

Whisper frequently transcribes Spanish number words as digits (e.g. "uno" → "1",
"mil" → "1000"). This causes alignment exceptions because the phrase aligner
compares VTT tokens against book text tokens with no digit-to-word mapping.

Usage:
    python3 fix-vtt-numbers.py <input.vtt> <output.vtt>

Only text lines are modified — WEBVTT header, blank lines, and timestamp
lines (containing "-->") are passed through unchanged.
"""

import re
import sys

# Ordered longest-first so "1000" is replaced before "100" before "1", etc.
CONVERSIONS = [
    (r'\b1000\b', 'mil'),
    (r'\b200\b',  'doscientos'),
    (r'\b100\b',  'cien'),
    (r'\b30\b',   'treinta'),
    (r'\b20\b',   'veinte'),
    (r'\b19\b',   'diecinueve'),
    (r'\b18\b',   'dieciocho'),
    (r'\b17\b',   'diecisiete'),
    (r'\b16\b',   'dieciséis'),
    (r'\b15\b',   'quince'),
    (r'\b14\b',   'catorce'),
    (r'\b13\b',   'trece'),
    (r'\b12\b',   'doce'),
    (r'\b11\b',   'once'),
    (r'\b10\b',   'diez'),
    (r'\b9\b',    'nueve'),
    (r'\b8\b',    'ocho'),
    (r'\b7\b',    'siete'),
    (r'\b6\b',    'seis'),
    (r'\b5\b',    'cinco'),
    (r'\b4\b',    'cuatro'),
    (r'\b3\b',    'tres'),
    (r'\b2\b',    'dos'),
    (r'\b1\b',    'uno'),
]

_COMPILED = [(re.compile(p), r) for p, r in CONVERSIONS]
_TIMESTAMP_RE = re.compile(r'\d+:\d+:\d+\.\d+\s+-->\s+\d+:\d+:\d+\.\d+')


def is_skip_line(line: str) -> bool:
    s = line.strip()
    return s == '' or s == 'WEBVTT' or bool(_TIMESTAMP_RE.search(s))


def convert_numbers(text: str) -> str:
    for pattern, replacement in _COMPILED:
        text = re.sub(pattern, replacement, text)
    return text


def process(input_path: str, output_path: str) -> None:
    with open(input_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    out_lines = []
    changed = 0
    for line in lines:
        if is_skip_line(line):
            out_lines.append(line)
            continue
        original = line.rstrip('\n')
        converted = convert_numbers(original)
        if converted != original:
            changed += 1
            print(f'  {repr(original)}')
            print(f'→ {repr(converted)}')
        out_lines.append(converted + '\n')

    with open(output_path, 'w', encoding='utf-8') as f:
        f.writelines(out_lines)

    print(f'\nDone — {changed} lines modified → {output_path}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: python3 fix-vtt-numbers.py <input.vtt> <output.vtt>')
        sys.exit(1)
    process(sys.argv[1], sys.argv[2])
