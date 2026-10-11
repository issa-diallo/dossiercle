# Research — B07-P-1, qualification auth isolée

Date : 2026-10-11. Mode LARGE. **RESEARCH: BLOCKED**. Builder unique dans le worktree `b07-p-1-auth`, branche `chore/b07-p-1-auth`. Skill appliqué : `secure-web-dev`, avec lecture de sa checklist. Préparation seulement ; aucune installation, compilation, test ou ressource runtime créée.

## Objectif et autorité

Qualifier l’intégralité de [Q4 B07-P-1](../../../product/ARCHITECTURE_Q4_B07_B12.md#b07-p-1--fixture-auth-isolée), conformément à [ADR-003](../../../adr/003-identite-centrale-better-auth-mfa.md), [ADR-013](../../../adr/013-qa-livraison-tests.md), D01–D05/D10/D53/D54/D60 et [D69](../../../product/ARCHITECTURE_DECISIONS.md#d69). D69 autorise le POC local ; il ne fait passer ni B07 ni Architecture. Le pipeline produit reste au gate Architecture : cette qualification précède les stories produit et leur Design System. Aucun passage en Execute avant revue DoR par l’orchestrateur.

Sources lues dans l’ordre projet : README, METHOD, WORKFLOW, COMMITS, documents produit et ADR applicables, Q4, proposition POC, D69 et artefacts précédents. Les documents produit copiés dans ce worktree conservent l’autorité issue de la consolidation ; aucun changement de stack.

## État réel et préflight

Le dépôt ne contient pas d’application auth, package produit, lockfile ou migration à réutiliser. Les seuls tests existants portent sur le moteur temporel synthétique #50 : aucune preuve auth. Les zones proposées sont `pocs/b07-auth/` et les présents artefacts, sans modification de S01–S37 ou du corpus acquis.

Préflight en lecture seule du 11 octobre : disque libre 76 563 005 440 octets, RAM disponible 19 191 112 kB ; Docker daemon 28.0.1, machine x86_64. Le précédent blocage disque est levé, sous réserve de contrôle juste avant toute création. Plafonds D69 : 4 CPU, 8 Gio RAM, 15 Gio disque temporaire, deux heures par phase et six heures cumulées, 2 000 000 000 octets réseau par essai, zéro dépense externe. Les ressources hôte disponibles ne dispensent pas de ces plafonds.

Image cache constatée : `postgres:17.11-bookworm`, digest `postgres@sha256:051f7b7b3abdd564d5d1bd1e8c4b9c1b6e77087d1dd22020ede611c096a272e0`, ID `sha256:a2ea0e68c465e0acf4c3672471b22b6b62972bb341e6f31544c855d85ba43745`, linux/amd64. Provenance officielle et SBOM/advisories restent à qualifier ; aucune création ou pull. Ne pas toucher `factory-backend-db-1` ni le port 5432. Chromium/headless revision 1243 est présent en cache ; [browsers.json 1.63.0](evidence/playwright-browsers.json) attend précisément cette révision, Chrome 153.0.8010.12. Correspondance de numéro seule ≠ intégrité ou provenance du binaire.

## Lecture exacte et obstacle bloquant

[Source Better Auth](evidence/better-auth-commit-backup-codes.txt), commit `db02f233918ad1233bf0753e437e1c0da353273d` résolu depuis `v1.7.7`, lignes 46–60 et 78–140 : `storeBackupCodes` accepte plain, encrypted ou une paire encrypt/decrypt. `verifyBackupCode` reconstitue la liste et compare le code brut. [Initialisation du plugin](evidence/better-auth-commit-2fa-index.txt) : stockage encrypted par défaut. Lignes 552–595 : `viewBackupCodes` existe côté serveur ; le supprimer des routes publiques ne rend pas les codes irréversibles.

Q4 exige des codes stockés sous forme non réversible, jamais relisibles. Aucun mécanisme supporté satisfaisant cette exigence n’a été identifié dans ce tag. Une paire encrypt/decrypt ne constitue pas un hash ; retourner des hashes à la comparaison native ne fonctionne pas. Intercepter les routes, remplacer le vérificateur ou inventer un plugin spécifique serait un arbitrage d’adaptation auth à documenter par ADR, pas une correction mécanique autorisée. **R-B07-01 : incompatibilité de capacité candidat / exigence codes secours ; décision ou extension supportée à qualifier avant Research PASS.** Aucune détente de l’exigence ni auth maison adoptée.

La consommation utilise `incrementOne` avec comparaison du champ courant (lignes 384–401) : indice de CAS, sans preuve d’atomicité de l’adaptateur Drizzle ni concurrence PostgreSQL exécutée. Invitation transactionnelle, activité humaine, récupération et révocations restent des politiques applicatives acquises dont les hooks exacts doivent être qualifiés, sans accès par défaut accordé.

## Dépendances et risques

Versions exactes Q4 conservées : Node 24.21.0 isolé, pnpm 12.8.1, TS 6.0.3, Nest 12.1.2/Express 5.2.1, Better Auth/adaptateur 1.7.7, tiers Nest 2.8.0, Drizzle 0.45.3/Kit 0.31.11, pg 8.23.1, Vitest 5.0.3 et Playwright 1.63.0. [Préflight antérieur](../arch-b02-b12/evidence/poc-version-preflight.md) couvre les peers déclarés ; nos réponses exactes confirment les paquets auth. Peers obligatoires complémentaires, transitives, lockfile et scripts doivent être gelés avant installation. Aucun latest/RC ou substitution automatique.

[37 avis Better Auth](evidence/better-auth-advisories.json) retournés le 11 octobre, sans preuve d’absence d’avis privés/futurs. Organization reste affecté par l’avis éditeur `GHSA-fmh4-wcc4-5jm3` et est interdit. Magic Link, OAuth Proxy, SSO, SMS/email comme second facteur, passkeys, cookie cache, secondaryStorage session et trusted-device restent interdits. Recontrôler toutes les versions exactes et transitives au lockfile ; Critical/High applicable sans dérogation datée, peer/engine insatisfait ou script non autorisé = arrêt, pas passage forcé.

Frontières : navigateur → API → auth PG centrale → DB agence choisie par droits courants ; aucune agence fournie par client n’accorde un droit. Assets sensibles : mots de passe, TOTP, cookies, codes, jetons d’invitation/récupération et clé de chiffrement locale hors DB. Aucun secret en journal ou preuve publiée. Synthétique ne dispense pas de confidentialité des secrets de l’essai.

## Réseau et questions restantes

[Ledger](evidence/research-network-ledger.json) : 507345 octets de corps reçus ; charge conservatrice 576977 octets avec réserve en-têtes/TLS et réponse d’erreur. Ce montant s’impute aux 2 Go, plafond de recherche 5 Mo respecté. Les octets de transport exacts ne sont pas instrumentés ; ne pas les prétendre mesurés. Un premier chemin source a répondu 404, puis chemin correct et source immutable lus. Aucune distribution runtime téléchargée.

[Manifeste proposé](distribution-manifest.md) : Node et npm exacts, PG cache, Chromium cache à valider. Distribution navigateur/scanner non approuvée : aucune permission implicite ; cache validé ou URL exacte/hash/taille soumis avant download. Ces choix et R-B07-01 empêchent le DoR. Les [annexes conditionnelles](research-proposals.md) servent seulement à la revue ; aucune phase Design ou Plan n’est démarrée après Research BLOCKED.

## Research Gate

- [x] État du dépôt, critères Q4, zones et dépendances inspectés.
- [x] Risques et assets sensibles documentés, préflight disque actuel suffisant.
- [ ] R-B07-01 résolu par mécanisme supporté ou ADR approuvé.
- [ ] Manifeste final, provenance caches, scripts et peers complémentaires qualifiés.

**Verdict BLOCKED.** Le reviewer peut examiner les brouillons ; aucune exécution ni PASS documentaire artificiel.

## Dossier de résolution R-B07-01 — non adopté

1. **Extension officielle supportée à qualifier, puis ADR sécurité explicite.** L’option `backupCodeOptions.storeBackupCodes` expose exactement `plain`, `encrypted` ou `{ encrypt: (token: string) => Promise<string>; decrypt: (token: string) => Promise<string> }`. Le token sérialise une liste JSON ; `getBackupCodes` appelle decrypt puis JSON parse, et `verifyBackupCode` utilise `codes.includes(code)` et filtre le code brut. Une liste de hashes renvoyée par decrypt ne satisfait pas cette comparaison ; un hash ne possède pas de fonction decrypt. Il est interdit de nommer faussement encrypt/decrypt une solution irréversible supposée compatible. Le point d’extension officiel pour vérification/hash/consommation n’a pas été trouvé dans ce module : avant de choisir cette option, lire la documentation et types du mécanisme exact, confirmer maintien challenge MFA/session, stockage non récupérable, CAS/transaction PG et fermeture de toute relecture interne. ADR et revue sécurité exigés ; aucune cryptographie ni auth maison sous ce mandat.
2. **Version compatible avec preuve réelle de hash.** Examiner un tag/version exact compatible avec tiers Nest/Drizzle/Node, advisories et licences ; option de hash seule insuffisante, vérifier vérification, régénération, API serveur et concurrence PG. Aucun latest ou upgrade automatiquement adopté, nouvelle matrice et revue avant essai. Aucune version satisfaisante identifiée ici.
3. **Modification d’exigence produit, non recommandée.** Des codes chiffrés restent récupérables par le serveur ; retirer viewBackupCodes n’efface pas ce fait. Accepter cette différence changerait Q4/ADR-003 et demanderait arbitrage explicite du propriétaire. Ne pas présenter la non-relecture UI comme non-réversibilité.

## Séparation de B12 : proposition de traitement du blocage

B12 peut préparer son bootstrap/supply chain indépendant : Node/pnpm verrouillés, peers/engines, builds TS/Nest/React, SBOM/avis/licences et distribution cache. Ces étapes ne qualifient pas la fonctionnalité MFA et n’accordent jamais B07 PASS. Le gate Q4 B12 comprend cependant l’intégration Better Auth/Drizzle/tiers Nest et l’absence des plugins interdits : le raccord auth final doit rester stable avant B12 PASS. Si résoudre R-B07-01 change version, plugin, schéma ou routes, lockfile/build/SBOM/contracts concernés doivent être refaits ; un bootstrap antérieur n’est qu’une preuve partielle. Le reviewer doit décider si la proposition d’extension conserve ce contrat ; jusqu’alors B12 peut préparer ou prouver des éléments indépendants, mais aucune fermeture finale dépendant d’un contrat auth instable. Pas de réduction silencieuse de Q4 et pas d’emprunt au budget B07.
