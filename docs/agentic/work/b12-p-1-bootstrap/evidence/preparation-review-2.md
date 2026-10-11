# Revue corrective indépendante — B12 préparation, candidat 2

Date : 2026-10-11. Reviewer auth_tooling_temporal, distinct du writer infra_architecture. Lecture seule ; aucun runtime ou package téléchargé/installé/exécuté par le reviewer.

## Verdict

**PASS Research / Design / Plan et correction BR01/BR02.** Aucun Critical, Major ou Minor restant nécessitant une modification. **DoR Execute reste BLOCKED uniquement par la décision utilisateur sur les distributions encore hors allowlist et la politique de provenance présentée.** Le préflight et les contrôles techniques prévus s'appliquent ensuite ; aucun PASS runtime, B12, B07 ou Architecture induit.

Gel : `/tmp/dossiercle-b12-preparation-manifest2.json`, empreinte déclarée `809755c4f58ec5b053d668ce9ef550eb2daff1280dc725a4fff9f435b773a4c9`. Les 22 fichiers correspondent aux SHA-256 du manifeste. Seuls les six textes Research/Design/Plan/Manifest/Goal/Handoff diffèrent du candidat 1 ; les sources et preuves restent identiques.

## Corrections confirmées

- BR01 : 2302268 octets sont explicitement les corps HTTP historiques, sans mesure TLS/IP rétroactive. La réserve de100000000 octets est prise dans les2Go existants, pas ajoutée au budget. Le solde opérationnel initial est exactement1897697732, inférieur au solde théorique1997697732. Les paragraphes opérationnels de chaque artefact prévalent sur la simple présentation historique du solde.
- Le décompte futur utilise maximum(delta RX physique agrégé, nouveaux corps/chunks reçus), une seule fois ajouté au cumul historique + réserve. Baseline persistante, trafic tiers imputé conservativement sans inspection, exclusion lo/docker/veth pour éviter duplication et arrêt sur changement de route/interface ou compteurs absents/reset sont spécifiés. Cette mesure n'est pas prétendue exhaustive sur le fil ; la réserve et les transferts interruptibles demeurent. Mesures et arrêt seront vérifiés dans Execute, aucune mesure effective revendiquée maintenant.
- BR02 : k6 utilise uniquement http://b12-api:3000 sur le réseau Docker internal, runner et API séparés ; aucune confusion avec localhost du runner. Pas de host-gateway, host networking, privileged ou Internet. Le smoke synthétique Q4 et les quotas agrégés sont conservés.
- Le contrat B12 reste core auth/type/runtime/schéma/absence plugins ; full MFA B07 ne devient pas un préalable au propre gate Q4 B12. Toute modification de version/schéma/frontière due à B07 impose requalification des preuves B12 affectées.
- Les critères Q4, arrêts immédiats, durées et plafonds restent inchangés. La compatibilité transitive, les bibliothèques Chromium, le lock frozen, les migrations et les builds restent à prouver pendant le POC : aucune qualification runtime anticipée.

## Demande utilisateur à présenter

Présenter les objets suivants comme complément concret au manifeste D69, sans nouvelle demande de budget ni de mandat général :

1. Chrome153.0.8010.12 linux64 : URLs initiales cdn.playwright.dev/builds/cft/153.0.8010.12/linux64/chrome-linux64.zip et chrome-headless-shell-linux64.zip ; finales storage.googleapis.com/chrome-for-testing-public/153.0.8010.12/linux64/ pour ces deux ZIP,195836009 et119809080 octets.
2. FFmpeg1011 linux : initiale cdn.playwright.dev/dbazure/download/playwright/builds/ffmpeg/1011/ffmpeg-linux.zip ; finale playwright.download.prss.microsoft.com/dbazure/download/playwright/builds/ffmpeg/1011/ffmpeg-linux.zip,2376500 octets.
3. DB Trivy : ghcr.io/aquasecurity/trivy-db@sha256:5393bc6f744928502de96983ed97b46f06f84e718a33169dce616fe304c8024a, blob db.tar.gz sha256:420fae4c53cae2a53073aca5d7db527a192d5df38c8cf487000984033524b987,126923263 octets, URLs du manifeste/token anonymous pull scoped et blob du dépôt exact. Aucune wildcard GHCR/mirror/JavaDB/checks bundle implicite.

Pour les ZIP navigateur, indiquer clairement : provenance Playwright officielle et HTTPS/URL/taille, digest du GET à consigner mais pas de checksum primaire publié établi dans les preuves. La décision utilisateur porte aussi sur l'acceptation de cette politique de provenance. Toute redirection vers une nouvelle cible arrête avant corps. Les objets Node/npm/GitHub exacts déjà couverts ne nécessitent pas de nouvelle approbation par archive.

Les objets nouveaux seront acquis seulement après cette décision, dans le budget inchangé de2Go dont100Mo réservés et runtime hermétique. Aucun compte fournisseur, appel IA/mail, cloud ou donnée réelle n'est autorisé par cette demande.
