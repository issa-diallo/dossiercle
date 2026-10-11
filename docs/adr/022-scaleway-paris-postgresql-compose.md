# ADR-022 — Scaleway Paris, PostgreSQL mutualisé et Compose

## Status

`ACCEPTED` — décisions humaines et conception dans le mandat#63 ; aucune preuve
runtime. ADR-025 n’accepte aucune solution OTP inexistante ; B07 reste BLOCKED.

## Date

2026-10-11

## Context

Aucun client ; D59 imposait Cloud SQL et un réseau inter-cloud coûteux. La nouvelle instruction demande Scaleway Paris, PG17 managé et une infrastructure simple sans Kubernetes.

## Decision drivers

V1 sans client simple/économique ; sécurité et isolation conservées ; preuves
honnêtes aux gates adaptés ; aucune installation/POC/dépense ; détail vérifiable.

## Options considered

Local/Compose Scaleway : coût initial0 cloud et topologie simple, responsabilité VM et sauvegardes. Cloud SQL+VPN : capacités documentées mais complexité multi-cloud, supersédé par instruction. Kubernetes : exploitation/ressources supplémentaires, exclu au lancement.

## Decision

Local sans client, puis Compose sur VM mutualisée et PG17 managé Paris ; Private Network, public PG supprimé, bases/rôles séparés par agence et par composant. Secret Manager scoped et rotation explicite. PITR natif non établi ; reprise alternative ADR-024. La configuration Cloud SQL/PITR D59 est remplacée, pas les objectifs D58 ni les garanties de production.

## Why

Instruction humaine de finalisation Architecture et contraintes déjà acquises.
Le choix minimise les composants sans attribuer de capacité non démontrée ;
les limitations ci-dessous font partie de la décision.

## Consequences

Un fournisseur infra, aucune instance par agence. Runtime mutualisé constitue exception explicite au tout-serverless historique ; montée en capacité après mesures, pas autoscaling illimité promis. HA PostgreSQL synchrone non réputée interzone ; snapshots locaux non protection catastrophe seule. Budget commercial dépasse 150 € selon hypothèses, acquisition interdite ici.

### Operational impact

Propriétaire responsable avant commerce ; qualification N2/N3 et arrêt fermé
si précondition absente. Contrats détaillés dans la finalisation, pas service
opérationnel ou stack installée par cet ADR.

## Security / data impact

Authentification : Keycloak central/TOTP et sessions serveur, blocage D54 explicite.
Autorisation : R01 et contrôle serveur courant ; support sans droits métier implicites.
Données sensibles : dérivés minimisés, originaux temporaires privés/AV/purge, aucune
pièce ni secret en job/log/export. Isolation : DB et runtime rôle par agence ;
secrets : coffre scoped et clés hors données protégées ; conformité : preuves
contractuelles/privacy avant réel, aucune conclusion juridique générale.

## Migration / rollback

Aucune application/client à migrer ; changement documentaire seulement. Future
migration par base canari/permissions/digests avec restore isolé avant bascule.
Rollback ne réactive pas ancien mandat/secret/droit/suppression et ne revient pas
silencieusement au fournisseur historique ; nouvel arbitrage si architecture change.

## Related

- Issue : [#63](https://github.com/issa-diallo/dossiercle/issues/63).
- Décision : D73 dans [registre](../product/ARCHITECTURE_DECISIONS.md).
- PRD : [PRD](../product/PRD.md) ; Stories : [37 stories](../product/STORIES.md).
- Contrats/preuves : [finalisation](../product/ARCHITECTURE_FINALIZATION.md).
- Sources : [research](../agentic/work/63-finalize-architecture/research.md).
- Budget : [prévisionnel](../product/ARCHITECTURE_BUDGET.md).
- Supersedes / previous : ADR-002 partiellement (produit/hébergement/configuration Cloud SQL seulement), ADR-017 (topologie inter-cloud proposée), D59. D08/D39/D54 et toutes règles isolation inchangées.
