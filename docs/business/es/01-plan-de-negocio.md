# Noetia — Plan de Negocio
**Versión 1.1 | Mayo 2026**

---

## Resumen Ejecutivo

Noetia es una plataforma de lectura multimodal que sincroniza texto y audio frase por frase, permitiendo a los lectores leer y escuchar al mismo tiempo. Su arquitectura independiente del idioma lanza con español como mercado principal y se expande al inglés en el Año 2, con idiomas adicionales a seguir — dirigiéndose a una base combinada de más de 2,000 millones de hablantes nativos entre español e inglés.

Noetia combina la profundidad inmersiva de una app de lectura con las mecánicas generadoras de hábito de las plataformas de aprendizaje social — permitiendo a los usuarios guardar fragmentos, generar tarjetas visuales de citas, compartir en redes sociales y leer juntos en clubes en tiempo real.

Noetia lanzó su beta en mayo de 2026 tras 12 meses de desarrollo por un equipo de 4 personas. La plataforma está en producción en **https://noetia.app**, corre en infraestructura productiva y se prepara para su envío al App Store de Apple y Google Play.

**Modelo de negocio:** Suscripción (Individual $8.99/mes · Dúo $13.99/mes · Familia $18.99/mes) más compras de tokens por título y donación social (el 2.22% de cada pago apoya causas sociales aliadas).

**Mercado objetivo:** Audiencias hispanohablantes en el lanzamiento (más de 500M hablantes nativos; más de 30M lectores digitales de pago en América Latina y España); mercados angloparlantes desde el Año 2; expansión multilingüe posterior.

**Objetivo de ingresos a 12 meses (post-lanzamiento Año 1):** $165,000 de ingresos totales, alcanzando 2,000 suscriptores de pago para mayo de 2027.

---

## El Problema

La lectura profunda e inmersiva está fragmentada en todos los idiomas. El español es el segundo idioma nativo más hablado en el mundo, pero las plataformas de lectura dominantes (Audible, Blinkist, Storytel) fueron construidas para audiencias anglófonas y ofrecen catálogos en español escasos y con poca adecuación cultural. Las plataformas en inglés enfrentan el problema inverso: catálogos enormes pero experiencias de consumo fragmentadas y pasivas.

Los lectores que quieren comprometerse profundamente con libros en cualquier idioma enfrentan tres problemas compuestos:

1. **Consumo fragmentado** — texto y audio existen en apps separadas, rompiendo el foco y la continuidad.
2. **Lectura pasiva** — las plataformas existentes no ayudan a los lectores a retener ni compartir lo que aprenden.
3. **Aislamiento social** — la lectura se trata como una actividad solitaria sin capa comunitaria ni de rendición de cuentas.

---

## La Solución

Noetia resuelve los tres — en cualquier idioma:

| Problema | Solución Noetia |
|---------|----------------|
| Texto + audio fragmentados | Sincronización frase por frase — audio y texto avanzan juntos, con la frase resaltada en tiempo real |
| Lectura pasiva | Captura de fragmentos → tarjetas visuales de citas → compartir en LinkedIn, Instagram, Facebook, Pinterest |
| Lectura en aislamiento | Noetia Clubes — hilos de discusión anclados a frases, sesiones de escucha en vivo (Escucha Juntos), votaciones de libros |

Diferenciadores adicionales:
- **Estadísticas de lectura** — gráfico de actividad de 7 días, contador de racha, metas semanales — bucles de hábito comprobados por el modelo de engagement de Duolingo
- **Controles de privacidad** — configuración granular de qué se comparte en los clubes
- **Causas Noetia** — el 2.22% de cada pago va a causas sociales verificadas (Medio Ambiente, Educación, Salud), convirtiendo cada suscripción en una contribución social

---

## Descripción del Producto

### Funcionalidades principales (lanzadas)

**Lector**
- Texto + audio sincronizados por frase (modo lectura, modo audio, modo escucha activa)
- Descarga offline de libros y sincronización
- Tamaño de fuente, modo oscuro, navegación por capítulos
- Progreso de lectura guardado y restaurado entre dispositivos

**Fragmentos y Compartir**
- Selección de frase con pulsación larga para guardar fragmentos
- Generación de imágenes de tarjetas de citas (4 plataformas × múltiples formatos y tamaños)
- Publicación directa en LinkedIn, Facebook, Instagram, Pinterest vía OAuth
- Compartir con enlace profundo

