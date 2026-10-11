# ADR-023 — Inngest interne et dispatcher fermé

## Status

`ACCEPTED` — décisions humaines et conception dans le mandat#63 ; aucune preuve
runtime. ADR-025 n’accepte aucune solution OTP inexistante ; B07 reste BLOCKED.

## Date

2026-10-11

## Context

L’orchestration choisie doit empêcher les anciens workers et les retries incertains d’émettre après restriction ; aucun exactly-once PG+SMTP disponible.

## Decision drivers

V1 sans client simple/économique ; sécurité et isolation conservées ; preuves
honnêtes aux gates adaptés ; aucune installation/POC/dépense ; détail vérifiable.

## Options considered

DispatcherA : faible complexité, indisponibilité conservatrice. Porte egressB : surface privilégiée distincte mais composant supplémentaire et même problème de fencing à qualifier. Workers avec credentials/failover par bail : plus disponibles en apparence, ancien processus encore capable d’envoyer, rejetés.

## Decision

Inngest auto-hébergé Compose privé avec PG technique/Redis externes. OptionA : dispatcher privilégié unique, restriction/admission sérialisées par agence, workers sans capacité fournisseur ; résultats inconnus bloqués jusqu’à réconciliation. Reprise uniquement après fencing réel de l’ancien hôte/egress, pas expiration de bail.

## Why

Instruction humaine de finalisation Architecture et contraintes déjà acquises.
Le choix minimise les composants sans attribuer de capacité non démontrée ;
les limitations ci-dessous font partie de la décision.

## Consequences

Préserve outbox/inbox/mandats/validation/audit et matrice d’effets typée. SSPL serveur et clause13 analysées, aucune exemption SaaS interne prouvée ; qualification usage/version écrite avant vente, coût licence commerciale inconnu. Tests pause/partition/locks/fencing et runtime N2 ; aucune réconciliation inventée.

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
- Décision : D74 dans [registre](../product/ARCHITECTURE_DECISIONS.md).
- PRD : [PRD](../product/PRD.md) ; Stories : [37 stories](../product/STORIES.md).
- Contrats/preuves : [finalisation](../product/ARCHITECTURE_FINALIZATION.md).
- Sources : [research](../agentic/work/63-finalize-architecture/research.md).
- Budget : [prévisionnel](../product/ARCHITECTURE_BUDGET.md).
- Supersedes / previous : ADR-005 et ADR-018 précisés pour topologie/barrière ; ADR-006 reste normatif. Aucun remplacement Inngest, aucune licence commerciale supposée acquise.
