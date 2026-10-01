# Recherche documentaire — Architecture DossierClé

Date des lectures : **2026-09-30**. Sources primaires lues par l'orchestrateur et transmises au rédacteur ; registre de recherche intégral lu par celui-ci. Pas de provisionnement, installation, benchmark DossierClé, données réelles, conseil juridique ou validation contractuelle. Les pages vivantes et métadonnées doivent être revalidées lors du gel de versions. Ce dossier complète [Architecture](ARCHITECTURE.md) ; il ne ferme aucun gate sans la preuve correspondante.

Actualisation des objectifs le 2026-10-01, issue #30 : [D58](ARCHITECTURE_DECISIONS.md#d58), sans nouvelle lecture fournisseur ni qualification runtime.

## F01 — PostgreSQL, sauvegardes et PITR

- [Serverless SQL — backups](https://www.scaleway.com/en/docs/serverless-sql-databases/how-to/manage-backups/) : sauvegardes **quotidiennes**, conservées **7 jours**, export `.pg_dump`, durée/coût restauration dépendant du volume. Ne démontre ni RPO < 4 heures, ni rétention 30 jours, ni PITR.
- [Stratégies backups managés](https://www.scaleway.com/en/docs/tutorials/backup-strategies/) : sauvegardes PostgreSQL/MySQL quotidiennes, 7 jours par défaut ; fréquence/rétention configurables selon instance, restauration autre AZ dans même région, pas multirégion native. **Ne prouve pas davantage PITR.** Ne pas reprendre des blogs affirmant PITR sans source primaire de l'offre exacte.
- [API Managed PostgreSQL/MySQL](https://www.scaleway.com/en/developers/api/managed-databases-for-postgresql-and-mysql) : opérations bases/utilisateurs/permissions/backups ; possibilité conceptuelle de plusieurs bases sur instance, pas qualification flotte ni coût nul.

Conséquence B01/B03 : choix de l'offre, granularité base/instance, coûts, connexions, WAL/journal et restauration cohérente ouverts. Allonger un export quotidien à 30 jours ne satisfait pas RPO < 4 heures. Préserver zéro perte en fonctionnement normal/retries ; la tolérance catastrophe D58 est explicite, pas silencieuse. Prouver RPO < 4 heures depuis le dernier état cohérent réellement récupérable avant l'incident (bases/fichiers/jobs), et RTO < 4 heures de l'incident au service effectivement utilisable. Une sauvegarde toutes les 4 heures ne suffit pas : marge pour durée, retard et échec, récupération et cohérence à mesurer. B03 reste ouvert pour ces preuves, pas pour réarbitrer cette tolérance.

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

## Preuves restantes

B01–B12 du document principal restent ouverts : PG/PITR/flotte, runtime/licence Inngest et barrière, PRA cohérent, réseau/coffre, connecteurs/tags, IA/privacy/coûts/BYOK, auth, quotas/rétention, fermetures/rapports, disponibilité/opérations, addendum produit et outillage. Aucun chiffre de prix, quota commercial ou SLA n'est fabriqué à partir de ces pages.