**Biblioteca y Descubrimiento**
- Más de 38 títulos gratuitos de dominio público (español) al lanzamiento; catálogo en inglés en desarrollo activo
- Títulos de pago subidos por autores (acceso vía tokens)
- Agrupación por colección, búsqueda (Meilisearch full-text)

**Noetia Clubes**
- Tipos de club: público / privado / evento de autor
- Hilos de discusión anclados a frases
- Chat general del club
- Votaciones de nominación de libros
- Escucha Juntos — sesiones de escucha en vivo programadas
- Roles de miembro (admin / moderador / miembro), mecánica de baneo

**Monetización**
- 3 niveles de suscripción (Individual / Dúo / Familia) con facturación mensual y anual
- Sistema de tokens (1 token = 1 libro de pago) — vencimiento a 90 días, redención FIFO
- Paquetes de tokens (1, 3, 5, 10 tokens) compra à la carte
- Tarjetas regalo con mensaje personal y ocasión
- Causas Noetia — donación social del 2.22% en cada pago

**Plataformas**
- Web (Next.js — escritorio + navegador móvil)
- iOS (React Native vía Expo)
- Android (React Native vía Expo)

**Idiomas**
- Localización completa de la interfaz: Español (lanzamiento) + Inglés (activo)
- Catálogo de contenido: Español (lanzamiento) → Inglés (Año 2) → hoja de ruta multilingüe

---

## Análisis de Mercado

> Las citas completas, notas metodológicas y niveles de confianza de cada número en esta sección se encuentran en el **Apéndice de Inteligencia de Mercado** (documento 05).

### Mercado Total Direccionable (TAM)

El mercado global de audiolibros fue valorado en **$8,700 millones en 2024** y se proyecta que alcance **$35,470 millones para 2030**, con una CAGR del 26.2% (Grand View Research, "Audiobook Market Size, Share & Trends Analysis Report," 2024 — alcance: global, todos los formatos y canales de distribución).

La capa de sincronización de frases + social de Noetia aborda el mercado de lectura digital más amplio, no solo los audiolibros. El mercado global combinado de ebooks, audiolibros y plataformas de suscripción de lectura supera los $20,000 millones en 2024.

El español y el inglés juntos representan las dos poblaciones de hablantes nativos más grandes del mundo (500M + 1,500M), haciendo que la estrategia bilingüe de Noetia esté directamente alineada con los segmentos de mayor volumen.

### Mercado Accesible (SAM)

**Mercados hispanohablantes (Año 1):**
- La audiencia de internet móvil de América Latina alcanzó **413 millones de usuarios en 2024** (GSMA, "The Mobile Economy: Latin America 2024"), de los cuales se estima que 130M se involucran regularmente con contenido digital de formato largo
- El segmento de lectura digital de pago (usuarios que pagan por libros, suscripciones o audiolibros) en América Latina se estima en **8–12M usuarios**, con crecimiento anual de ~18% (estimación compuesta — metodología completa en el Apéndice de Inteligencia de Mercado)
- Catálogo de audiolibros en español: más de 22,000 títulos al 2024, en rápido crecimiento (Bookwire, Spanish Market Report 2024)

**Mercados angloparlantes (Año 2):**
- Solo en EE.UU. hay más de 47M oyentes de audiolibros (Audio Publishers Association, 2024)
- El mercado de suscripción de lectura digital en inglés es el más desarrollado globalmente, con una disposición probada a pagar

**SAM combinado para planificación Año 1–3:** Lectores digitales hispanohablantes + lectores digitales angloparlantes en geografías objetivo.

### Mercado Obtenible (SOM)

**Objetivo Año 1:** 2,000 suscriptores de pago (primero en español; onboarding en inglés comienza en Q3 2026)
**Objetivo Año 3:** 15,000 suscriptores de pago (combinado español + inglés)

Estos objetivos asumen marketing de contenido orgánico, alianzas con autores y viralidad por contenido compartido como canales de adquisición principales. El modelo de adquisición completo está en la sección de Proyecciones Financieras.

### Tendencias del Mercado

