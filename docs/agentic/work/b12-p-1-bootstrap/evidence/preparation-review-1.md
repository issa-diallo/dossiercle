# Revue indépendante — préparation B12-P-1

Date : 2026-10-11. Reviewer : auth_tooling_temporal, distinct du writer infra_architecture. Lecture seule du worktree b12-p-1-bootstrap ; aucune installation, fixture, ressource runtime ou modification du dépôt.

## Verdict

**PASS de préparation Research / Design / Plan, avec deux précisions mineures à intégrer avant Execute. DoR Execute reste BLOCKED par le manifeste et les décisions de distribution encore attendues.** Aucun Critical ni Major. Ce verdict ne qualifie ni B12, ni B07, ni Architecture.

Candidat : `/tmp/dossiercle-b12-preparation-manifest.json`, empreinte déclarée `56f56e7dfe6cee318039548db21bd32c2e0eb148a957ec6cdab108052e1c36df`. Les 22 SHA-256 de fichiers correspondent au manifeste gelé. Research, Design, Plan, manifeste, goal, handoff et preuves de source/HEAD ont été examinés contre Q4 et D69.

## Findings

### BR01 — Minor : solde réseau calculé sur les corps, sans réserve

`distribution-manifest.md:7` appelle « conservative » la somme de 1734068 + 568200 octets. Elle est bien 2302268, mais ne comprend pas les en-têtes, HEAD, TLS/IP, erreurs ou retries ; le document le reconnaît lui-même. Le solde 1997697732 est donc une borne supérieure théorique issue des corps, pas une allocation intégralement disponible.

Correction : nommer explicitement le compteur de corps et le solde théorique ; réserver un montant borné pour transport/erreurs ou instrumenter leur charge avant acquisition, puis publier le solde opérationnel inférieur. Reporter la même précision dans Research/Plan/Goal/Handoff. Aucun reset ; arrêt avant dépassement du plafond cumulatif. L'absence d'une mesure exacte historique ne doit pas être transformée en mesure inventée.

### BR02 — Minor : cible k6 et loopback entre containers

`design.md:24`, `plan.md:16` et `distribution-manifest.md:54` parlent de k6 loopback, tandis que le runner et l'API sont des containers distincts. Leur 127.0.0.1 n'est pas commun par défaut.

Correction : figer une cible locale précise cohérente avec la topologie : soit k6 dans le namespace réseau de l'API pour réellement utiliser loopback, soit uniquement le service API B12 par DNS/adresse du réseau Docker internal. Cette seconde option conserve le smoke synthétique Q4, dont le texte n'impose pas loopback entre containers. Aucun host-gateway, runtime hôte ou Internet ajouté pour rendre le test accessible ; quotas agrégés inchangés.

## Contrats validés

- Les 11 étapes Q4 restent obligatoires : lock/engines/peers, compilations, intégration core auth/tiers/Drizzle/pg et absence des plugins interdits, trois DB/migrations/isolation, Inngest fermé, OTel/canaris, OpenAPI/diff/client, tests incluant Playwright et k6, deux builds/SBOM/scans/licences/source maps, promotion/rollback factices, nettoyage et revue.
- B12 peut avancer et satisfaire son propre gate sans full MFA B07. Son claim couvre uniquement core auth/type/runtime/schéma/absence plugins. Le défaut natif des codes secours ne démontre pas un défaut de bootstrap. Contrat partagé à figer dans les artefacts ; remédiation B07 changeant version/schéma/frontière impose de requalifier les preuves B12 affectées. Aucun PASS B07 induit, aucun remplacement auth adopté.
- L'absence actuelle de lock, de builds, de migrations exécutées, de résolution transitive et de preuve de bibliothèques Chromium est attendue pour un POC : ce sont des critères Execute/Verify à démontrer. Elle ne crée pas une obligation de terminer le POC avant sa préparation. Un conflit réel constaté déclenchera l'arrêt prévu.
- Isolation Docker internal/none, absence de runtime hôte supposé hermétique, aucun socket Docker et ports hôte loopback sont compatibles avec le mandat. Avant les tests, prouver le refus d'egress ; ne pas ajouter host networking, privileged ou host-gateway. L'accès aux services hôte et la configuration DNS/proxy doivent aussi rester hors allowlist des fixtures. Le runner, ses enfants Chromium et les outils successifs sont inclus dans les cgroups.
- Le partage PG1CPU/2GiB, API1CPU/2GiB, runner1,5CPU/3,5GiB, Collector0,5CPU/0,5GiB donne exactement 4CPU/8GiB. Les scans/builds remplacent le runner et ne s'ajoutent pas à cet agrégat. Disque15GiB, 2h par phase/8h total, 2Go cumulés et zéro euro demeurent inchangés. Faisabilité intégrale dans ces limites non prouvée, arrêt au plafond.
- Versions Q4 exactes, Node24.21.0 isolé, pnpm12.8.1 et freeze/engine-strict sont maintenus. Node22 de l'hôte n'est pas substitué. Ignore-scripts par défaut ; transitifs/scripts à figer et examiner avant installation ; pas de npx/latest/lifecycle global implicite.
- Les six archives officielles possèdent taille et digest primaire : total239108406 octets. Leur provenance publiée ne remplace pas la vérification des GET futurs. Le checksum Node correspond aux SHASUMS archivées et HEAD annonce31890184 octets.
- Le ledger additionne1725884 octets de réponses principales et8184 complémentaires, soit1734068. Avec le préflight568200, le cumul de corps est2302268. Le sous-total715943442 des six archives + Node + Chromium + headless + FFmpeg + DB est exact ; il n'inclut pas npm/transitifs/autres preuves et ne garantit pas de tenir sous2Go.
- Le manifeste Trivy immutable SHA-2565393bc6f744928502de96983ed97b46f06f84e718a33169dce616fe304c8024a décrit le blob420fae4c53cae2a53073aca5d7db527a192d5df38c8cf487000984033524b987,126923263 octets. Freshness réelle après extraction et compatibilité schéma restent à vérifier. Le token anonyme n'est pas archivé dans les preuves lues.
- L'origine des caches Chromium1243 n'est pas prétendue acquise sur la base de marqueurs ; ils restent intacts. Les ZIP Google/Microsoft ont une source Playwright officielle, tailles HEAD et URLs précises, mais pas de digest primaire publié. Le propriétaire/reviewer doit accepter explicitement cette politique de provenance avant téléchargement ou demander une autre preuve, sans inventer de checksum éditeur.
- Les arrêts Q4 ne sont pas contournables par poursuite d'un point indépendant. La continuation proposée est limitée aux échecs fonctionnels sans critère d'arrêt. Promotion QA/production, HA/PRA, cloud et pleine charge V restent hors claim local.

## Conditions restantes avant Execute

Intégrer BR01/BR02 ; figer le contrat auth de bootstrap et la conception d'acquisition/isolement ; faire décider les URLs navigateur/DB encore hors autorisation et leur politique de provenance ; enregistrer le manifeste accepté ; refaire les préflights hôte/ports/quotas immédiatement avant acquisition. Les preuves runtime et la compatibilité base/Chromium seront produites pendant le POC avec arrêts, pas revendiquées dès maintenant.

Aucun téléchargement runtime, installation ou test effectué par ce reviewer. Les anciens Q4 et autres gates demeurent historiques ou BLOCKED conformément au corpus courant.
