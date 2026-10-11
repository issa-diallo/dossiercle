# Annexes conditionnelles à Research — B07-P-1

Aucune phase Design ou Plan démarrée : Research reste BLOCKED. Les propositions ci-dessous servent seulement à la revue de résolution.

# Design conditionnel — B07-P-1

Date : 2026-10-11. **PROPOSITION CONDITIONNELLE** : Research BLOCKED sur R-B07-01. Ce document expose le design candidat à revoir après résolution ; aucune phase suivante autorisée. Inputs : [Research](research.md), Q4/ADR-003/013/D69. Pas d’interface produit : fixture de qualification et navigateur multi-onglets synthétiques ; Design System produit ne passe pas implicitement.

## Surface et données

Deux API Nest/Express utilisant le tiers Better Auth candidat et un PostgreSQL local : trois bases `b07_auth`, `b07_agency_a`, `b07_agency_b`. Auth centrale : tables générées pour le tag exact puis relues ; compte, session, facteur, appartenance, invitation, récupération, génération d’accès et audit minimisé. DB agences : un objet canari synthétique chacune, droits minimaux distincts. Aucun plugin Organization, aucune donnée métier réelle.

La clé de chiffrement TOTP est un fichier local privé hors DB/backup, permissions 0600, injecté sans contenu dans commande ou logs. Réutiliser les primitives de hash/chiffrement supportées par Better Auth ; aucun algorithme auth maison. Codes secours : **aucune implémentation choisie tant que R-B07-01 ouvert**. Tables de hashes éventuelles ne suffisent pas à valider le raccord au flow MFA natif.

## Flux et interfaces candidates

Invitation propriétaire → premier admin ; invitation admin agence → collaborateur : token aléatoire long, empreinte seule, agence/rôle/email fixés, expiration et transaction unique. Définition du mot de passe puis TOTP vérifié avant métier. Deux acceptations concurrentes produisent exactement un compte et une appartenance ; signup libre refuse l’accès. Routes Better Auth exactes inventoriées au tag et filtrées par allowlist, y compris appels serveur internes ; pas de bypass par double slash ou encodage.

Login mot de passe → MFA pending → TOTP ou code secours qualifié → session métier. Session serveur : `expiresIn=1296000`, `disableSessionRefresh=true`, `cookieCache.enabled=false`, aucun secondaryStorage. Autorité PG supplémentaire : hard expiry créé une fois + activité humaine monotone. Chaque accès relit compte/MFA/session/génération/appartenance/rôle, puis l’objet agence ; aucun cache retardant révocation. Cookie opaque Secure/HttpOnly/SameSite=Lax/host-only/Path=/, aucune valeur localStorage.

Endpoint activité UI explicite : interaction autorisée après validation, session+origine/CSRF, monotonie et rate limit ; polling/getSession/heartbeat/retry/autosave périodique exclus. Horloge de test contrôlée uniquement dans fixture isolée, non par header public. Onglets synchronisent avertissement/logout via BroadcastChannel ; serveur décide. À 30 min ou 15 jours, refus et invalidation. Brouillon synthétique sauvegardé sans prolonger indûment la session.

Logout/désactivation/retrait/changement de rôle/récupération : génération d’accès et session relues avant chaque effet. Jobs factices authentifiés par workload local, jamais par cookie humain ; rôle/mandat/validation rechargés immédiatement avant faux effet. Logout ne supprime pas un mandat agence indépendant ; droits retirés restent opposables.

Récupération : demande générique → identité vérifiée synthétique distincte du mail → accord admin ou propriétaire si dernier admin → révocation sessions/facteur/codes → jeton hashé temporaire à usage unique limité au réenrôlement → nouveau TOTP vérifié → nouvelle session. Aucun accès métier ni changement d’agence avec ce jeton, aucun support modifiant directement la DB hors audit. Séparation demandeur/approbateur testée.

Régénération secours : session fraîche et TOTP courant obligatoires ; invalidation atomique de tous les anciens codes avant nouvelle émission unique, sans logs. Implémentation reste conditionnelle au mécanisme supporté retenu. Rate limits PG atomiques sur login/TOTP/code/invitation/récupération, clé normalisée et seuils de fixture explicites avant revue ; seuils test ne deviennent pas règles produit. Stockage indisponible refuse, aucun fail-open.

## États et erreurs

Non authentifié, MFA pending, valide, idle expiré, absolu expiré, révoqué, désactivé, interdit agence, rate limited, facteur perdu, récupération pending/rejected/expired/used, DB indisponible. Réponses génériques sans énumération ; logs minimisés d’identifiants opaques et raisons stables. Mot de passe erroné pour compte existant/inexistant : même statut et forme, comparaison temporelle documentée sans garantie physique parfaite.