- Los audiolibros en español crecieron **45.7% en 2023** (Bookwire, Spanish Market Report 2024 — basado en datos de ventas de la plataforma entre principales editoriales y distribuidores en español; crecimiento regional América Latina: +9%, México: +12%)
- La lectura social (clubes de libros, apps de discusión) es el canal de descubrimiento de libros de crecimiento más rápido a nivel global
- El video de formato corto (TikTok/Instagram Reels) es la principal plataforma de descubrimiento de libros para el público menor de 35 años — el fenómeno "BookTok" generó 825M de vistas en TikTok en 2023 (Publishers Weekly)
- El consumo de audiolibros en español entre la comunidad hispana de EE.UU. está acelerando: EE.UU. es la región con mayor crecimiento en consumo de audiolibros en español (Bookwire, 2024)

---

## Panorama Competitivo

| Competidor | Fortalezas | Debilidades vs. Noetia |
|-----------|-----------|----------------------|
| Audible (Amazon) | Catálogo enorme, marca global | Sin sincronización de texto, sin capa social, catálogo en español débil, sin comunidad |
| Storytel | Catálogo en español creciente, modelo de suscripción | Sin sincronización de frases, sin compartir, contenido en español limitado |
| Blinkist | Enfocado en resúmenes, buena UX | Solo resúmenes (sin libros completos), primero en inglés |
| 12min | Resúmenes en español | Solo resúmenes, sin sincronización de audio, sin comunidad |
| Kindle | Mejor lector digital de su clase | Sin sincronización de audio, funciones sociales débiles, separado de Audible |
| Scribd | Gran catálogo, modelo de suscripción | Sin sincronización de frases, sin compartir social, sin clubes |
| Wattpad | Fuerte comunidad | Solo ficción, generado por usuarios, sin catálogo curado |

**Diferenciadores defendibles de Noetia:**
1. Sincronización texto-audio frase por frase (foso técnico — alta complejidad de implementación; los competidores carecen de esto para libros completos)
2. Arquitectura independiente del idioma con diseño de producto culturalmente adaptado por mercado
3. Integración de causas sociales (adhesión emocional — los lectores sienten que su suscripción importa)
4. Generación de tarjetas visuales de citas para compartir (motor de viralidad que impulsa adquisición orgánica)

---

## Modelo de Negocio

### Flujos de Ingresos

**1. Suscripciones (MRR recurrente)**
| Plan | Mensual | Anual | Usuarios |
|------|---------|--------|-------|
| Individual | $8.99 | $89.99 | 1 usuario, 1 token/ciclo |
| Dúo | $13.99 | $139.99 | 2 usuarios, pool compartido |
| Familia | $18.99 | $189.99 | 5 usuarios, pool compartido |

**2. Paquetes de Tokens (pago único)**
| Paquete | Precio | Por Token |
|---------|-------|-----------|
| 1 token | $3.99 | $3.99 |
| 3 tokens | $9.99 | $3.33 |
| 5 tokens | $14.99 | $3.00 |
| 10 tokens | $29.99 | $3.00 |

**3. Tarjetas Regalo** — tokens de regalo con mensaje personal (1 o 3 tokens), enviados por email

**4. Tarifas de Hosting de Autores** — ingreso futuro por upgrades de nivel de hosting (Básico: 1 libro, Starter: 3 libros, Pro: 12 libros)

### Distribución de Ingresos por Pago
- **45%** → Ingresos operativos de Noetia
- **36%** → Regalías de autor/narrador
- **9%** → Tarifa de narrador (cuando es distinto del autor)
- **2.22%** → Causas Noetia (donación social)
- **7.78%** → Fondo de marketing

### Economía Unitaria (Plan Individual, mensual)
- ARPU: $8.99
- Churn estimado: 5%/mes (promedio de la industria para apps de lectura nicho: 4–7%)
- LTV (al 5% de churn = 20 meses de tenencia promedio): **$179.80**
- Costo de Adquisición de Clientes (Año 1, primero orgánico): **estimado $15–25**
- Ratio LTV:CAC: **7:1 – 12:1**

---

## Estrategia de Contenido y Licencias

### 1. Catálogo de Dominio Público (Actual — 38+ títulos)

**Tipo de licencia:** Dominio público / Creative Commons Zero

