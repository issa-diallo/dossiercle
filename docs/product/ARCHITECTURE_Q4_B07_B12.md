# Q4 — Qualification B07+B12 : authentification et outillage

Date de qualification : **2026-10-03**. Issue [#40](https://github.com/issa-diallo/dossiercle/issues/40). Mode LARGE. Sources primaires publiques uniquement. Aucun package n'a été installé, aucun build, compte, POC, service cloud, dépense ou donnée réelle n'a été utilisé.

## Verdict

- **`B07: BLOCKED`** — la matrice Better Auth/NestJS/Drizzle est cohérente sur métadonnées, mais ne prouve pas l'idle humain multi-onglets, l'opposabilité de la révocation, la consommation atomique des codes de secours, la récupération manuelle ni l'invitation sans plugin Organization.
- **`B12: BLOCKED`** — les versions candidates sont épinglables sur papier, mais aucun lockfile, build, test, pipeline, artefact ou déploiement applicatif n'existe dans ce dépôt.
- `B07-P-1` et `B12-P-1` sont indispensables avant PASS ; ils sont décrits ci-dessous mais **non autorisés et non exécutés**.
- Better Auth `1.7.7`, TypeScript `6.0.3` et Node `24.21.0` sont des candidats documentaires, pas des choix de production.

# B07 — Authentification

## Matrice candidate datée

| Composant | Version candidate | Compatibilité déclarée | Licence | Statut |
|---|---:|---|---|---|
| Node.js | `24.21.0` LTS Krypton | satisfait Node `>=22.22.1` du tiers Nest | MIT + notices tierces au tag exact.[96] | candidat |
| TypeScript | `6.0.3` | accepté par le tiers Nest `^5.9.2 || ^6.0.0` | Apache-2.0 | candidat contraint |
| NestJS core/common/platform-express | `12.1.2` | Node `>=20`, peers Nest `^12` | MIT | candidat |
| Express | `5.2.1` | peer optionnel `^5.1.0` du tiers | MIT | candidat |
| Better Auth | `1.7.7` | React 18/19, Drizzle `^0.45.2` | MIT | minimum sécurité candidat |
| `@better-auth/drizzle-adapter` | `1.7.7` | core `^1.7.7`, Drizzle `^0.45.2` | MIT | alignement exact requis |
| `@thallesp/nestjs-better-auth` | `2.8.0` | Node `>=22.22.1`, Nest 11/12, Better Auth `<2`, TS 5.9/6 | MIT | tiers à éprouver |
| Drizzle ORM | `0.45.3` | `pg >=8`, Better Auth accepte `^0.45.2` | Apache-2.0 | candidat stable |
| Drizzle Kit | `0.31.11` | Better Auth demande `>=0.31.4` | MIT | candidat |
| `pg` | `8.23.1` | Node `>=16`, Drizzle `>=8` | MIT | candidat |

Les versions et contraintes viennent des métadonnées npm et de l'index Node consultés le 2026-10-03.[1][2][3][4][5][6][7][8][9][10][11] TypeScript `7.0.2` est le `latest` observé, mais sort des peers de `@thallesp/nestjs-better-auth@2.8.0` et `@nestjs/swagger@12.0.2`; il est donc exclu de cette matrice.[2][12]

Cette compatibilité est seulement déclarative : elle ne constitue ni résolution de peers, ni lockfile, ni compilation, ni migration de schéma, ni preuve runtime.

## Avis sécurité applicables

L'API publique du dépôt Better Auth retournait **37 avis publiés** le 2026-10-03 : 3 critical, 22 high, 9 medium et 3 low, aucun retiré dans cette réponse. Ce décompte ne prouve pas l'absence d'avis privé, futur ou non rattaché au dépôt.[13]

| Avis | Risque | Correction / disposition |
|---|---|---|
| `GHSA-44jh-23m7-hpcf` | course PostgreSQL sur rate limits du core et adaptateur Drizzle | corrigé en `1.7.7`; interdire `<1.7.7`.[14] |
| `GHSA-965c-763c-88jm` | critical, état OAuth réutilisable comme Magic Link | corrigé en `1.7.7`; Magic Link absent.[15] |
| `GHSA-r4xp-prcw-77qf` | OAuth Proxy pouvant authentifier un autre utilisateur | corrigé en `1.7.7`; OAuth Proxy absent.[16] |
| `GHSA-xg6x-h9c9-2m83` | cookie cache pouvant contourner le second facteur | ancien avis corrigé, mais cookie cache interdit par politique.[17] |
| `GHSA-fmh4-wcc4-5jm3` | invitation Organization acceptée par compte non vérifié | l'avis éditeur déclare `>=1.6.14` affecté sans correctif; plugin Organization interdit.[18] |
| `GHSA-gpj5-g38j-94v9` | Drizzle, injection via identifiants SQL | corrigé en `0.45.2`; candidat `0.45.3`.[19] |

Le filtrage global « aucun advisory pour la version » ne neutralise pas l'avis Organization contradictoire. La source éditeur la plus restrictive gouverne : aucune route Organization, Magic Link, OAuth Proxy ou SSO n'est chargée.

## Politique de sessions proposée

### Deux bornes serveur indépendantes

DossierClé impose :

- expiration absolue à **15 jours**, même en usage continu ;
- expiration après **30 minutes d'inactivité humaine réelle** ;
- polling, `getSession`, heartbeat, WebSocket, autosave périodique et retry réseau n'actualisent jamais l'activité.

Better Auth expose expiration et renouvellement, mais une activité fondée sur les requêtes serveur ne prouve pas l'activité humaine exigée.[20] Configuration candidate, avec noms d'options Better Auth exacts et invariants applicatifs séparés :

```text
session.expiresIn = 1 296 000 secondes
session.disableSessionRefresh = true
session.cookieCache.enabled = false
secondaryStorage = absent pour les sessions
```

DossierClé ajoute une autorité PostgreSQL : `hard_expires_at = created_at + 15 jours` et `last_human_activity_at`. Chaque accès métier relit session, compte, MFA, appartenance, rôle et version d'accès. Seul un endpoint d'activité lié à une interaction UI explicitement autorisée peut avancer `last_human_activity_at`; il est protégé par session, origine/CSRF, monotonie et rate limit.

`BroadcastChannel` peut synchroniser avertissement et logout entre onglets, mais ne constitue jamais l'autorité. À l'une des bornes, le serveur refuse la requête et invalide la session, même si le navigateur conserve un ancien cookie.

## MFA, codes de secours et facteurs interdits

Better Auth fournit TOTP, codes de secours et trusted devices.[21] La politique DossierClé est plus stricte :

- TOTP obligatoire avant toute route métier ;
- `allowPasswordless: false` et `skipVerificationOnEnable: false` : aucun accès métier avant vérification effective du TOTP ;
- aucun SMS, OTP e-mail, passkey ou facteur alternatif remplaçant silencieusement TOTP ;
- `trustDevice=true` refusé côté serveur et aucun cookie trusted-device émis ;
- codes de secours affichés une seule fois, stockés sous forme non réversible et consommés atomiquement ;
- deux usages concurrents du même code donnent exactement une réussite ;
- aucune route de relecture/export des codes après émission ;
- régénération seulement après session fraîche, TOTP courant et audit.

La documentation expose des opérations de gestion des codes, mais ne prouve pas que le mécanisme natif satisfait l'exigence « jamais relisible ». Tant que le schéma et les routes gelés ne sont pas éprouvés, les codes natifs ne sont pas acceptés.

## Invitations et récupération

### Invitations sans plugin Organization

Les agences et appartenances restent dans le domaine DossierClé : table centrale `invitation`, token long stocké par empreinte, expiration, agence/rôle/e-mail fixés, usage unique et consommation atomique avec création du compte et de l'appartenance. Aucune inscription libre n'accède au métier. Les hooks Better Auth peuvent filtrer les routes, mais leur documentation ne prouve pas l'atomicité de toute la transaction applicative.[22]

### Perte de TOTP et codes

Better Auth ne fournit pas le workflow D05 complet. La récupération DossierClé exige :

1. demande sans révéler l'existence du compte ;
2. vérification d'identité distincte de la possession de l'e-mail ;
3. accord admin agence, ou propriétaire plateforme si dernier admin ;
4. séparation demandeur/approbateur lorsque possible ;
5. jeton hashé, temporaire, usage unique et limité au réenrôlement ;
6. révocation de toutes les sessions et de l'ancien facteur avant émission ;
7. aucun accès métier ou changement d'agence par ce jeton ;
8. audit sans mot de passe, TOTP, code ou token brut ;
9. aucune modification directe non auditée de la base par le support.

## Révocation, jobs et rate limits

- Logout, désactivation, retrait d'agence, changement de rôle ou récupération invalident les sessions et incrémentent une génération d'accès.
- Tous les onglets échouent à leur prochaine requête ; aucun cache ne retarde l'interdiction.
- Les jobs utilisent une identité workload, jamais une session utilisateur. Avant effet, ils rechargent agence, mandat, droits et validation courante.
- Le logout seul ne supprime pas automatiquement un mandat agence déjà enregistré ; suspension, retrait d'appartenance et révocation d'une validation restent opposables.

Better Auth fournit un rate limiter configurable, mais les appels directs `auth.api` ne sont pas nécessairement couverts par le chemin HTTP.[23] DossierClé exige un stockage PostgreSQL atomique, des clés et seuils distincts pour login/TOTP/code/invitation/récupération, des réponses non énumérables et aucun fail-open si le stockage est indisponible. Les valeurs finales restent ouvertes ; les défauts de bibliothèque ne sont pas adoptés.

## Cookies, CSRF et origines

Better Auth vérifie les origines des requêtes non-GET à moins de désactiver explicitement les contrôles.[24]

Politique candidate :

- `baseURL` explicite ; `trustedOrigins` exactes, sans wildcard ni localhost en production ;
- contrôles CSRF et origine non désactivés ;
- cookie opaque `Secure`, `HttpOnly`, `SameSite=Lax`, host-only, `Path=/` ;
- aucun `Domain=.example.com` ou partage cross-subdomain sans justification ;
- CORS credentials uniquement pour les origines listées et `Vary: Origin` ;
- headers proxy acceptés uniquement depuis les proxies de confiance.

# B12 — Outillage, build et CI

## Matrice candidate

| Composant | Version candidate | Licence | Contrainte principale |
|---|---:|---|---|
| Node.js | `24.21.0` LTS | MIT + notices au tag exact.[96] | base commune |
| pnpm | `12.8.1` | MIT | Node `>=18` |
| TypeScript | `6.0.3` | Apache-2.0 | imposé par peers auth/Swagger |
| NestJS | `12.1.2` | MIT | Node `>=20` |
| `@nestjs/swagger` | `12.0.2` | MIT | Nest 12, TS 5.5/6 |
| React / React DOM | `19.3.0` | MIT | versions alignées |
| Vite / plugin React | `8.3.2` / `6.1.1` | MIT | Node `^20.19 || >=22.12` |
| Vitest / coverage-v8 | `5.0.3` | MIT | Node 22.12/24/26+, Vite 6–8 |
| Playwright Test | `1.63.0` | Apache-2.0 | Node `>=20` |
| k6 | `2.3.0` | AGPL-3.0 | outil CI/QA séparé, non embarqué |
| Inngest SDK | `4.21.1` | Apache-2.0 | Node `>=20`, TS `>=5.8` |
| OTel API | `1.9.1` | Apache-2.0 | SDK peer `<1.10` |
| OTel SDK Node / auto-instrumentations | `0.222.0` / `0.80.0` | Apache-2.0 | core/resources 2.x |
| OTel Collector Contrib (`otelcol-contrib`) | `0.162.0` | Apache-2.0 | distribution exacte, binaire/image séparé ; composants allowlistés |
| oasdiff | `1.33.0` | Apache-2.0 | CLI breaking diff |
| Syft | `1.54.0` | Apache-2.0 | SBOM |
| Gitleaks | `8.30.1` | MIT | scan secrets |
| Trivy | `0.75.0` | Apache-2.0 | images/SBOM |

Les métadonnées npm confirment les versions, licences et peers JavaScript.[1][2][3][12][25][26][27][28][29][30][31][32][33][34][35] Les releases des outils externes sont non-draft et non-prerelease aux versions indiquées.[36][37][38][39][40][41]

Le SDK npm Inngest reste distinct du serveur `v1.45.1` SSPL qualifié Q2. Une licence doit être enregistrée par artefact, jamais déduite du seul monorepo.[34][42][43]

## Matrice licences et avis publiée

La page sécurité officielle Node ne publie aucun bulletin postérieur au 29 juillet 2026 et indique `v24.21.0` comme LTS courante au moment de la lecture. Cela ne remplace pas une nouvelle vérification au gel du lockfile.[50]

Les requêtes GitHub Advisory Database portant sur **chaque version npm candidate exacte** ont retourné zéro avis applicable le 2026-10-03 pour pnpm, TypeScript, NestJS core/common/platform-express/Swagger, Express, Better Auth et son adaptateur Drizzle, le tiers Nest/Better Auth, `pg`, React, React DOM, Vite et son plugin React, Vitest et coverage-v8, Playwright Test, Inngest SDK, OTel API/SDK/auto-instrumentations, Drizzle ORM et Drizzle Kit.[53][54][55][56][57][58][59][60][61][62][63][64][65][66][88][89][90][91][92][93][94][95][97][98] « Zéro résultat » signifie zéro avis public correspondant à cette requête et cette date, pas absence de vulnérabilité ou de dépendance transitive.

| Composant | Avis récents/publics examinés | Conclusion candidat |
|---|---|---|
| pnpm `12.8.1` | avis 2026 corrigés en branches 10/11 et alpha 12 antérieure | hors des plages publiées ; requête version exacte vide.[53][67] |
| NestJS `12.1.2` | `GHSA-36xv-jgw5-4q75`, corrigé en 11.1.18 | candidat hors plage.[54][68] |
| Express `5.2.1` | `GHSA-pj86-cfqh-vqx6`, corrigé en 5.2.0 | candidat hors plage.[55][69] |
| `pg` `8.23.1` | ancien `GHSA-wc9v-mj63-m9g5`, séries 2–7 | candidat hors plage.[56] |
| React/React DOM `19.3.0` | aucun avis public applicable aux paquets exacts ; les dépendances React Server Components restent interdites dans la SPA | requêtes exactes vides ; absence RSC à prouver dans SBOM.[57][58] |
| Vite `8.3.2` | avis 2026 corrigés en 8.0.5 puis 8.0.16 | candidat postérieur aux correctifs.[59][70][71] |
| Vitest `5.0.3` | `GHSA-82fw-gwwq-j7x9` corrigé avant 5.0 stable ; anciens critical corrigés | candidat hors plages ; serveur UI/browser jamais public.[60][72][73] |
| Playwright Test `1.63.0` | aucun avis public applicable retourné | requête exacte vide ; navigateurs et transitifs restent audités.[61] |
| Inngest SDK `4.21.1` | `GHSA-2jf5-6wwv-vhxx` affecte 3.22–3.53 | candidat hors plage.[62][74] |
| OTel SDK `0.222.0` / auto `0.80.0` | `GHSA-q7rr-3cgh-j5r3` corrigé en SDK 0.217 et auto 0.75 | candidats postérieurs ; OTel API exact sans avis applicable.[63][64][65][75] |
| Drizzle `0.45.3` | injection corrigée en 0.45.2 | candidat postérieur.[19][66] |

Les paquets OTel API `1.9.1` et auto-instrumentations `0.80.0` sont Apache-2.0 selon leurs artefacts npm exacts.[51][52]

| Outil externe | Licence primaire | Avis dépôt publiés et traitement |
|---|---|---|
| OTel Collector Contrib `0.162.0` | Apache-2.0 au tag exact.[77] | sept avis de dépôt publiés. Les composants Azure auth, Sentry exporter, GitHub receiver, AWS Firehose et bearer-token extension restent hors allowlist ; leurs plages publiées s'arrêtent avant 0.162. L'avis transitive Prometheus `<0.311.3` impose une vérification SBOM du binaire exact pendant B12-P-1 : sans elle, la distribution demeure candidate `BLOCKED`.[76] |
| k6 `2.3.0` | AGPL-3.0, `LICENSE.md`; outil QA séparé, non lié/distribué avec le produit.[79] | zéro advisory de dépôt publié dans la réponse API datée.[78] |
| oasdiff `1.33.0` | Apache-2.0.[81] | deux avis corrigés en 1.18.1 et 1.26.1 ; candidat postérieur.[80] |
| Syft `1.54.0` | Apache-2.0.[83] | trois avis, dernier corrigé en 1.52.0 ; candidat postérieur.[82] |
| Gitleaks `8.30.1` | MIT.[85] | zéro advisory de dépôt publié dans la réponse API datée.[84] |
| Trivy `0.75.0` | Apache-2.0.[87] | cinq avis, corrections publiées jusqu'à 0.72.0 ; candidat postérieur.[86] |

La matrice doit être régénérée au gel effectif : les avis futurs, transitifs, OS/images et bases de vulnérabilités peuvent invalider ces candidats. Une licence inconnue, `NOASSERTION`, SSPL/AGPL embarquée ou copyleft non prévu bloque la livraison et exige une revue dédiée.

## Contrat monorepo reproductible

La racine candidate fixe `packageManager: pnpm@12.8.1`, Node `>=24.21.0 <25`, `pnpm-lock.yaml` unique, versions directes exactes et `engine-strict`. `pnpm install --frozen-lockfile` doit échouer sur divergence manifeste/lockfile.[44]

Frontières :

```text
apps/web
apps/api
packages/contracts
packages/domain
packages/adapters
packages/testing
tests/integration
tests/e2e
tests/performance
```

- `web` n'importe ni Drizzle, `pg`, secret ou migration ;
- `domain` ne dépend d'aucun framework ou fournisseur ;
- `contracts` contient schémas API/événements, sans données ;
- `adapters` dépend du domaine, jamais l'inverse ;
- web, API et migrations ont des artefacts distincts et une version de release commune.

Chaque build part d'un runner propre et d'une image épinglée par digest, fixe TZ/locale, n'appelle aucun fournisseur et publie SHA-256, SBOM, provenance et manifeste. Deux builds du même commit doivent être identiques ou lister les seules métadonnées non déterministes. QA et production utilisent les mêmes digests, sans reconstruction.

## Pipeline cible

1. **Policy** — règles dépôt, versions/actions non flottantes, lockfile unique, fichiers générés propres.
2. **Supply chain** — installation frozen, peers/engines, audit, licences, SBOM source/images, Gitleaks et Trivy ; Critical/High bloquant sans dérogation datée.
3. **Statique** — format, lint, TypeScript `noEmit`, frontières d'import, compilation.
4. **Unitaires** — règles/domain et React avec Vitest.
5. **Contrats** — OpenAPI déterministe, breaking diff, client frontend regénéré, événements versionnés.
6. **Intégration** — PostgreSQL réel synthétique, auth centrale et deux bases agences, migrations zéro/N-1, transactions/pools/non-fuite.
7. **Build** — web/API séparés, digests, SBOM, attestations et source maps privées.
8. **E2E QA** — Playwright contre QA distincte, données/boîtes/destinataires synthétiques.
9. **Charge** — k6 sur les cinq répartitions Architecture, hors production, cold start séparé.
10. **Promotion** — accord humain et promotion des digests exacts, aucun rebuild.

GitHub recommande permissions minimales, précautions avec les entrées non fiables et épinglage immuable des actions ; les environments portent les approbations de déploiement.[45][46] Les artefacts et attestations doivent être liés au commit et aux digests.[47]

## OpenAPI et compatibilité

Le backend génère `openapi.json` via `@nestjs/swagger`, le canonicalise et le génère deux fois : SHA-256 identiques obligatoires.[12]

- `oasdiff` compare la PR au contrat de base ; rupture sans stratégie/version majeure = blocage ;
- les types/client frontend sont regénérés et le dépôt doit rester propre ;
- tests HTTP producteur/consommateur contre backend réel ;
- matrice frontend/API N/N-1 explicite et testée, pas support implicite illimité ;
- mêmes règles pour événements Inngest et jobs longs.

## Télémétrie et source maps

Cible : application/workers → OTLP authentifié/chiffré → distribution exacte `otelcol-contrib@0.162.0` privée → backend à qualifier. OpenTelemetry recommande de supprimer ou transformer les données sensibles avant export.[48]

Allowlist : service/version/environnement, digest, IDs opaques, route normalisée, méthode, statut, durée, file, retry et type d'erreur stable. Sont interdits : corps HTTP, e-mail, document, prompt/résultat IA, cookies, authorization, OTP/TOTP, URL query, PII, SQL/paramètres, DSN et payloads Inngest non minimisés.

Le Collector charge uniquement les identifiants `receivers: [otlp]` avec protocoles `grpc` et `http`, `processors: [memory_limiter, filter, transform, batch]` et `exporters: [otlphttp]` vers un endpoint privé explicitement approuvé. Les pipelines `traces`, `metrics` et `logs` référencent seulement ces composants ; toute autre factory présente dans la distribution reste non configurée. L'image et son SBOM doivent néanmoins être scannés, car l'absence de configuration ne retire pas une dépendance du binaire. L'audit métier reste distinct des traces techniques.

Vite permet des source maps cachées.[49] Les `.map` sont exclus du site public, conservés comme artefact privé lié au digest, avec accès audité et durée à décider. Aucun upload automatique vers un fournisseur n'est autorisé.

## Rollback

Le dossier de release fixe commit, hash lockfile/OpenAPI, digests web/API/migrations, SBOM, attestations, versions compatibles et résultats QA.

Rollback : suspendre les effets autonomes, vérifier compatibilité schéma/événements, redéployer un digest déjà validé ou roll-forward/restore, réconcilier effets externes, exécuter smoke synthétique puis faire approuver la reprise. Revenir au code seul n'est pas un rollback valide.

# `B07-P-1` — fixture auth isolée

**Statut : nécessaire, non autorisé.**

## Hypothèse et raison de l'essai

La matrice candidate peut faire respecter TOTP, idle humain 30 minutes, borne absolue 15 jours, révocation immédiate, invitations/récupérations atomiques et absence de plugin interdit. La recherche est insuffisante car les peers ne prouvent ni build/runtime, ni guards, ni concurrence PostgreSQL, ni activité multi-onglets, ni non-récupérabilité des codes.

## Préconditions, périmètre et exclusions

Approbation humaine distincte obligatoire avec **durée maximale, plafond monétaire et quotas techniques explicitement approuvés avant démarrage**. Worktree local jetable, versions exactes, PostgreSQL local, mail sink, horloge contrôlée, données uniquement synthétiques, zéro fournisseur/cloud et journal minimisé.

Périmètre : fixture auth sans métier réel, deux agences fictives, navigateur automatisé multi-onglets et deux processus API. Exclusions : aucun e-mail externe, compte réel, production, IAM/cloud, test de charge global, preuve juridique ou validation de la totalité de B12.

## Étapes et critères mesurables

Succès obligatoire :

- deux installations/builds/typechecks reproductibles depuis lockfile, zéro peer/engine/RC ;
- schéma auth relu, migrations forward/rollback, aucune table/route Organization ;
- mot de passe synthétique absent en clair de la base, des backups et des logs ; hash configuré/identifié, mot de passe correct accepté et valeur erronée refusée sans différence d'énumération ;
- secret TOTP stocké uniquement chiffré ; clé de chiffrement injectée depuis un secret local distinct et absente de la base/backup ; copie de la base seule incapable de restituer le facteur ;
- invitation concurrente : exactement un compte/appartenance ; inscription libre refusée ;
- aucun accès métier avant TOTP ; trusted-device forgé refusé ;
- deux usages simultanés d'un code secours : exactement une réussite, code jamais relisible ;
- régénération des codes exige session fraîche + TOTP courant, invalide atomiquement tous les anciens codes et ne journalise aucune valeur ;
- idle valide à `30 min - ε`, refus à 30 min ; polling/heartbeat/getSession sans effet ;
- usage continu valide à `15 j - ε`, refus à 15 jours ;
- révocation/logout/désactivation opposables à tous les onglets et aux jobs avant effet ;
- récupération limitée au réenrôlement, ancien TOTP et sessions inutilisables ;
- récupération manuelle : identité et approbation synthétiques requises, token hashé/usage unique/expiré, accès métier impossible avant nouveau TOTP ; ancien facteur, anciens codes et anciennes sessions restent refusés ;
- origines hostiles/null/wildcard refusées ; rate limits atomiques sous concurrence et après redémarrage/deux instances ;
- aucun secret, cookie, mot de passe, TOTP, code ou token dans les journaux.

## Arrêt, nettoyage et restitution

Arrêt immédiat au premier contournement MFA/session/révocation, accès inter-agence, fuite de secret, appel réseau imprévu, dépassement de durée/budget/quota ou résultat non reproductible. Un seul de ces écarts maintient `B07: BLOCKED` et rejette ou modifie le candidat.

Supprimer bases, comptes, messages du mail sink, fichiers, caches, cookies et worktree ; vérifier l'absence de processus, port, credential et artefact résiduel. Publier versions, commandes, résultats bruts, limites, inventaire/nettoyage et empreintes du candidat pour une **revue indépendante** avant toute reclassification.

# `B12-P-1` — bootstrap synthétique

**Statut : nécessaire, non autorisé.**

## Hypothèse et raison de l'essai

Le socle candidat peut être résolu, construit et testé de manière reproductible avec OpenAPI déterministe, artefacts/SBOM liés aux digests et télémétrie minimisée. La recherche est insuffisante pour prouver la résolution réelle des peers, les scripts lifecycle, la coexistence OTel/Inngest, les migrations, les navigateurs Playwright et la reproductibilité des sorties.

## Préconditions, périmètre et exclusions

Approbation humaine distincte obligatoire avec **durée maximale, plafond monétaire, bande passante et quotas techniques approuvés avant démarrage**. Worktree temporaire, versions exactes, données synthétiques, aucun compte fournisseur, réseau limité aux registres nécessaires et inventaire de nettoyage.

Périmètre : bootstrap local sans story métier, PostgreSQL jetable, collecteur/local QA simulé et artefacts locaux. Exclusions : aucun déploiement QA/cloud réel, aucune promotion production, aucun secret/compte fournisseur, aucune donnée réelle, aucun test PRA complet et aucune preuve de performance/observabilité de production.

## Étapes et critères mesurables

Étapes et succès :

1. créer le monorepo minimal et rejouer le lockfile frozen ; zéro peer/engine insatisfait ;
2. compiler deux fois TS/Nest/React/Vite et comparer les sorties ;
3. intégrer Better Auth/Drizzle/pg/tier Nest et prouver l'absence des plugins interdits ;
4. migrer auth centrale + deux bases agences PostgreSQL sans fuite ;
5. intégrer Inngest SDK avec synchronisation non authentifiée désactivée ;
6. initialiser OTel vers Collector sans provider dupliqué ; injecter canaris et prouver leur absence des exports ;
7. générer OpenAPI deux fois, détecter une rupture volontaire et accepter une addition compatible ;
8. exécuter Vitest, intégration PG, Playwright minimal et smoke k6 ;
9. produire deux builds propres, SBOM/licences/scans, source maps non publiques ;
10. **simuler localement** QA→promotion en copiant/référençant les mêmes digests entre deux répertoires isolés, puis simuler rollback sans rebuild ; cette étape P ne remplace pas les preuves V de déploiement QA, promotion et rollback réels ;
11. détruire environnement et artefacts temporaires, vérifier l'absence de compte/service/donnée réelle et soumettre les preuves à revue indépendante.

## Arrêt, nettoyage et restitution

Arrêt immédiat sur peer/engine conflict, Critical/High non dérogé, plugin interdit, fuite canari, accès réseau imprévu, script lifecycle non approuvé, migration croisée, OpenAPI non déterministe, sortie non reproductible ou dépassement durée/budget/quota. Tout écart maintient `B12: BLOCKED`.

Supprimer containers, volumes, navigateurs/caches téléchargés, artefacts, images, base, collecteur et worktree ; vérifier l'absence de processus, port, credential et ressource. Restituer lockfile, commandes, hashes, SBOM/licences/scans, journaux expurgés, résultats et inventaire de nettoyage à une **revue indépendante**. Les tests QA/promotion/rollback réels restent classés V et ne sont pas reclassés par ce protocole local.

# Points à transmettre

| Destinataire | Élément |
|---|---|
| Q5 / B08+B10 | coûts CI/QA, stockage artefacts/traces/source maps et exploitation observabilité restent à chiffrer |
| Q5 / B03 | auth centrale, sessions/révocations et artefacts de reprise font partie des états PRA |
| Q6 / B11 | 15 jours absolus + idle 30 min, plugin Organization/cookie cache/trusted-device interdits ; B07/B12 demeurent BLOCKED |
| Future implémentation | versions exactes candidates seulement après B07-P-1/B12-P-1 et nouveau gel advisories |

# Sources

[1] https://nodejs.org/dist/index.json
[2] https://registry.npmjs.org/typescript
[3] https://registry.npmjs.org/@nestjs%2fcore/12.1.2
[4] https://registry.npmjs.org/@nestjs%2fcommon/12.1.2
[5] https://registry.npmjs.org/@nestjs%2fplatform-express/12.1.2
[6] https://registry.npmjs.org/express/5.2.1
[7] https://registry.npmjs.org/better-auth/1.7.7
[8] https://registry.npmjs.org/@better-auth%2fdrizzle-adapter/1.7.7
[9] https://registry.npmjs.org/@thallesp%2fnestjs-better-auth/2.8.0
[10] https://registry.npmjs.org/drizzle-orm/0.45.3
[11] https://registry.npmjs.org/pg/8.23.1
[12] https://registry.npmjs.org/@nestjs%2fswagger/12.0.2
[13] https://api.github.com/repos/better-auth/better-auth/security-advisories?per_page=100
[14] https://github.com/better-auth/better-auth/security/advisories/GHSA-44jh-23m7-hpcf
[15] https://github.com/better-auth/better-auth/security/advisories/GHSA-965c-763c-88jm
[16] https://github.com/better-auth/better-auth/security/advisories/GHSA-r4xp-prcw-77qf
[17] https://github.com/better-auth/better-auth/security/advisories/GHSA-xg6x-h9c9-2m83
[18] https://github.com/better-auth/better-auth/security/advisories/GHSA-fmh4-wcc4-5jm3
[19] https://github.com/advisories/GHSA-gpj5-g38j-94v9
[20] https://www.better-auth.com/docs/concepts/session-management
[21] https://www.better-auth.com/docs/plugins/2fa
[22] https://www.better-auth.com/docs/concepts/hooks
[23] https://www.better-auth.com/docs/concepts/rate-limit
[24] https://www.better-auth.com/docs/reference/security
[25] https://registry.npmjs.org/pnpm/12.8.1
[26] https://registry.npmjs.org/react/19.3.0
[27] https://registry.npmjs.org/react-dom/19.3.0
[28] https://registry.npmjs.org/vite/8.3.2
[29] https://registry.npmjs.org/@vitejs%2fplugin-react/6.1.1
[30] https://registry.npmjs.org/vitest/5.0.3
[31] https://registry.npmjs.org/@vitest%2fcoverage-v8/5.0.3
[32] https://registry.npmjs.org/@playwright%2ftest/1.63.0
[33] https://registry.npmjs.org/drizzle-kit/0.31.11
[34] https://registry.npmjs.org/inngest/4.21.1
[35] https://registry.npmjs.org/@opentelemetry%2fsdk-node/0.222.0
[36] https://github.com/open-telemetry/opentelemetry-collector-releases/releases/tag/v0.162.0
[37] https://github.com/grafana/k6/releases/tag/v2.3.0
[38] https://github.com/oasdiff/oasdiff/releases/tag/v1.33.0
[39] https://github.com/anchore/syft/releases/tag/v1.54.0
[40] https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1
[41] https://github.com/aquasecurity/trivy/releases/tag/v0.75.0
[42] https://github.com/inngest/inngest/releases/tag/v1.45.1
[43] https://github.com/inngest/inngest/blob/v1.45.1/LICENSE.md
[44] https://pnpm.io/cli/install
[45] https://docs.github.com/en/actions/reference/security/secure-use
[46] https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments
[47] https://docs.github.com/en/actions/concepts/security/artifact-attestations
[48] https://opentelemetry.io/docs/security/handling-sensitive-data/
[49] https://vite.dev/config/build-options.html#build-sourcemap
[50] https://nodejs.org/en/blog/vulnerability/
[51] https://registry.npmjs.org/@opentelemetry%2fapi/1.9.1
[52] https://registry.npmjs.org/@opentelemetry%2fauto-instrumentations-node/0.80.0
[53] https://api.github.com/advisories?ecosystem=npm&affects=pnpm%4012.8.1&per_page=100
[54] https://api.github.com/advisories?ecosystem=npm&affects=%40nestjs%2Fcore%4012.1.2&per_page=100
[55] https://api.github.com/advisories?ecosystem=npm&affects=express%405.2.1&per_page=100
[56] https://api.github.com/advisories?ecosystem=npm&affects=pg%408.23.1&per_page=100
[57] https://api.github.com/advisories?ecosystem=npm&affects=react%4019.3.0&per_page=100
[58] https://api.github.com/advisories?ecosystem=npm&affects=react-dom%4019.3.0&per_page=100
[59] https://api.github.com/advisories?ecosystem=npm&affects=vite%408.3.2&per_page=100
[60] https://api.github.com/advisories?ecosystem=npm&affects=vitest%405.0.3&per_page=100
[61] https://api.github.com/advisories?ecosystem=npm&affects=%40playwright%2Ftest%401.63.0&per_page=100
[62] https://api.github.com/advisories?ecosystem=npm&affects=inngest%404.21.1&per_page=100
[63] https://api.github.com/advisories?ecosystem=npm&affects=%40opentelemetry%2Fapi%401.9.1&per_page=100
[64] https://api.github.com/advisories?ecosystem=npm&affects=%40opentelemetry%2Fsdk-node%400.222.0&per_page=100
[65] https://api.github.com/advisories?ecosystem=npm&affects=%40opentelemetry%2Fauto-instrumentations-node%400.80.0&per_page=100
[66] https://api.github.com/advisories?ecosystem=npm&affects=drizzle-orm%400.45.3&per_page=100
[67] https://github.com/advisories/GHSA-c59q-g84q-2gj5
[68] https://github.com/advisories/GHSA-36xv-jgw5-4q75
[69] https://github.com/advisories/GHSA-pj86-cfqh-vqx6
[70] https://github.com/advisories/GHSA-fx2h-pf6j-xcff
[71] https://github.com/advisories/GHSA-v6wh-96g9-6wx3
[72] https://github.com/advisories/GHSA-82fw-gwwq-j7x9
[73] https://github.com/advisories/GHSA-5xrq-8626-4rwp
[74] https://github.com/advisories/GHSA-2jf5-6wwv-vhxx
[75] https://github.com/advisories/GHSA-q7rr-3cgh-j5r3
[76] https://api.github.com/repos/open-telemetry/opentelemetry-collector-contrib/security-advisories?per_page=100
[77] https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.162.0/LICENSE
[78] https://api.github.com/repos/grafana/k6/security-advisories?per_page=100
[79] https://github.com/grafana/k6/blob/v2.3.0/LICENSE.md
[80] https://api.github.com/repos/oasdiff/oasdiff/security-advisories?per_page=100
[81] https://github.com/oasdiff/oasdiff/blob/v1.33.0/LICENSE
[82] https://api.github.com/repos/anchore/syft/security-advisories?per_page=100
[83] https://github.com/anchore/syft/blob/v1.54.0/LICENSE
[84] https://api.github.com/repos/gitleaks/gitleaks/security-advisories?per_page=100
[85] https://github.com/gitleaks/gitleaks/blob/v8.30.1/LICENSE
[86] https://api.github.com/repos/aquasecurity/trivy/security-advisories?per_page=100
[87] https://github.com/aquasecurity/trivy/blob/v0.75.0/LICENSE
[88] https://api.github.com/advisories?ecosystem=npm&affects=typescript%406.0.3&per_page=100
[89] https://api.github.com/advisories?ecosystem=npm&affects=%40nestjs%2Fcommon%4012.1.2&per_page=100
[90] https://api.github.com/advisories?ecosystem=npm&affects=%40nestjs%2Fplatform-express%4012.1.2&per_page=100
[91] https://api.github.com/advisories?ecosystem=npm&affects=%40thallesp%2Fnestjs-better-auth%402.8.0&per_page=100
[92] https://api.github.com/advisories?ecosystem=npm&affects=drizzle-kit%400.31.11&per_page=100
[93] https://api.github.com/advisories?ecosystem=npm&affects=%40nestjs%2Fswagger%4012.0.2&per_page=100
[94] https://api.github.com/advisories?ecosystem=npm&affects=%40vitejs%2Fplugin-react%406.1.1&per_page=100
[95] https://api.github.com/advisories?ecosystem=npm&affects=%40vitest%2Fcoverage-v8%405.0.3&per_page=100
[96] https://github.com/nodejs/node/blob/v24.21.0/LICENSE
[97] https://api.github.com/advisories?ecosystem=npm&affects=better-auth%401.7.7&per_page=100
[98] https://api.github.com/advisories?ecosystem=npm&affects=%40better-auth%2Fdrizzle-adapter%401.7.7&per_page=100
