# Revue corrective ciblée T04 — 2026-10-12

Reviewer indépendant : `/root/s01_environment_review`, lecture seule, aucun test exécuté.

## Portée et verdict

**PASS ciblé.** Aucun Critical, Major ou Minor ouvert sur les corrections
logout et fermeture du POST Keycloak `login-actions/required-action` examinées.
Ce verdict ne constitue pas Review global S01 ni qualification MFA/V3.

## Findings suivis

- Major logout sur invitation ISSUED : corrigé par l’appel à la transaction qui
  accepte une invitation confirmée ISSUED, tout en gardant Origin/CSRF, le contrôle
  d’autorité et la révocation dans la transaction. Le test unitaire couvre mauvais
  CSRF sans UPDATE (rollback), CSRF valide, UPDATE, COMMIT et GET suivant refusé.
  Limite : Pool/autorité mockés ; aucune preuve de durabilité PostgreSQL dans ce test.
- Major POST required-action Keycloak hors grant/J1 : corrigé en fail-closed à
  l’ingress NGINX. La règle combine méthode POST et `$uri` décodée/normalisée,
  bloque l’endpoint required-action ainsi que les chemins `login-actions` ambigus
  contenant `;`, tout en laissant les endpoints MFA ordinaires disponibles.
  Le navigateur exige 403 sur les chemins littéral, encodé, slash répété,
  dotsegment et paramètres de chemin, corps vide. `nginx -t` passe.
- Cookie grant `SameSite=Strict` : corrigé en `Lax` et vérifié par navigateur après
  redémarrage explicite du processus coordinateur ; liaison issuer/callback démarre
  avec les origines fixes prévues.
- Minor logout/projection mock PENDING : corrigé dans le fixture vers
  CONFIRMED/VERIFIED/recoveryReady ; la limite de durabilité mockée est explicitée.
- La preuve de refus TOTP est historique : le parcours password/secours antérieur
  utilisait l’accès direct Keycloak et ne prouvait pas le contrat grant/J1. Le POST
  est maintenant fermé ; le parcours sûr doit attendre le pont dédié.

## Limites restantes de T04

Pont Keycloak grant-aware/J1 absent ; POST password/secours fermé. Le challenge
TOTP synthétique frais est resté refusé dans l’essai historique, cause indéterminée.
Callback OIDC, session forte, V3 complet et activation ne sont pas démontrés.
T04 reste BLOCKED ; Execute global, Verify global et Review globale ne passent pas.
