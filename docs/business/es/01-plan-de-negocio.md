# Noetia — Plan de Negocio
**Versión 1.0 | Mayo 2026**

---

## Resumen Ejecutivo

Noetia es una plataforma de lectura multimodal que sincroniza texto y audio frase por frase, permitiendo a los lectores leer y escuchar al mismo tiempo. Construida para audiencias hispanohablantes, Noetia combina la profundidad inmersiva de una app de lectura con las mecánicas generadoras de hábito de las plataformas de aprendizaje social — permitiendo a los usuarios guardar fragmentos, generar tarjetas visuales de citas, compartir en redes sociales y leer juntos en clubes en tiempo real.

Noetia lanzó su beta en mayo de 2026 tras 12 meses de desarrollo por un equipo de 4 personas. La plataforma está en producción en **https://noetia.app**, corre en infraestructura productiva y se prepara para su envío al App Store de Apple y Google Play.

**Modelo de negocio:** Suscripción (Individual $8.99/mes · Dúo $13.99/mes · Familia $18.99/mes) más compras de tokens por título y donación social (el 2.22% de cada pago apoya causas sociales aliadas).

**Mercado objetivo:** 500M hispanohablantes en el mundo; más de 30M lectores digitales en América Latina dispuestos a pagar por experiencias de lectura premium.

**Objetivo de ingresos a 12 meses (post-lanzamiento Año 1):** $165,000 de ingresos totales, alcanzando 2,000 suscriptores de pago para mayo de 2027.

---

## El Problema

El consumo de libros y audiolibros en español está subatendido en relación con el tamaño del mercado. El español es el segundo idioma nativo más hablado en el mundo, pero las plataformas de lectura dominantes (Audible, Blinkist, Storytel) fueron construidas para audiencias anglófonas y ofrecen catálogos en español escasos y con poca adecuación cultural.

Los lectores que quieren comprometerse profundamente con libros en español enfrentan tres problemas compuestos:

1. **Consumo fragmentado** — texto y audio existen en apps separadas, rompiendo el foco y la continuidad.
2. **Lectura pasiva** — las plataformas existentes no ayudan a los lectores a retener ni compartir lo que aprenden.
3. **Aislamiento social** — la lectura se trata como una actividad solitaria sin capa comunitaria ni de rendición de cuentas.

---

## La Solución

Noetia resuelve los tres:

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
- Más de 38 títulos gratuitos de dominio público (español) al lanzamiento
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

---

## Análisis de Mercado

### Mercado Total Direccionable (TAM)
Se proyecta que el mercado global de audiolibros alcance **$35 mil millones para 2030** (Grand View Research, 2024). La lectura digital en español es un segmento estructuralmente subatendido dentro de este mercado. Los ~500M hablantes nativos de español representan aproximadamente el 6.5% de la población mundial, pero reciben una fracción de la inversión en contenido de lectura premium.

### Mercado Accesible (SAM)
América Latina contaba con **~130M usuarios de internet** que leían contenido digital regularmente en 2025. El segmento de lectura digital de pago (usuarios que pagan por libros, suscripciones o audiolibros) se estima en **8–12M usuarios en toda la región**, con un crecimiento anual del ~18%.

### Mercado Obtenible (SOM)
**Objetivo Año 1:** 2,000 suscriptores de pago (0.025% del SAM)
**Objetivo Año 3:** 15,000 suscriptores de pago (0.15% del SAM)

Estos objetivos son conservadores y alcanzables a través de marketing de contenido orgánico, alianzas con autores y la viralidad del contenido compartido.

### Tendencias del Mercado
- El consumo de audiolibros en mercados hispanohablantes creció un 34% en 2024 (Statista)
- La lectura social (clubes de libros, apps de discusión) es el canal de descubrimiento de libros de crecimiento más rápido
- El video de formato corto (TikTok/Instagram Reels) es la principal plataforma de descubrimiento de libros para el público menor de 35 años — el compartir tarjetas visuales de Noetia conecta directamente con este comportamiento
- La cultura de trabajo remoto en América Latina ha aumentado el tiempo diario de lectura (+22% desde 2022, Bain & Company)

