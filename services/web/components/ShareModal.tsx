'use client';

import { useCallback, useEffect, useRef, useState, useId } from 'react';
import { apiFetch } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import {
  BG_PRESETS,
  FORMAT_PLATFORM_MAP,
  FONTS,
  FontId,
  GOOGLE_FONTS_URL,
  SHARE_FORMAT_LABELS,
  ShareFormat,
  ShareParams,
  copyToClipboard,
  getTextColor,
  shareFragment,
} from '@/lib/share-utils';

// ── Gradient directions ───────────────────────────────────────────────────────

const GRADIENT_DIRS = [
  { id: 'to-top-left',     icon: '↖', css: 'to top left' },
  { id: 'to-top',          icon: '↑', css: 'to top' },
  { id: 'to-top-right',    icon: '↗', css: 'to top right' },
  { id: 'to-left',         icon: '←', css: 'to left' },
  { id: 'radial',          icon: '●', css: null },
  { id: 'to-right',        icon: '→', css: 'to right' },
  { id: 'to-bottom-left',  icon: '↙', css: 'to bottom left' },
  { id: 'to-bottom',       icon: '↓', css: 'to bottom' },
  { id: 'to-bottom-right', icon: '↘', css: 'to bottom right' },
] as const;
type GradientDirId = typeof GRADIENT_DIRS[number]['id'];

function gradientCss(dir: GradientDirId, c1: string, c2: string): string {
  if (dir === 'radial') return `radial-gradient(circle at center, ${c1}, ${c2})`;
  const entry = GRADIENT_DIRS.find((d) => d.id === dir);
  return `linear-gradient(${entry?.css ?? 'to bottom'}, ${c1}, ${c2})`;
}

// ── Background image presets ──────────────────────────────────────────────────
// BG_PRESETS (18 Noetia gallery images) is defined in lib/share-utils.

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return fileToBase64(blob as File);
}

// ── Format aspect ratios ──────────────────────────────────────────────────────

const FORMAT_ASPECT: Record<ShareFormat, string> = {
  'ig-post':    'aspect-square',
  'ig-story':   'aspect-[9/16]',
  'reel':       'aspect-[9/16]',
  'fb-post':    'aspect-video',
  'fb-story':   'aspect-[9/16]',
  'li-post':    'aspect-video',
  'pin-post':   'aspect-[2/3]',
  'pin-square': 'aspect-square',
};

const SHARE_FORMATS = Object.keys(FORMAT_PLATFORM_MAP) as ShareFormat[];

