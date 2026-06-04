import { LAST_UPDATED } from './cookie-policy';

export const PRIVACY_POLICY_ES = `
# Política de Privacidad

**Versión MVP — sujeta a revisión legal**
Última actualización: ${LAST_UPDATED}

## 1. Responsable del tratamiento

**Noetia** es operada por Carloskfe.
Correo de contacto: **legal@noetia.app**
URL de la política de privacidad: **https://noetia.app/legal/privacy**

## 2. Datos que recopilamos

| Categoría | Datos | Fuente |
|-----------|-------|--------|
| Identidad | Nombre, correo electrónico | Registro / OAuth |
| Autenticación social | Token de Google, Facebook o Apple | OAuth |
| Información de pago | Historial de suscripciones y compras de tokens (gestionado por Stripe; no almacenamos datos de tarjeta) | Stripe |
| Actividad de lectura | Progreso por libro, posición de frase, minutos leídos, velocidad de reproducción | App |
| Contenido creado | Fragmentos guardados, notas, fragmentos combinados | App |
| Eventos de comportamiento | Tipo de evento (fragmento creado, fragmento compartido, libro visualizado), libro y timestamp asociados | App |
| Análisis temático de fragmentos | Etiquetas temáticas automáticas (p. ej. "amor", "filosofía") asignadas a cada fragmento que guardas | App |
| Perfil de lector (*Persona*) | Temas dominantes, arquetipo de engagement, cadencia de lectura, tasa de finalización, plataformas de compartición preferidas — calculado periódicamente a partir de tu actividad agregada | Sistema |
| Participación en clubes | Mensajes, discusiones en clubes de lectura, votaciones | App |
| Datos técnicos | Dirección IP, tipo de dispositivo, errores de la app | Logs / Sentry |
| Preferencias de idioma y privacidad | Idioma de interfaz, ajustes de visibilidad de perfil y actividad | App |

## 3. Base legal para el tratamiento

- **Ejecución de contrato**: procesamos tus datos de identidad y pago para prestarte el servicio de suscripción.
- **Interés legítimo**: procesamos datos de uso para mejorar la plataforma, detectar fraudes y analizar segmentos de audiencia de forma agregada.
- **Consentimiento**: procesamos cookies analíticas y de marketing solo si lo autorizas expresamente. El análisis de perfil de lector puede desactivarse desde los ajustes de privacidad.

## 4. Análisis de perfil de lector (*Persona*)

Noetia construye un **perfil de lector derivado** a partir de tu actividad (fragmentos guardados, patrones de lectura, contenido compartido). Este perfil no es creado por ti sino inferido automáticamente. Se utiliza para:

- **Personalización interna**: recomendarte libros coherentes con tu gusto intelectual.
- **Análisis de audiencia agregado**: entender qué segmentos de lectores existen en la plataforma.
- **Estadísticas para autores**: los autores ven estadísticas agregadas sobre qué tipos de lectores resuenan con sus libros. **Nunca se comparten datos individuales identificables con autores.**

Puedes desactivar el análisis de perfil en cualquier momento desde **Perfil → Privacidad → Contribuir a Noetia Insights**. Si lo desactivas, tus datos no se usarán para cálculos de perfil ni para estadísticas agregadas de audiencia.

## 5. Períodos de retención

| Datos | Período |
|-------|---------|
| Cuenta y contenido de usuario | Hasta que elimines tu cuenta |
| Datos de pago (requerido por ley fiscal) | 7 años |
| Eventos de comportamiento | 2 años (rolling) |
| Perfil de lector calculado | Se elimina al eliminar tu cuenta o al desactivar Noetia Insights |
| Logs técnicos | 90 días |
| Datos de uso anónimos agregados | Indefinido (no identificables) |

## 6. Procesadores de datos de terceros

| Proveedor | Finalidad | Política de privacidad |
|-----------|-----------|------------------------|
| **Stripe** | Procesamiento de pagos, suscripciones y paquetes de tokens | stripe.com/privacy |
| **Google OAuth** | Inicio de sesión con Google | policies.google.com/privacy |
| **Facebook Login** | Inicio de sesión con Facebook | facebook.com/privacy |
| **Apple Sign In** | Inicio de sesión con Apple | apple.com/legal/privacy |
| **Sentry** | Monitoreo de errores técnicos (sin datos de contenido de fragmentos) | sentry.io/privacy |
| **MinIO (autoalojado)** | Almacenamiento de archivos de libros y audio en nuestro servidor | — |

No vendemos tus datos personales a ningún tercero. Los datos de perfil de lector solo se comparten con autores de forma **estrictamente agregada** (nunca individual) y solo cuando el conjunto tiene al menos 50 usuarios.

## 7. Tus derechos

Tienes derecho a:
- **Acceso**: solicitar una copia de tus datos personales, incluido tu perfil de lector calculado.
- **Rectificación**: corregir datos inexactos.
- **Supresión**: solicitar la eliminación de tu cuenta, contenido y perfil de lector.
- **Portabilidad**: recibir tus datos (fragmentos, notas, historial de lectura) en formato estructurado.
- **Oposición**: oponerte al análisis de perfil de lector desde los ajustes de privacidad, sin necesidad de eliminar tu cuenta.
- **Limitación del tratamiento**: solicitar que pausemos el procesamiento mientras resolvemos una disputa.

Para ejercer cualquiera de estos derechos, envía un correo a **legal@noetia.app** con el asunto "Derechos RGPD".

## 8. Ley aplicable

Esta política se rige por el **Reglamento General de Protección de Datos (RGPD)** de la Unión Europea y la legislación española vigente.

## 9. Usuarios de California (CCPA)

Si resides en California (EE. UU.), tienes derechos adicionales bajo la Ley de Privacidad del Consumidor de California:
- Derecho a saber qué datos personales hemos recopilado y cómo los usamos.
- Derecho a eliminar tus datos personales.
- Derecho a no discriminación por ejercer tus derechos de privacidad.
- Derecho a conocer si vendemos o compartimos tus datos (no lo hacemos a título individual).

Para solicitudes de privacidad CCPA, escríbenos a **legal@noetia.app**.

## 10. Cambios en esta política

Notificaremos cambios materiales por correo electrónico o mediante un aviso en la plataforma con al menos **30 días de antelación** para cambios que afecten a la base legal del tratamiento. El uso continuado del servicio tras la notificación implica aceptación.
`.trim();