| Fuente | Tipo de Contenido | Licencia | Costo de Regalías |
|--------|------------------|---------|------------------|
| Project Gutenberg | Archivos de texto | Dominio público | $0 |
| LibriVox | Narraciones de audio | CC0 (dedicación al dominio público) | $0 |
| Wikisource en Español | Textos en español | Dominio público | $0 |

**Posición de derechos:** Sin costos de licencia ni obligaciones contractuales. Noetia verifica el estado de dominio público de cada título confirmando la fecha de publicación y el vencimiento del copyright por jurisdicción antes de la ingestión.

**Expansión:** El catálogo de dominio público en inglés está en desarrollo activo utilizando el mismo pipeline de Gutenberg + LibriVox. Objetivo: 40+ títulos en inglés para Q3 2026, junto con el lanzamiento en App Store.

---

### 2. Modelo Directo con Autores (Activo — en crecimiento)

**Tipo de licencia:** Licencia de distribución no exclusiva

Los autores se registran mediante códigos de invitación y suben contenido a través del panel de Noetia. Existen dos modelos de contenido:

| Modelo | El Autor Provee | Origen del Audio | Regalía |
|--------|----------------|-----------------|---------|
| Envío completo | Texto + audio narrado | Grabación master del autor | 45% (autor = narrador) |
| Solo texto | Archivo de texto | Por definir: producción del autor o de Noetia | 36% autor + 9% narrador |

**Términos clave de licencia (formalizados en Acuerdo de Autor):**
- No exclusiva: los autores conservan todos los derechos y pueden distribuir en otras plataformas simultáneamente
- Los autores auto-certifican la titularidad de todo el contenido subido
- Término de licencia: 12 meses renovables automáticamente; aviso escrito de 30 días para retirar un título
- Territorio: mundial por defecto; los autores pueden restringir a regiones específicas bajo solicitud
- Ciclo de pago: mensual, dentro de los 15 días hábiles posteriores al cierre de mes; umbral mínimo de pago $25

**Diligencia debida a escala actual:** Los autores auto-certifican derechos en el momento de subida. Noetia retira el contenido ante una queja DMCA o disputa de derechos. La revisión editorial previa se añadirá al llegar a 50+ autores activos.

---

### 3. Proceso de Acuerdos con Editoriales (Acercamiento activo — sin acuerdos firmados a mayo 2026)

**Objetivo:** Editoriales independientes y medianas en español en México, Colombia, Argentina y España. Editoriales en inglés desde el Año 2.

**Estructura de acuerdo propuesta:**
- Licencia no exclusiva por título o por catálogo
- Distribución de ingresos: 50% a la editorial (incluyendo parte del autor), 50% a Noetia
- Compromiso mínimo de catálogo: 5 títulos por editorial para el acuerdo inicial
- Las editoriales deben confirmar titularidad tanto de derechos de texto como de derechos de audiolibro/digital antes de publicar el título

**Estado actual:** Fase de introducción al mercado. Las primeras conversaciones formales con editoriales están previstas para Q4 2026 (posterior a la tracción beta).

**Editoriales prioritarias:**
- Penguin Random House Grupo Editorial (división España / América Latina)
- Fondo de Cultura Económica (México)
- Planeta Libros (catálogo en español)
- Editoriales independientes con más de 50 títulos en catálogo

**Próximo paso recomendado:** Contratar un abogado de propiedad intelectual/derechos editoriales con experiencia en mercados hispanohablantes para redactar el Acuerdo de Licencia Editorial estándar. Costo estimado: $3,000–$8,000.

---

### 4. Titularidad de Derechos de Audiolibros

| Tipo de Catálogo | Derechos de Texto | Derechos de Audio | Posición de Noetia |
|-----------------|------------------|------------------|-------------------|
| Dominio público | Dominio público | CC0 (LibriVox) | Solo distribución; sin titularidad de PI |
| Autor directo (envío completo) | Titularidad del autor | Master del autor | Licencia de distribución no exclusiva |
| Autor directo (solo texto) | Titularidad del autor | Por definir | Distribución + potencial PI de producción |
| Licencia editorial | Titularidad de la editorial | Titularidad de la editorial | Licencia de distribución no exclusiva |

**Los mapas de sincronización de frases** (datos de alineación Whisper generados por Noetia) son datos propietarios de Noetia y no forman parte del copyright de la obra subyacente. Este dato representa un activo técnico propietario.

---

