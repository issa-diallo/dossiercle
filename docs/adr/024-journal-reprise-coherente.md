# ADR-024 — Journal indépendant et reprise cohérente

## Status

`ACCEPTED` — décision de conception maintenue ; aucune preuve runtime. La note
pré-D81 sur B07 ci-dessous est historique : Architecture est PASS au niveau N1
par D81/ADR-029 ; les preuves N2/N3 restent requises avant activation.

## Date

2026-10-11

## Context

Rollback des bases ne doit pas ressusciter droits/MFA/mandats/suppressions. Scaleway managé ne fournit pas de preuve native PITR ; objectifs D58 restent stricts.

## Decision drivers

V1 sans client simple/économique ; sécurité et isolation conservées ; preuves
honnêtes aux gates adaptés ; aucune installation/POC/dépense ; détail vérifiable.

## Options considered

J1 : protection des refus et reprise explicitable, journal/IAM à exploiter. J2 revue humaine globale : peu de journal fin mais débit humain/RTO fragiles. Snapshots locaux seuls : rapides mais même emplacement et pas cohérence des droits post-backup, rejetés comme garantie catastrophe.

## Decision

J1 minimal Object Storage Multi-AZ Paris, Object Lock COMPLIANCE et IAM distinct, événements opaques de refus/epochs/tombstones avant acquittement ; accès fermé si journal inconnu. Backups horaires côté runner, dumps cohérents par base chiffrés avant stockage, manifest et watermarks causaux ; pas atomicité multibase supposée. Reprise intégrité→manuel→autonomie autorisée par propriétaire.

## Why

Instruction humaine de finalisation Architecture et contraintes déjà acquises.
Le choix minimise les composants sans attribuer de capacité non démontrée ;
les limitations ci-dessous font partie de la décision.

## Consequences

RPO/RTO chacun < 4 h à mesurer avant commerce depuis incident, réconciliation comprise ; contrôle d’âge jeu complet et fermeture prudente. Backups30 j chiffrés, journal couvre tous horizons restaurables ; pas originals. Paris seul ne prouve pas couverture perte régionale totale. Capacité intervention heures ouvrées actuelle ne vaut pas RTO commercial de nuit.

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
- Décision : D75 dans [registre](../product/ARCHITECTURE_DECISIONS.md).
- PRD : [PRD](../product/PRD.md) ; Stories : [37 stories](../product/STORIES.md).
- Contrats/preuves : [finalisation](../product/ARCHITECTURE_FINALIZATION.md).
- Sources : [research](../agentic/work/63-finalize-architecture/research.md).
- Budget : [prévisionnel](../product/ARCHITECTURE_BUDGET.md).
- Supersedes / previous : ADR-010 précisé sur reprise et ADR-002/D59 sur mécanisme PITR remplacé par D73. D58, D41/D42 et absence doublons/droits ressuscités préservés.
