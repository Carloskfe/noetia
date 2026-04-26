## ADDED Requirements

### Requirement: ShareModal shows a live CSS preview of the quote card
The `ShareModal` component SHALL render a CSS-based preview of the quote card at the top of the modal. The preview SHALL update instantly when the user changes format, font, background type, or colours — with no API call. The preview SHALL display the fragment text, author name, and book title using the selected font and background.

#### Scenario: Preview renders with default options on open
- **WHEN** the `ShareModal` opens for a fragment
- **THEN** a CSS-rendered card is visible showing the fragment text, attribution, and default style (Lato font, classic navy solid background)

#### Scenario: Preview updates immediately when font changes
- **WHEN** the user selects a different font
- **THEN** the preview card re-renders with the new font applied, with no spinner or network call

#### Scenario: Preview updates immediately when background colour changes
- **WHEN** the user changes the background colour via the colour picker
- **THEN** the preview card background updates instantly and text colour adjusts automatically for contrast

#### Scenario: Preview aspect ratio reflects selected format
- **WHEN** the user selects "IG Story"
- **THEN** the preview card renders at 9:16 aspect ratio

#### Scenario: Preview aspect ratio reflects post format
- **WHEN** the user selects "IG Post"
- **THEN** the preview card renders at 1:1 aspect ratio

### Requirement: ShareModal provides format selection per platform
The `ShareModal` SHALL display a grid of format buttons covering all supported combinations: IG Post, IG Story, FB Post, FB Story, LI Post, WA. Selecting a format SHALL update the preview aspect ratio and determine the dimensions used when the PNG is generated.

#### Scenario: All six format options are visible
- **WHEN** the `ShareModal` is open
- **THEN** six format buttons are rendered: IG Post, IG Story, FB Post, FB Story, LI Post, WA

#### Scenario: Selecting a format marks it as active
- **WHEN** the user clicks "FB Story"
- **THEN** the "FB Story" button appears selected and the preview updates to 9:16 aspect ratio

### Requirement: ShareModal provides font selection with 5 predefined fonts
The `ShareModal` SHALL display 5 font option buttons. Each button SHALL show "Aa" rendered in that typeface. Selecting a font SHALL update the CSS preview and be included in the PNG generation request.

#### Scenario: Five font buttons are displayed
- **WHEN** the `ShareModal` is open
- **THEN** five font buttons are visible: Playfair Display, Lato, Merriweather, Dancing Script, Montserrat

#### Scenario: Selecting a font updates the preview
- **WHEN** the user clicks the "Dancing Script" font button
- **THEN** the preview card text renders in Dancing Script and the button appears selected

### Requirement: ShareModal provides background customisation with solid and gradient options
The `ShareModal` SHALL offer a background type toggle (Sólido / Degradado). In solid mode, one colour picker SHALL be shown. In gradient mode, two colour pickers (start and end) SHALL be shown. Background changes SHALL update the preview instantly.

#### Scenario: Solid mode shows one colour picker
- **WHEN** the background type is set to "Sólido"
- **THEN** exactly one colour picker input is visible

#### Scenario: Gradient mode shows two colour pickers
- **WHEN** the user selects "Degradado"
- **THEN** two colour picker inputs are visible (start colour and end colour)

#### Scenario: Changing a solid colour updates preview background
- **WHEN** the user picks hex `#FF6B6B` as the solid background colour
- **THEN** the preview card background becomes `#FF6B6B`

#### Scenario: Text colour adjusts automatically for light backgrounds
- **WHEN** the user selects a light background colour (luminance > 0.179)
- **THEN** the preview card text renders in dark navy (`#0D1B2A`)

#### Scenario: Text colour adjusts automatically for dark backgrounds
- **WHEN** the user selects a dark background colour (luminance ≤ 0.179)
- **THEN** the preview card text renders in white

### Requirement: ShareModal generates a PNG and offers Download and Copy Link only on commit
The `ShareModal` SHALL show "Descargar" and "Copiar enlace" action buttons. Clicking either SHALL trigger exactly one call to `POST /fragments/:id/share` with the current format, font, bgType, and bgColors. A loading spinner SHALL be shown while the request is in flight. On success, the generated image URL SHALL be used for the download or clipboard action.

#### Scenario: Download triggers generation and initiates file download
- **WHEN** the user clicks "Descargar"
- **THEN** a single `POST /fragments/:id/share` call is made with the selected options, and on success the browser downloads the PNG

#### Scenario: Copy Link triggers generation and copies URL to clipboard
- **WHEN** the user clicks "Copiar enlace"
- **THEN** a single `POST /fragments/:id/share` call is made, and on success the URL is written to the clipboard and the button label briefly shows "¡Copiado!"

#### Scenario: Generation failure shows an error message
- **WHEN** `POST /fragments/:id/share` returns a non-200 response
- **THEN** an error message "No se pudo generar la imagen" is shown and the action buttons remain available

#### Scenario: Loading state is shown during generation
- **WHEN** the `POST /fragments/:id/share` call is in flight
- **THEN** a loading spinner is visible and the action buttons are disabled

### Requirement: ShareModal shows optional caption from the fragment note
If the fragment has a non-null note, the `ShareModal` SHALL display the note text with a checkbox labelled "Usar como comentario". The checkbox SHALL default to unchecked. When checked, the note text SHALL be displayed as suggested caption copy for the user to manually paste into the social network.

#### Scenario: Caption section is visible when fragment has a note
- **WHEN** the `ShareModal` opens for a fragment with a non-null note
- **THEN** the note text is displayed alongside a "Usar como comentario" checkbox

#### Scenario: Caption section is hidden when fragment has no note
- **WHEN** the `ShareModal` opens for a fragment with a null note
- **THEN** no caption section is rendered

#### Scenario: Caption is not shown by default
- **WHEN** the `ShareModal` opens for a fragment with a note
- **THEN** the "Usar como comentario" checkbox is unchecked by default
