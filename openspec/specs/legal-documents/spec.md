## ADDED Requirements

### Requirement: Privacy Policy page is accessible at /legal/privacy
The web app SHALL serve a bilingual (ES/EN) Privacy Policy at `/legal/privacy` covering: data controller identity, categories of personal data collected (email, name, payment info, reading progress, fragments), legal basis for processing, retention periods, third-party processors (Stripe, Supabase/Auth.js, MinIO), user rights (access, rectification, erasure, portability), and contact information for data requests.

#### Scenario: Privacy policy page renders
- **WHEN** a user navigates to `/legal/privacy`
- **THEN** the page renders with both Spanish and English content and a "Última actualización / Last updated" date

#### Scenario: Privacy policy covers third-party processors
- **WHEN** the page content is inspected
- **THEN** it names Stripe (payments), MinIO (file storage), and authentication providers (Google, Facebook, Apple) as data processors

### Requirement: Terms of Service page is accessible at /legal/terms
The web app SHALL serve a bilingual (ES/EN) Terms of Service at `/legal/terms` covering: service description, eligibility, subscription plans and billing terms, DRM and content access restrictions, acceptable use, fragment sharing rules, intellectual property, disclaimers, limitation of liability, governing law (Spain), and contact information.

#### Scenario: Terms of service page renders
- **WHEN** a user navigates to `/legal/terms`
- **THEN** the page renders with both Spanish and English content

#### Scenario: Terms cover subscription billing
- **WHEN** the page content is inspected
- **THEN** it describes the Individual ($9.99/mo) and Dual Reader ($14.99/mo) plans and cancellation terms

### Requirement: Footer contains links to all legal pages
The web app's global footer SHALL include visible links to `/legal/cookies`, `/legal/privacy`, and `/legal/terms` on every page.

#### Scenario: Footer links are present
- **WHEN** any page with the global layout is rendered
- **THEN** the footer contains anchor elements pointing to all three legal pages in both languages

### Requirement: Legal pages are excluded from authentication requirement
The legal pages at `/legal/*` SHALL be publicly accessible without login.

#### Scenario: Unauthenticated user can access legal pages
- **WHEN** an unauthenticated user navigates to `/legal/privacy`
- **THEN** the page renders without a redirect to login
