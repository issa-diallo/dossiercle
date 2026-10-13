# T04 — fermeture durable après changement natif

Date : 2026-10-13. Correction minimale du coordinateur existant, conformément
au Plan T04 et au contrat OTP de restauration. Préparation PASS conservée.

## Finding indépendant

Un simple refus `IDENTITY_NOT_READY`, suivi de ROLLBACK, laissait J1 et l’epoch
inchangés. Restaurer les anciennes réponses natives pouvait réouvrir l’ancien
cookie. Reviewer indépendant : `/root/s01_environment_review`, lecture seule.

## Correction

- Accès BFF sous verrou exclusif d’autorité, après verrou invitation.
- Changement d’identité/facteurs positivement observé : J1 `DENIED`, epoch+1,
  fsync avant SQL ; confirmed NULL, enrollment DENIED, sessions toutes révoquées,
  audit service ; COMMIT avant retour du refus. Aucune reconfirmation automatique.
- 404 natif sur GET du sujet attendu, attributs d’identité manquants/invalides et
  facteur TOTP Keycloak inattendu sont distingués d’une panne de transport.
- SID positivement absent : tombstone SID et révocation de session sous J1 ;
  aucune fermeture globale du compte pour une expiration normale de session.
- TLS/PI indisponibles restent temporaires ; aucun changement automatique d’epoch.

## Preuves exécutées

`pnpm build:api` puis Vitest integration des fichiers auth et authority-journal :
24/24 PASS au premier checkpoint (15 auth +9 journal). Cela couvre commit de
DENIED, toutes les sessions, restauration des anciennes réponses natives,
concurrence de deux GET, panne temporaire sans changement de J1.

`pnpm test:auth -g 'native-change'` : 1/1 PASS au second checkpoint, avant ajout
de la rotation. Firefox avec TLS validé : authentification native par secours,
refresh humain, pannes PI/KC, ENCKEY absente sans régénération, J1 absent et
redémarrage sans régénération, clé BFF absente, WAF arrêté ; récupération des
services sans changement de J1. Désactivation native puis réactivation du sujet :
ancien cookie fermé et J1 DENIED epoch2.

Rejeu ciblé final auth +authority-journal : **26/26 PASS** (17 auth +9 journal),
avec crash après fsync/avant SQL et SID absent. Readback/configuration native :
**7/7 PASS**, dont 404 du sujet attendu. Rejeu global integration : **58/58 PASS**.

Firefox natif final : **12/12 PASS**, dont désactivation/réactivation, reset et
restauration du mot de passe et toutes les pannes contrôlées. Après restart
Keycloak, un SID absent est révoqué durablement ; jamais de DENY global pour
expiration normale. Toute reprise de ce scénario impose une nouvelle connexion
password+secours natifs/Code/acr2, nouveau BFF puis logout. Le rejeu final
faults1/1 PASS (2.8 min) a observé503 puis une nouvelle MFA native forte/logout.
Le delta d’assertion exact cookie/SID est relu indépendamment ; sa branche401
n’a pas été empruntée dans ce dernier rejeu. Aucun résultat natif401 inventé.

Aucun secret, trace DOM ou export de facteur dans ce rapport.
