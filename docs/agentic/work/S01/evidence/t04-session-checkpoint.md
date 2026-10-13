# T04 — checkpoint de qualification locale (2026-10-12)

État : EN COURS. Aucun PASS V3, commit, PR ou merge à ce checkpoint.

## Exécutions réelles

- `pnpm build` : PASS (types, lint, API, frontend).
- `pnpm test:unit` : 34/34 PASS.
- `pnpm test:integration` : 47/47 PASS (12 schéma + 35 autres).
- Migration additive `0003_s01_session_scope.sql` réellement appliquée à la
  centrale synthétique ; checksum `9f0dc36dc01ac75df76e23250452f299c4a649f03e6bd6e38c976325c6cb955a`.
- `apps/api/test/auth.integration.spec.ts` : 9/9 PASS, PostgreSQL/J1 réels,
  frontières natives explicitement simulées. Ces tests ne prouvent pas la MFA.

## Corrections en revue indépendante

- Logout BFF sous verrou/J1, aucun refresh de session pendant logout ou polling.
- Refresh humain explicitement qualifié, grant natif maintenu, tokens chiffrés,
  contrôle issuer/sub/sid/acr2, absolu15j inchangé ; échec laisse J1 divergent fermé.
- Backchannel signé : révocation sans dépendre de facteurs encore actifs.
  Receipt durable SID sous verrou dédié, avant résolution de son binding ;
  émission et lecture BFF refusent une SID révoquée même après panne du receiver.
- Scope lu et verrouillé par fonction SECURITY DEFINER bornée, search_path fixe,
  tables qualifiées et droits PUBLIC fermés ; aucun UPDATE agence accordé au
  coordinateur d’identité.

## Qualification native ouverte

Le navigateur réel a consommé l’OTP, sans obtenir de callback valide.
Readback : les PUT de configuration omettant priority réinitialisaient les
priorités à zéro ; le sous-flux MFA précédait le password. Correction : préserver
les priorités et appliquer explicitement l’ordre password puis MFA, condition
LOA2 puis sélecteur ; readback obligatoire. Essai Firefox rejoué en cours.
Les essais précédents restent des échecs, jamais des preuves PASS.

Restent : parcours complet password/TOTP/secours/owner, refresh/backchannel
natifs, matrice V3 complète et pannes ; revue finale indépendante, CI et Lead Tech.
T05 n’a pas démarré. Préparation Research/Design/Plan préservée.
