# NEM-025 B2-A1: French email dictionary entries (engineering draft)

**Status:** an engineering draft only. It has **not** been reviewed by a human and is **not approved**. It is unreachable at runtime (see README §6).

**Columns:**
- **ES (source):** the existing Spanish copy, which is byte-identical to the original.
- **fr-CA draft:** the new French. `⍽` marks a non-breaking space (U+00A0). `{…}` marks an interpolated value.
- Interpolated user values are escaped before insertion (`SafeHtml`).
- Where wording depends on the count, both the 1-token and 3-token outputs are shown.

**Provisional conventions** (fr-CA terminology guide, PR #79). All are pending PO decisions D-T1 to D-T6:
- the "vous" register (D-T1);
- **jeton** for Token (D-T2);
- **Écoute active** for Escucha Activa (D-T3);
- **courriel** for email;
- **forfait** for plan.

**Québec punctuation:**
- no space before `?` or `!`;
- a non-breaking space before `:`;
- `« … »` with inner non-breaking spaces;
- typographic apostrophe `’`.

| # | Key | ES (source) | fr-CA draft |
|---|---|---|---|
| 1 | `common.tagline` | Lee. Escucha. Comparte. | Lisez. Écoutez. Partagez. |
| 2 | `common.rightsReserved` | Todos los derechos reservados. | Tous droits réservés. |
| 3 | `common.linkFallbackBrowser` | Si el botón no funciona, copia este enlace en tu navegador: | Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur⍽: |
| 4 | `common.linkFallbackShort` | Si el botón no funciona, copia este enlace: | Si le bouton ne fonctionne pas, copiez ce lien⍽: |
| 5 | `confirmation.subject` | Confirma tu cuenta en Noetia | Confirmez votre compte Noetia |
| 6 | `confirmation.greeting` | ¡Bienvenido/a, {name}! | Bienvenue, {name}! |
| 7 | `confirmation.body` | Gracias por crear tu cuenta. Confirma tu dirección de correo para comenzar a leer, escuchar y compartir fragmentos. | Merci d’avoir créé votre compte. Confirmez votre adresse courriel pour commencer à lire, à écouter et à partager des fragments. |
| 8 | `confirmation.cta` | Confirmar mi cuenta | Confirmer mon compte |
| 9 | `confirmation.expiry` | Este enlace expira en 24 horas. Si no creaste esta cuenta, ignora este mensaje. | Ce lien expire dans 24 heures. Si vous n’avez pas créé ce compte, vous pouvez ignorer ce courriel. |
| 10 | `passwordReset.subject` | Recupera tu contraseña en Noetia | Réinitialisez votre mot de passe Noetia |
| 11 | `passwordReset.greeting` | Hola, {name} | Bonjour {name}, |
| 12 | `passwordReset.body` | Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón para crear una nueva. | Nous avons reçu une demande de réinitialisation du mot de passe de votre compte. Cliquez sur le bouton ci-dessous pour en créer un nouveau. |
| 13 | `passwordReset.cta` | Restablecer contraseña | Réinitialiser le mot de passe |
| 14 | `passwordReset.expiry` | Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este mensaje — tu contraseña no será modificada. | Ce lien expire dans 1 heure. Si vous n’avez pas demandé ce changement, vous pouvez ignorer ce courriel⍽: votre mot de passe ne sera pas modifié. |
| 15 | `farewell.subject` | Tu cuenta de Noetia ha sido eliminada | Votre compte Noetia a été supprimé |
| 16 | `farewell.greeting` | Hasta pronto, {name}. | À bientôt, {name}. |
| 17 | `farewell.body` | Tu cuenta ha sido eliminada correctamente. Todos tus datos — fragmentos, biblioteca y preferencias — han sido borrados de nuestros sistemas. | Votre compte a bien été supprimé. Toutes vos données — fragments, bibliothèque et préférences — ont été effacées de nos systèmes. |
| 18 | `farewell.registerAgain` | Si cambiaste de opinión o eliminaste tu cuenta por error, puedes volver a registrarte en cualquier momento en {registerLink}. | Si vous avez changé d’avis ou supprimé votre compte par erreur, vous pouvez vous réinscrire à tout moment sur {registerLink}. |
| 19 | `farewell.thanks` | Gracias por haber sido parte de la comunidad Noetia. Esperamos verte de nuevo. | Merci d’avoir fait partie de la communauté Noetia. Nous espérons vous revoir bientôt. |
| 20 | `waitlistConfirmation.subject` | ¡Estás en la lista de espera de Noetia! | Vous êtes sur la liste d’attente de Noetia! |
| 21 | `waitlistConfirmation.heading` | ¡Ya estás en la lista, {name}! | Vous êtes sur la liste, {name}! |
| 22 | `waitlistConfirmation.intro` | Gracias por tu interés en Noetia. Somos una plataforma de lectura sincronizada con audio y generación de citas visuales para compartir en redes sociales. | Merci de votre intérêt pour Noetia. Nous sommes une plateforme de lecture synchronisée avec l’audio, qui permet aussi de créer des citations visuelles à partager sur les réseaux sociaux. |
| 23 | `waitlistConfirmation.notify` | Te avisaremos por este correo en cuanto tu acceso beta esté disponible. No necesitas hacer nada más. | Nous vous écrirons à cette adresse dès que votre accès bêta sera disponible. Vous n’avez rien d’autre à faire. |
| 24 | `waitlistConfirmation.whatIs` | ¿Qué es Noetia? | Qu’est-ce que Noetia? |
| 25 | `waitlistConfirmation.activeListening` | Escucha Activa | Écoute active |
| 26 | `waitlistConfirmation.activeListeningDesc` | texto y audio sincronizados frase por frase. | texte et audio synchronisés phrase par phrase. |
| 27 | `waitlistConfirmation.fragments` | Fragmentos | Fragments |
| 28 | `waitlistConfirmation.fragmentsDesc` | captura las ideas que más te impactan. | saisissez les idées qui vous marquent le plus. |
| 29 | `waitlistConfirmation.share` | Comparte | Partagez |
| 30 | `waitlistConfirmation.shareDesc` | crea tarjetas visuales para LinkedIn, Instagram y más. | créez des cartes visuelles pour LinkedIn, Instagram et plus encore. |
| 31 | `waitlistInvite.subject` | ¡Tu acceso a Noetia Beta está listo! | Votre accès à Noetia Bêta est prêt! |
| 32 | `waitlistInvite.eyebrow` | Acceso Beta | Accès bêta |
| 33 | `waitlistInvite.heading` | Tu acceso está listo, {name} | Votre accès est prêt, {name} |
| 34 | `waitlistInvite.body` | Eres uno de los primeros lectores en acceder a Noetia. Crea tu cuenta y empieza a leer con el modo de Escucha Activa. | Vous faites partie des premiers lecteurs à accéder à Noetia. Créez votre compte et commencez à lire avec le mode Écoute active. |
| 35 | `waitlistInvite.cta` | Crear mi cuenta → | Créer mon compte → |
| 36 | `giftCard.subject` | {buyer} te regala 1 token en Noetia · {buyer} te regala 3 tokens en Noetia | {buyer} vous offre 1 jeton Noetia · {buyer} vous offre 3 jetons Noetia |
| 37 | `giftCard.heading` | <strong>{buyer}</strong> te envía un regalo | <strong>{buyer}</strong> vous offre un cadeau |
| 38 | `giftCard.tokenLabel` | 1: Noetia Token · 3: Noetia Tokens | 1: Jeton Noetia · 3: Jetons Noetia |
| 39 | `giftCard.eachToken` | Cada token desbloquea un libro de tu elección | Chaque jeton débloque un livre de votre choix |
| 40 | `giftCard.quote` | "{message}" | «⍽{message}⍽» |
| 41 | `giftCard.cta` | Reclamar mi regalo → | Réclamer mon cadeau → |
| 42 | `giftCard.validity` | Este regalo es válido por 1 año. | Ce cadeau est valide pendant 1 an. |
| 43 | `giftConfirmation.subject` | Tu regalo de Noetia fue enviado a {recipient} | Votre cadeau Noetia a été envoyé à {recipient} |
| 44 | `giftConfirmation.heading` | ¡Tu regalo fue enviado! 🎁 | Votre cadeau a été envoyé! 🎁 |
| 45 | `giftConfirmation.body` | Hola {buyer}, enviamos <strong>1 token Noetia</strong> a <strong>{recipient}</strong>. Cuando los reclamen podrán desbloquear libros de su elección. ‖ Hola {buyer}, enviamos <strong>3 tokens Noetia</strong> a <strong>{recipient}</strong>. Cuando los reclamen podrán desbloquear libros de su elección. | Bonjour {buyer}, nous avons envoyé <strong>1 jeton Noetia</strong> à <strong>{recipient}</strong>. Dès que la personne l’aura réclamé, elle pourra débloquer un livre de son choix. ‖ Bonjour {buyer}, nous avons envoyé <strong>3 jetons Noetia</strong> à <strong>{recipient}</strong>. Dès que la personne les aura réclamés, elle pourra débloquer des livres de son choix. |
| 46 | `giftConfirmation.questions` | ¿Tienes preguntas? Escríbenos a {support} | Des questions? Écrivez-nous à {support} |
| 47 | `planInvite.subject` | {inviter} te invita a Noetia {plan} | {inviter} vous invite à Noetia {plan} |
| 48 | `planInvite.heading` | Te han invitado a leer juntos | Une invitation à lire ensemble |
| 49 | `planInvite.body` | <strong>{inviter}</strong> te está invitando a unirte a su plan <strong>{plan}</strong> en Noetia. Con este plan comparten tokens para desbloquear libros, cada uno con su biblioteca personal. | <strong>{inviter}</strong> vous invite à rejoindre son forfait <strong>{plan}</strong> sur Noetia. Avec ce forfait, vous partagez des jetons pour débloquer des livres, et chaque personne garde sa propre bibliothèque. |
| 50 | `planInvite.cta` | Aceptar invitación → | Accepter l’invitation → |
| 51 | `planInvite.expiry` | Este enlace expira en 48 horas. Si no esperabas esta invitación, puedes ignorar este mensaje. | Ce lien expire dans 48 heures. Si vous n’attendiez pas cette invitation, vous pouvez ignorer ce courriel. |

## Notes per entry

| # | Note |
|---|---|
| 1 | Imperative "vous" form, mirroring the ES tagline. |
| 3, 4, 14 | Non-breaking space before `:` (Québec convention). |
| 6, 21, 33 | ES uses the inclusive "Bienvenido/a". The French "Bienvenue" is gender-neutral. 21 and 33 add nothing gendered. |
| 11 | "Bonjour {name}," follows French letter convention. ES "Hola, {name}" has no trailing punctuation. Layout is unchanged. |
| 17 | **Legal-sensitive.** A faithful translation of the existing ES/EN data-erasure statement, with no change of meaning (PO instruction A1-2). Per PR #82 §6.1 (SP-1), this statement is not fully accurate today. French E-4 **must not be released** before SP-1 is fixed or legal review is done (B2-D5). |
| 18 | `{registerLink}` is the server-built `noetia.app` anchor. Its markup is unchanged. |
| 25 | "Écoute active" depends on D-T3. ES keeps the proper noun "Escucha Activa"; EN translates it as "Active Listening". |
| 27 | "Fragments" is identical in EN and French. It is the agreed product term, so it is allowlisted in the completeness test. |
| 31, 32 | "Bêta" is spelled the French way. |
| 34 | "premiers lecteurs" is a masculine generic, matching ES "primeros lectores". Inclusive wording is decision D-T4. |
| 36, 38, 45 | **jeton/jetons** (D-T2). French plural: n ≤ 1 is singular. Callers only use 1 or 3. The token label is capitalized ("Jeton Noetia") like ES "Noetia Token". |
| 40 | French guillemets replace the ASCII `"…"` used in ES/EN. |
| 42 | "valide pendant 1 an" keeps the 1-year gift validity (no commercial change). |
| 45 | The 1-token sentence says "un livre" ("a book") and the 3-token sentence "des livres" ("books"). ES/EN say "books" in both cases. One token unlocks one book, so the commercial meaning is unchanged; flagged for review. |
| 46 | `{support}` is the `SUPPORT_EMAIL` constant (`hola@noetia.app`, unchanged; PR #75 governs any change). |
| 47, 49 | Plan names come from the database (`plans.name`) and are not translated (D-T6). "forfait" is the provisional term. |
| 48 | "Une invitation à lire ensemble" avoids the gendered passive "Vous êtes invité(e)". |
| 9, 14, 51 | Validity periods 24 h / 1 h / 48 h are kept exactly. |
