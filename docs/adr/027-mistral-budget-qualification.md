# ADR-027 — Mistral stateless, budgets et qualification

## Status

`ACCEPTED` — décision de conception maintenue ; aucune preuve runtime. La note
pré-D81 sur B07 ci-dessous est historique : Architecture est PASS au niveau N1
par D81/ADR-029 ; les preuves N2/N3 restent requises avant activation.

## Date

2026-10-11

## Context

Fournisseur Mistral acquis ; utilisateur fixe 5 €/agence et 30 € sans client, sans benchmark/appels autorisés et sans preuve ZDR effective.

## Decision drivers

V1 sans client simple/économique ; sécurité et isolation conservées ; preuves
honnêtes aux gates adaptés ; aucune installation/POC/dépense ; détail vérifiable.

## Options considered

Small 4/OCR conditionnel : coût proposé faible, qualité à mesurer. Modèle plus cher automatique : risque dépassement, rejeté sans justification/validation. Fournisseur/route stateful alternative : contredit D72/ZDR, non retenue.

## Decision

Candidats réversibles Small 4 et OCR 4.1 par tâche, extraction locale avant OCR ; routes stateless EU, ZDR approuvé/training opt-out et disponibilité à établir avant réel. Ledger atomique réservations/retries inconnus, suspension au plafond et hausse humaine explicite. BYOK/secours consentis et manuel préservés. Qualification qualité/coût et choix modèle commercial N2 avant activation, aucun benchmark prétendu.

## Why

Instruction humaine de finalisation Architecture et contraintes déjà acquises.
Le choix minimise les composants sans attribuer de capacité non démontrée ;
les limitations ci-dessous font partie de la décision.

## Consequences

Provenance/schema et abstention sur ambiguïté essentielle priment sur score auto-déclaré. Zéro évaluation/classement financier candidats, aucune décision locative ni engagement autonome non autorisé. Budget€ face tarifsUSD et supplémentEU nécessite conversion/réserve à l’appel, pas taux actuel inventé.

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
- Décision : D78 dans [registre](../product/ARCHITECTURE_DECISIONS.md).
- PRD : [PRD](../product/PRD.md) ; Stories : [37 stories](../product/STORIES.md).
- Contrats/preuves : [finalisation](../product/ARCHITECTURE_FINALIZATION.md).
- Sources : [research](../agentic/work/63-finalize-architecture/research.md).
- Budget : [prévisionnel](../product/ARCHITECTURE_BUDGET.md).
- Supersedes / previous : ADR-008/021 précisés D72 ; aucune nouvelle acquisition modèle prouvée, aucun remplacement fournisseur.