---

## Panorama Competitivo

| Competidor | Fortalezas | Debilidades vs. Noetia |
|-----------|-----------|----------------------|
| Audible (Amazon) | Catálogo enorme, marca global | Primero en inglés, sin sincronización de texto, sin capa social, sin comunidad en español |
| Storytel | Fuerte catálogo escandinavo | Contenido en español limitado, sin sincronización de frases, sin compartir |
| Blinkist | Enfocado en resúmenes, buena UX | Solo resúmenes (sin libros completos), primero en inglés |
| 12min | Resúmenes en español | Solo resúmenes, sin sincronización de audio, sin comunidad |
| Kindle | Mejor lector digital de su clase | Sin sincronización de audio, funciones sociales débiles, separado de Audible |
| Wattpad | Fuerte comunidad | Solo ficción, generado por usuarios, sin catálogo curado |

**Diferenciadores defendibles de Noetia:**
1. Sincronización texto-audio frase por frase (foso técnico — alta complejidad de implementación)
2. Enfoque nativo en español con diseño de producto culturalmente adaptado
3. Integración de causas sociales (adhesión emocional — los lectores sienten que su suscripción importa)
4. Generación de tarjetas visuales de citas para compartir (motor de viralidad)

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

## Estrategia Go-to-Market

### Fase 1 — Lanzamiento Beta (Mayo–Agosto 2026)
- 500 usuarios beta vía lista de espera (ya en recolección)
- Solo con invitación, con códigos de subida para autores tempranos
- Enfoque: validación de product-market fit, análisis de churn, NPS
- Canales: red del fundador, contenido en LinkedIn, acercamiento a autores

### Fase 2 — Crecimiento (Septiembre 2026–Febrero 2027)
- Lanzamiento en App Store y Google Play
- Estrategia de contenido TikTok/Instagram: "mejores citas de [libro]" usando las tarjetas de Noetia (bucle de viralidad)
- Programa de alianzas con autores: 10 autores hispanohablantes con audiencias establecidas
- Alianzas con clubes de libros: círculos literarios universitarios, comunidades de lectura en WhatsApp/Discord
- Programa de referidos: invita a 3 amigos → 1 token gratis

### Fase 3 — Escala (Marzo 2027+)
- Lanzamiento del catálogo en inglés (misma tecnología, nuevo mercado)
- Patrocinios de podcasts/newsletters dirigidos a audiencias de productividad y desarrollo personal
- B2B: programas de bienestar corporativo (lectura como beneficio), licencias universitarias

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

### Supuestos
- Lanzamiento beta: Mayo 2026
- Lanzamiento en App Store: Q3 2026
- Plan promedio: 70% Individual, 20% Dúo, 10% Familia → ARPU promedio ≈ $10.20/mes
- Churn mensual: 5% (conservador; disminuye conforme el producto madura)
- Tasa de compra de tokens: 15% de los suscriptores compra al menos 1 paquete de tokens al año

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

El costo de infraestructura es insignificante a la escala actual. El principal costo de escala es capital humano (atención al cliente, licencias de contenido, marketing).

---

## Análisis de Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|------|-----------|--------|-----------|
| Catálogo inicial de autores limitado | Alta | Alta | 38 títulos de dominio público gratuitos brindan experiencia completa en beta; programa de autores en marcha |
| Rechazo en App Store | Media | Media | Política de privacidad activa, permisos declarados, sin contenido objetable |
| Disputas / contracargos en Stripe | Baja | Media | Política de no reembolso en tokens (declarada en checkout); autenticación robusta |
| Caída del servidor | Baja | Alta | Backups diarios de PostgreSQL, backups de MinIO, alertas Grafana, historial de 99.9% de uptime |
| Competidor copia la sincronización de frases | Media | Media | El foso técnico es profundo; el enfoque cultural en español y la comunidad son más difíciles de replicar |
| Churn más alto de lo proyectado | Media | Alta | La gamificación de rachas de lectura, los clubes y el sistema de metas están diseñados para combatir el churn |

---

*Noetia — Lee. Escucha. Captura. Comparte.*
*https://noetia.app | noreply@noetia.app*
