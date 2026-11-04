// Quotation cases verified against the CC0 fixture (NEM-016 report §15.2).
export const FIXTURE_FILE = 'docs/staging/fixtures/nem-016-quote-fixture.txt';
export const FIXTURE_TITLE = 'Cuaderno de pruebas de citas (NEM-016)';
export const FIXTURE_AUTHOR = 'Equipo Noetia (texto sintético, CC0)';

/** The sentence fragment fA holds; Q4–Q6 and N4–N9 are cut from the fixture around it. */
export const SOURCE_SENTENCE = 'La lectora abrió el cuaderno otra vez y lo cerró de golpe, satisfecha con lo aprendido.';

const Q4 = 'La lectora abrió el cuaderno otra vez […] satisfecha con lo aprendido.';

export const POSITIVE = Object.freeze({
  Q1: { text: 'leyó despacio cada línea', spans: 1 },
  Q2: { text: '«La lectora abrió el cuaderno al amanecer.»', spans: 1 },
  Q3: { text: '¿Esperas… qué?', spans: 1 },
  Q4: { text: Q4, spans: 2 },
  Q5: { text: 'La lectora abrió el cuaderno otra vez [...] satisfecha con lo aprendido.', spans: 2 },
  Q6: { text: 'La lectora abrió el cuaderno […] lo cerró de golpe', spans: 2 },
});

export const NEGATIVE = Object.freeze({
  N1: { text: 'leyó rápido cada línea', reason: 'not_in_source' },
  N2: { text: 'leyó despacio cada línea?', reason: 'not_in_source' },
  N3: { text: 'La lectora leyó todo el cuaderno', reason: 'not_in_source' },
  N4: { text: 'La lectora abrió el cuaderno otra vez … satisfecha con lo aprendido.', reason: 'omission_marker_required' },
  N5: { text: 'La lectora abrió el cuaderno al amanecer […] cada frase tenía su propio peso.', reason: 'omission_may_distort' },
  N6: { text: 'The reader opened the notebook at dawn […] close it again until the evening', reason: 'omission_may_distort' },
  N7: { text: 'satisfecha con lo aprendido. […] La lectora abrió el cuaderno otra vez', reason: 'not_in_source' },
  N8: { text: 'La lectora […] golpe […] peso', reason: 'segment_too_short' },
  N9: { text: 'La lectora abrió el cuaderno otra vez (…) satisfecha con lo aprendido.', reason: 'not_in_source' },
});

export const TINY_PNG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/** A7: refused by the API; none of these are ever fetched by the harness. */
export const UNSAFE_BACKGROUNDS = Object.freeze([
  'http://noetia.app/backgrounds/imagen-1.jpg',
  'https://staging.noetia.app/admin',
  'http://api:4000/health',
  'http://169.254.169.254/',
  'file:///etc/passwd',
  'data:image/svg+xml;base64,PHN2Zz4=',
]);