### 5. DRM y Protección de Contenido

**Enfoque actual: DRM suave (vinculación a cuenta)**

Noetia no implementa sistemas DRM completos (Widevine, FairPlay). En su lugar:
- El contenido está cifrado en reposo (cifrado del lado del servidor de MinIO, AES-256)
- Las URLs de streaming y descarga son presignadas con ventanas de expiración cortas (streaming: TTL de 5 minutos; descarga: TTL de 1 hora)
- Los archivos descargados están vinculados a la cuenta; no son transferibles entre dispositivos
- El acceso offline se aplica en la capa de autenticación de la API

**Fundamento:** El DRM completo (Widevine/FairPlay) requiere certificación de plataforma, una carga de ingeniería significativa y es exigido principalmente por grandes editoriales. A la escala actual del catálogo (dominio público + autores directos), el DRM suave es contractualmente suficiente y se divulga a los autores desde el inicio.

**Hoja de ruta:** Se evaluará la capacidad de DRM completo antes de firmar cualquier acuerdo editorial importante que lo requiera (estimado Año 2–3).

---

### 6. Derechos Territoriales

**Modelo actual:** Sin restricciones territoriales
- Catálogo de dominio público: distribuible globalmente sin restricciones
- Licencias de autores directos: mundiales por defecto (los autores pueden optar por restricciones)

**Perspectivas futuras:**
- Los acuerdos con editoriales requerirán negociación por territorio; América Latina + España es el alcance predeterminado esperado
- Los derechos del mercado hispano en EE.UU. se negociarán como territorio diferenciado en las condiciones de los acuerdos editoriales
- La expansión al inglés requiere un marco separado de derechos territoriales (Año 2)

---

## Estrategia Go-to-Market

### Fase 1 — Lanzamiento Beta (Mayo–Agosto 2026)
- 500 usuarios beta vía lista de espera (ya en recolección)
- Solo con invitación, con códigos de subida para autores tempranos
- Enfoque: validación de product-market fit, análisis de churn, NPS
- Canales: red del fundador, contenido en LinkedIn, acercamiento a autores
- Idioma: español primario; interfaz y onboarding en inglés disponibles

### Fase 2 — Crecimiento (Septiembre 2026–Febrero 2027)
- Lanzamiento en App Store y Google Play
- Lanzamiento del catálogo de dominio público en inglés junto con las app stores
- Estrategia de contenido TikTok/Instagram: "mejores citas de [libro]" usando las tarjetas de Noetia (bucle de viralidad)
- Programa de alianzas con autores: 10 hispanohablantes + 5 angloparlantes con audiencias establecidas
- Alianzas con clubes de libros: círculos literarios universitarios, comunidades de lectura en WhatsApp/Discord
- Programa de referidos: invita a 3 amigos → 1 token gratis

### Fase 3 — Escala (Marzo 2027+)
- Acuerdos de catálogos editoriales (español + inglés)
- Patrocinios de podcasts/newsletters dirigidos a audiencias de productividad y desarrollo personal
- B2B: programas de bienestar corporativo (lectura como beneficio), licencias universitarias
- Entrada al mercado portugués (Brasil)

---

## Equipo

El equipo fundador combina visión de producto con ejecución técnica en todo el stack.

| Rol | Responsabilidades |
|------|-----------------|
| **Product Manager** | Roadmap, sprint planning, gestión de stakeholders, investigación de usuarios, KPIs, go-to-market |
| **Desarrollador Backend** | API NestJS, esquema PostgreSQL, Stripe, autenticación, suscripciones, clubes, migraciones |
| **Desarrollador Frontend** | App web Next.js, app móvil React Native (iOS + Android), i18n, componentes UI |
| **Ingeniero DevOps** | Infraestructura Docker, Traefik, CI/CD con GitHub Actions, monitoreo Grafana, backups, seguridad del servidor |

12 meses de desarrollo. 55 migraciones de base de datos. Cero contratistas externos. Propiedad total del stack tecnológico.

---

## Proyecciones Financieras

