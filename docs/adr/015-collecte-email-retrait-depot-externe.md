# ADR-015 — Collecte par email et retrait du dépôt externe V1

> **Autorité actuelle #63 — D73–D80 :** B11 humain D69 acquis ; D77 fixe formats emailPDF/JPEG/PNG sans réintroduire dépôt/OTP/espace client. Anciennes durées/formats ouverts supersédés dans cette portée. [ADR-026](026-documents-retention-limites.md), [matrice](../product/ARCHITECTURE_FINALIZATION.md). Le corps antérieur conserve sa provenance ; ses états ouverts/pending ou propositions contradictoires sont historiques dans cette seule portée.

## Status

`ACCEPTED` — décision utilisateur de principe acquise ; consolidation B11 CONSOLIDATED_PENDING_REVIEW, gate humain PENDING_HUMAN et Architecture BLOCKED. Aucun PASS runtime ou autorisation de production.

## Date

2026-10-11 (transposition, commencée le 10). Source décision : #33 du 2026-10-02.

## Context

L’atelier #33 réserve la plateforme aux collaborateurs et retire le formulaire client sans compte décrit D50/D51.

## Decision drivers

Parcours spécialisé ; messagerie de l’agence comme entrée ; maintien MFA et contrôle des pièces.

## Options considered

### A — collecte par email

**Pros** — Retenu #33 ; cohérent boîte source et accès agence.

**Cons** — Messages/pièces non fiables restent à filtrer, besoin de relecture fournisseur.

### B — formulaire sans compte OTP/lien 7 j

**Pros** — Contrôle spécifique upload.

**Cons** — Ancien choix explicitement retiré ; surface publique additionnelle.

### C — portail client permanent

**Pros** — Suivi déposant plus complet.

**Cons** — HorsV1, besoin et droits non cadrés.

## Decision

D64 retire dépôt client/OTP/lien 7 j et espace client V1. Les pièces clients arrivent par email à l’agence ; les collaborateurs consultent les constats dérivés et provenance, avec traitement temporaire selon ADR-014. Pas de routes /deposit ni upload_grant/upload_session client en modèle courant. MFA TOTP des collaborateurs, AV/quarantaine e-mail et imports CSV/XLSX catalogue subsistent. La restriction PDF/JPEG/PNG de l’ancien formulaire ne fixe pas la politique formats email, ouverte B08. V2 invitation artisan reste un périmètre futur distinct.

## Why

Le retrait explicite de #33 prévaut sur le choix historique, sans créer un nouveau produit ni un droit public.

## Consequences

### Positive

La portée utilisateur courante devient explicite et compatible avec les Stories.

### Negative / trade-offs

Les limites des options retenues restent des contraintes ; aucune qualité/privacy/disponibilité n’est déduite de la documentation.

### Operational impact

Réconcilier S31–S33/API/tests avant implémentation ; aucune route dépôt existante à supprimer dans ce travail documentaire. Tests futurs ingestion/AV/purge/provenance et refus accès extérieur ; durée/quotas encore à décider.

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
- Previous ADR / Supersedes : ADR-009 et D50/D51 seulement portée formulaire/OTP ; D31–D34/D49 sécurité email restent applicables.
- Décisions actuelles : [D60–D68](../product/ARCHITECTURE_DECISIONS.md#décisions-acquises-consolidées-le-2026-10-11--d60d68).
