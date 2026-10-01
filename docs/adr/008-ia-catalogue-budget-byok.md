# ADR-008 — Catalogue IA approuvé, Qwen inclus, BYOK et secours consenti

## Status

`ACCEPTED`

Décision utilisateur de principe ACCEPTED, pas une implémentation ni une qualification technique validée. Architecture globale **BLOCKED**. Les mécanismes de conception sont des obligations à vérifier ; détails non arbitrés et produits/outils candidats restent ouverts ou proposés, même dans cet ADR ACCEPTED.

## Date

2026-09-30

## Context

Les documents locatifs et e-mails contiennent des données sensibles. Le modèle choisi, son coût, ses capacités et les permissions d’usage varient selon fournisseur et compte.

## Decision drivers

Qwen/Scaleway par défaut ; minimisation/UE/non-entraînement ; choix admin ; budget rare épuisement sans surfacturation ; secours explicite.

## Options considered

### Option A — Passerelle métier, catalogue fermé, ledger inclus/BYOK et fallback opt-in

**Pros** — Capacités/privacy contrôlées par tâche, coûts réservés et routage explicable.

**Cons** — Catalogue/contrats/tarifs à entretenir ; pannes et réservations incertaines à réconcilier.

### Option B — Choix libre URL/modèle par tout collaborateur et fallback automatique

**Pros** — Flexibilité immédiate et disponibilité apparente.

**Cons** — Exfiltration/SSRF, clés exposées et fournisseur non consenti ; contraire D16/D17.

### Option C — Offre illimitée ou blocage total du travail en fin de budget

**Pros** — Règle commerciale simple à présenter.

**Cons** — Coût non borné ou perte continuité métier ; contraire D18/D19/D23.

## Decision

Qwen via Scaleway principal par défaut, modèle Qwen3.6-35B-A3B candidat seulement malgré catalogue observé. Admin agence seul choisit catalogue approuvé et BYOK coffre ; Mistral API directe candidat opt-in. Enveloppe incluse mensuelle sans cumul dimensionnée après benchmark/coût/marge ; pas compteur ni alerte budget Qwen agence, seulement propriétaire plateforme. BYOK payé au fournisseur en plus abonnement, coût estimé visible admin et facture fait foi. Budget BYOK épuisé/clé invalide/panne : Qwen inclus si consentement initial et enveloppe disponible, sinon attente sans perdre mail/manuel. Retour automatique après vérification/stabilité uniquement appels futurs. Réserver atomiquement coût maximal avant appel, finaliser une fois, ne pas libérer une réserve incertaine aveuglément. Supplément commercial explicite, pas surfacturation automatique ni compteur interdit divulgué.

### Portée de la recommandation OCR

Le statut ACCEPTED de cet ADR couvre les choix utilisateur IA/BYOK/budget. **D25 reste une proposition OCR non approuvée, à qualifier**, et non un pipeline OCR définitivement sélectionné. Extraction texte PDF puis vision/humain est une recommandation sans benchmark DossierClé ; capacités, formats et coûts doivent être testés avant sélection technique. Les exclusions d'authenticité/solvabilité sont, elles, des contraintes fermes.

### Décisions utilisateur préservées

Le texte ci-dessous conserve les confirmations et leurs réserves ; les propositions contenues dans une décision source ne deviennent pas des validations runtime.

