# ADR-016 — Rapports, fermetures et bindings explicites

> **Autorité actuelle #63 — D73–D80 :** B09 QUALIFIED_LOCALLY — HUMAN_APPROVED acquis après#62 ; horaires/bindings/fermetures inchangés ; preuves durables PG/crash/tzdb/transport N2. Pending humain ci-dessous historique. [ADR-024](024-journal-reprise-coherente.md), [matrice](../product/ARCHITECTURE_FINALIZATION.md). Le corps antérieur conserve sa provenance ; ses états ouverts/pending ou propositions contradictoires sont historiques dans cette seule portée.

## Status

`ACCEPTED` — décision utilisateur de principe acquise ; consolidation B11 CONSOLIDATED_PENDING_REVIEW, gate humain PENDING_HUMAN et Architecture BLOCKED. Aucun PASS runtime ou autorisation de production.

## Date

2026-10-11 (transposition, commencée le 10). Sources décisions : #33 du 2026-10-02 et confirmation #42 du 2026-10-03, qualification #50/#51.

## Context

ADR-011 laissait l’interaction fermeture/rapports ouverte. #33 et confirmation #42 du 2026-10-03 ont acquis D1–D3 ; #50/#51 apportent une preuve algorithmique locale.

## Decision drivers

Slots fixes ; pas calendrier automatique ; pas rattrapage ; fenêtre depuis envoi effectif ; binding activé sans ancien historique.

## Options considered

### A — empêcher en fermeture et couvrir période prochaine occurrence

**Pros** — Retenu #33 ; fermeture respectée sans trou historique utile.

**Cons** — Fenêtres/livraisons par destinataire et résultats inconnus à réconcilier.

### B — rapports administratifs même fermé

**Pros** — Rapport quotidien apparent.

**Cons** — Non retenu après décision fermeture ; contraire D66.

### C — déplacer/rattraper automatiquement

**Pros** — Simple récupération apparente.

**Cons** — Modifie slots et double effets ; rejeté D66/D67.

## Decision

D66 : lundi–vendredi 8h45/13h30/16h00, aucun rapport pendant fermeture manuelle, pas calendrier férié automatique. Occurrence empêchée visible sans report/rattrapage ; prochaine autorisée depuis dernier envoi effectif, weekend/fermeture inclus. D67 : slots dans horaires d’action, configuration incohérente refusée/legacy empêchée ; retard strictement avant prochain slot sinon PREVENTED_LATE ; un destinataire nouveau ou réautorisé reçoit un nouveau binding qui commence à activation, sans historique ni héritage automatique ni ancien curseur. Accusé Sinistres D46 et droits/mandat/audit/tags/prise/stop gardent leurs contrôles. Aucun envoi autonome n’est autorisé par le seul créneau.

## Why

La règle temporelle provient d’arbitrages humains déjà acquis, sans déplacement implicite de créneau.

## Consequences

### Positive

La portée utilisateur courante devient explicite et compatible avec les Stories.

### Negative / trade-offs

Les limites des options retenues restent des contraintes ; aucune qualité/privacy/disponibilité n’est déduite de la documentation.

### Operational impact

POC #50 fusionné #51 commit 1654fb572c235f101cfc7a04473ac10c8e4f0507, store/RLock/transport en mémoire. 63 tests rejoués deux fois par orchestrateur sous Python 3.12.3 le 2026-10-10 ; preuve locale, pas PG/crash de processus/HA/transport réel. Revue narrativement PASS dans PR mais aucune GitHub review enregistrée. B09 QUALIFIED_LOCALLY_PENDING_HUMAN ; fermeture locale du gate seulement proposée, QA durable future obligatoire.

## Security / data impact

Authentification humaine centrale/MFA/session courante et identité service bornée ; R01 et mandat avant effet ; données sensibles minimisées ; base agence et coffre scoped ; secrets jamais exportés ; contrats/finalités/rétentions et privacy à qualifier avant réel. Les résumés et références peuvent rester personnels même sans original.

## Migration / rollback

Migration documentaire : appliquer les critères actuels avant Research story ; préserver texte ancien comme journal avec pointeur d’autorité. Aucune donnée/runtime migrée. Rollback : suspendre le traitement incompatible et réconcilier, jamais rétablir un ancien périmètre supprimé par simple rollback technique ; nouveau choix utilisateur/ADR requis si changement.

## Validation et gate

Critères et responsabilités [remediation](../product/ARCHITECTURE_REMEDIATION.md) ; Verify/Review indépendants de la consolidation puis décision humaine.

## Related

- PRD : [PRD](../product/PRD.md).
- Stories : [S01–S37](../product/STORIES.md), identifiants/DAG conservés.
- Issue : [#33](https://github.com/issa-diallo/dossiercle/issues/33) ; [#50](https://github.com/issa-diallo/dossiercle/issues/50) temporel.
- Previous ADR / Supersedes : ADR-011 seulement interaction fermeture/fenêtres et bindings ; D45–D48 maintenus/précisés, aucune nouvelle heure.
- Décisions actuelles : [D60–D68](../product/ARCHITECTURE_DECISIONS.md#décisions-acquises-consolidées-le-2026-10-11--d60d68).