Origines exactes sur loopback HTTPS, rejet hostile/null/wildcard, CSRF jamais désactivé, CORS credentials seulement origines listées avec Vary: Origin. Certificat local et hôtes synthétiques ne changent aucun trust store global. Routes sensibles accessibles seulement dans fixture ; pas de ressource publique. Lectures inter-agence testées en remplaçant identifiants, session et URL.

## Matrice de couverture Q4

| Critère | Preuve prévue |
|---|---|
| Installation/build/typecheck deux fois, peers/engines, schéma et plugins | Lockfile, manifests, deux sorties, inventaire routes/tables |
| Mot de passe/TOTP et backup seul | Hash identifié, valeur fausse refusée, dump canari sans clair/clé, copie DB incapable de restituer facteur |
| Invitation/signup/MFA/trusted-device | Course 2 API, refus signup/métier pre-MFA, cookie/header forgé refusés |
| Secours non relisibles, course, régénération | Mécanisme supporté à qualifier ; exactement un succès, anciennes valeurs refusées, session fraîche+TOTP |
| Idle/absolu | ε=1 ms horloge serveur, limites inclusives, activité continue et polling multi-onglets |
| Révocation/job | Tous onglets et faux effets refusés après génération, logout distinct mandat |
| Récupération/dernier admin | Double approbation/identité, jeton expiré/réutilisé refusé, aucun métier avant nouvel enrôlement |
| Origine/CSRF/rate limit | Hostile/null/wildcard, concurrence 2 API et redémarrage, DB panne fail-closed |
| Journaux/migrations/reproductibilité | Canaris absents logs/base/backup, forward/rollback et reprise x2 |

**Proposition sans verdict de phase** : couverture intégrale écrite ; raccord codes secours et inventaire supporté/hook exact restent ouverts. Aucun changement produit ou nouvelle stack adopté.

# Plan conditionnel — B07-P-1

Date : 2026-10-11. Mode LARGE. **PROPOSITION CONDITIONNELLE**. Research/Design BLOCKED ; revue DoR de l’orchestrateur requise avant toute installation, code ou runtime. Modèle puissant recommandé pour sécurité et revue critique conformément AGENTS ; le harness fournit le modèle effectif, aucune modification prétendue.

## Résultat attendu et séquence

Qualifier **tous** les critères Q4 B07-P-1 puis Verify et revue indépendante ; six heures cumulées max, trois phases de deux heures. Le temps est mesuré avec début/fin et tâches ; téléchargements/installation/build/test/nettoyage comptent dans les plafonds d’essai. Pas de promesse PASS dans six heures. Revue de préparation distincte ; tout nouveau périmètre exige décision.

0. Résoudre R-B07-01 et qualifier mécanisme/hook supporté. ADR requis si adaptation structurante ; aucune détente des codes non réversibles ni plugin maison improvisé. Revoir Research → Design → Plan et DoR. Compléter manifeste exact et scripts/peers ; revue préalable, puis préflight hôte et ports. Aucun code avant ce gate.

A — ≤2 h : staging distributions et caches validés, Node 24 isolé, pnpm exact, verrouillage versions, inventaire dépendances/scripts/avis/licences ; deux installations frozen, builds et typechecks. Schéma Better Auth relu, auth centrale et deux DB agence locales. Mot de passe/TOTP chiffré hors clé, invitations concurrentes et barrières MFA/trusted-device/signup. Si lockfile/peers inexacts, arrêter immédiatement.

B — ≤2 h : session PG/hard expiry/activité humaine, navigateur multi-onglets et horloge injectable, deux API, idle/absolu ±1 ms ; génération d’accès, révocations et faux jobs. Secours uniquement mécanisme préalablement qualifié : non-relecture, consommation concurrente, régénération fraîche+TOTP et invalidation atomique. Backup DB sans clé et canaris. Aucun contournement accepté comme test attendu : vulnérabilité constatée implique arrêt.

C — ≤2 h : récupération contrôlée/dernier admin, absence métier jusqu’au nouvel enrôlement, jetons hashés/usage unique/expiration, refus anciens facteurs/sessions/codes. Origines/CSRF, rate limits concurrentes et restart, panne DB fail-closed. Migrations forward/rollback, reprise complète reproductible deux fois, logs expurgés, preuves et nettoyage ciblé.

## Environnement fermé

Fichiers futurs, seulement après DoR : `pocs/b07-auth/package.json`, `pnpm-lock.yaml`, `.npmrc`, `src/auth.ts`, `src/session-authority.ts`, `src/invitations.ts`, `src/recovery.ts`, `src/access.ts`, `src/test-clock.ts`, `src/server.ts`, `migrations/`, `tests/`, scripts setup/run/cleanup et manifeste. Aucun fichier application produit touché ; aucune suppression existante.

