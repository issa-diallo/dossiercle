# ADR-026 — Documents temporaires et rétentions séparées

## Status

`ACCEPTED` — décision de conception maintenue ; aucune preuve runtime. La note
pré-D81 sur B07 ci-dessous est historique : Architecture est PASS au niveau N1
par D81/ADR-029 ; les preuves N2/N3 restent requises avant activation.

## Date

2026-10-11

## Context

L’utilisateur fixe formats/limites/TTL et une hypothèse métier3 ans ; les classes de données doivent être distinguées, pas durée légale universelle.

## Decision drivers

V1 sans client simple/économique ; sécurité et isolation conservées ; preuves
honnêtes aux gates adaptés ; aucune installation/POC/dépense ; détail vérifiable.

## Options considered

Allowlist et purge rapide : minimisation, relire source si nécessaire. Archive EML durable : facilite reprise mais contraire D62/D63, rejetée. Tout format automatique : risque parsing/actif non qualifié, rejeté.

## Decision

20000000 octets par pièce ; email automatique PDF/JPEG/PNG, autres manuels ; AV/quarantaine tous états, fin traitement/24 h plafond de purge. Imports CSV/XLSX préservés. Métier3 ans après clôture hypothèse avant validation juridique/contractuelle ; durées audit/logs/backups distinctes dans finalisation. Export dérivé CSV/JSON24 h et résiliation D42 prioritaires.

## Why

Instruction humaine de finalisation Architecture et contraintes déjà acquises.
Le choix minimise les composants sans attribuer de capacité non démontrée ;
les limitations ci-dessous font partie de la décision.

## Consequences

Purge applicative supervisée et lifecycle de secours, pas garantie TTL par un lifecycle quotidien. Pas versioning/Object Lock sur originaux, pas copies caches/logs/backups. Suppression et horizon tombstones font partie de la restauration. Hypothèses techniques réversibles ne créent pas prix/plafonds commerciaux nouveaux.

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
- Décision : D77 dans [registre](../product/ARCHITECTURE_DECISIONS.md).
- PRD : [PRD](../product/PRD.md) ; Stories : [37 stories](../product/STORIES.md).
- Contrats/preuves : [finalisation](../product/ARCHITECTURE_FINALIZATION.md).
- Sources : [research](../agentic/work/63-finalize-architecture/research.md).
- Budget : [prévisionnel](../product/ARCHITECTURE_BUDGET.md).
- Supersedes / previous : ADR-009/014/015/020 précisés formats/rétentions ; politiques historiques proposées supersédées dans ces portées seulement ; droits/AV/export/confidentialité maintenus.
