## ADDED Requirements

### Requirement: Each fragment card in the Fragment Sheet has a Share button
The Fragment Sheet SHALL render a "Compartir" (Share) icon button on each fragment card. Clicking it SHALL open the platform picker for that fragment.

#### Scenario: Share button is visible on each fragment card
- **WHEN** the Fragment Sheet is open with at least one fragment
- **THEN** each fragment card displays a share icon button

#### Scenario: Clicking Share opens the platform picker
- **WHEN** the user clicks the share button on a fragment card
- **THEN** the platform picker component is displayed for that fragment

### Requirement: Platform picker lets the user choose a target social platform
The `SharePicker` component SHALL display four options: LinkedIn, Instagram, Facebook, WhatsApp. Selecting a platform SHALL trigger a call to `POST /fragments/:id/share` with the chosen platform and show a loading state while the request is in flight.

#### Scenario: User selects a platform and generation succeeds
- **WHEN** the user selects "LinkedIn" in the platform picker
- **THEN** a loading indicator is shown, `POST /fragments/:id/share` is called with `{ platform: "linkedin" }`, and on success the share preview modal opens

#### Scenario: Generation failure shows an error message
- **WHEN** the `POST /fragments/:id/share` call returns a non-200 response
- **THEN** an error message "No se pudo generar la imagen" is shown and the picker remains open

### Requirement: Share preview modal shows the generated image with download and copy-link actions
The `SharePreviewModal` component SHALL display the pre-signed image URL in an `<img>` tag, a "Descargar" button that triggers a file download, and a "Copiar enlace" button that copies the URL to clipboard.

#### Scenario: Preview modal displays the generated image
- **WHEN** the share preview modal opens with a valid URL
- **THEN** an image element with the pre-signed URL as `src` is rendered

#### Scenario: Download button triggers file download
- **WHEN** the user clicks "Descargar"
- **THEN** the browser initiates a download of the PNG file

#### Scenario: Copy link copies URL to clipboard
- **WHEN** the user clicks "Copiar enlace"
- **THEN** the pre-signed URL is written to the clipboard and the button label briefly changes to "¡Copiado!"