export const PRIVACY_POLICY_EN = `
# Privacy Policy

**MVP Version — subject to legal review**
Last updated: ${LAST_UPDATED}

## 1. Data Controller

**Noetia** is operated by Carloskfe.
Contact email: **legal@noetia.app**
Privacy policy URL: **https://noetia.app/legal/privacy**

## 2. Data We Collect

| Category | Data | Source |
|----------|------|--------|
| Identity | Name, email address | Registration / OAuth |
| Social authentication | Google, Facebook, or Apple token | OAuth |
| Payment information | Subscription and token purchase history (managed by Stripe; we do not store card data) | Stripe |
| Reading activity | Progress per book, phrase position, minutes read, playback speed | App |
| User-created content | Saved fragments, notes, combined fragments | App |
| Behavioural events | Event type (fragment created, fragment shared, book viewed), associated book and timestamp | App |
| Fragment theme analysis | Automatic thematic tags (e.g. "love", "philosophy") assigned to each fragment you save | App |
| Reader Profile (*Persona*) | Dominant themes, engagement archetype, reading cadence, completion rate, preferred sharing platforms — computed periodically from your aggregated activity | System |
| Club participation | Messages, reading club discussions, poll votes | App |
| Technical data | IP address, device type, app errors | Logs / Sentry |
| Language and privacy preferences | Interface language, profile and activity visibility settings | App |

## 3. Legal Basis for Processing

- **Contract performance**: we process your identity and payment data to provide the subscription service.
- **Legitimate interest**: we process usage data to improve the platform, detect fraud, and analyse audience segments in aggregate.
- **Consent**: we process analytics and marketing cookies only with your explicit authorisation. Reader profile analysis can be disabled from your privacy settings.

## 4. Reader Profile Analysis (*Persona*)

Noetia builds a **derived reader profile** from your activity (saved fragments, reading patterns, shared content). This profile is not created by you but inferred automatically. It is used for:

- **Internal personalisation**: recommending books aligned with your intellectual taste.
- **Aggregate audience analysis**: understanding what reader segments exist on the platform.
- **Author statistics**: authors see aggregate statistics about what types of readers resonate with their books. **No individually identifiable data is ever shared with authors.**

You may disable profile analysis at any time from **Profile → Privacy → Contribute to Noetia Insights**. If you disable it, your data will not be used for profile calculations or aggregate audience statistics.

## 5. Retention Periods

| Data | Period |
|------|--------|
| Account and user content | Until you delete your account |
| Payment data (required by tax law) | 7 years |
| Behavioural events | 2 years (rolling) |
| Computed reader profile | Deleted when you delete your account or disable Noetia Insights |
| Technical logs | 90 days |
| Anonymous aggregate usage data | Indefinitely (non-identifiable) |

## 6. Third-Party Data Processors

| Provider | Purpose | Privacy Policy |
|----------|---------|----------------|
| **Stripe** | Payment processing, subscriptions, and token packages | stripe.com/privacy |
| **Google OAuth** | Sign in with Google | policies.google.com/privacy |
| **Facebook Login** | Sign in with Facebook | facebook.com/privacy |
| **Apple Sign In** | Sign in with Apple | apple.com/legal/privacy |
| **Sentry** | Technical error monitoring (no fragment content data) | sentry.io/privacy |
| **MinIO (self-hosted)** | Book and audio file storage on our own server | — |

We do not sell your personal data to any third party. Reader profile data is only shared with authors in **strictly aggregated form** (never individual) and only when the dataset contains at least 50 users.

## 7. Your Rights

You have the right to:
- **Access**: request a copy of your personal data, including your computed reader profile.
- **Rectification**: correct inaccurate data.
- **Erasure**: request deletion of your account, content, and reader profile.
- **Portability**: receive your data (fragments, notes, reading history) in a structured format.
- **Objection**: opt out of reader profile analysis from your privacy settings, without needing to delete your account.
- **Restriction**: request that we pause processing while we resolve a dispute.

To exercise any of these rights, send an email to **legal@noetia.app** with the subject "GDPR Rights".

## 8. Governing Law

This policy is governed by the **EU General Data Protection Regulation (GDPR)** and applicable Spanish legislation.

## 9. California Users (CCPA)

If you reside in California, USA, you have additional rights under the California Consumer Privacy Act:
- Right to know what personal data we have collected and how we use it.
- Right to delete your personal data.
- Right to non-discrimination for exercising your privacy rights.
- Right to know whether we sell or share your data (we do not, on an individual basis).

For CCPA privacy requests, contact us at **legal@noetia.app**.

## 10. Changes to This Policy

We will notify you of material changes by email or via a notice on the platform at least **30 days in advance** for changes affecting the legal basis for processing. Continued use of the service after notification constitutes acceptance.
`.trim();
