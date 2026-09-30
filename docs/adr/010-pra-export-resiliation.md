# ADR-010 — PRA mesurable, export limité et résiliation sans résurrection

## Status

`ACCEPTED`

Décision utilisateur de principe ACCEPTED, pas une implémentation ni une qualification technique validée. Architecture globale **BLOCKED**. Les mécanismes de conception sont des obligations à vérifier ; détails non arbitrés et produits/outils candidats restent ouverts ou proposés, même dans cet ADR ACCEPTED.

## Date

2026-09-30

## Context

Bases séparées, fichiers, auth et orchestrateur doivent être récupérés ensemble sans double envoi. Le droit d’export en fin d’abonnement ne prolonge pas l’autonomie ni tout l’accès métier.

## Decision drivers

RPO15/RTO4h objectifs ; invariant zéro perte acceptée ; rétention contrôlée ; export admin sans re-MFA selon refus explicite.

## Options considered

### Option A — Backups chiffrés cohérents, restore isolé/réconcilié, export temporaire et tombstones

**Pros** — Pertes/écarts mesurables, arrêt des sorties restaurées et exercice complet par agence.

**Cons** — Complexité cohérence inter-stores, secrets nécessaires et tombstones hors ancien snapshot ; coûts/retention à qualifier.

### Option B — Export quotidien seul et restore direct avec redémarrage des jobs

**Pros** — Procédure simple et peu d’outillage.

**Cons** — Ne prouve ni RPO15 ni absence rejeu ; source Scaleway Serverless 7j ne vaut pas politique cible 30j.

### Option C — Export avec re-MFA systématique ou promesse toutes copies détruites à J30

**Pros** — Re-MFA réduirait le risque session volée ; promesse de suppression simple.

**Cons** — Re-MFA export explicitement refusée ; backups/obligations légales rendent promesse J30 fausse.

## Decision

RPO≤15min et RTO≤4h pour incident majeur sont objectifs à mesurer. Backups chiffrés/restreints 30 jours sous validation technique/réglementaire ; PITR/service exact pas prouvé. Maintenir invariant PRD zéro perte acceptée : reconstruction de la fenêtre à prouver, conflit sinon B03 et décision propriétaire, pas affaiblissement tacite. Export admin session valide sans re-MFA dédiée, audit, CSV/JSON+EML+originaux/index, aucun secret ; malveillants exclus/signalés. Archive 24h puis suppression, sources inchangées. Fin abonnement : stop IA/mail, invalider tâches/accès associés, admin export seul 30j puis suppression active ; backups expirent selon politique sauf obligation. Restore ne réactive pas supprimés grâce tombstones/génération/réconciliation.

### Portée export et sécurité des EML

L'export a portée agence, pas dossier : admin/session valide, droit d'export actif ou fenêtre résiduelle D42, audit, objets autorisés et archive temporaire. Il n'exige ni prise/tag IA ni budget IA ni horaires agent ; ces non-applicabilités typées ne réactivent ni mail ni autonomie après résiliation. L'analyse de l'archive couvre chaque EML et ses parties MIME. Toute pièce malveillante, suspecte, non analysée, en quarantaine ou en erreur AV exclut son fichier séparé **et l'EML original qui l'embarque en entier**, avec motif et liens dans l'index. EML d'un message en quarantaine également exclu ; libération du message ne libère pas la pièce. Original stocké inchangé, aucune version modifiée annoncée originale. Tester fixture EML synthétique pour absence des octets bloqués sous toutes formes exportées.

### Autorisations après restauration ancienne

Avant toute réouverture, invalider **toutes les sessions restaurées**, appliquer une génération de reprise/révocation indépendante du rollback et réconcilier depuis source actuelle fiable les changements post-sauvegarde : membership/rôles, désactivation, récupération/réenrôlement MFA, révocation des boîtes et validations. Une réauthentification sur un ancien TOTP restauré ne prouve pas validité si ce facteur a été remplacé. Sans état actuel fiable, rester fermé pour comptes/facteurs/connexions/effets concernés, humains et services compris ; aucun rétablissement permissif depuis le seul snapshot. Le stockage indépendant de génération/journal et sa durabilité restent qualification B03/B07. Tests futurs : révocation session, retrait membership, récupération MFA et révocation boîte **après backup puis restore ancien** ; aucune capacité ne ressuscite. Ces contrôles complètent tombstones de résiliation, ils ne sont pas optionnels « si nécessaire ».

### Décisions utilisateur préservées

Le texte ci-dessous conserve les confirmations et leurs réserves ; les propositions contenues dans une décision source ne deviennent pas des validations runtime.

