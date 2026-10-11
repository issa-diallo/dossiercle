# Revue critique du mécanisme natif Better Auth 1.7.7 — B07

Date : 2026-10-11. **Research du candidat « codes de secours natifs conformes par configuration » : BLOCKED.** Aucun verdict global d’impossibilité de Better Auth. Aucun runtime, paquet, image ou dépendance installé ; aucun fichier de worktree modifié.

## Sources exactes et budget

Lecture indépendante des fichiers au tag `v1.7.7`, réponses de source enregistrées dans `/tmp/dossiercle-b07-native-source-records.json` :

| Fichier | Octets | SHA-256 du corps |
|---|---:|---|
| packages/better-auth/src/plugins/two-factor/types.ts | 3 043 | bdf95a44472fced357121288a857accfc648a8724d6e73a090744c6f7226fd53 |
| packages/better-auth/src/plugins/two-factor/index.ts | 17 838 | c65179cfb4efdb8eeb47e7e8f87881b6ac14787b466b3121250050610bb2d36b |
| packages/better-auth/src/plugins/two-factor/backup-codes/index.ts | 16 045 | 602c34b8efc5fa0bac9c599716aae7c2ebc93930f388967e5b1d7bac8ad01aa8 |

Total des corps de source lus : **70 809 octets**, plafond 5 000 000. Deux chemins exploratoires backup-codes.ts et backup-codes/utils.ts ont retourné 404 ; aucune source extrapolée depuis ces réponses et leurs corps d’erreur n’ont pas été consommés par le script. Les metadata exactes de préflight antérieur représentaient 568 200 octets ; même cumul conservateur sources+préflight = 639 009 octets. Pas de full registry ni téléchargement runtime. Le builder a résolu le tag vers commit `db02f233918ad1233bf0753e437e1c0da353273d` ; le reviewer a ensuite relu indépendamment backup-codes/index.ts et index.ts aux URLs de ce commit immutable. Les octets/hashes sont identiques aux deux sources du tag (33 883 octets supplémentaires inclus dans le total). Les URL immutables et égalités sont archivées dans le ledger /tmp. Tarball integrity reste à vérifier au gel d’installation.

URLs :
- https://raw.githubusercontent.com/better-auth/better-auth/v1.7.7/packages/better-auth/src/plugins/two-factor/types.ts
- https://raw.githubusercontent.com/better-auth/better-auth/v1.7.7/packages/better-auth/src/plugins/two-factor/index.ts
- https://raw.githubusercontent.com/better-auth/better-auth/v1.7.7/packages/better-auth/src/plugins/two-factor/backup-codes/index.ts

## Ce que prouve la source native

1. `BackupCodeOptions.storeBackupCodes` (backup-codes/index.ts:46–55) admet `plain`, `encrypted` ou paire `encrypt(token):Promise<string>` / `decrypt(token):Promise<string>`. Pas mode hash ni fonction documentée de comparaison hash candidat dans ce contrat typé. `customBackupCodesGenerate` génère les codes ; il ne remplace pas leur validation.
2. Le plugin twoFactor (index.ts:54–56) choisit encrypted par défaut. `encodeBackupCodes` JSON-sérialise la liste puis chiffre ou appelle custom encrypt (backup-codes:72–87).
3. `verifyBackupCode` appelle `getBackupCodes`, déchiffre/parse la liste et vérifie `codes.includes(data.code)` (103–141). La vérification native suppose donc une liste de valeurs reconnues par comparaison directe au code fourni.
4. `viewBackupCodes` est explicitement **server-only**, non exposé HTTP dans cette version. Il charge DB et retourne les codes déchiffrés ; ne pas présenter à tort une route HTTP publique. Néanmoins le serveur et sa clé peuvent relire les codes : bloquer cette API seule ne rend pas le stockage irréversible.
5. La consommation après validation utilise **CAS** : adapter.incrementOne avec conditions `id` et ancien `backupCodes`, puis écrit la liste réduite. Une requête concurrente basée sur ancienne liste doit échouer CONFLICT si l’adaptateur garantit CAS. **Ne pas dire que le natif n’a aucune mesure d’atomicité.** Reste à prouver avec adaptateur Drizzle exact/PostgreSQL, deux processus et scénarios session/regen/échec. Lecture source ≠ test runtime.
6. Régénération native vérifie mot de passe puis remplace la liste via adapter.update. Le parcours Q4 demande session fraîche + TOTP courant et invalidation atomique concurrente des anciens codes ; configuration/guards/concurrence doivent être conçus et prouvés, pas présumés par cette route.

## Pourquoi le couple encrypt/decrypt ne résout pas le hash

Remplacer encrypt par un hash irréversible ne permet pas à decrypt de restituer la liste nécessaire à includes(code). Retourner la liste des hashes ne correspond pas au code brut fourni. Transformer secrètement le code entrant par hook ne suffit pas non plus : réencodage de la liste après consommation, génération/régénération, domain separation et server-only view changent alors de contrat. Une convention de marquage qui distingue arbitrairement code brut et hash pour éviter double hash détournerait la sémantique de stockage. Ce n’est pas une extension hash documentée validée par ces types.

