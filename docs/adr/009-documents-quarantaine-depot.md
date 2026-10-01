# ADR-009 — Documents privés, quarantaine et dépôt sans compte borné

## Status

`ACCEPTED`

Décision utilisateur de principe ACCEPTED, pas une implémentation ni une qualification technique validée. Architecture globale **BLOCKED**. Les mécanismes de conception sont des obligations à vérifier ; détails non arbitrés et produits/outils candidats restent ouverts ou proposés, même dans cet ADR ACCEPTED.

## Date

2026-09-30

## Context

Les fichiers et contenus reçus sont non fiables ; la réception utile ne doit pas signifier téléchargement autorisé ou transmission immédiate à une IA.

## Decision drivers

Objets privés Paris ; antivirus fail-closed ; séparation quarantaine message/pièce ; accès externe dépôt sans lecture dossier.

## Options considered

### Option A — Stockage privé + quarantaine objet + dépôt révocable et OTP par session

**Pros** — Séparation réception/contrôle/usage, exposition limitée et erreurs traçables.

**Cons** — Scanner isolé, quotas et purge nécessaires ; URL signée seule peut ne pas permettre révocation immédiate.

### Option B — Pièces ouvertes ou OCR immédiatement puis scan asynchrone

**Pros** — Temps d’accès apparent plus court.

**Cons** — Exposition avant contrôle et possible transfert hostile/sensible ; rejeté.

### Option C — Portail compte complet ou lien public réutilisable sans OTP

**Pros** — Plus de fonctions pour déposant, parcours plus court pour lien seul.

**Cons** — Périmètre non demandé ou contrôle insuffisant ; aucun accès aux pièces déjà reçues autorisé.

## Decision

Fichiers privés Scaleway Paris hors PG, accès métier autorisé et liens courts. Quarantaine initiale jusqu’à antivirus réussi ; suspicion ou erreur interdit métier/IA. Isoler analyse et parser, MIME réel et ressources bornées. Message suspect conservé sans réponse auto, admin seul libère vers traitement humain ; pièce malveillante reste bloquée indépendamment. Limite 20 Mo, unité à confirmer sans changer silencieusement. Dépôt PDF/JPEG/PNG seulement, lien révocable 7 jours multi-dépôts, OTP destinataire à chaque nouvelle session, aucune lecture pièce/dossier. CSV/XLSX catalogue séparé, Word/exécutable/ZIP refusés au dépôt ; formats email ouverts à qualifier.

### Conteneurs EML et export sûr

L'interdiction de téléchargement d'une pièce s'étend à tous les conteneurs qui embarquent ses octets, notamment les parties MIME d'un EML original. Une pièce malveillante, suspecte, non analysée, encore en quarantaine ou en erreur AV est exclue de l'archive ; l'EML original qui la contient est **exclu en entier** et référencé avec motif/relations dans l'index. Le message lui-même encore en quarantaine est exclu aussi. Retirer seulement le fichier séparé ne suffit jamais. Libérer humainement un message ne libère pas ses pièces bloquées ; l'original stocké reste intact et aucune représentation modifiée n'est présentée comme original. Fixture future EML synthétique : vérifier absence du binaire interdit dans fichiers séparés **et** parties MIME encodées de l'archive. Cette limitation de complétude applique D31/D34/D43, pas un nouveau droit de téléchargement.

### Décisions utilisateur préservées

Le texte ci-dessous conserve les confirmations et leurs réserves ; les propositions contenues dans une décision source ne deviennent pas des validations runtime.

