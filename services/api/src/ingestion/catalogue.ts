export type TextSource = 'gutenberg' | 'wikisource';

export interface CatalogueEntry {
  title: string;
  author: string;
  description: string;
  source: TextSource;
  gutenbergId?: number;
  wikisourceTitle?: string;
  librivoxAudioUrl: string;
  /** Override search string passed to LibriVox API when the full title doesn't match */
  librivoxSearchTitle?: string;
  /** Hardcoded cover image URL — skips Open Library search when present */
  coverUrl?: string;
}

export const CATALOGUE: CatalogueEntry[] = [
  {
    title: 'Lazarillo de Tormes',
    author: 'Anónimo',
    description: 'Novela picaresca anónima del siglo XVI, fundadora del género en la literatura española.',
    source: 'gutenberg',
    gutenbergId: 320,
    librivoxAudioUrl: 'https://librivox.org/lazarillo-de-tormes/',
  },
  {
    title: 'El Sombrero de Tres Picos',
    author: 'Pedro Antonio de Alarcón',
    description: 'Comedia costumbrista del siglo XIX basada en una historia popular andaluza.',
    source: 'gutenberg',
    gutenbergId: 29506,
    librivoxAudioUrl: 'https://librivox.org/el-sombrero-de-tres-picos-by-pedro-antonio-de-alarcon-y-ariza/',
    librivoxSearchTitle: 'Sombrero de Tres Picos',
  },
  {
    title: 'Leyendas',
    author: 'Gustavo Adolfo Bécquer',
    description: 'Colección de leyendas románticas del poeta y narrador sevillano del siglo XIX.',
    source: 'gutenberg',
    gutenbergId: 10814,
    librivoxAudioUrl: 'https://librivox.org/leyendas-by-gustavo-adolfo-becquer/',
  },
  {
    title: 'Don Juan Tenorio',
    author: 'José Zorrilla',
    description: 'Drama romántico en verso sobre el legendario seductor español.',
    source: 'gutenberg',
    gutenbergId: 5201,
    librivoxAudioUrl: 'https://librivox.org/don-juan-by-jose-zorrilla-y-moral/',
  },
  {
    title: 'Marianela',
    author: 'Benito Pérez Galdós',
    description: 'Novela social de Galdós que explora la belleza, la pobreza y el amor en la España rural.',
    source: 'gutenberg',
    gutenbergId: 48818,
    librivoxAudioUrl: 'https://librivox.org/marianela-by-benito-perez-galdos/',
  },
  {
    title: 'Doña Perfecta',
    author: 'Benito Pérez Galdós',
    description: 'Novela que denuncia el fanatismo religioso y la intolerancia en la España del siglo XIX.',
    source: 'gutenberg',
    gutenbergId: 15725,
    librivoxAudioUrl: 'https://librivox.org/dona-perfecta-by-benito-perez-galdos/',
  },
  {
    title: 'Niebla',
    author: 'Miguel de Unamuno',
    description: 'Nivola existencialista en la que el protagonista cuestiona su propia realidad ante su creador.',
    source: 'gutenberg',
    gutenbergId: 49836,
    librivoxAudioUrl: 'https://librivox.org/niebla-by-miguel-de-unamuno/',
  },
  {
    title: 'El Gaucho Martín Fierro',
    author: 'José Hernández',
    description: 'Poema épico gauchesco argentino, símbolo de la identidad nacional latinoamericana.',
    source: 'gutenberg',
    gutenbergId: 14765,
    librivoxAudioUrl: 'https://librivox.org/el-gaucho-martin-fierro-by-jose-hernandez/',
    librivoxSearchTitle: 'Martin Fierro',
  },
  {
    title: 'Cuentos de Amor de Locura y de Muerte',
    author: 'Horacio Quiroga',
    description: 'Cuentos del maestro rioplatense del género, ambientados en la selva misionera.',
    source: 'gutenberg',
    gutenbergId: 13507,
    librivoxAudioUrl: 'https://librivox.org/cuentos-de-amor-de-locura-y-de-muerte-by-horacio-quiroga/',
  },
  {
    title: 'Los Cuatro Jinetes del Apocalipsis',
    author: 'Vicente Blasco Ibáñez',
    description: 'Novela antibélica ambientada en la Primera Guerra Mundial, bestseller mundial de 1916.',
    source: 'gutenberg',
    gutenbergId: 24536,
    librivoxAudioUrl: 'https://librivox.org/los-cuatro-jinetes-del-apocalipsis-by-vicente-blasco-ibanez/',
    librivoxSearchTitle: 'Cuatro Jinetes',
  },
  {
    title: 'La Isla del Tesoro',
    author: 'Robert Louis Stevenson',
    description: 'Clásico de aventuras piratas narrado por el joven Jim Hawkins en busca de un tesoro oculto.',
    source: 'gutenberg',
    gutenbergId: 45438,
    librivoxAudioUrl: 'https://librivox.org/la-isla-del-tesoro-by-robert-louis-stevenson/',
    librivoxSearchTitle: 'Isla del Tesoro',
  },
  {
    title: 'Viaje al Centro de la Tierra',
    author: 'Julio Verne',
    description: 'Novela de ciencia ficción en la que el profesor Lidenbrock y su sobrino descienden al interior de la Tierra.',
    source: 'wikisource',
    wikisourceTitle: 'Viaje al centro de la Tierra',
    librivoxAudioUrl: 'https://librivox.org/viaje-al-centro-de-la-tierra-by-jules-verne/',
  },
  {
    title: 'Romeo y Julieta',
    author: 'William Shakespeare',
    description: 'La más célebre tragedia de amor de la literatura universal.',
    source: 'wikisource',
    wikisourceTitle: 'Romeo y Julieta (Menéndez y Pelayo tr.)',
    librivoxAudioUrl: 'https://librivox.org/romeo-y-julieta-by-william-shakespeare/',
  },
  {
    title: 'Crimen y Castigo',
    author: 'Fiódor Dostoyevski',
    description: 'Novela psicológica sobre un estudiante que comete un crimen y lidia con su conciencia.',
    source: 'gutenberg',
    gutenbergId: 61851,
    librivoxAudioUrl: 'https://librivox.org/crimen-y-castigo-by-fyodor-dostoyevsky/',
  },
  {
    title: 'La Odisea',
    author: 'Homero',
    description: 'Epopeya griega sobre el largo viaje de Odiseo de regreso a Ítaca tras la guerra de Troya.',
    source: 'gutenberg',
    gutenbergId: 58221,
    librivoxAudioUrl: 'https://librivox.org/la-odisea-by-homero/',
    librivoxSearchTitle: 'Odisea',
  },
  {
    title: 'La Divina Comedia',
    author: 'Dante Alighieri',
    description: 'Poema épico medieval que narra el viaje de Dante por el Infierno, el Purgatorio y el Paraíso.',
    source: 'gutenberg',
    gutenbergId: 57303,
    librivoxAudioUrl: 'https://librivox.org/la-divina-comedia-by-dante-alighieri/',
    librivoxSearchTitle: 'Divina Comedia',
  },
  {
    title: 'Don Quijote de la Mancha — Vol. I',
    author: 'Miguel de Cervantes',
    description: 'Primera parte de la obra cumbre de la literatura española y universal.',
    source: 'gutenberg',
    gutenbergId: 2000,
    librivoxAudioUrl: 'https://librivox.org/don-quijote-vol-1-by-miguel-de-cervantes-saavedra/',
    librivoxSearchTitle: 'Don Quijote',
  },
  {
    title: 'Don Quijote de la Mancha — Vol. II',
    author: 'Miguel de Cervantes',
    description: 'Segunda parte de la inmortal novela del caballero manchego y su escudero Sancho Panza.',
    source: 'gutenberg',
    gutenbergId: 2000,
    librivoxAudioUrl: 'https://librivox.org/don-quijote-volume-2-by-miguel-de-cervantes-saavedra/',
    librivoxSearchTitle: 'Don Quijote',
  },
  {
    title: 'Orgullo y Prejuicio',
    author: 'Jane Austen',
    description: 'Novela de la escritora inglesa sobre el amor, el matrimonio y los prejuicios sociales en la Inglaterra del siglo XIX.',
    source: 'wikisource',
    wikisourceTitle: 'Orgullo y prejuicio',
    librivoxAudioUrl: 'https://librivox.org/orgullo-y-prejuicio1-by-jane-austen/',
    librivoxSearchTitle: 'Orgullo Prejuicio',
  },
  {
    title: 'Génesis',
    author: 'Anónimo',
    description: 'El primer libro del Antiguo Testamento: la creación del mundo, Adán y Eva, Noé, Abraham, Isaac, Jacob y José. Versión Reina-Valera 1909.',
    source: 'wikisource',
    wikisourceTitle: 'Biblia Reina-Valera 1909/Génesis',
    librivoxAudioUrl: 'https://librivox.org/genesis-reina-valera-version/',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
  },
];