Une API générale de plugin/hooks peut permettre une intégration spécifique ; elle ne prouve pas que la politique DossierClé soit satisfaite. Aucun « faux decrypt » ni réversibilité acceptée pour faire passer test, aucune modification de l’exigence produit codes hashés/non relisibles/usage unique.

## Remédiation concrète, sans réouvrir la politique produit

A. **Préférée à qualifier : capacité hash native explicitement supportée par une version publiée ou évolution amont.** Étudier un mécanisme exact proposant hash/verify et consommation atomique, avec retrait/inutilité de toute relecture. Conserver primitives cryptographiques reconnues et matrice compatible. La version Q4 ne change pas silencieusement : documenter la nouvelle qualification et ADR/configuration approuvés, versions épinglées, mêmes critères Q4. Cette revue n’a ni recherché ni adopté une version latest ; disponibilité d’une telle capacité reste ouverte.

B. **Si amont insuffisant : extension applicative clairement séparée, spécifiée et revue.** Codes en table centrale dédiée avec hash adapté à l’entropie et bibliothèque reconnue, consommation PG conditionnelle/transactionnelle, génération affichée une fois, invalidation atomique, aucune API de relecture. Désactiver complètement parcours secours natifs et empêcher tout bypass par auth.api/routes/enrôlement. Intégrer explicitement au challenge MFA et à la création de session Better Auth sans spoof de session ni copie de secrets dans hooks. Choisir cette frontière exige ADR et review sécurité ; ne pas commencer du code sécurité spécifique sous couvert de simple paramètre. TOTP/mot de passe/session Better Auth peuvent rester ; ce n’est pas un verdict de rejet global de la bibliothèque.

C. Fork/patch vendored limité et publié avec SHA peut être étudié comme alternative à l’extension, mais crée maintenance sécurité et divergence de dépendance structurante. Ni un patch local non tracé ni cryptographie maison n’est adopté ici.

Prochaine sortie Research : contract concret hash/verify/concurrency et réenrôlement retenu, API supportées et mécanismes anti-bypass identifiés, ADR/Architecture compatibles, plan tests et reviewer, puis Design/Plan. Le natif 1.7.7 configurable seul reste BLOCKED pour Q4 ; l’exigence produit reste acquise.

## B12 : progression indépendante bornée

Q4 B12-P-1 exige intégration Better Auth/Drizzle/pg/tiers Nest, migrations auth+deux agences et absence plugins interdits ; il ne remplace pas la totalité des critères MFA/session/recovery de B07. Compiler/resoudre la matrice et intégrer un handler auth factice local peut prouver compatibilité runtime sans affirmer conformité des codes natifs.

Les volets strictement indépendants peuvent être **préparés** : source/version/lock manifeste, compile frontend/backend, OpenAPI, tests tooling, SBOM, OTel et promotion locale. Exécuter une phase B12 nécessite ses propres Research/Design/Plan PASS et préflight/budget D69 ; le rapport doit nommer le défaut secours non traité et isoler le handler synthétique sans accès métier/Internet. Aucun PASS auth ou B07 ne découle de cette preuve.

**Verdict indépendant du contrat Q4 : B12 peut avancer et satisfaire son propre gate sans avoir prouvé toute la MFA B07.** Q4 étape 3 demande intégration du core Better Auth/Drizzle/pg/tiers Nest et absence des plugins interdits, pas stockage hash ni récupération complète. Le défaut secours natif n’est donc pas, à lui seul, un blocker technique de ce bootstrap. B12 reste tenu à tous ses autres critères Q4 : migrations, builds, OTel/Inngest, OpenAPI, Vitest/PG/Playwright/k6, SBOM/licences/scans et promotion/rollback simulés.

Le corpus courant pose « B07 précède B12 » et mentionne B07 comme dépendance. Le Plan B12 doit justifier explicitement la séparation : contrat core/schéma natif/absence plugins gelé pour compatibilité locale, politiques secours non qualifiées et B07 maintenu BLOCKED. Cette justification ne retire aucune dépendance structurante ni aucun test Q4 ; elle permet une qualification de core stable déjà mandatée D69, sans prétendre livrer auth production. Si la remédiation B07 change ensuite version, schéma ou frontière d’intégration, les preuves B12 affectées doivent être requalifiées sur le nouveau candidat. Pas besoin de bloquer les étapes indépendantes par réflexe ni de réouvrir l’exigence produit. Une réduction de gate, une adoption stack différente ou une suppression explicite de la dépendance exigerait au contraire un amendment tracé/revu avant Execute.

## Verdict et limites

**BLOCKED pour adoption du mécanisme secours natif tel quel.** La source suffit à identifier l’absence de stockage hash avec comparateur dans le contrat natif étudié ; aucun test interdit nécessaire pour constater la contradiction. Better Auth global et alternatives applicatives restent à qualifier. Aucun avis sécurité, build, peer runtime ou facteur TOTP qualifié par cette lecture. Remédiation technique ciblée requise, sans reposer de question utilisateur sur la nécessité du hash/MFA/codes à usage unique.