### Supuestos Base
- Lanzamiento beta: Mayo 2026
- Lanzamiento en App Store + catálogo en inglés: Q3 2026
- Plan promedio: 70% Individual, 20% Dúo, 10% Familia → ARPU promedio ≈ $10.20/mes
- Churn mensual: 5% (conservador; disminuye conforme el producto madura y los clubes profundizan el engagement)
- Tasa de compra de tokens: 15% de los suscriptores compra al menos 1 paquete de tokens al año
- Los ingresos del Año 1 son principalmente del mercado en español; los suscriptores en inglés comienzan a contribuir desde Q4 2026

### Modelo de Adquisición de Crecimiento

#### Embudo de Adquisición de Usuarios

**Etapa 1 — Conciencia (parte superior del embudo)**
- Contenido personal del fundador en LinkedIn (temas de lectura y productividad en español e inglés)
- Contenido generado por autores: los autores promocionan sus títulos en Noetia a sus audiencias existentes
- Bucle viral: tarjetas de Noetia publicadas en TikTok/Instagram/Pinterest por lectores
- Círculos literarios universitarios, comunidades de lectura en WhatsApp y Discord

**Etapa 2 — Adquisición**
- Landing page de lista de espera → código de invitación → creación de cuenta gratuita
- Descubrimiento orgánico en App Store / Google Play (Q3 2026+)
- Programa de referidos: invita a 3 amigos → gana 1 token gratis (~$3.99 de costo por referido)

**Etapa 3 — Activación**
- Biblioteca de dominio público accesible inmediatamente — sin muro de pago para la primera experiencia de lectura
- Racha de lectura inicializada en la primera sesión; descubrimiento de clubes mostrado al final de la sesión 1
- Objetivo: 60%+ de nuevos usuarios completan su primera sesión de lectura dentro de las 48 horas de registro

**Etapa 4 — Conversión (Gratuito → De Pago)**
Disparadores principales de conversión:
- Querer un título de pago (bloqueado por token) del catálogo de autores
- Unirse a un club que lee un libro de pago
- Fin de un título gratuito — sugerencia para explorar el catálogo de autores de pago

Tasa de conversión objetivo: 12–18% de los usuarios gratuitos activos convierten dentro de los 90 días de registro.

**Etapa 5 — Retención y Expansión**
- Las rachas de lectura y metas semanales crean retención por bucle de hábito (aversión a perder la racha)
- La membresía en clubes crea responsabilidad social (disuasor significativo del churn)
- Upgrade al plan anual: 16–17% de ahorro vs. mensual — ofrecido en el mes 3 con prompt in-app

#### Costo de Adquisición de Clientes (CAC) por Canal

| Canal | CAC Estimado | Notas |
|-------|-------------|-------|
| Orgánico / contenido del fundador | ~$5 | Solo costo de tiempo; sin gasto en medios |
| Referido de autores (audiencias de autores) | ~$8–12 | Co-marketing con autores que promocionan Noetia a sus seguidores |
| Programa de referidos (3 amigos → 1 token) | ~$12–18 | Costo del token ($3.99) amortizado entre 3 usuarios referidos |
| Redes sociales pagadas (Fase 2, Sep 2026+) | ~$25–40 | Anuncios en Meta/TikTok dirigidos a lectores en español/inglés |
| **CAC combinado (Año 1, primero orgánico)** | **~$15–25** | Ponderado fuertemente hacia canales orgánicos |

#### Modelo de Crecimiento de Suscriptores

| Período | Nuevos Brutos/Mes | Churn (5%) | Netos Nuevos | Acumulado |
|---------|-----------------|-----------|------------|----------|
| May–Jul 2026 (beta) | ~80 | ~5 | ~75 | 200 |
| Ago–Oct 2026 (lanzamiento App Store) | ~150 | ~15 | ~135 | 550 |
| Nov 2026–Ene 2027 | ~250 | ~30 | ~220 | 1,100 |
| Feb–Abr 2027 | ~350 | ~55 | ~295 | 1,700 |
| May 2027 | ~400 | ~80 | ~320 | 2,000+ |

#### Supuestos de Retención

| Antigüedad del Cohorte | Retención Mensual Esperada |
|----------------------|--------------------------|
| Mes 1–3 | 90–95% (novedad + hábitos en formación) |
| Mes 4–12 | 95% (5% churn; clubes y rachas activos) |
| Mes 13+ | 96% (4% churn; formación de hábito profundo) |

Principales causas de churn: (1) brechas en el catálogo — el usuario agota el contenido disponible que desea; (2) sensibilidad al precio en el mes 3 para usuarios que no hacen upgrade al plan anual; (3) eventos de vida no relacionados con el producto.