Runtime dans un réseau Docker `--internal` dédié avec labels `dossiercle.poc=b07`, hôte/gateway hors egress autorisé. Deux API et navigateur dans ce réseau fermé ou un namespace sans egress équivalent ; **deux processus hôte ordinaires ne garantissent pas cette isolation**. Images supplémentaires non gelées empêchent le DoR de cette topologie ; option namespace à examiner sans commande privilégiée implicite. PG `--pull never` au digest cache qualifié. Pas `--network host`, privileged, socket Docker monté ou accès host-gateway. Tous ports exposés seulement sur `127.0.0.1`, candidats 15437/18471/18472/18473 après contrôle de disponibilité ; aucun changement du 5432 existant. HTTPS local pour cookies Secure, aucune désactivation sécurité pour faciliter les tests.

Plafonds agrégés : 4 CPU et 8 Gio RAM pour l’ensemble, pas par container ; proposer PG 1 CPU/2 Gio, API chacune 1 CPU/1,5 Gio, navigateur+harness 1 CPU/3 Gio. Aucun cinquième API/worker ; disque mesuré ≤15 Gio, réseau cumulé ≤2 Go. Réserve nettoyage avant plafond temporel ; relever process/ports/volumes avant et après. Connexions localhost ne remplacent pas le firewall : preuve d’egress refusé exigée avant test.

## Distributions et commandes permises à revoir

[Manifeste](distribution-manifest.md). Node téléchargé en archive officielle exacte et SHA-256 contrôlé ; extraction privée dans `.poc-runtime/node-v24.21.0`, PATH local à l’essai, jamais Node global. pnpm tarball exact exécuté via ce Node, pas corepack demandant latest. Métadonnées, tarballs et redirections comptés, cache validé traçable ; deux installations offline frozen après lockfile examiné. Scripts npm/pnpm de dépendances interdits : `ignore-scripts=true`, aucun postinstall, prepare, prepack ou install implicite. Allowlist lifecycle initiale **vide** ; script requis implique revue de ses octets et nouvelle autorisation expresse, jamais `pnpm approve-builds` global.

Seules commandes racine candidates : `typecheck` = `tsc --noEmit`, `build` = `tsc -p tsconfig.build.json`, `test:unit` = `vitest run`, `test:integration` = `vitest run --config vitest.integration.config.ts`, `test:e2e` = `playwright test --config playwright.config.ts`. Leurs fichiers exacts sont relus avant exécution ; aucune autorisation de scripts transitifs. Pas `npx`, dlx ou téléchargement implicite de navigateur. Advisory/peer/engine/licence après résolution gelée, arrêt Critical/High non dérogé, NOASSERTION ou conflit ; pas --force ni strict-peer=false. Scanner non présent/autorisé n’est pas dispensé : proposer cache validé ou distribution exacte avant download.

## Données, preuves, rollback et arrêts

Comptes `@example.invalid`, agences et mails mémoire synthétiques ; clés/tokens privés jetables, aucune impression de valeur. Schéma auth généré sans code installé ici ; relire migration, clés/rôles least privilege, rollback sur bases de l’essai exclusivement. Compatible restore exige sessions invalidées et droits revalidés, pas preuve PRA cloud.

Tests prévus : unitaires horloge/transitions/input ; PG réel 2 API pour invitation/secours/rate limits ; contrats auth/origine et interdictions ; browser deux onglets ; builds/typechecks x2 ; scans secrets/avis et inventaires. Chaque critère Q4 reçoit commande, date, exit code, résultat brut expurgé et hash candidat. Test non exécuté n’est pas PASS. Verify/Review indépendants ; B07 clôture proposée seulement après preuves complètes et décision de gate, Architecture demeure indépendante.

**Arrêt immédiat** au premier bypass MFA/session/révocation, fuite secret/agence, peer/engine conflict, réseau imprévu, script non approuvé, advisory bloquant, sortie non reproductible ou plafond. Stop, nettoyage ciblé et rapport ; aucun processus/download nouveau après arrêt. Reprise après correction et nouvelle autorisation, aucun reset budget. Seul échec fonctionnel sans déclencheur d’arrêt peut permettre une phase indépendante dans mandat/budgets restants. Nettoyage seulement ressources nommées de l’essai ; pas prune Docker, suppression globale caches ou worktree utilisateur. Rapports conservés sans secrets, fichiers runtime privés supprimés selon mandat validé.

## Plan Gate / DoR

Critères Q4, fichiers, dépendances, tests, isolation et arrêts identifiés. Restent R-B07-01, manifests/hashes/taille/provenance caches, image ou namespace API/browser fermé, peers additionnels et scripts exacts. **Aucun Plan PASS ; Execute interdit jusqu’à revue DoR positive.**
