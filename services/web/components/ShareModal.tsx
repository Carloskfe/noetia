'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
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

// ── Format aspect ratios ──────────────────────────────────────────────────────

const FORMAT_ASPECT: Record<ShareFormat, string> = {
  'ig-post':      'aspect-square',
  'ig-story':     'aspect-[9/16]',
  'fb-post':      'aspect-video',
  'fb-story':     'aspect-[9/16]',
  'li-post':      'aspect-video',
  'wa-pic':       'aspect-square',
  'wa-story':     'aspect-[9/16]',
  'reel':         'aspect-[9/16]',
  'twitter-card': 'aspect-[16/9]',
};

const SHARE_FORMATS = Object.keys(FORMAT_PLATFORM_MAP) as ShareFormat[];

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  fragmentId: string;
  fragmentText: string;
  author: string;
  bookTitle: string;
  note: string | null;
  onClose: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ShareModal({
  fragmentId, fragmentText, author, bookTitle, note, onClose,
}: Props) {
  const [selectedFormat, setSelectedFormat] = useState<ShareFormat>('ig-post');
  const [selectedFont, setSelectedFont] = useState<FontId>('lato');
  const [bgType, setBgType] = useState<'solid' | 'gradient'>('solid');
  const [bgColors, setBgColors] = useState<[string, string]>(['#0D1B2A', '#1A4A4A']);
  const [textColorOverride, setTextColorOverride] = useState<string | null>(null);
  const [captionEnabled, setCaptionEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [connectedPlatforms, setConnectedPlatforms] = useState<Set<string>>(new Set());
  const [publishingPlatform, setPublishingPlatform] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishToast, setPublishToast] = useState<{ platform: string; postUrl: string } | null>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);

  const activeBgColors = bgType === 'gradient' ? [bgColors[0], bgColors[1]] : [bgColors[0]];
  const autoTextColor = getTextColor(activeBgColors);
  const textColor = textColorOverride ?? autoTextColor;
  const fontCss = FONTS.find((f) => f.id === selectedFont)?.css ?? "'Lato', sans-serif";

  const previewBg = bgType === 'gradient'
    ? `linear-gradient(to bottom, ${bgColors[0]}, ${bgColors[1]})`
    : bgColors[0];

  const params: ShareParams = {
    format: selectedFormat,
    font: selectedFont,
    bgType,
    bgColors: activeBgColors,
    ...(textColorOverride ? { textColor: textColorOverride } : {}),
  };

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
        setPublishError('No se pudo publicar. Intenta de nuevo.');
      } finally {
        setPublishingPlatform(null);
      }
    },
    [fragmentId, params, captionEnabled, note],
  );

  const generate = useCallback(async (): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      return await shareFragment(fragmentId, params);
    } catch {
      setError('No se pudo generar la imagen');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fragmentId, params]);

  const handleDownload = useCallback(async () => {
    const url = await generate();
    if (!url) return;
    const a = downloadRef.current!;
    a.href = url;
    a.download = `noetia-\${selectedFormat}.png`;
    a.click();
  }, [generate, selectedFormat]);

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
      <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
            <h3 className="text-sm font-semibold text-gray-900">Crear tarjeta</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XIcon />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* ── Live CSS Preview ──────────────────────────────────────── */}
            <div className={`w-full ${FORMAT_ASPECT[selectedFormat]} rounded-xl overflow-hidden shadow-md mx-auto max-w-[260px]`}>
              <div
                className="w-full h-full flex flex-col items-center justify-center p-4 gap-2"
                style={{ background: previewBg, fontFamily: fontCss }}
              >
                <p
                  className="text-center text-sm leading-snug font-medium line-clamp-6"
                  style={{ color: textColor }}
                >
                  "{fragmentText}"
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
              </div>
            </div>

            {/* ── Format selection ──────────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Formato</p>
              <div className="grid grid-cols-3 gap-1.5">
                {SHARE_FORMATS.map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setSelectedFormat(fmt)}
                    className={[
                      'text-xs py-2 px-1 rounded-lg border transition font-medium',
                      selectedFormat === fmt
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50',
                    ].join(' ')}
                  >
                    {SHARE_FORMAT_LABELS[fmt]}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Font picker ───────────────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fuente</p>
              <div className="space-y-1">
                {FONTS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFont(f.id as FontId)}
                    className={[
                      'w-full text-left px-3 py-2 rounded-xl border transition',
                      selectedFont === f.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    <p style={{ fontFamily: f.css }} className="text-sm font-medium text-gray-900 leading-snug">
                      {f.label}
                    </p>
                    <p style={{ fontFamily: f.css }} className="text-xs text-gray-400 leading-snug">
                      El inicio de algo grande
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Background ───────────────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fondo</p>
              <div className="flex gap-2 mb-3">
                {(['solid', 'gradient'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setBgType(type)}
                    className={[
                      'flex-1 text-xs py-1.5 rounded-lg border transition',
                      bgType === type
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                        : 'border-gray-200 text-gray-600 hover:border-blue-200',
                    ].join(' ')}
                  >
                    {type === 'solid' ? 'Sólido' : 'Degradado'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span>{bgType === 'gradient' ? 'Color 1' : 'Color'}</span>
                  <input
                    type="color"
                    value={bgColors[0]}
                    onChange={(e) => setBgColors([e.target.value, bgColors[1]])}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                  />
                </label>
                {bgType === 'gradient' && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span>Color 2</span>
                    <input
                      type="color"
                      value={bgColors[1]}
                      onChange={(e) => setBgColors([bgColors[0], e.target.value])}
                      className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* ── Text color picker ────────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Color del texto</p>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColorOverride(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                  />
                  <span>{textColor.toUpperCase()}</span>
                </label>
                {textColorOverride && (
                  <button
                    onClick={() => setTextColorOverride(null)}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    Restablecer
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
                  <span className="text-xs font-medium text-gray-700">Usar como comentario</span>
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
                Descargar
              </button>
              <button
                onClick={handleCopy}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-medium py-2.5 rounded-xl transition"
              >
                {loading ? <SpinnerIcon /> : <CopyIcon />}
                {copied ? '¡Copiado!' : 'Copiar enlace'}
              </button>
            </div>

            {/* ── Social publish ────────────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Publicar</p>
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
                          title={igDisabled ? 'Pendiente aprobación' : undefined}
                          className="flex-1 text-xs py-1.5 rounded-lg border border-green-400 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 transition"
                        >
                          {isPublishing ? <SpinnerIcon /> : 'Compartir ahora'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConnect(platform)}
                          className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50 transition"
                        >
                          Conectar cuenta
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {publishError && <p className="text-xs text-red-500 mt-2">{publishError}</p>}
              {publishToast && (
                <p className="text-xs text-green-700 mt-2">
                  ¡Publicado en {publishToast.platform.charAt(0).toUpperCase() + publishToast.platform.slice(1)}!{' '}
                  <a href={publishToast.postUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    Ver publicación
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden download anchor */}
      {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
      <a ref={downloadRef} className="hidden" />
    </>
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
