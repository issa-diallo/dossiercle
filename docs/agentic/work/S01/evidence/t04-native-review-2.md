# Revue indépendante ciblée T04 — UI native TOTP

Date : 2026-10-11. Reviewer indépendant : `/root/s01_environment_review`.
Mode : lecture seule ; aucun test exécuté par le reviewer.

## Portée

Correction native `default_tokentype=totp` (scope webui), vérification de sa
lecture effective par privacyIDEA, attente du type sélectionné dans Firefox avant
soumission, preuve positive par `EnrollmentAdapter.proof`, diagnostics et résultats
répétés. Ce contrôle ne couvre pas les tâches T04 restantes ni le parcours MFA
complet.

## Verdict

**PASS_WITH_MINOR — aucun Critical/Major ouvert dans cette portée.**

La policy native est compatible avec le contrat ; le setup contrôle exactement le
readback. Le test attend l’option TOTP avant POST et le proxy continue de refuser
les autres types. La preuve positive PI et les diagnostics limités aux métadonnées
sûres sont cohérents avec les contraintes. Le reviewer demande de présenter la
course HOTP comme cause plausible issue de l’inspection des sources, non comme
cause démontrée de chacun des échecs antérieurs. Les résultats avant correction
restent historiques ; le rejeu après correction est 5/5 PASS.

## Limites

Mot de passe, codes de secours, Code OIDC, session forte, owner bootstrap, V3,
Verify et Review globaux ne sont pas validés. Le verdict PASS_WITH_MINOR s’applique
uniquement aux fichiers et contrôles énumérés ci-dessus.