- **[D12](../product/ARCHITECTURE_DECISIONS.md#d12)** — Fichiers privés Scaleway Paris, stockage distinct PG, accès autorisé + liens temporaires courts. Pas fichiers publics.

- **[D31](../product/ARCHITECTURE_DECISIONS.md#d31)** — Pièces en quarantaine jusqu'à antivirus réussi ; suspect OU erreur analyse bloque téléchargement métier et IA. Analyser isolé, MIME réel/limites/archive-bomb/protections parser.

- **[D32](../product/ARCHITECTURE_DECISIONS.md#d32)** — Tests obligatoires emails malveillants : phishing/usurpation et Reply-To, pièce hostile, liens/SSRF, injection prompt, saturation/coût, HTML actif/traceurs, aucune autorisation via contenu. Messages synthétiques, pas malware réel ni preuve de protection absolue.

- **[D33](../product/ARCHITECTURE_DECISIONS.md#d33)** — Email suspect conservé quarantaine, aucune réponse automatique, alerte admin. Pas suppression aveugle.

- **[D34](../product/ARCHITECTURE_DECISIONS.md#d34)** — Admin SEUL libère message après contrôle, traitement HUMAIN d'abord, pas activation IA implicite ; pièce malveillante reste bloquée indépendamment.

- **[D49](../product/ARCHITECTURE_DECISIONS.md#d49)** — Limite 20 Mo par fichier, dépassement message visible avec signalement pièce non analysée ; définir unité sans changer silencieusement, limites connexions/import/pages à qualifier.

- **[D50](../product/ARCHITECTURE_DECISIONS.md#d50)** — Dépôt sécurisé sans compte par lien temporaire révocable 7 jours, plusieurs dépôts, OTP email destinataire à chaque nouvelle session. Pas consultation pièces déjà transmises/données dossier.

- **[D51](../product/ARCHITECTURE_DECISIONS.md#d51)** — Dépôt sécurisé PDF/JPEG/PNG seulement, 20 Mo et antivirus ; Word/exécutable/ZIP refusés CE formulaire. CSV/XLSX catalogue restent parcours séparé. Formats email hors formulaire non inventés validés, politique à proposer.

## Why

La frontière d’usage protège même si le message doit rester conservé. L’OTP dépôt ne doit pas être confondu avec MFA des collaborateurs.

## Consequences

### Positive

Confidentialité et rejet hostiles avant IA ; dépôt minimal sans ouverture d’un espace client complet.

### Negative / trade-offs

Faux positifs/panne AV bloquent, résolution humaine requise ; rétention/quarantaine consomment stockage ; risque lien+boîte compromis subsiste.

### Operational impact

État/version par objet, limites archive-bomb/pages/temps/mémoire, anti-abus OTP/session/IP/lien, expires/revocation contrôlés à chaque opération. Message dépassement visible, pièce non analysée indexée.

## Security / data impact

Tokens empreintés non prédictibles, OTP usage unique limité essais, pas changement destinataire par déposant. Pas HTML actif/traceurs, SSRF/Reply-To/prompt injection testés synthétiquement ; aucun malware réel ni protection absolue annoncée.

- **Authentication** : requêtes humaines avec session centrale valide et MFA avant métier ; dépôt OTP séparé. Jobs autonomes avec identité workload/service authentifiée, portée limitée et mandat agence courant, sans maintenir une session utilisateur après logout/idle30. Logout ne supprime pas le mandat agence ; retraits de droits, validité des validations humaines et suspensions restent recontrôlés avant effet. Routes publiques strictement limitées, aucun bypass.
- **Authorization** : R01 et vérification courante côté services/jobs, pas droit donné par l’UI ou contenu IA.
- **Sensitive data** : minimisation, objets privés et aucun contenu brut dans traces techniques.
- **Tenant isolation** : base distincte par agence et contrôles objets/jobs/exports ; identité centrale seulement selon D54.
- **Secrets** : coffre scoped, TOTP chiffré clé hors DB, aucun réaffichage/export/log de secret.
- **Compliance** : contrats/rétention/résidence à prouver ; aucune conformité absolue ou test accompli déduit d’une page fournisseur.

## Migration / rollback

- **Migration** : Créer chemin réception/quarantaine avant téléchargement/IA ; indexer objets historiques avec état inconnu donc bloqué jusqu’au contrôle, pas considérer anciens fichiers propres par défaut.
- **Rollback** : Bloquer nouvelles lectures/dépôts si scanner/auth défaillant ; conserver originaux privés et audit, révoquer liens compromis ; pas rendre bucket public pour rétablir service.

## Validation et gate

AV succès/suspect/erreur, mauvaise signature MIME, dépassement, formulaire types refusés, double OTP/nouvelle session/revocation, fuite objets/URL ; phishing, pièces inoffensives hostiles simulées et coût saturé.

Gates/propriétaires et preuves de sortie : **B04, B08**, décrits dans [Architecture Gate](../product/ARCHITECTURE.md#architecture-gate). La clôture exige preuve et revue indépendante, pas seulement la présente recommandation. Sources techniques datées : [recherche F01–F09](../product/ARCHITECTURE_RESEARCH.md).

## Related

- PRD : [besoin et critères inchangés](../product/PRD.md).
- Story : [STORIES](../product/STORIES.md) — S03, S13, S23, S29, S31–S33, S34 ; toujours BACKLOG.
- Issue : [#27](https://github.com/issa-diallo/dossiercle/issues/27).
- Architecture : [section de conception](../product/ARCHITECTURE.md#fichiers-quarantaine-et-dépôt).
- Previous ADR : aucun ADR antérieur dans le dépôt au début de ce travail ; voir [index](../product/ARCHITECTURE_DECISIONS.md#index-des-adr) pour dépendances transverses.
- Supersedes : aucun ADR antérieur remplacé ; les écarts au PRD/Stories et propositions conversationnelles abandonnées figurent dans [addendum](../product/ARCHITECTURE_DECISIONS.md#addendum-et-supersessions). Pas de réécriture du PASS Story Review historique.
