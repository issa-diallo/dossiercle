# T04 — preuve de blocage MFA natif

Date : 2026-10-12. Worktree synthétique `feat/s01-espace-isole`.

## Reproduction

Cette reproduction décrit l’essai historique exécuté avant la fermeture du POST
Keycloak `required-action` (voir « Réconciliation de sécurité » ci-dessous). La
commande est désormais arrêtée plus tôt par la barrière fail-closed et ne reproduit
plus à elle seule le refus OTP ; aucun parcours grant-aware de remplacement n’est
encore disponible.

Commande réellement exécutée :

```sh
PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/playwright-browsers" pnpm exec playwright test tests/auth/s01-auth.spec.ts -g 'native candidate: TLS browser reaches maintained enrollment UI without persisted native JWT'
```

Préconditions confirmées dans le même parcours navigateur : invitation synthétique
admise ; authentification PI native et premier TOTP d’enrôlement acceptés ; preuve
`EnrollmentAdapter.proof` positive ; actions Keycloak de mot de passe et de
récupération achevées ; aucun JWT PI retrouvé dans `localStorage` ou
`sessionStorage` sur l’origine PI. L’utilisateur candidat et les valeurs d’accès
sont générés à chaque exécution ; aucun code, lien d’action, cookie ou token n’est
imprimé.

Le parcours ouvre ensuite OIDC, valide le mot de passe puis sélectionne le facteur
privacyIDEA natif. Un code TOTP est généré par l’outil synthétique épinglé, au moins
deux périodes de 30 secondes après le code accepté à l’enrôlement. Le formulaire
Keycloak affiche le refus générique `wrong otp value`. Aucune requête de callback
OIDC ni de session BFF n’est reçue. L’exécution Playwright échoue à l’étape
`native-callback` ; aucun PASS MFA/session n’est attribué.

Les tentatives ont également confirmé que le même code pendant sa période
d’enrôlement est rejeté comme rejeu. Les valeurs TOTP n’ont été ni lues depuis les
codes de récupération, ni enregistrées, ni imprimées. Les contextes Playwright de
test en échec produits automatiquement ont été supprimés après vérification ; le
test nettoie désormais la page vers `about:blank` avant de remonter son erreur.

## Verdict

**T04 BLOCKED avant callback OIDC.** L’explication exacte du rejet d’un TOTP frais
reste inconnue. Ce fait empêche de qualifier le contrat validé
Keycloak 26.8 + privacyIDEA 3.14/provider 1.8.0 (ADR-029 / `ARCHITECTURE_OTP.md`).
Il n’autorise aucun fallback, abaissement LOA, contournement MFA ou modification
silencieuse de l’architecture. Le seul avancement sûr est de diagnostiquer la
liaison provider/resolver/horloge dans ce laboratoire synthétique et de corriger
le minimum compatible avec le contrat, puis de rejouer V3.

Verify global et Review globale restent non commencés ; T05–T10 bloqués par leurs
dépendances T04. Aucun espace actif n’a été créé.

## Réconciliation de sécurité — 2026-10-12

La séquence ci-dessus a exercé les pages Keycloak password/secours via le POST
natif direct `login-actions/required-action`. La revue indépendante a établi que
ce chemin ne contrôlait pas le grant d’enrôlement, le J1 courant et le verrou
d’autorité au moment de la mutation. Ces étapes prouvent seulement le comportement
technique observé dans la fixture synthétique ; elles ne qualifient pas l’invariant
d’autorisation S01 et ne valent pas preuve de conformité.

Correction fail-closed : le reverse proxy refuse maintenant ce POST en 403 sans
journaliser son corps. Le Firefox TLS réel a vérifié ce refus. Aucun chemin de
remplacement grant-aware n’est implémenté ; les changements de credentials ne
peuvent donc pas être qualifiés et T04 demeure bloquée. L’essai TOTP frais antérieur
reste un constat du provider, mais ne prouve pas une incompatibilité d’architecture
puisque sa cause est indéterminée.

La reprise corrige aussi logout pour les invitations ISSUED confirmées, avec
Origin/CSRF et révocation transactionnelle avant réponse. Test unitaire ciblé :
PASS sur cette frontière simulée. Build/typecheck/lint et 34 tests unitaires :
PASS ; Firefox TLS ciblé routes + binding issuer/callback : 2/2 PASS après
redémarrage du coordinateur pour charger le cookie `SameSite=Lax`. Ces résultats
ne constituent ni Verify global ni qualification MFA/session native. Revue
corrective indépendante PASS, sans finding ouvert sur les correctifs ciblés
([preuve](t04-corrective-review.md)).
