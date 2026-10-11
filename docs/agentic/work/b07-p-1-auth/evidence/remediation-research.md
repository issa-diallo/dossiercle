# Recherche de remédiation B07 — versions et extensions Better Auth

2026-10-11. Lecture primaire bornée, /tmp uniquement. Aucun paquet, binaire, image, runtime ou installation ; worktree B07 gelé inchangé. **Aucun candidat résolvant le hash irréversible identifié ; aucune version adoptée.** Ce constat porte sur les sources examinées, pas sur une impossibilité globale de Better Auth.

## Versions et source exacte

L’endpoint [dist-tags officiel](https://registry.npmjs.org/-/package/better-auth/dist-tags) retourne `latest: 1.7.7`. Les autres tags sont alpha/beta/rc/canary ou branches `release-1.4: 1.4.22`, `release-1.6: 1.6.33`. Aucun successeur stable proposé par ces tags. La [release v1.7.7](https://github.com/better-auth/better-auth/releases/tag/v1.7.7) est non-draft, non-prerelease, immuable, publiée le 2026-09-30 ; son changelog rapporte notamment correctifs Magic Link/OAuth Proxy et concurrence rate limits Drizzle, aucune nouvelle capacité de hash secours annoncée. Les anciennes branches ne sont pas proposées en substitution : leur couverture des correctifs requis par Q4 et leur compatibilité ne sont pas établies ici ; elles n’ont pas été qualifiées pour ce problème.

Le [ref v1.7.7](https://api.github.com/repos/better-auth/better-auth/git/ref/tags/v1.7.7) résout le commit `db02f233918ad1233bf0753e437e1c0da353273d`, identique à la recherche initiale. Toutes les lectures code/docs ci-dessous portent sur ce commit, pas sur main.

## Contrat backup natif : gap confirmé

[BackupCodeOptions et implémentation](https://github.com/better-auth/better-auth/blob/db02f233918ad1233bf0753e437e1c0da353273d/packages/better-auth/src/plugins/two-factor/backup-codes/index.ts) :

- `storeBackupCodes` accepte `plain`, `encrypted` ou `{ encrypt(token: string): Promise<string>; decrypt(token: string): Promise<string> }`.
- Le token est la liste JSON complète. `getBackupCodes` restitue cette liste ; `verifyBackupCode` fait `codes.includes(code)` puis filtre le code brut. Aucun callback officiel de vérification par hash dans cette option.
- `customBackupCodesGenerate: () => string[]` personnalise la génération ; il ne remplace pas la vérification ni le stockage.
- `viewBackupCodes` côté serveur restitue les valeurs après déchiffrement. Bloquer la route HTTP ne supprime pas leur réversibilité.
- Le CAS natif vérifie l’ancienne valeur avant mise à jour via `incrementOne`. Ce fait source n’est pas un test PostgreSQL ni une preuve de transaction complète de régénération.

La [doc 2FA versionnée](https://github.com/better-auth/better-auth/blob/db02f233918ad1233bf0753e437e1c0da353273d/docs/content/docs/plugins/2fa.mdx) décrit elle aussi plain/encrypted/custom encryptor pour les secours. Son option de hash concerne les **OTP**, pas les backup codes ; les confondre inventerait une capacité. Le défaut plain affiché dans cette doc diffère du défaut encrypted réellement composé dans le plugin : la source exacte gouverne ici.

Aucune option `disableBackupCodes` trouvée dans [TwoFactorOptions](https://github.com/better-auth/better-auth/blob/db02f233918ad1233bf0753e437e1c0da353273d/packages/better-auth/src/plugins/two-factor/types.ts), la doc 2FA ou le composant natif examiné. Celui-ci compose les endpoints TOTP, OTP et backup sans registre configurable de nouveaux facteurs. La demande « désactiver les secours et brancher un facteur custom » ne correspond donc pas à une recette officielle identifiée dans ce tag.

## Extension officielle : capacité générale, pas protocole de facteur qualifié

La [doc Plugins versionnée](https://github.com/better-auth/better-auth/blob/db02f233918ad1233bf0753e437e1c0da353273d/docs/content/docs/concepts/plugins.mdx) documente `BetterAuthPlugin`, `createAuthEndpoint`, `schema`, hooks before/after, middleware, rate limits et `context.adapter`/`internalAdapter`. Les hooks peuvent couvrir également les appels directs ; middleware ne couvre que les requêtes. Les chemins de plugin doivent être distincts. Ces API permettent une extension **développée et maintenue par nous**, pas un module officiel prêt à fournir des codes hashés.

Le backup natif importe `verifyTwoFactor` et les helpers de lockout depuis un fichier interne relatif. L’export public du paquet `./plugins/two-factor` expose index/types/client ; aucun contrat public de remplacement du vérificateur/challenge n’a été identifié. La documentation d’un plugin général ne prouve pas que l’on peut terminer correctement le challenge MFA natif, gérer tentative/lockout/session et préserver CSRF sans dépendre d’internals. Aucun protocole encrypt/decrypt détourné, override de routes ou import privé n’est recommandé comme solution qualifiée.

## Proposition pour la prochaine décision humaine

**A — préserver Q4 et demander une capacité officiellement supportée : recommandé.** Garder B07 BLOCKED. Préparer un contrat de besoin pour une extension éditeur ou une future release : stockage irréversible, génération affichée une fois, vérification supportée, consommation PG atomique, régénération fraîche+TOTP invalidant tout, aucune relecture serveur et transition de challenge native documentée. Refaire matrice/avis/peers si version change. Aucun contact éditeur envoyé ; attendre une version n’a pas de délai garanti.

**B — autoriser une étude d’extension applicative de sécurité, pas son implémentation : alternative.** Utiliser seulement API publiques et primitives reconnues si le raccord challenge peut être établi. Un ADR sécurité doit décider maintenance, revue indépendante, threat model, stockage/hash/entropie, transactions PG, routes internes et fermeture de toute voie native récupérable. Préalable : identifier un raccord public documenté au challenge ; sans cela, cette voie reste BLOCKED et ne justifie pas une auth maison. Coût et calendrier inconnus, potentiellement hors six heures du POC ; aucune extension de budget implicite.

**C — accepter des codes chiffrés réversibles : non recommandé.** Change l’exigence produit Q4/ADR003 et requiert décision explicite. Une UI sans relecture ne satisfait pas le hash. Ce choix n’est pas préparé comme adoption.

B12 peut poursuivre le bootstrap/supply chain et l’intégration core auth avec claims limités ; aucun B07 PASS ni full MFA implicite. Requalifier lockfile, SBOM, schéma, routes et contrats si résolution B07 les modifie.

## Mesure et intégrité

Réponses archivées dans `/tmp/b07-remediation-sources/`, ledger `ledger.json`. Corps HTTP reçus : 109643 octets. Réserve transport/en-têtes : 32 768 octets (estimation conservatrice, pas mesure réseau exacte). Charge additionnelle : 142411 octets ; cumul recherche B07 : 719388 octets imputés aux 2 Go. Plafond additionnel 5 Mo respecté. Aucun full registry, archive tarball ou recherche sans borne.

| Réponse | Octets | SHA-256 |
|---|---:|---|
| dist-tags.json | 178 | `df1889df6ffe4515d12a5e063af6154d6b15ff685f8b82fc20e2b47aece10030` |
| latest-metadata.json | 15640 | `2197676fde1b0662a560136d1179c0064b0490e14d081490e3ef460420bd3181` |
| latest-tag-ref.json | 347 | `afbd2cb8f375f6663170e46e1a02b60d94d092168c4f61d6fe2a3bc68e4f6ce2` |
| release.json | 5367 | `c7cac5d2ec38367f95bcefb7514758bd10c6624c59f3773090d4a4e9e45cb922` |
| docs-2fa.mdx | 24007 | `cc09ba56f0b069460ff3cef435eb22ba104ebf977298b62997b955d57ac464ad` |
| docs-plugins.mdx | 27178 | `18305a35962d8d91f7c06de22487ef32f11daaf8d473da90ef7ae54a5ffe4b2e` |
| twofactor-types.ts | 3043 | `bdf95a44472fced357121288a857accfc648a8724d6e73a090744c6f7226fd53` |
| twofactor-index.ts | 17838 | `c65179cfb4efdb8eeb47e7e8f87881b6ac14787b466b3121250050610bb2d36b` |
| twofactor-backup.ts | 16045 | `602c34b8efc5fa0bac9c599716aae7c2ebc93930f388967e5b1d7bac8ad01aa8` |
