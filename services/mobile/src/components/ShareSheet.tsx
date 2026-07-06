import React, { useState } from 'react';
import {
  ActivityIndicator, Image, Linking, Modal, ScrollView, Share,
  StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { apiClient } from '../api/client';
import { useTranslation } from '../i18n';
import { BG_PRESETS, buildSharePayload, Platform } from '../lib/share-backgrounds';

const PLATFORMS: Array<{ id: Platform; color: string; icon: string }> = [
  { id: 'instagram', color: '#E1306C', icon: '📸' },
  { id: 'facebook', color: '#1877F2', icon: '👥' },
  { id: 'linkedin', color: '#0A66C2', icon: '💼' },
  { id: 'pinterest', color: '#E60023', icon: '📌' },
];

interface Props {
  fragmentId: string;
  fragmentText: string;
  visible: boolean;
  onClose: () => void;
}

export function ShareSheet({ fragmentId, fragmentText, visible, onClose }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Platform | null>(null);
  const [presetIdx, setPresetIdx] = useState<number | null>(null);
  const [flip, setFlip] = useState(false);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isImageBg = presetIdx !== null;

  function reset() {
    setSelected(null);
    setPresetIdx(null);
    setFlip(false);
    setBold(false);
    setItalic(false);
    setImageUrl(null);
    setLoading(false);
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleGenerate() {
    if (!selected) return;
    setLoading(true);
    setError('');
    setImageUrl(null);
    try {
      const payload = buildSharePayload(
        selected,
        {
          type: presetIdx !== null ? 'preset' : 'default',
          presetUrl: presetIdx !== null ? BG_PRESETS[presetIdx] : undefined,
          flip,
        },
        { bold, italic },
      );
      const res = await apiClient.post<{ url: string }>(`/fragments/${fragmentId}/share`, payload);
      setImageUrl(res.url);
    } catch {
      setError(t.sharing.error);
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    if (!imageUrl) return;
    try {
      await Share.share({ url: imageUrl, message: fragmentText });
    } catch {}
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <Text style={styles.title}>{t.sharing.title}</Text>

            <Text style={styles.preview} numberOfLines={3}>{fragmentText}</Text>

            {/* Platform selector */}
            {!imageUrl && (
              <>
                <Text style={styles.sectionLabel}>{t.sharing.selectPlatform}</Text>
                <View style={styles.platforms}>
                  {PLATFORMS.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.platformBtn, selected === p.id && { borderColor: p.color, borderWidth: 2 }]}
                      onPress={() => setSelected(p.id)}
                    >
                      <Text style={styles.platformIcon}>{p.icon}</Text>
                      <Text style={[styles.platformLabel, selected === p.id && { color: p.color, fontWeight: '700' }]}>
                        {t.sharing.platforms[p.id]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Background picker: default gradient + 18 Noetia presets */}
                <Text style={styles.sectionLabel}>{t.sharing.background}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.bgRow}
                >
                  <TouchableOpacity
                    style={[styles.bgDefault, !isImageBg && styles.bgSelected]}
                    onPress={() => setPresetIdx(null)}
                  >
                    <Text style={styles.bgDefaultText} numberOfLines={1}>{t.sharing.bgDefault}</Text>
                  </TouchableOpacity>
                  {BG_PRESETS.map((url, i) => (
                    <TouchableOpacity
                      key={url}
                      style={[styles.bgThumb, presetIdx === i && styles.bgSelected]}
                      onPress={() => setPresetIdx(i)}
                    >
                      <Image source={{ uri: url }} style={styles.bgThumbImg} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Mirror toggle — image backgrounds only */}
                {isImageBg && (
                  <View style={styles.flipRow}>
                    <Text style={styles.flipLabel}>{t.sharing.flip}</Text>
                    <Switch
                      value={flip}
                      onValueChange={setFlip}
                      accessibilityLabel={t.sharing.flipAria}
                      trackColor={{ true: '#0D1B2A', false: '#E5E7EB' }}
                    />
                  </View>
                )}

                {/* Text style — bold / italic */}
                <Text style={styles.sectionLabel}>{t.sharing.textStyle}</Text>
                <View style={styles.styleRow}>
                  <TouchableOpacity
                    style={[styles.styleBtn, bold && styles.styleBtnActive]}
                    onPress={() => setBold((v) => !v)}
                    accessibilityLabel={t.sharing.bold}
                    accessibilityState={{ selected: bold }}
                  >
                    <Text style={[styles.styleBtnText, { fontWeight: '700' }, bold && styles.styleBtnTextActive]}>
                      {t.sharing.bold}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.styleBtn, italic && styles.styleBtnActive]}
                    onPress={() => setItalic((v) => !v)}
                    accessibilityLabel={t.sharing.italic}
                    accessibilityState={{ selected: italic }}
                  >
                    <Text style={[styles.styleBtnText, { fontStyle: 'italic' }, italic && styles.styleBtnTextActive]}>
                      {t.sharing.italic}
                    </Text>
                  </TouchableOpacity>
                </View>

                {error !== '' && <Text style={styles.error}>{error}</Text>}

                <TouchableOpacity
                  style={[styles.generateBtn, (!selected || loading) && styles.generateBtnDisabled]}
                  onPress={handleGenerate}
                  disabled={!selected || loading}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.generateBtnText}>
                        {loading ? t.sharing.generating : t.sharing.generate}
                      </Text>}
                </TouchableOpacity>
              </>
            )}

            {/* Result */}
            {imageUrl && (
              <View style={styles.result}>
                <Text style={styles.resultCheck}>✓</Text>
                <Text style={styles.resultLabel}>{t.sharing.platforms[selected!]}</Text>

                <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                  <Text style={styles.actionBtnText}>📤 {t.sharing.shareLink}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={() => Linking.openURL(imageUrl)}>
                  <Text style={styles.actionBtnSecondaryText}>🖼️ {t.sharing.openImage}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.tryAgainBtn} onPress={reset}>
                  <Text style={styles.tryAgainText}>{t.sharing.tryAgain}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:             { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:               { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle:              { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:               { fontSize: 18, fontWeight: '700', color: '#0D1B2A', marginBottom: 12 },
  preview:             { fontSize: 13, color: '#6B7280', fontStyle: 'italic', lineHeight: 19, marginBottom: 20, borderLeftWidth: 3, borderLeftColor: '#E5E7EB', paddingLeft: 10 },
  sectionLabel:        { fontSize: 12, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  platforms:           { flexDirection: 'row', gap: 10, marginBottom: 20 },
  bgRow:               { gap: 8, paddingRight: 8, marginBottom: 16 },
  bgDefault:           { width: 52, height: 52, borderRadius: 10, borderWidth: 2, borderColor: '#E5E7EB', backgroundColor: '#0D1B2A', alignItems: 'center', justifyContent: 'center', padding: 4 },
  bgDefaultText:       { color: '#fff', fontSize: 9, fontWeight: '600', textAlign: 'center' },
  bgThumb:             { width: 52, height: 52, borderRadius: 10, borderWidth: 2, borderColor: '#E5E7EB', overflow: 'hidden' },
  bgThumbImg:          { width: '100%', height: '100%' },
  bgSelected:          { borderColor: '#0D1B2A' },
  flipRow:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  flipLabel:           { fontSize: 14, color: '#374151' },
  styleRow:            { flexDirection: 'row', gap: 10, marginBottom: 20 },
  styleBtn:            { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  styleBtnActive:      { borderColor: '#0D1B2A', backgroundColor: '#0D1B2A' },
  styleBtnText:        { fontSize: 15, color: '#374151' },
  styleBtnTextActive:  { color: '#fff' },
  platformBtn:         { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  platformIcon:        { fontSize: 22, marginBottom: 4 },
  platformLabel:       { fontSize: 11, color: '#374151', fontWeight: '500' },
  error:               { fontSize: 13, color: '#EF4444', marginBottom: 12, textAlign: 'center' },
  generateBtn:         { backgroundColor: '#0D1B2A', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  generateBtnDisabled: { opacity: 0.4 },
  generateBtnText:     { color: '#fff', fontSize: 16, fontWeight: '600' },
  result:              { alignItems: 'center', paddingTop: 8 },
  resultCheck:         { fontSize: 40, marginBottom: 4 },
  resultLabel:         { fontSize: 16, fontWeight: '600', color: '#0D1B2A', marginBottom: 20 },
  actionBtn:           { width: '100%', backgroundColor: '#0D1B2A', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  actionBtnText:       { color: '#fff', fontSize: 15, fontWeight: '600' },
  actionBtnSecondary:  { backgroundColor: '#F3F4F6' },
  actionBtnSecondaryText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  tryAgainBtn:         { marginTop: 8, padding: 10 },
  tryAgainText:        { color: '#9CA3AF', fontSize: 14 },
});
