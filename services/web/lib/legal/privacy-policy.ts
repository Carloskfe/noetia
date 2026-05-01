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
| Información de pago | Historial de suscripciones (gestionado por Stripe; no almacenamos datos de tarjeta) | Stripe |
| Actividad de lectura | Progreso por libro, posición de frase, velocidad de reproducción | App |
| Contenido creado | Fragmentos guardados, notas, fragmentos combinados | App |
| Datos técnicos | Dirección IP, tipo de dispositivo, errores de la app | Logs |

## 3. Base legal para el tratamiento

- **Ejecución de contrato**: procesamos tus datos de identidad y pago para prestarte el servicio de suscripción.
- **Interés legítimo**: procesamos datos de uso para mejorar la plataforma y detectar fraudes.
- **Consentimiento**: procesamos cookies analíticas y de marketing solo si lo autorizas expresamente.

## 4. Períodos de retención

| Datos | Período |
|-------|---------|
| Cuenta y contenido de usuario | Hasta que elimines tu cuenta |
| Datos de pago (requerido por ley fiscal) | 7 años |
| Logs técnicos | 90 días |
| Datos de uso anónimos | Indefinido (no identificables) |

## 5. Procesadores de datos de terceros

| Proveedor | Finalidad | Política de privacidad |
|-----------|-----------|------------------------|
| **Stripe** | Procesamiento de pagos y suscripciones | stripe.com/privacy |
| **Google OAuth** | Inicio de sesión con Google | policies.google.com/privacy |
| **Facebook Login** | Inicio de sesión con Facebook | facebook.com/privacy |
| **Apple Sign In** | Inicio de sesión con Apple | apple.com/legal/privacy |
| **MinIO (autoalojado)** | Almacenamiento de archivos de libros y audio | — |

No vendemos tus datos personales a ningún tercero.

## 6. Tus derechos

Tienes derecho a:
- **Acceso**: solicitar una copia de tus datos personales.
- **Rectificación**: corregir datos inexactos.
- **Supresión**: solicitar la eliminación de tu cuenta y datos.
- **Portabilidad**: recibir tus datos en formato estructurado.
- **Oposición**: oponerte al tratamiento basado en interés legítimo.

Para ejercer cualquiera de estos derechos, envía un correo a **legal@noetia.app** con el asunto "Derechos RGPD".

## 7. Ley aplicable

Esta política se rige por el **Reglamento General de Protección de Datos (RGPD)** de la Unión Europea y la legislación española vigente.

## 8. Usuarios de California (CCPA)

Si resides en California (EE. UU.), tienes derechos adicionales bajo la Ley de Privacidad del Consumidor de California:
- Derecho a saber qué datos personales hemos recopilado.
- Derecho a eliminar tus datos personales.
- Derecho a no discriminación por ejercer tus derechos de privacidad.

Para solicitudes de privacidad CCPA, escríbenos a **legal@noetia.app**.

## 9. Cambios en esta política

Notificaremos cambios materiales por correo electrónico o mediante un aviso en la plataforma. El uso continuado del servicio tras la notificación implica aceptación.
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
| Payment information | Subscription history (managed by Stripe; we do not store card data) | Stripe |
| Reading activity | Progress per book, phrase position, playback speed | App |
| User-created content | Saved fragments, notes, combined fragments | App |
| Technical data | IP address, device type, app errors | Logs |

## 3. Legal Basis for Processing

- **Contract performance**: we process your identity and payment data to provide the subscription service.
- **Legitimate interest**: we process usage data to improve the platform and detect fraud.
- **Consent**: we process analytics and marketing cookies only with your explicit authorisation.

## 4. Retention Periods

| Data | Period |
|------|--------|
| Account and user content | Until you delete your account |
| Payment data (required by tax law) | 7 years |
| Technical logs | 90 days |
| Anonymous usage data | Indefinitely (non-identifiable) |

## 5. Third-Party Data Processors

| Provider | Purpose | Privacy Policy |
|----------|---------|----------------|
| **Stripe** | Payment and subscription processing | stripe.com/privacy |
| **Google OAuth** | Sign in with Google | policies.google.com/privacy |
| **Facebook Login** | Sign in with Facebook | facebook.com/privacy |
| **Apple Sign In** | Sign in with Apple | apple.com/legal/privacy |
| **MinIO (self-hosted)** | Book and audio file storage | — |

We do not sell your personal data to any third party.

## 6. Your Rights

You have the right to:
- **Access**: request a copy of your personal data.
- **Rectification**: correct inaccurate data.
- **Erasure**: request deletion of your account and data.
- **Portability**: receive your data in a structured format.
- **Objection**: object to processing based on legitimate interest.

To exercise any of these rights, send an email to **legal@noetia.app** with the subject "GDPR Rights".

## 7. Governing Law

This policy is governed by the **EU General Data Protection Regulation (GDPR)** and applicable Spanish legislation.

## 8. California Users (CCPA)

If you reside in California, USA, you have additional rights under the California Consumer Privacy Act:
- Right to know what personal data we have collected.
- Right to delete your personal data.
- Right to non-discrimination for exercising your privacy rights.

For CCPA privacy requests, contact us at **legal@noetia.app**.

## 9. Changes to This Policy

We will notify you of material changes by email or via a notice on the platform. Continued use of the service after notification constitutes acceptance.
`.trim();