- **[D14](../product/ARCHITECTURE_DECISIONS.md#d14)** — IA minimisation, traitement UE, pas réutilisation entraînement, conservation maîtrisée, garanties fournisseur vérifiées avant données réelles.

- **[D15](../product/ARCHITECTURE_DECISIONS.md#d15)** — Qwen via Scaleway PRINCIPAL PAR DÉFAUT ; Mistral via API directe candidat alternatif/secours. Modèle précis Qwen3.6-35B-A3B seulement candidat avancé par assistant, qualification/version/tarif/disponibilité/confidentialité restent à prouver. Aucun benchmark DossierClé exécuté.

- **[D16](../product/ARCHITECTURE_DECISIONS.md#d16)** — Admin agence SEUL choisit modèle/fournisseur dans catalogue approuvé et gère sa clé personnelle. Pas URL arbitraire ; clés coffre agence, jamais réaffichées/loguées/passées au modèle.

- **[D17](../product/ARCHITECTURE_DECISIONS.md#d17)** — SECOURS seulement après accord explicite agence ; aucune activation Mistral silencieuse. Compatibilité texte/vision/outils/sorties structurées et confidentialité requises par tâche.

- **[D18](../product/ARCHITECTURE_DECISIONS.md#d18)** — Abonnement comprend enveloppe IA mensuelle dimensionnée après tests tokens entrée/sortie, OCR, reprises, secours, coût dossier et charge mensuelle + marge. Dimensionner pour rendre épuisement RARE, pas usage illimité. Renouvellement mensuel SANS CUMUL. Pas nécessité de virement réel fournisseur mensuel.

- **[D19](../product/ARCHITECTURE_DECISIONS.md#d19)** — Enveloppe plateforme exceptionnellement épuisée : email reçu et travail manuel continuent, IA en attente, aucune perte ni surfacturation automatique. Complément payant demande accord admin. Conflit éventuel avec alerte budget plateforme seule : pas divulguer compteur, autorisation commerciale séparée avant supplément.

- **[D20](../product/ARCHITECTURE_DECISIONS.md#d20)** — Clé personnelle : consommation payée directement au fournisseur EN PLUS abonnement ; expliquer avant activation ; pas remise inventée sur abonnement.

- **[D21](../product/ARCHITECTURE_DECISIONS.md#d21)** — Pas tableau de bord ni alerte tokens/coûts Qwen pour agence : suivi/alertes budget UNIQUEMENT propriétaire plateforme. Incapacité opérationnelle visible sans chiffres/tokens ni alerte budgétaire agence.

- **[D22](../product/ARCHITECTURE_DECISIONS.md#d22)** — Avec clé personnelle : admin agence voit consommation/coût estimé, facture fournisseur fait foi. Budget mensuel configurable limité appels DossierClé, plafond fournisseur complémentaire, réservations atomiques/coûts concurrents à concevoir.

- **[D23](../product/ARCHITECTURE_DECISIONS.md#d23)** — Budget clé personnelle épuisé OU clé invalide/révoquée OU fournisseur indisponible : bascule Qwen inclus, avec accord initial explicite admin, dans enveloppe plateforme disponible. Pas mise en pause si cette bascule autorisée et disponible.

- **[D24](../product/ARCHITECTURE_DECISIONS.md#d24)** — Retour automatique modèle choisi après rétablissement/vérification budget et délai de stabilité ; reprise appels futurs uniquement. Tous fournisseurs autorisés indisponibles : attente, manuel/email continuent ; mandat/horaires/état humain/budget/idempotence recontrôlés au retour.

- **[D25](../product/ARCHITECTURE_DECISIONS.md#d25)** — OCR : recommandation (non bench exécuté) extraction directe texte PDF si possible, vision sur scans/photos, humain si doute. Pas authenticité ni solvabilité. Modèle métier et capacités OCR à qualifier, pas claim meilleur OCR.

## Why

Une passerelle applique les contraintes de l’agence sans déléguer la sécurité au modèle ; un ledger distinct évite de confondre abonnement et facture fournisseur.

## Consequences

### Positive

Routage contrôlable, continuité manuelle, visibilité BYOK adaptée sans révéler budget inclus.

### Negative / trade-offs

Estimation peut différer facture, BYOK limite seulement DossierClé ; une capacité sans coût maximal fiable doit attendre. Aucune compatibilité OCR ou performance présumée entre fournisseurs.

### Operational impact

Catalogue par version/tâche/région/tarif, limites et circuits de stabilité ; tests token entrée/sortie/OCR/reprise/secours et charge mensuelle/marge. Périodes mensuelles distinctes, réservations concurrentes et double comptage à tester.

## Security / data impact

Jamais secrets au modèle, SQL/réseau arbitraire interdits, sorties validées. Scaleway ZDR exception requêtes jusqu’à deux semaines ; Mistral Scale ZDR sur demande/stateless et training opt-out distinct ; preuve par compte BYOK avant réel.

- **Authentication** : requêtes humaines avec session centrale valide et MFA avant métier ; dépôt OTP séparé. Jobs autonomes avec identité workload/service authentifiée, portée limitée et mandat agence courant, sans maintenir une session utilisateur après logout/idle30. Logout ne supprime pas le mandat agence ; retraits de droits, validité des validations humaines et suspensions restent recontrôlés avant effet. Routes publiques strictement limitées, aucun bypass.
- **Authorization** : R01 et vérification courante côté services/jobs, pas droit donné par l’UI ou contenu IA.
- **Sensitive data** : minimisation, objets privés et aucun contenu brut dans traces techniques.
- **Tenant isolation** : base distincte par agence et contrôles objets/jobs/exports ; identité centrale seulement selon D54.
- **Secrets** : coffre scoped, TOTP chiffré clé hors DB, aucun réaffichage/export/log de secret.
- **Compliance** : contrats/rétention/résidence à prouver ; aucune conformité absolue ou test accompli déduit d’une page fournisseur.

## Migration / rollback

- **Migration** : Versionner tarifs/prompts/schémas et configurations consenties ; changement de fournisseur/capacité nécessite preuve privacy et consentement applicables, pas migration silencieuse des données.
- **Rollback** : Désactiver fournisseur compromis/incompatible ; futures requêtes seulement vers secours autorisé et budget disponible, sinon attente. Ne pas rejouer appels facturés ou résultat inconnu.

## Validation et gate

Benchmark synthétique et corpus OCR, sortie/outils/vision par tâche, injections, budgets concurrents/passage mois/timeout, panne BYOK→Qwen et retour stable ; aucune mesure effectuée.

Gates/propriétaires et preuves de sortie : **B06, B08**, décrits dans [Architecture Gate](../product/ARCHITECTURE.md#architecture-gate). La clôture exige preuve et revue indépendante, pas seulement la présente recommandation. Sources techniques datées : [recherche F01–F09](../product/ARCHITECTURE_RESEARCH.md).

## Related

- PRD : [besoin et critères inchangés](../product/PRD.md).
- Story : [STORIES](../product/STORIES.md) — S10–S15, S19–S21, S24–S27, S30–S34 ; toujours BACKLOG.
- Issue : [#27](https://github.com/issa-diallo/dossiercle/issues/27).
- Architecture : [section de conception](../product/ARCHITECTURE.md#ia-ocr-enveloppes-et-byok).
- Previous ADR : aucun ADR antérieur dans le dépôt au début de ce travail ; voir [index](../product/ARCHITECTURE_DECISIONS.md#index-des-adr) pour dépendances transverses.
- Supersedes : aucun ADR antérieur remplacé ; les écarts au PRD/Stories et propositions conversationnelles abandonnées figurent dans [addendum](../product/ARCHITECTURE_DECISIONS.md#addendum-et-supersessions). Pas de réécriture du PASS Story Review historique.
