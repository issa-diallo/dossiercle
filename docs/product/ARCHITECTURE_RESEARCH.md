# Recherche documentaire — Architecture DossierClé

Date initiale des lectures : **2026-09-30**, dossier historique complété jusqu’au **2026-10-04**. [F17](#f17--actualisation-et-consolidation-du-2026-10-11) ajoute des observations ciblées du **2026-10-10** et leur consolidation finale du **2026-10-11** ; F01–F16 ne sont pas prétendues intégralement revérifiées. Sources primaires documentaires uniquement. Pas de provisionnement, installation, benchmark DossierClé, données réelles, conseil juridique ou validation contractuelle. Les pages vivantes et métadonnées doivent être revalidées lors du gel de versions. Ce dossier complète [Architecture](ARCHITECTURE.md) ; une décision humaine peut fermer un choix avec risque accepté sans transformer la documentation fournisseur en preuve runtime.

Actualisation des objectifs le 2026-10-01, issue #30 : [D58](ARCHITECTURE_DECISIONS.md#d58), sans nouvelle lecture fournisseur ni qualification runtime.

## F01 — PostgreSQL, sauvegardes et PITR

- [Serverless SQL — backups](https://www.scaleway.com/en/docs/serverless-sql-databases/how-to/manage-backups/) : sauvegardes **quotidiennes**, conservées **7 jours**, export `.pg_dump`, durée/coût restauration dépendant du volume. Ne démontre ni RPO < 4 heures, ni rétention 30 jours, ni PITR.
- [Stratégies backups managés](https://www.scaleway.com/en/docs/tutorials/backup-strategies/) : sauvegardes PostgreSQL/MySQL quotidiennes, 7 jours par défaut ; fréquence/rétention configurables selon instance, restauration autre AZ dans même région, pas multirégion native. **Ne prouve pas davantage PITR.** Ne pas reprendre des blogs affirmant PITR sans source primaire de l'offre exacte.
- [API Managed PostgreSQL/MySQL](https://www.scaleway.com/en/developers/api/managed-databases-for-postgresql-and-mysql) : opérations bases/utilisateurs/permissions/backups ; possibilité conceptuelle de plusieurs bases sur instance, pas qualification flotte ni coût nul.

Conséquence historique : cette lecture a rejeté Scaleway comme preuve suffisante pour B01. D59 sélectionne ensuite Cloud SQL avec risque accepté ; coûts, connexions, granularité de restauration et preuves opérationnelles restent à mesurer en Verify/QA. B03 reste ouvert pour RPO/RTO et reprise cohérente multi-services.

## F02 — Réseau et runtime Scaleway

- [Private Networks des Containers](https://www.scaleway.com/en/docs/serverless-containers/reference-content/containers-private-networks/) : un réseau privé par container ; **egress privé supporté, ingress privé non supporté**. Ne pas dessiner Inngest→NestJS Serverless comme appel privé garanti. HTTPS public authentifié et signature sur corps brut/anti-rejeu, ou gateway/runtime différent à qualifier.
- [Limites Containers](https://www.scaleway.com/en/docs/serverless-containers/reference-content/containers-limitations/) : timeout requête maximum 60 minutes, disque temporaire, scale-to-zero après 15 minutes ; aucune preuve d'exécution arrière-plan durable après réponse. Inngest server continuellement actif exige runtime/persistance adaptés, pas un container scale-to-zero présumé durable.
- [Connectivité réseau privé](https://www.scaleway.com/en/docs/serverless-containers/troubleshooting/container-private-network-connectivity/) : readiness au cold start à vérifier à Paris avec probes et retries bornés. Une divergence entre textes sur VPC routing impose validation compte/région, pas migration de région silencieuse.

Conséquence B02/B04 : topologie persistante plateforme, ingress/egress, signature/callback/raw body et reprise doivent être prouvés ; web et worker séparés peuvent rester le même monolithe.

## F03 — Scaleway IA : garanties et exceptions

- [Confidentialité Generative APIs](https://www.scaleway.com/en/docs/generative-apis/reference-content/data-privacy/) : ZDR par défaut **avec exception de conservation des requêtes complètes jusqu'à deux semaines** pour investigation problèmes/abus/erreurs. Métadonnées/tokens conservés pour le service ; ne pas écrire « aucune conservation absolue ».
- [FAQ](https://www.scaleway.com/en/docs/generative-apis/faq/) : modèles actuellement Paris, engagement Europe si évolution ; endpoint serverless public, pas accès VPC privé présumé. Le choix utilisateur impose infra Paris et traitement IA UE, pas nécessairement France stricte pour toute IA.
- [Catalogue](https://www.scaleway.com/en/docs/generative-apis/reference-content/supported-models/) : `Qwen3.6-35B-A3B` apparaît comme modèle serverless texte/vision, français, structured output/function calling, licence Apache 2.0 du modèle. [Fiche éditeur](https://huggingface.co/Qwen/Qwen3.6-35B-A3B) : évaluations éditeur, pas benchmark DossierClé. Multimodal n'implique pas ingestion PDF native.

Conséquence B06 : Qwen/Scaleway reste principal de principe, version exacte et performances/tarif à qualifier. La présence dans le catalogue n'est pas sélection finale. Examiner DPA, exceptions, transferts, sous-traitants et compatibilité de la conservation avec les finalités avant données réelles.

## F04 — Mistral et comptes BYOK

[ZDR Mistral](https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr) : offre Scale, demande motivée au support, approbation discrétionnaire, indicateur dans console admin ; seulement endpoints **stateless**. Files/batch/agents/conversations ne sont pas couverts ; OCR stateless possible, fichier stateful distinct. **ZDR et training opt-out sont deux réglages/garanties différents.**

Conséquence B06/B08 : une clé valide ne prouve pas conformité, absence d'entraînement ni rétention. Preuves par compte BYOK, endpoint/région UE, contrat, opt-out et politique de conservation avant activation réelle. D14 exige conservation maîtrisée, pas « zéro absolu » inventé ; si ZDR refusé, arbitrage humain de la politique, aucun fallback silencieux. Le consentement commercial BYOK ne vaut pas validation privacy.

## F05 — Secret Manager

[Documentation Scaleway Secret Manager](https://www.scaleway.com/en/docs/secret-manager/) : stockage/versionnement, option Key Manager pour clés client ; droits IAM et identité workload à qualifier. Suppression planifiée secrets/versions : **7 jours** dans un état inaccessible mais restaurable, pas effacement physique immédiat. Révocation fournisseur indépendante requise pour invalider une clé immédiatement.

Conséquence B04/B08 : rotation, permissions, résidence et cycle de vie à démontrer ; ne pas confondre retrait d'accès DossierClé, suppression planifiée au coffre et révocation à la source.

## F06 — Inngest

- [Self-hosting](https://www.inngest.com/docs/self-hosting) : défaut SQLite/Redis mémoire avec snapshots ne démontre pas HA ; `--redis-uri` pour queue/run state et `--postgres-uri` pour configuration/historique. SQLite ne couvre pas multi-node. **PostgreSQL ne purge pas automatiquement les anciens events/runs/traces** : rétention/minimisation des payloads, résultats d'étape et erreurs à concevoir.
- [Cancellation](https://www.inngest.com/docs/features/inngest-functions/cancellation) : annulation entre étapes, **étape en cours continue** ; replays dashboard ne peuvent ressusciter une autorisation. Références opaques uniquement, pas secrets, URL signées ou documents dans payloads.
- [Licence serveur](https://github.com/inngest/inngest/blob/main/LICENSE.md) : SSPL v1, clause 13 service ; Apache 2.0 au troisième anniversaire de publication du code concerné. SDK Apache 2.0 distinct du serveur. Pas conclusion juridique automatique sur SaaS embarqué interne.

Conséquence B02/B03 : serveur et SDK/version distincts, avis sur usage/licence, runtime persistant et coûts à valider. Inngest Cloud exclu. La barrière d'effets et les données métier restent DossierClé, indépendamment du retry/cancel/replay de l'orchestrateur.

## F07 — Better Auth, NestJS, Drizzle

- [NestJS](https://better-auth.com/docs/integrations/nestjs) : intégration tierce `@thallesp/nestjs-better-auth`, configuration `bodyParser: false` à examiner avec raw body/signatures webhooks. Guards par défaut et allowlist de routes publiques à qualifier ; aucun guard auth ne remplace autorisation R01.
- [Sessions](https://better-auth.com/docs/concepts/session-management) : expiration par défaut 7 jours, `updateAge` distinct ; cookie cache peut retarder révocation. `expireIn` réglé à 30 minutes n'est pas une preuve d'inactivité réelle si polling renouvelle.
- [2FA](https://better-auth.com/docs/plugins/2fa) : TOTP/enrôlement vérifié, codes de secours ; trusted devices/désactivation disponibles mais **aucun bypass de MFA obligatoire autorisé** par DossierClé. Récupération manuelle contrôlée spécifique à développer/tester.
- [Adaptateur Drizzle](https://better-auth.com/docs/adapters/drizzle), [PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql), [migrations](https://orm.drizzle.team/docs/migrations) : prise en charge PG et Pool configurable, variations de relations/versions, génération/migration de schéma. Pas isolation flotte/migration multibase automatique ; exemples `@rc` non autorisation prod.
- [Dépôt Better Auth](https://github.com/better-auth/better-auth) : MIT. Prisma reste alternative viable ; aucun rejet fondé sur affirmation obsolète d'un moteur Rust obligatoire.

Conséquence B07/B12 : compatible en principe ne veut pas dire intégré, testé ni durci. Versions stables gelées après matrice et QA complète.

## F08 — Gmail, Microsoft 365, IMAP/SMTP

- [Gmail labels](https://developers.google.com/workspace/gmail/api/guides/labels) : distinguer message/thread, y compris nouveaux messages d'un thread déjà tagué ; scopes effectifs minimaux à qualifier, simple scope labels insuffisant pour tout le traitement.
- [Gmail push](https://developers.google.com/workspace/gmail/api/guides/push) : dépendance **Google Cloud Pub/Sub** (topic/subscription/droits, renouvellement watch et history). Dépendance de transport du connecteur, pas orchestration métier hors Scaleway. Région/contrat/coût/autorisation à qualifier ou polling borné à comparer ; ne pas promettre tout transport Gmail sur Scaleway.
- [Graph update message](https://learn.microsoft.com/en-us/graph/api/message-update?view=graph-rest-1.0) : catégories via PATCH, permission **Mail.ReadWrite** ; envoi **Mail.Send** distinct à vérifier. Préserver catégories étrangères et lu/non lu, confirmer readback, subscriptions/delta expirations à tester.
- [RFC 9051](https://www.rfc-editor.org/rfc/rfc9051.html) : flags/keywords/UID, pas protocole d'envoi ; SMTP séparé. Source partiellement extraite lors recherche, pas déclaration de lecture intégrale RFC. `PERMANENTFLAGS`, keywords persistants, resync et visibilité client réel à prouver.

Conséquence B05 : matrice des trois connecteurs pilotes ; tag absent/incohérent bloque autonomie. Auth headers fiables issus du fournisseur à distinguer d'en-têtes forgés. Aucun compte réel ni test fournisseur effectué.

## F09 — Métadonnées npm : candidats, pas versions adoptées

Lectures registre sans installation le 2026-09-30 :

| Paquet | Version candidate observée | Contraintes/portée |
|---|---|---|
| [`@nestjs/core`](https://registry.npmjs.org/@nestjs%2fcore) | 12.1.2 | Node ≥20 ; ne suffit pas pour le tiers auth |
| [`drizzle-orm`](https://registry.npmjs.org/drizzle-orm) | 0.45.3 | Apache 2.0 |
| [`drizzle-kit`](https://registry.npmjs.org/drizzle-kit) | 0.31.11 | MIT |
| [`pg`](https://registry.npmjs.org/pg) | 8.23.1 | MIT, Node ≥16 |
| [`better-auth`](https://registry.npmjs.org/better-auth) | 1.7.6 | MIT, peers React 18/19 |
| [`@better-auth/drizzle-adapter`](https://registry.npmjs.org/@better-auth%2fdrizzle-adapter) | 1.7.6 | MIT, Drizzle ^0.45.2 ou intervalle RC ; candidat stable possible sans RC |
| [`@thallesp/nestjs-better-auth`](https://registry.npmjs.org/@thallesp%2fnestjs-better-auth) | 2.8.0 | MIT, Node ≥22.22.1, Nest ^11.1.6 ou ^12, Express ^5.1, Better Auth ≥1.5 <2, TS ^5.9.2 ou ^6 |
| [`inngest` SDK](https://registry.npmjs.org/inngest) | 4.21.0 | Apache 2.0, Node ≥20, TS ≥5.8 ; version serveur distincte |

Ces métadonnées ne sont pas un lockfile, un build ou un audit sécurité. Ne pas adopter automatiquement les dernières versions observées ; gel stable, compatibilité effective et licence de chaque composant à valider B12. La borne Node du tiers auth est plus stricte que celle de Nest seul.

## F10 — Versions observées et avis publiés au 2026-10-02

- [Releases du serveur Inngest](https://github.com/inngest/inngest/releases) : dernière release serveur publique, non draft et non prerelease observée, **v1.45.1**, publiée le 2026-09-17. Elle concerne le dépôt serveur `inngest/inngest`, pas le SDK npm.
- [Métadonnée `latest` du SDK npm Inngest](https://registry.npmjs.org/inngest/latest) : **4.21.1** observé pour le SDK `inngest/inngest-js`, Apache-2.0, Node ≥20 et peer TypeScript ≥5.8.0. F09 conserve l'observation 4.21.0 du 2026-09-30 : la page vivante a évolué entre les deux lectures.

Ces numéros sont des **observations datées distinctes**, ni adoption, ni gel, ni preuve de compatibilité, de licence acceptable pour l'usage retenu ou de sûreté. Le serveur Inngest v1.45.1 et le SDK npm 4.21.1 ne doivent pas être confondus.

- [Avis de sécurité Better Auth](https://github.com/better-auth/better-auth/security/advisories) : lecture exhaustive des **37 avis publiés retournés par l'API publique du dépôt** au 2026-10-02, aucun retiré dans cette réponse, publications du 2024-12-30 au 2026-09-30 : 3 critical, 22 high, 9 medium et 3 low. Cette exhaustivité porte seulement sur cette réponse publique à cette date : ce n'est ni un audit du code, ni une garantie d'absence d'avis privés, retirés après lecture ou futurs, ni une preuve de sûreté.
- Avis publiés les 29–30 septembre à intégrer à la matrice du gel : [GHSA-44jh-23m7-hpcf](https://github.com/better-auth/better-auth/security/advisories/GHSA-44jh-23m7-hpcf), low, concurrence PostgreSQL/rate limits dans le core et `@better-auth/drizzle-adapter`, corrigé en 1.7.7 ; [GHSA-965c-763c-88jm](https://github.com/better-auth/better-auth/security/advisories/GHSA-965c-763c-88jm), critical, état OAuth utilisable comme Magic Link, corrigé en 1.7.7 ; [GHSA-r4xp-prcw-77qf](https://github.com/better-auth/better-auth/security/advisories/GHSA-r4xp-prcw-77qf), high, OAuth Proxy, corrigé en 1.7.7 ; [GHSA-mx9r-x6ww-qjw9](https://github.com/better-auth/better-auth/security/advisories/GHSA-mx9r-x6ww-qjw9), high, `@better-auth/sso`, corrigé en 1.7.3. La [release v1.7.7](https://github.com/better-auth/better-auth/releases/tag/v1.7.7), publiée le 2026-09-30, mentionne les correctifs Magic Link, OAuth Proxy et Drizzle.
- MFA directement pertinent : [GHSA-xg6x-h9c9-2m83](https://github.com/better-auth/better-auth/security/advisories/GHSA-xg6x-h9c9-2m83), high, cookie cache pouvant contourner 2FA, corrigé en 1.4.6. Invitations d'organisation : [GHSA-fmh4-wcc4-5jm3](https://github.com/better-auth/better-auth/security/advisories/GHSA-fmh4-wcc4-5jm3) déclare `better-auth >=1.6.14` affecté sans version corrigée publiée ; si le plugin organization/invitations est utilisé, mitigation et configuration vérifiées sont obligatoires.

Magic Link, OAuth Proxy et SSO ne sont pas approuvés dans DossierClé et restent hors périmètre. Leur absence future doit être prouvée dans dépendances, plugins, configuration, routes et tests ; elle ne peut pas être supposée. Le core et l'adaptateur Drizzle restant candidats, les avis associés demeurent dans la matrice de sécurité. Un numéro récent ne suffit pas : configuration, mitigation et tests MFA/cookie/révocation/invitations restent requis sous B07/B12.

## F11 — Qualification Q1 B01 du 2026-10-02

La qualification initiale du 2026-10-02 a rejeté Scaleway comme cible suffisamment prouvée pour les invariants B01. Son contenu complet est conservé dans l'[annexe Q1 Scaleway historique — supersédée](ARCHITECTURE_Q1_B01_SCALEWAY_HISTORIQUE.md), incluant sources, contradictions, coûts datés, limites de chiffrement/restauration et ancien protocole `B01-P-1`. Le document [Q1 — B01 courant](ARCHITECTURE_Q1_B01.md) porte désormais la décision #52 : Cloud SQL est la cible active ; l'étude Scaleway reste une preuve historique de supersession, pas une recommandation courante.

## F12 — Qualification Q2 B02+B04 du 2026-10-02

La qualification détaillée est publiée dans [Q2 — B02+B04](ARCHITECTURE_Q2_B02_B04.md). Elle conserve Inngest v1.45.1 et le SDK 4.21.1 comme candidats non adoptés, avec PostgreSQL et Redis externes sur Instances ou Kapsule Paris. Elle rejette Serverless Containers pour le serveur Inngest persistant, mais le conserve comme candidat API avec callback HTTPS public signé, synchronisation non authentifiée explicitement désactivée et vérification JSON canonique par le SDK. Elle distingue Kapsule multi-AZ à control plane zonal du cluster regional HA Dedicated, tout en conservant le blocage du Load Balancer d'accès au control plane dans la zone primaire. Les scénarios chiffrés intègrent trois Load Balancers ingress zonaux et restent des planchers incomplets, non des preuves D58. Elle conclut `B02: BLOCKED` sur la SSPL, la récupération Redis, la rétention, le multi-réplicas et la barrière d'effets ; et `B04: BLOCKED` sur l'identité workload sans clé statique, le callback réel après proxy/parsing et la topologie HA/egress. Les protocoles `B02-P-1` et `B04-P-1` sont proposés sans autoriser de POC, compte, ressource ou dépense.

## F13 — Qualification Q3 B05+B06 du 2026-10-03

La recherche primaire détaillée sur Gmail, Microsoft Graph, IMAP/SMTP, Scaleway Generative APIs/Qwen et Mistral est publiée dans [Q3 — B05+B06](ARCHITECTURE_Q3_B05_B06.md). Elle établit les contrats documentaires de réception/envoi/marquage, les scopes/limites officiels, les garanties et exceptions privacy, les capacités et tarifs publics datés, ainsi que les contraintes de ledger/BYOK/fallback. Elle conclut `B05: BLOCKED` et `B06: BLOCKED`, avec demandes `B05-P-1` et `B06-P-1` nécessaires mais non autorisées par cette recherche.

## F14 — Qualification Q4 B07+B12 du 2026-10-03

La qualification détaillée est publiée dans [Q4 — B07+B12](ARCHITECTURE_Q4_B07_B12.md). Elle établit une matrice candidate Node 24 LTS, TypeScript 6, NestJS 12, Better Auth 1.7.7, Drizzle 0.45, React 19, Vite 8, Vitest 5, Playwright, k6 et OpenTelemetry, sans installation ni adoption. Elle impose les bornes session de 15 jours et idle humain de 30 minutes côté serveur, interdit cookie cache, trusted device et plugin Organization, et conserve les invitations/récupérations dans le domaine DossierClé. Elle définit un pipeline reproductible avec lockfile gelé, OpenAPI vérifié, artefacts immuables, SBOM, télémétrie minimisée et promotion QA→production sans rebuild. Elle conclut `B07: BLOCKED` et `B12: BLOCKED` : les protocoles synthétiques `B07-P-1` et `B12-P-1` sont indispensables mais non autorisés.

## F15 — Qualification Q5 B08+B10+B03 du 2026-10-03

La qualification détaillée est publiée dans [Q5 — B08+B10+B03](ARCHITECTURE_Q5_B03_B08_B10.md). Elle consolide trois comptes et deux boîtes inclus, l'absence de copie durable des originaux, l'export dérivé, les options de formats et de limite 20 Mo/20 MiB, ainsi que des scénarios synthétiques de coûts IA, observabilité et runtime. Elle distingue les durées métier, temporaires, audit, sécurité, backups, tombstones et exports sans fabriquer de durée légale universelle. Elle documente les options de disponibilité interne, les coûts publics des plans de support, les modèles de rotation et les runbooks, sans confondre délai initial de réponse, résolution, RTO ou SLA client. Enfin, elle cartographie les états PRA, établit les formules de cut cohérent/RPO/RTO, sépare perte AZ et régionale, et propose `B03-P-1` sans l'exécuter. Elle conclut `B08: BLOCKED`, `B10: BLOCKED` et `B03: BLOCKED`; les choix privacy/juridiques, commerciaux, opérationnels, PRA et toute autorisation de POC restent humains.

## F16 — Adoption documentaire Cloud SQL du 2026-10-04

Les sources officielles Google Cloud consultées documentent : région Paris `europe-west9`, PostgreSQL 17, instances HA régionales avec primaire/standby interzones et failover automatique, PITR vers une nouvelle instance, modes imposant le chiffrement en transit, chiffrement au repos des tables/fichiers temporaires/sauvegardes et sauvegardes automatiques ou à la demande chiffrées par défaut. Voir [Q1 — B01](ARCHITECTURE_Q1_B01.md) pour les liens et limites.

La décision humaine [D59](ARCHITECTURE_DECISIONS.md#d59) adopte Cloud SQL PostgreSQL 17 Enterprise HA régionale avec PITR activé et TLS obligatoire. Le POC #53 a été abandonné avant exécution. Statut : `B01: CLOSED_BY_DECISION — ACCEPTED_WITH_RISK`, pas `PASS`. Aucune mesure réelle de failover, transactions acquittées, PITR, RPO/RTO, isolation, pools, migrations ou coût ; aucune preuve de perte régionale. Ces contrôles sont reportés à Verify/QA avant Production, tandis que B03 reste `BLOCKED`.

## Preuves restantes

B01 n'est plus un choix structurel ouvert : il est `CLOSED_BY_DECISION — ACCEPTED_WITH_RISK`, avec validations opérationnelles encore obligatoires. B02–B12 restent ouverts ou `BLOCKED` : runtime/licence Inngest et barrière, PRA cohérent, réseau/coffre, connecteurs/tags, IA/privacy/coûts/BYOK, auth, quotas/rétention, fermetures/rapports, disponibilité/opérations, addendum produit et outillage. Aucun coût moyen par dossier, quota commercial ou SLA n'est fabriqué.

## F17 — Actualisation et consolidation du 2026-10-11

Observations publiques du **2026-10-10**, transposition finale du **2026-10-11** dans [remediation](ARCHITECTURE_REMEDIATION.md). Cette entrée conserve F01–F16 et Q1–Q6 comme photographies historiques. Sources primaires consultées en lecture seule par les explorations infra, intégrations et auth/outillage ; aucun benchmark fournisseur, compte, ressource ou dépense. Les versions et prix observés ne sont pas adoptés.

- **Réseau Cloud SQL** : [options de connexion](https://docs.cloud.google.com/sql/docs/postgres/connection-options), [HA](https://docs.cloud.google.com/sql/docs/postgres/high-availability), [WIF](https://docs.cloud.google.com/iam/docs/workload-identity-federation). D59 choisit PG17 Enterprise HA régionale Paris/PITR/TLS ; ne prouve pas VPN inter-cloud, bootstrap WIF, latence, pools, RTO ou coût total. Connector public n’est pas un VPN privé. Coûts Q2/Q5 intégrant PG Scaleway sont historiques et ne constituent pas le total Cloud SQL.
- **Inngest et infrastructure** : [licence serveur v1.45.1](https://raw.githubusercontent.com/inngest/inngest/v1.45.1/LICENSE.md), [self-hosting](https://www.inngest.com/docs/self-hosting), [annulation](https://www.inngest.com/docs/durable-execution/guides-and-advanced/cancellation). SSPL actuelle et future concession Apache, PG/Redis persistants, purge à qualifier et étape déjà lancée non annulée. [Redis Scaleway](https://www.scaleway.com/en/docs/managed-databases-for-redis/reference-content/ensuring-data-persistence/), [limites Kapsule multi-AZ](https://www.scaleway.com/en/docs/kubernetes/reference-content/multi-az-clusters/), [CSI coffre](https://www.scaleway.com/en/docs/secret-manager/api-cli/deploying-secret-manager-csi-provider-kubernetes/) : récupération/HA/identité sans clé statique non acquises. Protocoles A/B/J1/J2 restent proposés, pas preuve.
- **Scaleway IA** : [privacy](https://www.scaleway.com/en/docs/generative-apis/reference-content/data-privacy/) maintient contenu HTTP jusqu’à deux semaines en incident/abus, usage agrégé jusqu’à six mois, cache éphémère automatique par projet non désactivable et non-entraînement annoncé. [Catalogue](https://www.scaleway.com/en/docs/generative-apis/reference-content/supported-models/) contient Qwen3.6 texte/code/vision/structured output et Qwen3.8 ; aucun choix nouveau ni qualité DossierClé démontrée. Page tarif principale en erreur lors de la lecture : prix Q3/Q5 restent historiques, pas tarif gelé le jour.
- **Mistral** : [ZDR](https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr) exige pay-as-you-go et demande approuvée, preuve dans le compte ; opt-out entraînement distinct, stateless seulement. [Région](https://docs.mistral.ai/inference/regional-inference) : endpoint EU dans UE/EFTA, control plane éventuellement hors géographie, modèles/fonctions disponibles à vérifier via `models.list`. Majoration de 10 % sur tokens régionaux ; pages OCR non extrapolées. [Prix](https://docs.mistral.ai/inference/pricing) : Small4 0,15/0,60 USD par million entrée/sortie et OCR4.1 4 USD/1000 pages. Disponibilité, contrats et facturation du compte non prouvés.
- **Mail** : [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) maintient restricted scope verification/assessment pour données transmises ou stockées serveur. [Quotas](https://developers.google.com/workspace/gmail/api/reference/quota) : nouveaux projets 1,2 million unités/minute/projet et 6000/utilisateur ; anciens projets peuvent conserver anciens quotas. Seuil 80 millions/jour et futur tarif annoncé, aucun prix d’assessment/dépassement inventé. Ces limites techniques ne fixent pas quota commercial.
- **Versions et auth** : [Node officiel](https://nodejs.org/dist/index.json), [Better Auth npm](https://registry.npmjs.org/better-auth), [adaptateur](https://registry.npmjs.org/@better-auth%2fdrizzle-adapter), [tiers Nest](https://registry.npmjs.org/@thallesp%2fnestjs-better-auth), [TypeScript](https://registry.npmjs.org/typescript), [Nest](https://registry.npmjs.org/@nestjs%2fcore), [Drizzle](https://registry.npmjs.org/drizzle-orm) confirment les principaux candidats Q4 : Node 24.21.0, TS 6.0.3, Nest 12.1.2, Better Auth/adaptateur 1.7.7, tiers 2.8.0, Drizzle 0.45.3. Cela ne prouve pas résolution transitive/build/runtime ; latest différent non adopté. [37 avis Better Auth publics](https://api.github.com/repos/better-auth/better-auth/security-advisories?per_page=100), dont Organization sans correctif publié applicable, exigent exclusion et scan au gel. [Codes secours](https://better-auth.com/docs/plugins/2fa) exposent une primitive `viewBackupCodes` ; non-relecture/hash irréversible et consommation atomique doivent être démontrés, pas présumés. [Sessions](https://better-auth.com/docs/concepts/session-management) ne prouvent pas idle humain 30 min/absolu 15 j DossierClé.
- **B09** : [confirmation humaine #42](https://github.com/issa-diallo/dossiercle/issues/42#issuecomment-5966676710), [#50](https://github.com/issa-diallo/dossiercle/issues/50), [PR #51](https://github.com/issa-diallo/dossiercle/pull/51) fusionnée le 2026-10-03, commit `1654fb572c235f101cfc7a04473ac10c8e4f0507`. Revue PASS narrative dans PR, aucune GitHub review enregistrée. Suite 63 tests rejouée deux fois par orchestrateur sous Python 3.12.3 le 2026-10-10 ; store/transport en mémoire, pas PG/crash processus/HA/PRA. [Rappel de gate humain](https://github.com/issa-diallo/dossiercle/issues/33#issuecomment-5967415396) : aucun PASS B09/B11/Architecture automatique après POC.

Décisions acquises #33/#42/#50 transposées D60–D68 ; nouvelle rétention, quota, SLO, runtime, licence, réseau et bornes POC restent propositions. B09 QUALIFIED_LOCALLY_PENDING_HUMAN, B11 READY_FOR_HUMAN et gate humain PENDING_HUMAN, Architecture BLOCKED. Les obligations de QA finale et de données réelles sont maintenues.
