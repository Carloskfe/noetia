import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from '../i18n';
import { dismissTour } from '../offline/tour-storage';
import { useTour } from './TourContext';

const SLIDES = [
  { icon: '📚' as const, key: 'welcome' as const },
  { icon: '📖' as const, key: 'library' as const },
  { icon: '✨' as const, key: 'reader' as const },
  { icon: '🎧' as const, key: 'audio' as const },
  { icon: '💡' as const, key: 'fragments' as const },
  { icon: '🤝' as const, key: 'clubs' as const },
];

export function OnboardingTour() {
  const { t } = useTranslation();
  const { tourVisible, dismissTourUI } = useTour();
  const [step, setStep] = useState(0);
  const [dismissing, setDismissing] = useState(false);

  async function handleDismiss() {
    if (dismissing) return;
    await dismissTour();
    setDismissing(true);
    setTimeout(() => {
      dismissTourUI();
      setStep(0);
      setDismissing(false);
    }, 2500);
  }

  function handleNext() {
    if (step < SLIDES.length - 1) {
      setStep((s) => s + 1);
    } else {
      handleDismiss();
    }
  }

  if (!tourVisible) return null;

  if (dismissing) {
    return (
      <Modal visible transparent animationType="fade" statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={[styles.card, styles.cardCenter]}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.dismissMsg}>{t.tour.dismissedMsg}</Text>
          </View>
        </View>
      </Modal>
    );
  }

  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];
  const slideT = t.tour.slides[slide.key];

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Text style={styles.slideIcon}>{slide.icon}</Text>
          </View>

          <Text style={styles.slideTitle}>{slideT.title}</Text>
          <Text style={styles.slideBody}>{slideT.body}</Text>

          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
            ))}
          </View>

          <TouchableOpacity style={styles.nextBtn} onPress={handleNext} accessibilityRole="button">
            <Text style={styles.nextBtnText}>{isLast ? t.tour.done : t.tour.next}</Text>
          </TouchableOpacity>

          {!isLast && (
            <TouchableOpacity onPress={handleDismiss} style={styles.skipBtn} accessibilityRole="button">
              <Text style={styles.skipText}>{t.tour.skip}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card:        { backgroundColor: '#fff', borderRadius: 20, padding: 32, width: '100%', alignItems: 'center' },
  cardCenter:  { justifyContent: 'center', minHeight: 200 },
  iconWrap:    { width: 88, height: 88, borderRadius: 44, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  slideIcon:   { fontSize: 44 },
  slideTitle:  { fontSize: 22, fontWeight: '800', color: '#0D1B2A', textAlign: 'center', marginBottom: 12 },
  slideBody:   { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 23, marginBottom: 28 },
  dots:        { flexDirection: 'row', gap: 6, marginBottom: 24, alignItems: 'center' },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },
  dotActive:   { backgroundColor: '#4F46E5', width: 20, borderRadius: 4 },
  nextBtn:     { backgroundColor: '#4F46E5', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginBottom: 12 },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipBtn:     { paddingVertical: 8 },
  skipText:    { color: '#9CA3AF', fontSize: 14 },
  checkIcon:   { fontSize: 52, marginBottom: 16, color: '#4F46E5' },
  dismissMsg:  { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
});
