# Research — finalisation Architecture #63

Mode LARGE. Research documentaire seulement ; pas de nouvelle recherche
produit/questionnaire. Sources internes : README → METHOD → WORKFLOW → COMMITS,
SCALING/CONTEXT/SAFETY, PRD/37 Stories/Story Review, Architecture/D01–D72/
remediation, ADR-001–021 et artefacts B01–B12/#62. Q1–Q6 historiques conservés.
Lecture et synthèses spécialisées indépendantes en lecture seule.

## Sources primaires consultées le 2026-10-11

| Source | Conclusion bornée / preuve |
|---|---|
| [Scaleway PostgreSQL produit](https://www.scaleway.com/en/managed-postgresql-mysql/) et [API](https://www.scaleway.com/en/developers/api/managed-database-postgre-mysql) | PostgreSQL17 annoncé, bases multiples ; version/SKU/région effective à contrôler au provisionnement. |
| [Utilisateurs PG](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/manage-users/) | Permissions par base ; objets futurs nécessitent privilèges par défaut. |
| [Endpoint public](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/remove-public-endpoint/) et [FAQ](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/faq/) | Private Network puis suppression endpoint public documentés ; bootstrap par défaut public à fermer. |
| [Endpoints TLS](https://www.scaleway.com/en/developers/api/managed-database-postgre-mysql/endpoints) | TLS supporté ; clients verify-full et absence chemin public restent N2. |
| [Concepts RDB](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/concepts/) et [backups](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/manage-backups/) | Snapshots cohérents même emplacement, backups logiques par base, fréquence/rétention configurables ; HA synchrone sans preuve multi-AZ. LUKS données/logs/snapshots, pas backups logiques. Défaut24 h/7 j ne satisfait pas notre protocole. PITR WAL natif non établi, cadence native1 h non établie ; runner externe de dump horaire choisi. |
| [Object Lock](https://www.scaleway.com/en/docs/object-storage/api-cli/object-lock/) et [régions](https://www.scaleway.com/en/product-availability-by-region/) | Object Lock requiert versioning ; COMPLIANCE non contournable pendant rétention, classes Multi-AZ/OneZone/Glacier. Paris Multi-AZ disponible ; bucket journal séparé des originaux24 h. |
| [Secret Manager](https://www.scaleway.com/en/docs/secret-manager/faq/) | IAM/TLS/chiffrement enveloppe et réplication zonale ; bootstrap IAM de l’hôte pas supprimé. |
| [Inngest selfhost](https://www.inngest.com/docs/self-hosting) | Docker, PG externe et Redis externe documentés (exemplePG17/Redis 7) ; défaut SQLite/Redis mémoire non référence commerce. Purge historique PG à exploiter. |
| [Licence Inngest v1.45.1](https://raw.githubusercontent.com/inngest/inngest/v1.45.1/LICENSE.md) | Serveur SSPL, clause13 Service Source Code si fonction offerte comme service ; transformation future Apache selon ancienneté du code, pas exemption courante. Moteur interne immobiliers choisi, qualification usage/version avant vente ; tarif licence commerciale inconnu. |
| [OIDC Keycloak](https://www.keycloak.org/securing-apps/oidc-layers), [DB](https://www.keycloak.org/server/db) | Code/PKCE/introspection/logout/backchannel ; PG17 supporté. Contrat BFF NestJS proposé avec jetons serveur. |
| [OTP26.8.0](https://raw.githubusercontent.com/keycloak/keycloak/26.8.0/server-spi/src/main/java/org/keycloak/models/credential/OTPCredentialModel.java) et [JPA26.8.0](https://raw.githubusercontent.com/keycloak/keycloak/26.8.0/model/jpa/src/main/java/org/keycloak/models/jpa/JpaUserCredentialStore.java) | createOTPCredential sérialise secretData JSON ; store persiste sans cryptographie applicative. Défaut N1 KC-OTP-01 contre D54, pas hypothèse d’échec runtime. |
| [Secours26.8.0](https://raw.githubusercontent.com/keycloak/keycloak/26.8.0/server-spi/src/main/java/org/keycloak/models/credential/RecoveryAuthnCodesCredentialModel.java), [vault](https://www.keycloak.org/server/vault) | Hash des secours et retrait à usage sur source ; concurrence N2. Vault ne fournit pas chiffrement OTP natif : SMTP/LDAP/IdP seulement. |
| [Mistral prix](https://docs.mistral.ai/inference/pricing), [régional](https://docs.mistral.ai/inference/regional-inference), [ZDR](https://docs.mistral.ai/admin/monitor-comply/zero-data-retention) | Small 4/OCR 4.1 candidats ; endpoint EU +10 %, modèles/routes à qualifier ; ZDR organisation approuvée stateless chat/OCR, pas services stateful ; training opt-out distinct, control plane à examiner. |
| [Nest12 migration](https://docs.nestjs.com/migration-guide), [Vite guide](https://vite.dev/guide/) | Nest12 ESM et TS6 ; Node24.15+ couvre seuil schematics, Vite 20.19+/22.12+. Compatibilité documentaire ne prouve pas builds. |

## Conclusions et limites

B01/B04 sont des choix de conception cohérents documentables sans POC, avec
limites Scaleway transparentes et reprise alternative conservant D58.
B05/B06 P1 historiques exigeaient des essais avant choix fin ; nouvelle mission
permet une proposition réversible sans clients et garde activation/données
réelles fermées jusqu’à N2/N3. Reclassification explicite D80, pas faux PASS.
B07 garde une incompatibilité **indispensable à Architecture**, non reportable :
aucune solution concrète OTP chiffré compatible maintenue n’a été identifiée.

La licence Inngest est analysée documentairement, pas un avis juridique définitif ;
la frontière SaaS interne choisie reste à qualifier contractuellement avant vente.
Ne promettre aucun SKU disponible, taille suffisante, délai restore, région
Mistral, capacité pilote, conformité RGPD, licence commerciale ou HA interzone.
Tarifs et calculs : [budget](../../../product/ARCHITECTURE_BUDGET.md).

Verdict Research : PASS pour les faits/limites recensés ; Architecture BLOCKED
par KC-OTP-01. Aucun test applicatif ni POC exécuté.