- **[D27](../product/ARCHITECTURE_DECISIONS.md#d27)** — Objectifs DR : perte max 15 minutes (RPO) et retour sous 4h (RTO) pour incident majeur, tests restauration bases+documents+orchestration, pas garanties acquises. Invariants message accepté non perdu du PRD restent, arbitrage cohérence RPO à expliquer sans affaiblir le PRD.

- **[D41](../product/ARCHITECTURE_DECISIONS.md#d41)** — Sauvegardes chiffrées, accès restreint, rétention 30 jours sous validation technique/réglementaire. Différent rétention dossiers actifs.

- **[D42](../product/ARCHITECTURE_DECISIONS.md#d42)** — Fin effective abonnement : IA et connexions email arrêtées, révoquer les tâches et accès correspondants, accès admin limité export 30 jours puis supprimer données actives. Backups expirent suivant rétention sauf obligation légale, restauration ne réactive pas données supprimées. Ne pas affirmer toutes copies effacées au 30e jour.

- **[D43](../product/ARCHITECTURE_DECISIONS.md#d43)** — Export : dossiers/contacts/biens/historiques CSV/JSON, mails EML, pièces originales, index relations. Pas mots de passe/clés. Fichiers malveillants exclus et signalés dans index (complétude soumise sécurité).

- **[D44](../product/ARCHITECTURE_DECISIONS.md#d44)** — Export réservé admin session valide, authentifié/temporaire/audité ; utilisateur REFUSE re-MFA spécifique export, ne pas la réintroduire. Risque session compromise reconnu. Archive disponible 24h puis supprimée, sources inchangées, regénération si droit actif.

## Why

Un plan de reprise utile distingue données, effets externes et autorisations ; l’export est un droit contrôlé, non un accès public ou une sauvegarde équivalente.

## Consequences

### Positive

Parcours sortie agence explicite, restore non destructif et vérifiable, risques sans fausse garantie.

### Negative / trade-offs

Risque résiduel session admin compromise accepté sans re-MFA export ; rétention sauvegardes diffère fin accès ; aucune offre actuelle prouvée RPO cible.

### Operational impact

Manifests/hashes/comptages/relations, chronométrage incident→service, clés et state-store, aucune émission avant réconciliation. Tombstone survivant à ancien backup et registre de purges minimisé.

## Security / data impact

Export privé authentifié/temporaire et droit revérifié au téléchargement ; archives excluent credentials et fichiers bloqués. Secret Manager suppression planifiée7j ≠ révocation fournisseur ; audit et accès backup restreints.

- **Authentication** : requêtes humaines avec session centrale valide et MFA avant métier ; dépôt OTP séparé. Jobs autonomes avec identité workload/service authentifiée, portée limitée et mandat agence courant, sans maintenir une session utilisateur après logout/idle30. Logout ne supprime pas le mandat agence ; retraits de droits, validité des validations humaines et suspensions restent recontrôlés avant effet. Routes publiques strictement limitées, aucun bypass.
- **Authorization** : R01 et vérification courante côté services/jobs, pas droit donné par l’UI ou contenu IA.
- **Sensitive data** : minimisation, objets privés et aucun contenu brut dans traces techniques.
- **Tenant isolation** : base distincte par agence et contrôles objets/jobs/exports ; identité centrale seulement selon D54.
- **Secrets** : coffre scoped, TOTP chiffré clé hors DB, aucun réaffichage/export/log de secret.
- **Compliance** : contrats/rétention/résidence à prouver ; aucune conformité absolue ou test accompli déduit d’une page fournisseur.

## Migration / rollback

- **Migration** : Définir cutover/génération de restauration et compatibilité schémas ; planifier purges selon finalité et obligations, pas effacement des preuves avant validation.
- **Rollback** : Tester restore en isolement sans écraser actif, sorties coupées ; réconciliation puis accord reprise. Annuler opération de suppression avant exécution si erreur, mais jamais promettre annuler un effacement effectif.

## Validation et gate

Restauration agence V1 complète avec objets/auth/orchestrateur, panne instance, calcul RPO/RTO et reconstruction acceptations/dépôts/actions manuelles, export droits expirés, archive24h et résiliation/restauration sans résurrection.

Gates/propriétaires et preuves de sortie : **B01, B03, B08**, décrits dans [Architecture Gate](../product/ARCHITECTURE.md#architecture-gate). La clôture exige preuve et revue indépendante, pas seulement la présente recommandation. Sources techniques datées : [recherche F01–F09](../product/ARCHITECTURE_RESEARCH.md).

## Related

- PRD : [besoin et critères inchangés](../product/PRD.md).
- Story : [STORIES](../product/STORIES.md) — S01–S03, S06, S09, S12–S18, S31–S36 ; toujours BACKLOG.
- Issue : [#27](https://github.com/issa-diallo/dossiercle/issues/27).
- Architecture : [section de conception](../product/ARCHITECTURE.md#sauvegarde-export-résiliation-et-pra).
- Previous ADR : aucun ADR antérieur dans le dépôt au début de ce travail ; voir [index](../product/ARCHITECTURE_DECISIONS.md#index-des-adr) pour dépendances transverses.
- Supersedes : aucun ADR antérieur remplacé ; les écarts au PRD/Stories et propositions conversationnelles abandonnées figurent dans [addendum](../product/ARCHITECTURE_DECISIONS.md#addendum-et-supersessions). Pas de réécriture du PASS Story Review historique.