#### Modelo de Adquisición de Autores

Los autores son la cadena de suministro de contenido. El Año 1 prioriza la calidad sobre la cantidad.

| Período | Autores Objetivo | Títulos de Pago Activos | Canal de Adquisición |
|---------|----------------|----------------------|---------------------|
| May–Ago 2026 (beta) | 5–10 | 10–20 | Red personal del fundador |
| Sep–Dic 2026 | 25 | 40–60 | Referidos de autores + contacto directo |
| May 2027 (fin Año 1) | 50 | 75+ | Programa de referidos + proceso editorial |
| May 2028 (fin Año 2) | 150 | 250+ | Acuerdos editoriales + contacto con autores en inglés |

**Criterios de selección de autores (Año 1):** Audiencia existente en español o inglés (mínimo 1,000 seguidores en cualquier plataforma); categoría de no ficción, desarrollo personal o ficción literaria; dispuesto a promocionar su página de Noetia a su propia audiencia.

**Estructura de incentivos para autores:**
- 45% de regalía — la más alta de la categoría (Audible ofrece 25–40%)
- Nivel de hosting Starter gratuito durante los primeros 12 meses
- Co-marketing: Noetia presenta al autor en contenido social y newsletter del programa de autores
- Panel de autor en tiempo real: ganancias, engagement de lectores, análisis de fragmentos

### Proyecciones de Ingresos

| Período | Suscriptores | MRR | ARR |
|--------|------------|-----|-----|
| Ago 2026 (3 meses post-lanzamiento) | 200 | $2,040 | $24,480 |
| Nov 2026 (6 meses) | 600 | $6,120 | $73,440 |
| Feb 2027 (9 meses) | 1,200 | $12,240 | $146,880 |
| May 2027 (12 meses) | 2,000 | $20,400 | $244,800 |
| May 2028 (24 meses) | 6,000 | $61,200 | $734,400 |
| May 2029 (36 meses) | 15,000 | $153,000 | $1,836,000 |

*Los ingresos por paquetes de tokens y tarifas de hosting de autores añaden ~12% sobre el ARR de suscripción a partir del Año 2.*

### Estructura de Costos (actual)
| Concepto | Costo Mensual |
|------|-------------|
| Contabo VPS (8 vCPU, 24 GB RAM, 400 GB SSD) | ~$25 |
| Resend (email, tier gratuito) | $0 |
| Expo EAS Build | $0–$29 |
| Comisiones Stripe (~2.9% + $0.30) | Variable |
| Dominio / DNS (Cloudflare) | ~$12/año |
| **Total infraestructura fija** | **< $50/mes** |

El costo de infraestructura es insignificante a la escala actual. El principal costo de escala es capital humano (atención al cliente, licencias de contenido, marketing) y honorarios legales de acuerdos editoriales.

---

## Análisis de Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|------|-----------|--------|-----------|
| Crecimiento lento del catálogo de autores | Alta | Alta | 38+ títulos de dominio público brindan experiencia completa en beta; catálogo en inglés en paralelo |
| Rechazo en App Store | Media | Media | Política de privacidad activa, permisos declarados, sin contenido objetable |
| Disputas de derechos editoriales | Media | Media | Auto-certificación de autores + proceso de retiro DMCA; abogado de PI retenido antes de acuerdos editoriales |
| Disputas / contracargos en Stripe | Baja | Media | Política de no reembolso en tokens (declarada en checkout); autenticación robusta |
| Caída del servidor | Baja | Alta | Backups diarios de PostgreSQL, backups de MinIO, alertas Grafana, historial de 99.9% de uptime |
| Competidor copia la sincronización de frases | Media | Media | El foso técnico es profundo; la capa cultural + comunitaria es más difícil de replicar |
| Churn más alto de lo proyectado | Media | Alta | Gamificación de rachas, clubes, metas semanales e incentivo de plan anual combaten el churn |
| Entrada demasiado temprana al mercado inglés | Baja | Media | El catálogo en inglés de dominio público tiene costo cero de licencias; el riesgo es solo tiempo de ingeniería |

---

*Noetia — Lee. Escucha. Captura. Comparte.*
*https://noetia.app | noreply@noetia.app*
