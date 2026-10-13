# Revue indépendante Design — S01

## Révision 1 — CHANGES_REQUIRED

2026-10-11, reviewer distinct `/root/s01_reviewer`, lecture seule ; modèle hérité,
effort exact non observable. Aucun runtime/test applicatif, fichier modifié,
publication ou PR. Research PASS, Design, Architecture/FINALIZATION/OTP,
S01/R01–R05 et Design System examinés.

Critical 0 ; Major 1 : **S01-D-01 — refus J1 non explicitement opposable en
fonctionnement courant après échec de projection centrale**. Ancienne ligne
CONFIRMED pouvait sembler suffisante à l'étape6. Source : FINALIZATION B03,
refus valable même si seconde écriture échoue. Minor 0.

Correction attendue : head/sequence/empreinte J1 courants avant accès/octroi,
refus si PENDING/deny/divergence/indisponibilité, sérialisation activation/refus,
tests panne J1→PG et concurrence. Les autres contrôles (quatre AC, transaction
centrale, saga/outbox, grant/claim, séparation rôles/bases, OTP, B05/B06, UX)
étaient conformes.

## Correction auteur et revue 2

Design corrigé : `identity.account_authority` conserve watermark J1 ; barrière
courante sans cache, verrou d'autorité gardé jusqu'à lecture/commit, refus durable
même après rollback central ; activation explicitement conditionnée à la
convergence. Scénarios de panne/concurrence ajoutés.

## Révision 2 — PASS

Retour indépendant reçu après correction : **PASS — Design S01, revue 2**.
S01-D-01 corrigé : head J1 courant comparé au watermark, PENDING/deny/divergence/
indisponibilité opposables malgré CONFIRMED/ACTIVE central ancien. Verrou tenu
jusqu'à lecture/commit, révocation/activation sérialisées, perte du verrou fermée,
tests J1→PG et concurrence prescrits. Cohérent FINALIZATION B03/D75, Research et
quatre AC ; aucune transaction distribuée ou dépendance B05/B06 ajoutée.
Findings ouverts : Critical 0, Major 0, Minor 0. Plan peut commencer.
Revue documentaire uniquement ; aucun test applicatif exécuté.


## Revalidation 3 — corrections découvertes en revue Plan

S01-P-01 : fermeture dès CREATE avec ALLOW_CONNECTIONS false, ACL depuis DB
maintenance avant ouverture migration, test pause/crash A→B. S01-P-02 : LOA2/acr2
et provenance issuer/client synchronisés sans remplacer preuve native+J1.
**PASS — Design revue 3**, reçu après inspection des contenus corrigés.
S01-P-01/P-02 fermés ; ACL avant ouverture et test pause/reprise A→B,
LOA2 synchronisé et preuve native+epoch J1 conservées. Critical/Major/Minor ouverts0.
Avis 2 conservé historique. Aucun runtime exécuté ; Plan revue2 PASS distinct.
