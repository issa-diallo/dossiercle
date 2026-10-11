# Revue indépendante ciblée D72

Date : 2026-10-11. Périmètre : décisions et statuts documentaires, lecture seule du worktree `arch-b02-b12-architecture`. Aucun runtime, test, téléchargement ou recherche supplémentaire.

## Verdict

**PASS_WITH_MINOR** : 0 Critical, 0 Major, 1 Minor de libellé historique. Aucun blocage sur la clôture des choix humains Keycloak, Mistral et Inngest.

## Constatations satisfaisantes

- La preuve `human-approval-d72-tools.md` reproduit la validation explicite des trois outils et l’instruction de ne pas démarrer le Design System. Sa portée ne transforme pas cette validation en autorisation cloud, données réelles, dépenses ou reprise de POC.
- D72 remplace explicitement Better Auth par Keycloak et Scaleway Generative APIs par Mistral. Inngest est conservé. D71 est conservé ; son remplacement porte seulement sur les choix concernés.
- Les ADR018/019/021 sont ACCEPTED pour les choix d’outils uniquement. Les versions exactes, modèle Mistral et propositions détaillées ne deviennent pas adoptés par implication.
- D54 n’est pas supersédé : chiffrement du secret TOTP et clé hors DB, secours irréversibles, invitation seule, droits serveur, session opaque et révocation restent exigés. La protection TOTP et les comportements runtime restent à concevoir et prouver.
- La qualification SSPL de l’usage/version reste une condition de mise en service, sans avis juridique définitif. ZDR effectif, entraînement désactivé et région restent à établir avant données réelles. Aucun test, conformité, contrat ni licence n’est déclaré PASS par validation humaine.
- Architecture demeure BLOCKED. Le sommet Architecture et STATUS interdisent le démarrage du Design System ; les phases et preuves de livraison ne sont pas implicitement closes. STOP POC demeure applicable.

## Finding DR01 — Minor

Dans les notes de sommet PRD et STORIES, la bannière D71 présente encore « Stack validée » et un lien intitulé « Décision courante » vers D71, alors que la bannière D72 supérieure est l’autorité actuelle. La hiérarchie est compréhensible, mais ce libellé local donne deux autorités courantes.

Correction attendue : qualifier la bannière D71 d’historique, actualisée par D72 sur auth/IA, et remplacer « Décision courante » par « Décision historique ». Conserver les choix non remplacés et le contenu historique ; aucune nouvelle validation humaine requise.

## Limites

Cette revue porte sur D72 et sa frontière documentaire. Elle ne donne pas Architecture PASS, ne clôt pas les arbitrages restants et ne fournit aucune preuve opérationnelle ou juridique. Aucun fichier canonique modifié par le reviewer.

## Addendum de clôture

Relecture ciblée le 2026-10-11 : les bannières PRD et STORIES indiquent maintenant « Stack historique — D71 » et « Décision historique ». L’autorité D72 est distincte et explicite. **DR01 CLOSED. Verdict final : PASS documentaire ciblé D72 ; 0 Critical, 0 Major, 0 Minor ouverts.** Le verdict initial demeure historique. La clôture concerne les trois choix d’outils ; toutes les limites et conditions ci-dessus restent applicables, notamment Architecture BLOCKED et Design System non démarré.
