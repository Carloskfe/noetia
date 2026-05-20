import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation, type Language } from '../i18n';

interface Props {
  onSelect: () => void;
}

const OPTIONS: Array<{ lang: Language; flag: string; label: string; sublabel: string }> = [
  { lang: 'es', flag: '🌎', label: 'ES Latam', sublabel: 'Latin America' },
  { lang: 'en', flag: '🇺🇸', label: 'English', sublabel: 'Inglés' },
];

export function LanguageScreen({ onSelect }: Props) {
  const { setLanguage, t } = useTranslation();
  const [selected, setSelected] = useState<Language>('es');

  async function handleContinue() {
    await setLanguage(selected);
    onSelect();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Noetia</Text>
      <Text style={styles.title}>{t.lang.pick}</Text>
      <Text style={styles.subtitle}>{t.lang.subtitle}</Text>

      <View style={styles.options}>
        {OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.lang}
            style={[styles.option, selected === opt.lang && styles.optionSelected]}
            onPress={() => setSelected(opt.lang)}
            accessibilityLabel={opt.label}
          >
            <Text style={styles.flag}>{opt.flag}</Text>
            <View style={styles.optionText}>
              <Text style={[styles.optionLabel, selected === opt.lang && styles.optionLabelSelected]}>
                {opt.label}
              </Text>
              <Text style={styles.optionSublabel}>{opt.sublabel}</Text>
            </View>
            {selected === opt.lang && <Text style={styles.check}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.btn} onPress={handleContinue} accessibilityLabel={t.lang.continue}>
        <Text style={styles.btnText}>{t.lang.continue}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 28 },
  logo:               { fontSize: 38, fontWeight: '800', color: '#0D1B2A', marginBottom: 32 },
  title:              { fontSize: 22, fontWeight: '700', color: '#0D1B2A', marginBottom: 8, textAlign: 'center' },
  subtitle:           { fontSize: 14, color: '#6B7280', marginBottom: 40, textAlign: 'center' },
  options:            { width: '100%', gap: 12, marginBottom: 40 },
  option:             { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 14, padding: 18, backgroundColor: '#fff' },
  optionSelected:     { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  flag:               { fontSize: 32, marginRight: 16 },
  optionText:         { flex: 1 },
  optionLabel:        { fontSize: 17, fontWeight: '600', color: '#374151' },
  optionLabelSelected:{ color: '#4F46E5' },
  optionSublabel:     { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  check:              { fontSize: 18, color: '#4F46E5', fontWeight: '700' },
  btn:                { width: '100%', backgroundColor: '#0D1B2A', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnText:            { color: '#fff', fontSize: 16, fontWeight: '700' },
});
