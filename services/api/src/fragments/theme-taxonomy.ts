export type Theme =
  | 'amor'
  | 'aventura'
  | 'belleza'
  | 'conocimiento'
  | 'destino'
  | 'familia'
  | 'fe'
  | 'filosofia'
  | 'heroismo'
  | 'humanidad'
  | 'identidad'
  | 'justicia'
  | 'libertad'
  | 'muerte'
  | 'naturaleza'
  | 'poder'
  | 'sufrimiento'
  | 'tiempo'
  | 'amistad'
  | 'espiritualidad';

/**
 * Keyword lists per theme. Matching is case-insensitive substring search on
 * the full fragment text. Keywords are in Spanish; short common words are
 * intentionally avoided to reduce false positives.
 */
export const THEME_KEYWORDS: Record<Theme, string[]> = {
  amor: [
    'amor', 'amada', 'amado', 'amar', 'enamorado', 'enamorada', 'corazón',
    'pasión', 'ternura', 'cariño', 'beso', 'besar', 'amante', 'querer',
    'querida', 'adorar', 'sentimiento', 'romance',
  ],
  aventura: [
    'viaje', 'navegación', 'navegar', 'expedición', 'explorar', 'descubrir',
    'camino', 'travesía', 'partida', 'zarpar', 'empresa', 'hazaña', 'odisea',
    'peregrinación', 'errante', 'peregrino',
  ],
  belleza: [
    'belleza', 'bello', 'hermoso', 'hermosa', 'sublime', 'elegancia', 'esplendor',
    'gracia', 'proporción', 'armonía', 'magnificencia', 'poesía', 'estética',
    'contemplar', 'deleite',
  ],
  conocimiento: [
    'saber', 'conocer', 'aprender', 'sabiduría', 'inteligencia', 'razón',
    'ciencia', 'estudio', 'educación', 'entender', 'comprender', 'libros',
    'lectura', 'ignorancia', 'verdad', 'mente', 'pensamiento',
  ],
  destino: [
    'destino', 'hado', 'fatalidad', 'fortuna', 'suerte', 'predestinado',
    'inevitable', 'sino', 'voluntad de los dioses', 'providencia',
    'inexorable', 'azar',
  ],
  familia: [
    'familia', 'padre', 'madre', 'hijo', 'hija', 'hogar', 'patria',
    'linaje', 'herencia', 'ancestros', 'progenitor', 'esposa', 'esposo',
    'matrimonio', 'sangre', 'raíces',
  ],
  fe: [
    'dios', 'oración', 'rezar', 'templo', 'sagrado', 'divino', 'creencia',
    'bendición', 'gracia divina', 'salvación', 'profeta', 'señor', 'cielo',
    'paraíso', 'pecado', 'redención',
  ],
  filosofia: [
    'virtud', 'bien supremo', 'ética', 'alma', 'espíritu', 'naturaleza humana',
    'voluntad', 'contemplación', 'sabiduría', 'logos', 'esencia', 'ser',
    'existencia', 'filosofía', 'reflexión', 'meditación', 'principio',
  ],
  heroismo: [
    'héroe', 'valentía', 'coraje', 'valor', 'sacrificio', 'gloria',
    'honor', 'victoria', 'guerra', 'combate', 'hazaña', 'proeza',
    'luchar', 'vencer', 'guerrero', 'soldado', 'batalla',
  ],
  humanidad: [
    'humanidad', 'compasión', 'bondad', 'misericordia', 'empatía', 'prójimo',
    'pueblo', 'solidaridad', 'dignidad', 'piedad', 'generosidad', 'fraternidad',
    'condición humana', 'mortales',
  ],
  identidad: [
    'identidad', 'quién soy', 'propósito', 'vocación', 'esencia propia',
    'carácter', 'personalidad', 'yo mismo', 'autenticidad', 'conciencia',
    'introspección', 'autoconocimiento',
  ],
  justicia: [
    'justicia', 'injusticia', 'ley', 'derecho', 'culpa', 'inocencia',
    'castigo', 'venganza', 'tribunal', 'juicio', 'crimen', 'delito',
    'moral', 'equidad', 'impunidad',
  ],
  libertad: [
    'libertad', 'libre', 'esclavitud', 'cadenas', 'rebelión', 'independencia',
    'emancipación', 'opresión', 'tirano', 'yugo', 'servidumbre', 'liberar',
    'autonomía',
  ],
  muerte: [
    'muerte', 'morir', 'muerto', 'sepulcro', 'tumba', 'agonía', 'cadáver',
    'inmortal', 'inmortalidad', 'última hora', 'hades', 'ultratumba',
    'fallecido', 'difunto', 'luto',
  ],
  naturaleza: [
    'mar', 'océano', 'cielo', 'tierra', 'bosque', 'montaña', 'río',
    'viento', 'tormenta', 'aurora', 'crepúsculo', 'paisaje', 'naturaleza',
    'selva', 'campo', 'floresta',
  ],
  poder: [
    'poder', 'reino', 'rey', 'reina', 'soberano', 'dominar', 'autoridad',
    'mando', 'gobernar', 'conquista', 'trono', 'imperium', 'ambición',
    'príncipe', 'señorío', 'nobleza',
  ],
  sufrimiento: [
    'dolor', 'sufrimiento', 'pena', 'tristeza', 'llanto', 'lágrimas',
    'angustia', 'tormento', 'herida', 'soledad', 'desesperación',
    'amargura', 'desgracia', 'afflicción', 'padecer',
  ],
  tiempo: [
    'tiempo', 'memoria', 'recuerdo', 'pasado', 'futuro', 'eternidad',
    'instante', 'momento', 'nostalgia', 'ayer', 'mañana', 'efímero',
    'transitorio', 'siglo', 'época', 'historia',
  ],
  amistad: [
    'amigo', 'amistad', 'compañero', 'fiel', 'lealtad', 'confianza',
    'camarada', 'fraternidad', 'aliado', 'camaradería', 'fidelidad',
    'vínculo', 'comunidad',
  ],
  espiritualidad: [
    'meditación', 'iluminación', 'trascendencia', 'místico', 'espiritual',
    'interior', 'paz interior', 'serenidad', 'éxtasis', 'revelación',
    'contemplar lo divino', 'ascetismo', 'plegaria',
  ],
};
