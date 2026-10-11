# Manifeste distributions — B07-P-1, candidat à revoir

2026-10-11. **MANIFEST: BLOCKED**, aucune distribution autorisée par ce seul fichier. D69 fixe budgets et essais ; URL/hashes/provenance finaux sont une précondition avant download. Toutes les tailles compressées inconnues restent inconnues, jamais une estimation exacte.

## Artefacts concrets

| Artefact | URL ou cache | Empreinte | Disposition |
|---|---|---|---|
| Node 24.21.0 linux-x64 | https://nodejs.org/dist/v24.21.0/node-v24.21.0-linux-x64.tar.xz | SHA-256 `fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6` depuis [SHASUMS](evidence/node24-checksums.txt) | Taille/réponse headers à borner avant download ; signature/provenance à vérifier |
| pnpm 12.8.1 | https://registry.npmjs.org/pnpm/-/pnpm-12.8.1.tgz | Métadonnées exactes à reprendre du préflight, integrity à archiver | Aucune exécution du pnpm global 12.4.1 |
| `better-auth@1.7.7` | https://registry.npmjs.org/better-auth/-/better-auth-1.7.7.tgz | `sha512-Zhgxi/c5ylmfB/sX+nwnBbsFf/j6k0L8DvL6CJXZSrXgxc5pPMC/e7j812zNd4L4B4ELmdURCPw3X8nAOUdcjw==` | Non téléchargé ; taille compressée inconnue |
| `@better-auth/drizzle-adapter@1.7.7` | https://registry.npmjs.org/@better-auth/drizzle-adapter/-/drizzle-adapter-1.7.7.tgz | `sha512-qon0U94PR5FQysuyGoAlGVQpIIiNg5dtDpwjE63sN/HjoRWZadZzHPcS9mn7JsJyQZK6iTNhd7LD0AaXt2f78w==` | Non téléchargé ; taille compressée inconnue |
| `@thallesp/nestjs-better-auth@2.8.0` | https://registry.npmjs.org/@thallesp/nestjs-better-auth/-/nestjs-better-auth-2.8.0.tgz | `sha512-B5K8Nlr0BH/tFJAPJAPefC09gKSSFofgmSTQx6XFeWDgPcG6awTh9iRFlv9it0skYgcCD2fXr53ChgXjLse0pw==` | Non téléchargé ; taille compressée inconnue |
| `drizzle-orm@0.45.3` | https://registry.npmjs.org/drizzle-orm/-/drizzle-orm-0.45.3.tgz | `sha512-CAloER21cDdcgZ1OmjrZX82EeRNsdP+y0onX/eyoYDaYzki/adrAa91lzM5jWh7zZPK4qUbw/6LGv9J+A+uizA==` | Non téléchargé ; taille compressée inconnue |
| `pg@8.23.1` | https://registry.npmjs.org/pg/-/pg-8.23.1.tgz | `sha512-aL96AHANtWjPLDOLqnhx+ngp9+UK7ETEU8VJrDCGvsSSi/mGLcWYsS6Herg7lmaBJe4uwrfqsa7gTEFaSizDoQ==` | Non téléchargé ; taille compressée inconnue |
| PG 17.11 bookworm | Cache local `postgres:17.11-bookworm` | `postgres@sha256:051f7b7b3abdd564d5d1bd1e8c4b9c1b6e77087d1dd22020ede611c096a272e0` | `--pull never` ; source officielle/digest et SBOM/advisories à vérifier, aucune permission de download |
| Chromium/headless 1243 | Cache `~/.cache/ms-playwright/chromium-1243` et `chromium_headless_shell-1243` | browsers.json Playwright 1.63.0 attend 1243/153.0.8010.12 | Hashs/provenance cache à établir ; pas de simple marker INSTALLATION_COMPLETE comme preuve |

## Compléments à geler pour le reviewer

Npm directs restants : TypeScript 6.0.3, Nest core/common/platform-express 12.1.2, Express 5.2.1, Drizzle Kit 0.31.11, Vitest 5.0.3, Playwright Test 1.63.0, React/DOM 19.3.0 et Vite/plugin 8.3.2/6.1.1 si UI de fixture compilée. Les peers obligatoires rxjs, reflect-metadata, core/utils Better Auth, types Node/PG, dépendances de test et transitives doivent recevoir versions exactes et dist.integrity avant résolution. Q4 ne décide pas ces versions : proposition et revue nécessaires, pas de latest.

Sources autorisées pour recherche : endpoints npm exacts, Node officiel, sources GitHub tag/commit et advisories. Distribution npm : seulement tarballs exacts `registry.npmjs.org` présents dans manifeste final/lockfile, redirections vers nouvel hôte arrêtées jusqu’à revue. Bloquer téléchargement implicite `playwright install` ou scanner. Aucun tarball/source package exécuté pendant Research.

Navigateur : utiliser cache 1243 uniquement si provenance hash/version vérifiée. Sinon préparer l’URL exacte depuis registry Playwright du tag 1.63.0 et soumettre **hôte, URL finale, redirections, hash/contrôle éditeur et taille** avant téléchargement ; pas d’URL CDN inventée ici. Une autorisation de npm n’autorise pas cette distribution distincte. Firefox/WebKit et revision 1234 ne sont pas candidats.

Scanner : aucun binaire/cache scanner qualifié à ce stade. Proposer avant download une distribution exacte, ses checksums et bases de vulnérabilités, chacune avec URL/hôtes et fraîcheur. Ne pas réduire Q4 ou présenter un JSON advisories direct comme scan complet SBOM/transitif. Collector/k6/oasdiff relèvent du gate B12 et ne remplacent aucune preuve B07.

Runtime API/browser : image ou namespace isolé à figer ; aucun pull générique Node/Playwright Docker permis. Une image supplémentaire requiert nom@digest, source/notice/licence/SBOM et contrôle avant usage. Ne pas exposer réseau hôte pour contourner ce préalable.

## Budget et scripts

Budget initial 2 000 000 000 octets cumulatifs B07, recherche imputée par [ledger](evidence/research-network-ledger.json). Avant download, total de Content-Length fiables + marge mesurée ≤ solde ; réponse chunked/inconnue utilise compteur interrompant avant solde. Comptabiliser toutes requêtes, retry/redirections, réponses d’erreur et téléchargements transitifs ; overhead non instrumenté consigné avec réserve, pas déclaré exact. Deux installations frozen offline ne retéléchargent pas les mêmes paquets mais ne dispensent pas des hashes.

Scripts lifecycle de dépendances : **allowlist vide**. Aucun install/postinstall/prepare/prepack exécuté ; `ignore-scripts=true`. Si binaire exige script, décrire fichier exact, hash, effets disque/réseau et commande, puis obtenir revue avant son exécution. Racine uniquement commandes explicites du Plan après validation de leurs fichiers. Pas de nouveau download après un arrêt de sécurité/plafond ; reprise avec nouvelle autorisation et solde inchangé.
