# Revue indépendante — B07 Research

Date : 2026-10-11. Reviewer : auth_tooling_temporal, distinct du writer integrations_privacy. Lecture seule ; aucune installation, exécution runtime ou modification du worktree.

## Verdict

**PASS de la revue documentaire du candidat BLOCKED. Research B07 reste BLOCKED ; Design, Plan et Execute ne sont pas ouverts.** Aucun Critical, Major ou Minor nécessitant une correction du candidat.

Candidat : `/tmp/dossiercle-b07-research-candidate.json`, empreinte déclarée `40e3419ac79cf98e9c56ef86646ea439b773fd7357a6a919bb7862aa8460c2f3`. Les 19 fichiers ont été relus ; leurs tailles et SHA-256 correspondent tous au manifeste gelé.

## Constats indépendants

- La conclusion native est exacte et bornée : Better Auth 1.7.7 ne fournit pas, dans le mécanisme de codes secours examiné, un contrat hash/comparateur compatible avec Q4. Cela ne prouve pas une impossibilité générale de toute extension Better Auth.
- Le commit immutable `db02f233918ad1233bf0753e437e1c0da353273d` et les sources archivées correspondent à ma lecture indépendante : backup-codes/index.ts, 16045 octets, SHA-256 `602c34b8efc5fa0bac9c599716aae7c2ebc93930f388967e5b1d7bac8ad01aa8` ; two-factor/index.ts, 17838 octets, SHA-256 `c65179cfb4efdb8eeb47e7e8f87881b6ac14787b466b3121250050610bb2d36b`.
- Plain/encrypted/custom encrypt-decrypt récupèrent une liste ; la vérification native compare le code brut par includes. Le faux encrypt/decrypt de hashes ne résout pas ce contrat. Le candidat n'adopte aucun contournement.
- viewBackupCodes est serveur uniquement : il ne faut pas en déduire une route HTTP exposée. Son existence confirme la capacité de relecture interne des valeurs réversibles ; le dossier distingue correctement ces faits.
- La consommation native comporte une comparaison de l'ancien champ lors de incrementOne : CAS supporté dans la source, sans preuve runtime de l'adaptateur Drizzle/PostgreSQL ou de deux API concurrentes. Le dossier ne transforme pas la source en preuve d'atomicité exécutée.
- Les propositions sont explicitement des annexes conditionnelles. Elles couvrent deux API, horloge contrôlée, sauvegarde sans clé TOTP, codes non réversibles, fresh session + TOTP, récupération, multi-onglets, origines, limites, migrations et rollback. Aucune qualification auth ni gate ultérieur n'est annoncé PASS.
- Les arrêts immédiats, les plafonds 2 h par phase / 6 h total, 2 Go / 0 euro, 4 CPU / 8 GiB / 15 GiB, les données synthétiques et le runtime sans Internet sont conservés. Images/topologie et distributions encore ouvertes restent des blockers explicites.
- Le ledger additionne 507345 octets de corps ; avec 4096 octets d'erreur et 65536 de réserve protocole, la charge est exactement 576977 octets. Cette réserve n'est pas présentée comme une mesure exacte du transport. Aucun téléchargement runtime n'est déclaré.

## B12 et suite

B12 peut préparer puis qualifier son propre gate Q4 complet sans exiger le PASS des fonctionnalités MFA B07. Son contrat figé doit couvrir core auth, tiers Nest/Drizzle, schéma et absence des plugins interdits ; son PASS reste étroit. Les passages B12 du dossier B07 sont acceptables sous cette lecture : un changement ultérieur de version, schéma ou frontière auth impose de refaire les preuves B12 affectées. Ni fermeture B07 ni réduction de Q4 n'en découlent.

R-B07-01 doit être résolu par un mécanisme supporté exact et une proposition d'ADR si l'adaptation est structurante, puis revu avant Research PASS. Les options proposées demeurent conditionnelles. Ne pas rouvrir silencieusement l'exigence produit de codes non réversibles. Les manifests et prérequis d'isolation doivent également être complétés avant DoR.

Référence indépendante : `/tmp/dossiercle-b07-native-review.md`. Ce verdict porte sur la fidélité et la préparation documentaire, pas sur le fonctionnement de l'authentification.
