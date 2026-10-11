# ADR-029 — Chiffrer les secrets TOTP avec privacyIDEA

## Status

`ACCEPTED` — conception retenue dans la demande utilisateur de résolution de
B07 ; aucune installation ni preuve runtime. Revue indépendante référencée
ci-dessous avant verdict du gate. Précise/supersède ADR-025 sur la solution OTP,
sans remplacer Keycloak ni affaiblir D54, D05, D60 ou R01.

## Date

2026-10-11

## Context

KC-OTP-01 : Keycloak 26.8 stocke les secrets TOTP sans chiffrement applicatif.
D54 exige confidentialité du secret en base et clé hors DB. Le natif, les
volumes chiffrés et Vault SPI ne satisfont pas seuls cette exigence. Aucun client
ni facteur à migrer ; la mission reste Architecture uniquement, sans POC.

## Decision drivers

Conserver Keycloak, TOTP obligatoire et secours irréversibles ; utiliser un
moteur MFA maintenu plutôt qu’une authentification maison ; local possible,
Compose Scaleway Paris, pas Kubernetes ; distinguer conception et qualification.

## Options considered

- Keycloak seul + chiffrement disque : économique mais contraire D54, rejeté.
- Proxy cozystack/keycloak-kms-proxy : chiffre credentials avec KMS externe,
  Apache 2 ; corpus Keycloak 26.0, maturité récente et dépendance au parsing SQL,
  Vault supplémentaire. Non retenu pour cette V1.
- privacyIDEA et provider officiel : logiciel MFA maintenu, chiffrement des
  secrets TOTP et rotation documentés, intégration famille Keycloak26. Un service de
  plus et licence AGPL, mais pas modification du moteur d’identité. Retenu.

## Decision

Keycloak reste IdP OIDC et autorité comptes/mots de passe/sessions. privacyIDEA
3.14 devient le magasin/validateur TOTP central, via provider officiel 1.8.0.
Un conteneur privé et une DB logique `privacyidea` dédiée sur PG 17 mutualisé,
avec rôle distinct, sans droits sur bases métier. Aucun TOTP natif Keycloak.
Secours natifs Keycloak hashés à usage unique conservés.

Le contrat normatif, les paramètres exacts et les sources sont dans
[qualification OTP](../product/ARCHITECTURE_OTP.md) : clés Secret Manager hors
DB/backups, rotation offline, restauration coordonnée avec journal, MFA requis,
onboarding fermé et protection des entrées OpenID du provider par ingress WAF
maintenu. Ces contrôles sont obligatoires, pas options ni capacité déjà active.

## Why

Un dump SQL ne révèle plus les secrets TOTP. Les primitives MFA sont déléguées à un
logiciel existant ; NestJS garde sessions opaques et autorisation R01. Aucune
instance dédiée par agence, aucune stack applicative remplacée.

## Consequences

### Positive

D54 respectée par conception vérifiable ; Keycloak et les invariants conservés ;
clés et données restaurables séparées, solution publiée et maintenue.

### Negative / trade-offs

Un service Python et son cycle de correctifs de plus ; panne PI ferme les
connexions TOTP. AES256CBC documenté, pas AEAD : aucune protection revendiquée
contre un DBA en écriture ni compromission du service. Plugin avec SPI privés,
compilé contre26.5.6 : fonctionnement exact26.8 à tester en Verify, pas garanti.

### Operational impact

Rotation offline avec export de secrets TOTP en RAM protégée ; clés anciennes jusqu’à
expiration des backups ; restauration et charge à qualifier. Service mutualisé
sur VM proposée, aucun supplément matériel garanti nul. Support commercial non
acquis ; budget et obligations de licence réévalués avant commerce.

## Security / data impact

Authentification : password Keycloak + TOTP PI ou secours Keycloak ; pas email/SMS
ni passkey silencieux. Autorisation : NestJS R01 et epochs actuels. Identité
stable realm/resolver/UUID, username non réattribué ; sans données métier en PI.
Secrets : `PI_ENCFILE` hors PG et sauvegardes de données, tmpfs 0400 et IAM scoped.
Contrôle connu du provider : POST `scope`/`id_token_hint` fermés par analyse des
paramètres à l’ingress ; aucun accès direct à Keycloak. Les données de formulaire
et OTP ne vont pas dans les journaux WAF ni le stockage temporaire disque.
Conformité : PI AGPL v3 non modifié, REST séparé ; provider Apache 2. Notices et
sources conservées ; pas exemption SaaS générale, revue distribution avant vente.

## Migration / rollback

Aucune migration réelle. Futur canari avec données synthétiques puis Verify
obligatoire avant réel. Rollback fermé si solution incompatible ; ne jamais
réactiver OTP natif non chiffré ou restaurer droits/facteurs révoqués.

## Related

- PRD : [PRD](../product/PRD.md) ; Stories S01–S06, R01/G01 [Stories](../product/STORIES.md).
- Issue : [#63](https://github.com/issa-diallo/dossiercle/issues/63), prolongée par la demande de résolution OTP.
- Décision : D81 dans [registre](../product/ARCHITECTURE_DECISIONS.md).
- Previous : [ADR-025](025-keycloak-bff-protection-otp.md), [ADR-019](019-alternative-mfa-keycloak.md).
- Recherche/revue : [OTP](../product/ARCHITECTURE_OTP.md), [revue](../agentic/work/63-finalize-architecture/otp-review.md).
