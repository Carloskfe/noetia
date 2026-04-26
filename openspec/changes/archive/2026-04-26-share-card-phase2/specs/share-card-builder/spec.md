## MODIFIED Requirements

### Requirement: ShareModal provides font selection with 5 predefined fonts
The `ShareModal` SHALL display 5 font option buttons. Each button SHALL show a small thumbnail PNG image (`/presets/{font-id}.png`) rendered in that typeface on a dark background. Selecting a font SHALL update the CSS preview and be included in the PNG generation request.

#### Scenario: Five font thumbnail buttons are displayed
- **WHEN** the `ShareModal` is open
- **THEN** five font buttons are visible, each showing a thumbnail image for: Playfair Display, Lato, Merriweather, Dancing Script, Montserrat

#### Scenario: Selecting a font updates the preview
- **WHEN** the user clicks the "Dancing Script" font thumbnail
- **THEN** the preview card text renders in Dancing Script and the button appears selected

### Requirement: ShareModal provides format selection per platform
The `ShareModal` SHALL display a grid of format buttons covering all supported combinations: IG Post, IG Story, FB Post, FB Story, LI Post, WA Pic, WA Story, Reel, Twitter/X Card. Selecting a format SHALL update the preview aspect ratio and determine the dimensions used when the PNG is generated.

#### Scenario: All nine format options are visible
- **WHEN** the `ShareModal` is open
- **THEN** nine format buttons are rendered: IG Post, IG Story, FB Post, FB Story, LI Post, WA Pic, WA Story, Reel, Twitter/X Card

#### Scenario: Selecting a format marks it as active
- **WHEN** the user clicks "WA Story"
- **THEN** the "WA Story" button appears selected and the preview updates to 9:16 aspect ratio

#### Scenario: Selecting Twitter/X Card updates preview to 16:9 aspect ratio
- **WHEN** the user clicks "Twitter/X Card"
- **THEN** the preview renders at 16:9 aspect ratio

#### Scenario: Selecting Reel updates preview to 9:16 aspect ratio
- **WHEN** the user clicks "Reel"
- **THEN** the preview renders at 9:16 aspect ratio

## ADDED Requirements

### Requirement: ShareModal provides a manual text color override
The `ShareModal` SHALL display a colour picker labelled "Color del texto" below the background controls. It SHALL default to the auto-luminance colour (white or dark navy, computed from the current background). When the user picks a colour, that value SHALL override auto-luminance in the CSS preview and be sent as `textColor` in the PNG generation request. A "Restablecer" link SHALL reset the override and restore auto-luminance.

#### Scenario: Text color picker defaults to auto-luminance colour
- **WHEN** the `ShareModal` opens with a dark background
- **THEN** the text colour picker shows white (`#FFFFFF`) as its initial value

#### Scenario: Picking a custom text colour updates the CSS preview
- **WHEN** the user selects `#FF6B6B` in the text colour picker
- **THEN** the preview card text renders in `#FF6B6B`

#### Scenario: "Restablecer" removes the manual override
- **WHEN** the user clicks "Restablecer" after picking a custom colour
- **THEN** the text colour reverts to the auto-luminance value for the current background

#### Scenario: Custom text colour is included in the generation request
- **WHEN** the user has selected a custom text colour and clicks "Descargar"
- **THEN** the `POST /fragments/:id/share` request includes `textColor: "#FF6B6B"`

#### Scenario: Generation request omits textColor when auto-luminance is active
- **WHEN** the user has not overridden the text colour (or has reset it)
- **THEN** the `POST /fragments/:id/share` request does not include the `textColor` field