// Quote text size options — scale matches the image-gen clamp range (0.7–1.5).
const TEXT_SIZES = [
  { id: 'S', scale: 0.7 },
  { id: 'M', scale: 1 },
  { id: 'L', scale: 1.5 },
] as const;

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  fragmentId: string;
  fragmentText: string;
  author: string;
  bookTitle: string;
  bookCollection?: string | null;
  note: string | null;
  onClose: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ShareModal({
  fragmentId, fragmentText, author, bookTitle, bookCollection, note, onClose,
}: Props) {
  const { t } = useTranslation();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFormat, setSelectedFormat] = useState<ShareFormat>('ig-post');
  const [selectedFont, setSelectedFont] = useState<FontId>('playfair');
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [bgType, setBgType] = useState<'solid' | 'gradient' | 'image'>('solid');
  const [bgColors, setBgColors] = useState<[string, string]>(['#0D1B2A', '#1A4A4A']);
  const [gradientDir, setGradientDir] = useState<GradientDirId>('to-bottom');
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgImageLoading, setBgImageLoading] = useState(false);
  const [bgFlip, setBgFlip] = useState(false);
  // How a photo background maps onto the card. 'blur' (fit whole image over a
  // blurred backdrop, no crop) is the safe default; 'cover' crops to fill.
  const [bgFit, setBgFit] = useState<'cover' | 'contain' | 'blur'>('blur');
  const [textColorOverride, setTextColorOverride] = useState<string | null>(null);
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [textScale, setTextScale] = useState(1);
  const [captionEnabled, setCaptionEnabled] = useState(false);

  // E1 — editable fragment text
  const [editedText, setEditedText] = useState(fragmentText);
  const [savingText, setSavingText] = useState(false);
  const textChanged = editedText !== fragmentText;

  // E2 — citation location
  const isBible = bookCollection === 'Biblia Reina-Valera';
  const defaultCitation = isBible
    ? `${bookTitle}, Capítulo X, versículo Y`
    : bookCollection
      ? `${bookCollection} · ${bookTitle}, Capítulo X, p. N`
      : `${bookTitle}, Capítulo X, p. N`;
  const [citationText, setCitationText] = useState(defaultCitation);
  const [citationEnabled, setCitationEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [connectedPlatforms, setConnectedPlatforms] = useState<Set<string>>(new Set());
  const [publishingPlatform, setPublishingPlatform] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishToast, setPublishToast] = useState<{ platform: string; postUrl: string } | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Flip (mirror) applies to raster image backgrounds only — no-op for solid/gradient.
  const imageActive = bgType === 'image' && !!bgImage;
  const activeBgColors = bgType === 'gradient' ? [bgColors[0], bgColors[1]] : [bgColors[0]];
  const autoTextColor = bgType === 'image' ? '#FFFFFF' : getTextColor(activeBgColors);
  const textColor = textColorOverride ?? autoTextColor;
  const fontCss = FONTS.find((f) => f.id === selectedFont)?.css ?? "'Lato', sans-serif";

  const previewBg =
    bgType === 'image' && bgImage
      ? `url("${bgImage}") center/cover`
      : bgType === 'gradient'
        ? gradientCss(gradientDir, bgColors[0], bgColors[1])
        : bgColors[0];

  const params: ShareParams = {
    format: selectedFormat,
    font: selectedFont,
    bgType,
    bgColors: bgType !== 'image' ? activeBgColors : ['#000000'],
    // Always forward the exact colour the preview shows (auto-contrast OR the
    // user's override). The server derives auto-contrast slightly differently
    // (it averages RGB channels then takes luminance; the preview averages the
    // per-colour luminances), so on gradients the two could pick opposite
    // colours — making the download not match the preview. Sending the resolved
    // colour makes the preview authoritative.
    textColor,
    ...(editedText !== fragmentText     ? { text:        editedText }        : {}),
    ...(citationEnabled && citationText ? { citation:    citationText }      : {}),
    ...(textBold                        ? { textBold:    true }              : {}),
    ...(textItalic                      ? { textItalic:  true }              : {}),
    ...(textAlign !== 'center'          ? { textAlign }                      : {}),
    ...(textScale !== 1                 ? { textScale }                      : {}),
    ...(bgType === 'gradient'           ? { gradientDir }                    : {}),
    ...(bgType === 'image' && bgImage   ? { bgImage }                        : {}),
    ...(imageActive && bgFlip           ? { bgFlip: true }                   : {}),
    ...(imageActive && bgFit !== 'blur' ? { bgFit }                          : {}),
  };

  const handleSelectPreset = useCallback(async (url: string) => {
    setBgImageLoading(true);
    try {
      const b64 = await urlToBase64(url);
      setBgImage(b64);
    } catch {}
    setBgImageLoading(false);
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgImageLoading(true);
    try {
      const b64 = await fileToBase64(file);
      setBgImage(b64);
    } catch {}
    setBgImageLoading(false);
    e.target.value = '';
  }, []);

  const handleSaveText = useCallback(async () => {
    if (!textChanged) return;
    setSavingText(true);
    try {
      await apiFetch(`/fragments/${fragmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ text: editedText }),
      });
    } catch {}
    setSavingText(false);
  }, [fragmentId, editedText, textChanged]);

  useEffect(() => {
    const platforms = ['linkedin', 'facebook', 'instagram', 'pinterest'];
    Promise.all(
      platforms.map((p) =>
        fetch(`/api/social/${p}/status`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : { connected: false }))
          .then((d: { connected: boolean }) => ({ p, connected: d.connected }))
          .catch(() => ({ p, connected: false })),
      ),
    ).then((results) => {
      setConnectedPlatforms(
        new Set(results.filter((r) => r.connected).map((r) => r.p)),
      );
    });
  }, []);

  const handleConnect = useCallback((platform: string) => {
    const popup = window.open(
      `/api/social/${platform}/connect`,
      'oauth',
      'width=600,height=700,noopener',
    );
    const check = setInterval(() => {
      if (popup?.closed) {
        clearInterval(check);
        fetch(`/api/social/${platform}/status`, { credentials: 'include' })
          .then((r) => r.json())
          .then((d: { connected: boolean }) => {
            if (d.connected) {
              setConnectedPlatforms((prev) => new Set([...prev, platform]));
            }
          })
          .catch(() => undefined);
      }
    }, 500);
  }, []);

  const handlePublish = useCallback(
    async (platform: string) => {
      setPublishingPlatform(platform);
      setPublishError(null);
      setPublishToast(null);
      try {
        const url = await shareFragment(fragmentId, params);
        const res = await fetch(`/api/social/${platform}/publish`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: url, caption: captionEnabled ? note : undefined }),
        });
        if (!res.ok) throw new Error('publish_failed');
        const data = (await res.json()) as { postUrl: string };
        setPublishToast({ platform, postUrl: data.postUrl });
        setTimeout(() => setPublishToast(null), 6000);
      } catch {
        setPublishError(t.shareCard.errorPublish);
      } finally {
        setPublishingPlatform(null);
      }
    },
    [fragmentId, params, captionEnabled, note, t],
  );

  const generate = useCallback(async (): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      return await shareFragment(fragmentId, params);
    } catch {
      setError(t.shareCard.errorGenerate);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fragmentId, params, t]);

  const handleDownload = useCallback(async () => {
    const url = await generate();
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `noetia-${selectedFormat}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError(t.shareCard.errorDownload);
    }
  }, [generate, selectedFormat, t]);

  const handleCopy = useCallback(async () => {
    const url = await generate();
    if (!url) return;
    await copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generate]);

  return (
    <>
      {/* Google Fonts */}
      <style>{`@import url('${GOOGLE_FONTS_URL}');`}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="presentation"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.shareCard.dialogAria}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
            <h3 className="text-sm font-semibold text-gray-900">{t.shareCard.title}</h3>
            <button onClick={onClose} aria-label={t.shareCard.close} className="text-gray-400 hover:text-gray-600">
              <XIcon aria-hidden="true" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* ── Live CSS Preview ──────────────────────────────────────── */}
            <div className={`relative w-full ${FORMAT_ASPECT[selectedFormat]} rounded-xl overflow-hidden shadow-md mx-auto max-w-[260px]`}>
              {/* Background layer(s) — mirrored independently so the quote text
                  stays upright. Photo backgrounds approximate the render's bgFit:
                  cover fills+crops, contain fits over a matte, blur fits over a
                  blurred zoom of itself. */}
              {imageActive ? (
                <div
                  className="absolute inset-0"
                  style={bgFlip ? { transform: 'scaleX(-1)' } : undefined}
                >
                  {bgFit === 'cover' ? (
                    <div className="absolute inset-0" style={{ background: `url("${bgImage}") center/cover` }} />
                  ) : bgFit === 'contain' ? (
                    <>
                      <div className="absolute inset-0 bg-gray-800" />
                      <div className="absolute inset-0" style={{ background: `url("${bgImage}") center/contain no-repeat` }} />
                    </>
                  ) : (
                    <>
                      <div
                        className="absolute inset-0"
                        style={{ background: `url("${bgImage}") center/cover`, filter: 'blur(8px) brightness(0.85)', transform: 'scale(1.15)' }}
                      />
                      <div className="absolute inset-0" style={{ background: `url("${bgImage}") center/contain no-repeat` }} />
                    </>
                  )}
                </div>
              ) : (
                <div className="absolute inset-0" style={{ background: previewBg }} />
              )}
              <div
                className="relative w-full h-full flex flex-col items-center justify-center p-4 gap-2"
                style={{ fontFamily: fontCss }}
              >
                <p
                  className="leading-snug line-clamp-6 w-full"
                  style={{
                    color: textColor,
                    fontSize: `${0.875 * textScale}rem`,
                    fontWeight: textBold ? 'bold' : 'normal',
                    fontStyle: textItalic ? 'italic' : 'normal',
                    textAlign,
                  }}
                >
                  "{editedText}"
                </p>
                <div
                  className="w-8 border-t mt-1"
                  style={{ borderColor: textColor, opacity: 0.4 }}
                />
                <p
                  className="text-center text-xs opacity-70"
                  style={{ color: textColor }}
                >
                  {[author, bookTitle].filter(Boolean).join(' · ')}
                </p>
                {citationEnabled && citationText && (
                  <p className="text-center text-[10px] opacity-50" style={{ color: textColor }}>
                    {citationText}
                  </p>
                )}
              </div>
            </div>

            {/* ── E1: Edit fragment text ───────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.shareCard.quoteText}</p>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:border-blue-400 transition"
                placeholder={t.shareCard.quotePlaceholder}
              />
              {textChanged && (
                <button
                  onClick={handleSaveText}
                  disabled={savingText}
                  className="mt-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 transition"
                >
                  {savingText ? t.shareCard.saving : t.shareCard.saveToLibrary}
                </button>
              )}
            </div>

            {/* ── E2: Citation location ─────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="citation-toggle"
                  checked={citationEnabled}
                  onChange={(e) => setCitationEnabled(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded"
                />
                <label htmlFor="citation-toggle" className="text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer">
                  {t.shareCard.includeCitation}
                </label>
              </div>
              {citationEnabled && (
                <input
                  type="text"
                  value={citationText}
                  onChange={(e) => setCitationText(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400 transition"
                  placeholder={isBible ? t.shareCard.citationBiblePlaceholder(bookTitle) : bookCollection ? t.shareCard.citationCollectionPlaceholder(bookCollection, bookTitle) : t.shareCard.citationPlaceholder(bookTitle)}
                />
              )}
            </div>

            {/* ── Format selection ──────────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.shareCard.format}</p>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value as ShareFormat)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400 bg-white"
              >
                {SHARE_FORMATS.map((fmt) => (
                  <option key={fmt} value={fmt}>{SHARE_FORMAT_LABELS[fmt]}</option>
                ))}
              </select>
            </div>

            {/* ── Font + Bold/Italic ────────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.shareCard.font}</p>
              <div className="flex items-center gap-2">
                {/* Custom font dropdown — shows sample text in each font */}
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => setFontMenuOpen((v) => !v)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-left bg-white flex items-center justify-between hover:border-blue-300 transition"
                  >
                    <div>
                      <span className="text-xs text-gray-400 block leading-none mb-0.5">
                        {FONTS.find((f) => f.id === selectedFont)?.label}
                      </span>
                      <span
                        className="text-sm text-gray-800 leading-none"
                        style={{ fontFamily: fontCss }}
                      >
                        {t.shareCard.fontSample}
                      </span>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {fontMenuOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                      {FONTS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => { setSelectedFont(f.id as FontId); setFontMenuOpen(false); }}
                          className={`w-full text-left px-3 py-2.5 hover:bg-blue-50 transition border-b border-gray-100 last:border-0 ${selectedFont === f.id ? 'bg-blue-50' : ''}`}
                        >
                          <span className="text-[10px] text-gray-400 block leading-none mb-0.5">{f.label}</span>
                          <span className="text-sm text-gray-800" style={{ fontFamily: f.css }}>
                            {t.shareCard.fontSample}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setTextBold((v) => !v)}
                  title={t.shareCard.bold}
                  className={`w-9 h-9 flex-shrink-0 rounded-xl border text-sm font-bold transition ${textBold ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
                >B</button>
                <button
                  onClick={() => setTextItalic((v) => !v)}
                  title={t.shareCard.italic}
                  className={`w-9 h-9 flex-shrink-0 rounded-xl border text-sm italic transition ${textItalic ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
                ><em>I</em></button>

                {/* Text alignment */}
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setTextAlign(a)}
                    title={t.shareCard.align[a]}
                    aria-label={t.shareCard.align[a]}
                    aria-pressed={textAlign === a}
                    className={`w-9 h-9 flex-shrink-0 rounded-xl border flex items-center justify-center transition ${textAlign === a ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      {a === 'left' && <><path d="M4 6h16M4 12h10M4 18h13" /></>}
                      {a === 'center' && <><path d="M4 6h16M7 12h10M6 18h12" /></>}
                      {a === 'right' && <><path d="M4 6h16M10 12h10M7 18h13" /></>}
                    </svg>
                  </button>
                ))}
              </div>

              {/* Quote text size (S/M/L) */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500 flex-1">{t.shareCard.textSize.label}</span>
                {TEXT_SIZES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setTextScale(s.scale)}
                    title={t.shareCard.textSize[s.id]}
                    aria-label={t.shareCard.textSize[s.id]}
                    aria-pressed={textScale === s.scale}
                    className={`w-9 h-9 flex-shrink-0 rounded-xl border text-sm font-semibold transition ${textScale === s.scale ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
                  >
                    {s.id}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Background (D3 hex inputs, D4 directions, D7 images) ── */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.shareCard.background}</p>

              {/* Type tabs */}
              <div className="flex gap-2 mb-3">
                {(['solid', 'gradient', 'image'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setBgType(type)}
                    className={`flex-1 text-xs py-1.5 rounded-lg border transition ${
                      bgType === type
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                        : 'border-gray-200 text-gray-600 hover:border-blue-200'
                    }`}
                  >
                    {type === 'solid' ? t.shareCard.bgSolid : type === 'gradient' ? t.shareCard.bgGradient : t.shareCard.bgImage}
                  </button>
                ))}
              </div>

              {/* Solid/Gradient color pickers with hex inputs (D3) */}
              {bgType !== 'image' && (
                <div className="flex flex-wrap gap-3 mb-3">
                  <ColorPicker
                    label={bgType === 'gradient' ? t.shareCard.color1 : t.shareCard.color}
                    value={bgColors[0]}
                    onChange={(v) => setBgColors([v, bgColors[1]])}
                  />
                  {bgType === 'gradient' && (
                    <ColorPicker
                      label={t.shareCard.color2}
                      value={bgColors[1]}
                      onChange={(v) => setBgColors([bgColors[0], v])}
                    />
                  )}
                </div>
              )}

              {/* D4 — Gradient direction 3×3 grid */}
              {bgType === 'gradient' && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">{t.shareCard.gradientDirection}</p>
                  <div className="grid grid-cols-3 gap-1 w-28">
                    {GRADIENT_DIRS.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setGradientDir(d.id)}
                        title={d.id}
                        className={`w-8 h-8 rounded-lg border text-base transition flex items-center justify-center ${
                          gradientDir === d.id
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-200 text-gray-600 hover:border-blue-300'
                        }`}
                      >
                        {d.icon}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* D7 — Image presets + upload */}
              {bgType === 'image' && (
                <div>
                  <div className="grid grid-cols-3 gap-2">
                    {BG_PRESETS.map((url, i) => (
                      <button
                        key={url}
                        onClick={() => handleSelectPreset(url)}
                        disabled={bgImageLoading}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition ${
                          bgImage && !bgImage.startsWith('data:image') && bgImage === url
                            ? 'border-blue-500'
                            : 'border-transparent hover:border-blue-300'
                        }`}
                      >
                        <img src={url} alt={t.shareCard.presetAlt(i + 1)} className="w-full h-full object-cover" />
                      </button>
                    ))}

                    {/* Upload from folder */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={bgImageLoading}
                      className="aspect-square rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-blue-500 transition disabled:opacity-50"
                    >
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
                      </svg>
                      <span className="text-[10px] font-medium">{t.shareCard.uploadImage}</span>
                    </button>

                    {/* Camera capture */}
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={bgImageLoading}
                      className="aspect-square rounded-xl border-2 border-dashed border-gray-300 hover:border-green-400 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-green-500 transition disabled:opacity-50"
                    >
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                      </svg>
                      <span className="text-[10px] font-medium">{t.shareCard.camera}</span>
                    </button>
                  </div>

                  {/* File inputs — hidden */}
                  <input
                    id={fileInputId}
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  {bgImageLoading && (
                    <p className="text-xs text-blue-500 mt-2 text-center">{t.shareCard.loadingImage}</p>
                  )}
                  {bgImage && !bgImageLoading && (
                    <button
                      onClick={() => setBgImage(null)}
                      className="mt-2 text-xs text-gray-400 hover:text-red-500 transition"
                    >
                      {t.shareCard.removeImage}
                    </button>
                  )}

                  {/* Image fit — photo backgrounds only */}
                  {imageActive && (
                    <div className="mt-3">
                      <span className="text-sm text-gray-700">{t.shareCard.fit.label}</span>
                      <div
                        role="radiogroup"
                        aria-label={t.shareCard.fit.aria}
                        className="mt-1.5 flex items-center gap-1 bg-gray-100 rounded-lg p-1"
                      >
                        {(['blur', 'contain', 'cover'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            role="radio"
                            aria-checked={bgFit === mode}
                            onClick={() => setBgFit(mode)}
                            className={[
                              'flex-1 text-xs font-medium py-1.5 rounded-md transition',
                              bgFit === mode
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-800',
                            ].join(' ')}
                          >
                            {t.shareCard.fit[mode]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Flip (mirror) — image backgrounds only */}
                  {imageActive && (
                    <label className="mt-3 flex items-center justify-between gap-3 cursor-pointer">
                      <span className="text-sm text-gray-700">{t.shareCard.flip}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={bgFlip}
                        aria-label={t.shareCard.flipAria}
                        onClick={() => setBgFlip((v) => !v)}
                        className={[
                          'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
                          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                          bgFlip ? 'bg-blue-600' : 'bg-gray-200',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
                            bgFlip ? 'translate-x-5' : 'translate-x-0',
                          ].join(' ')}
                        />
                      </button>
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* ── Text color picker (D3 hex input) ────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.shareCard.textColor}</p>
              <div className="flex items-center gap-3">
                <ColorPicker
                  label=""
                  value={textColor}
                  onChange={(v) => setTextColorOverride(v)}
                />
                {textColorOverride && (
                  <button onClick={() => setTextColorOverride(null)} className="text-xs text-blue-500 hover:underline">
                    {t.shareCard.reset}
                  </button>
                )}
              </div>
            </div>

            {/* ── Caption ──────────────────────────────────────────────── */}
            {note && (
              <div className="border border-gray-100 rounded-xl p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={captionEnabled}
                    onChange={(e) => setCaptionEnabled(e.target.checked)}
                    className="accent-blue-600"
                  />
                  <span className="text-xs font-medium text-gray-700">{t.shareCard.useAsCaption}</span>
                </label>
                {captionEnabled && (
                  <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 leading-snug">{note}</p>
                )}
              </div>
            )}

            {/* ── Error ────────────────────────────────────────────────── */}
            {error && (
              <p className="text-xs text-red-500 text-center">{error}</p>
            )}

            {/* ── Actions ──────────────────────────────────────────────── */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleDownload}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition"
              >
                {loading ? <SpinnerIcon /> : <DownloadIcon />}
                {t.shareCard.download}
              </button>
              <button
                onClick={handleCopy}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-medium py-2.5 rounded-xl transition"
              >
                {loading ? <SpinnerIcon /> : <CopyIcon />}
                {copied ? t.shareCard.copied : t.shareCard.copyLink}
              </button>
            </div>

            {/* ── Social publish ────────────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.shareCard.publish}</p>
              <div className="space-y-2">
                {(['linkedin', 'facebook', 'instagram', 'pinterest'] as const).map((platform) => {
                  const connected = connectedPlatforms.has(platform);
                  const isPublishing = publishingPlatform === platform;
                  const igDisabled = platform === 'instagram' && process.env.NEXT_PUBLIC_INSTAGRAM_PUBLISH_ENABLED !== 'true';
                  const label = platform.charAt(0).toUpperCase() + platform.slice(1);
                  return (
                    <div key={platform} className="flex items-center gap-3">
                      <span className="w-20 text-xs text-gray-600 capitalize">{label}</span>
                      {connected ? (
                        <button
                          onClick={() => handlePublish(platform)}
                          disabled={isPublishing || igDisabled}
                          title={igDisabled ? t.shareCard.pendingApproval : undefined}
                          className="flex-1 text-xs py-1.5 rounded-lg border border-green-400 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 transition"
                        >
                          {isPublishing ? <SpinnerIcon /> : t.shareCard.shareNow}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConnect(platform)}
                          className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50 transition"
                        >
                          {t.shareCard.connectAccount}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {publishError && <p className="text-xs text-red-500 mt-2">{publishError}</p>}
              {publishToast && (
                <p className="text-xs text-green-700 mt-2">
                  {t.shareCard.publishedOn(publishToast.platform.charAt(0).toUpperCase() + publishToast.platform.slice(1))}{' '}
                  <a href={publishToast.postUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    {t.shareCard.viewPost}
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

    </>
  );
}

// ── ColorPicker — color wheel + hex text input (D3) ──────────────────────────

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [hex, setHex] = useState(value);

  // Keep local hex in sync when parent value changes (e.g. reset)
  if (hex !== value && !hex.startsWith('#') || hex.length === 7 && hex !== value) {
    // deliberate no-op to avoid render loops; see hex onChange handler
  }

  function handleHexInput(raw: string) {
    const v = raw.startsWith('#') ? raw : '#' + raw;
    setHex(v);
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange(v);
  }

  function handleColorWheel(v: string) {
    setHex(v);
    onChange(v);
  }

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-gray-600 w-14 flex-shrink-0">{label}</span>}
      <input
        type="color"
        value={value}
        onChange={(e) => handleColorWheel(e.target.value)}
        className="w-8 h-8 rounded cursor-pointer border border-gray-200 flex-shrink-0"
      />
      <input
        type="text"
        value={hex !== value ? hex : value}
        onChange={(e) => handleHexInput(e.target.value)}
        onBlur={() => setHex(value)}
        maxLength={7}
        className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-400"
        placeholder="#000000"
      />
    </div>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
