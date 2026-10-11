# ADR-025 — Contrat Keycloak BFF et protection OTP

> **Suite D81 — 2026-10-11 :** la protection OTP est désormais définie par
> [ADR-029](029-keycloak-privacyidea-totp-chiffre.md) / [contrat OTP](../product/ARCHITECTURE_OTP.md).
> Keycloak reste IdP ; le constat natif et le verdict BLOCKED du corps ci-dessous
> sont historiques avant cette résolution, sans abrogation de D54.

## Status

`ACCEPTED` — décisions humaines et conception dans le mandat#63 ; aucune preuve
runtime. ADR-025 n’accepte aucune solution OTP inexistante ; B07 reste BLOCKED.

## Date

2026-10-11

## Context

Keycloak est acquis D72 ; D54 exige secret TOTP chiffré avec clé hors DB. La source26.8.0 ne fournit pas cette protection nativement.

## Decision drivers

V1 sans client simple/économique ; sécurité et isolation conservées ; preuves
honnêtes aux gates adaptés ; aucune installation/POC/dépense ; détail vérifiable.

## Options considered

Keycloak natif : fournisseur acquis, secours hashés ; secret TOTP stocké brut dans JSON/JPA, incompatible D54. Keycloak avec solution maintenue de chiffrement credentials : seule recommandation, fournisseur conservé, support/rotation/restore à établir. Assouplir D54 ou auth maison : non autorisé, rejeté.

## Decision

Contrat NestJS BFF OIDC Code+PKCE, tokens serveur, cookie opaque, CSRF, session serveur idle30 min absolu15 j, droits R01 actuels ; Keycloak invitations/MFA/secours natifs et récupération par propriétaire. Architecture BLOCKED KC-OTP-01 tant que solution maintenue/supportée de chiffrement credentials compatible D54 non identifiée et revue.

## Why

Instruction humaine de finalisation Architecture et contraintes déjà acquises.
Le choix minimise les composants sans attribuer de capacité non démontrée ;
les limitations ci-dessous font partie de la décision.

## Consequences

Ne pas confondre cryptage volume/backup avec secret chiffré en DB contre dump/lecture SQL. Aucune promesse native/vault OTP ni report artificiel N2. Paramètres recovery/anti-abus à implémenter via Keycloak/bibliothèques maintenues, jamais primitives password/TOTP maison.

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
- Décision : D76 dans [registre](../product/ARCHITECTURE_DECISIONS.md).
- PRD : [PRD](../product/PRD.md) ; Stories : [37 stories](../product/STORIES.md).
- Contrats/preuves : [finalisation](../product/ARCHITECTURE_FINALIZATION.md).
- Sources : [research](../agentic/work/63-finalize-architecture/research.md).
- Budget : [prévisionnel](../product/ARCHITECTURE_BUDGET.md).
- Supersedes / previous : ADR-019 et ADR-003 précisés sur contrat ; aucune abrogation D54/D05. B07 reste BLOCKED N1, pas réouverture du choix fournisseur.
