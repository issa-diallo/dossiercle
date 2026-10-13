# Verify — livraison T00–T04 de S01

Date : 2026-10-13. Portée autorisée : terminer T04 puis livrer/merger et arrêter.
T05–T10 hors mission ; aucun AC d’activation S01 ni état DONE déduit.

## Résultats réellement exécutés

| Commande | Résultat | Portée réelle |
|---|---|---|
| `bash scripts/worktree-setup.sh --check` | PASS | isolation et configuration identifiées |
| `pnpm build` | PASS | types applications/tests, lint, API et Vite |
| `pnpm test:unit` | 37/37 PASS | règles, cookies, CSRF, OIDC, chiffrement, SID |
| `pnpm test:integration` | 58/58 PASS | 12 schema +46 autres ; PostgreSQL réel, J1 et adapters natifs |
| `node scripts/s01-control-migrate.mjs` | PASS | rejeu migration centrale et grants ; checksum ci-dessous |
| `pnpm test:auth` | **12/12 PASS, 11.4 min** | Firefox avec TLS validé, huit parcours natifs +quatre matrices/restart, tête finale |
| `pnpm test:auth -g 'refresh/faults'` | **1/1 PASS, 2.8 min** | dernière assertion exacte cookie/SID ; reprise503 observée, nouvelle MFA native et logout confirmés |
| `python3 scripts/s01-secret-scan.py` | PASS, zéro match | blobs indexés contre secrets synthétiques raw/hex/base64 et fragments PEM ; compteur dans t04-checks.json |
| `pnpm test:auth -g 'native-password'` | 1/1 PASS, 17.1 s | ajout final : reset mot de passe natif, DENIED durable, restauration refusée |
| `pnpm test:auth:rotation` | 1/1 PASS, 1.1 min | rotation canari réelle, sélection dédiée sans refaire la matrice de pannes |
| `pnpm test:auth -g 'throttle'` | 1/1 PASS, 1.5 min | cinq échecs natifs, délai puis authentification forte |
| `bash scripts/agentic-check.sh` | PASS présence | ne prouve pas les gates applicatifs |
| `git diff --check` | PASS | espaces du patch courant |

Checksum centrale : `9f0dc36dc01ac75df76e23250452f299c4a649f03e6bd6e38c976325c6cb955a`.
Les logs locaux de commande sont sous `.local/`, ignorés par Git. Aucun export
secret, URL d’action/code/state, cookie, trace DOM ou screenshot n’est publié.
Les boundary mocks des tests SQL sont explicitement distingués des tests natifs.

## Matrice V3 observée

- Password natif → TOTP ou secours → Code/PKCE/S256 → claims signés issuer/sub/acr2/SID.
- Enrôlement PI maintenu, premier OTP consommé ; aucune session forte avant preuves.
- OTP invalide, déjà consommé et hors bornes : refus ; succès frais ensuite.
- Secours public concurrent : un BFF seulement ; ancien onglet/formulaire et
  code consommé dans un nouveau grant refusés ; code suivant accepté.
- Owner serveur explicitement configuré : scope platform fort ; onboarding vide.
- Refresh humain natif, polling sans refresh, CSRF et callback/state forgés/rejoués.
- Backchannel natif signé réel, receipt durable, révocation et anti-rejeu.
- Idle30 min/absolu15 j via horloge de test sur vraies transactions SQL ; bornes
  realm natives lues séparément. Aucun test n’a attendu quinze jours réels.
- Changement natif : DENIED epoch+1, toutes sessions révoquées, audit et commit
  avant refus ; crash après fsync avant SQL et restauration ancienne restent fermés.
- Sujet natif absent 404 distingué des pannes ; SID absent ferme la session sans
  DENY global ; dépendances temporaires ne changent pas l’epoch.
- PI/KC arrêtés, ENCKEY absente, journal absent au restart sans régénération,
  clé BFF absente, WAF arrêté : accès fermé ; reprise technique testée.
- Tous clients interactifs lus, consoles et grants hérités fermés, offline retiré ;
  porteurs bearer-only explicitement reconnus, aucun IdP externe configuré.
- Routes natives directes/admin/account/token/device/CIBA/broker/logout/reset,
  query/body/encodages/duplicats/multipart/JSON : refus sans octroi ni mutation J1.
- Restart coordinateur : grants transitoires perdus ; receipt d’admission interdit le rejeu.
- Rotation supplier janitor réelle sur store clone synthétique et credential distinct,
  nouvelle clé, secret resolver réenregistré nativement, compteurs/assignation
  préservés, OTP consommé refusé ; ENCKEY hors dump, seed absente du dump KC,
  export en clair uniquement en RAM sans swap/coredump et supprimé dans finally.

## Finding upstream conservé

La consommation concurrente native des secours est défaillante. La commande
privée `test:auth:upstream` est rejouée séparément ; son échec n’est pas un PASS
natif et ne produit aucun BFF. [Preuve et limites](evidence/t04-recovery-concurrency.md).
La protection composite locale est la propriété qualifiée par la suite publique.

## Limites

CI hébergée et Lead Tech de la tête actuelle restent des gates Ship distincts.
UI PI précédente figée3.14 : upgrade exige requalification. IAM/coffre cloud,
PRA commercial, rétention30j/charge/licences commerciales ne sont pas qualifiés.
Aucune création d’agence, activation IA/modules/mail ou action externe métier.

## Rejeux intermédiaires conservés

Le checkpoint10/10 a passé. Le premier rejeu11 cas a échoué sur trois
contextes multi-onglets ; aucun PASS de cette tête n’a été publié. Le harnais
quitte désormais le document natif avant remplacement des cookies et POST
simultanés, pour éviter sa navigation automatique concurrente ; cookies,
origine, formulaire natif et backend inchangés. Le rejeu ciblé suivant a passé
4/5 ; le cas restant exigeait incorrectement la conservation du SID après restart
Keycloak. Sa correction qualifie explicitement fermeture durable ou reprise,
puis impose toujours une nouvelle MFA native. Ce scénario corrigé a passé1/1.
Le rejeu complet corrigé **12/12 PASS** inclut password et scan RAM renforcé.

## Observation de panne finale

Le rejeu ciblé a observé **503** juste après redémarrage Keycloak, avec J1
inchangé. Nouvelle connexion native password+code secours/Code/acr2 : PASS,
nouveau BFF fort puis logout : PASS. La branche401 du dernier helper n’a pas été
empruntée dans ce rejeu : sa liaison cookie/SID exacte a été relue indépendamment,
la fermeture d’un SID absent est couverte par l’intégration SQL avec frontière
native explicitement simulée. Aucun 401 natif nouvellement exécuté inventé.

## Scan de secrets reproductible

`python3 scripts/s01-secret-scan.py` lit uniquement l’environnement synthétique
connu et ses clés requises, compare les blobs Git indexés aux valeurs privées
brutes/hex/base64 et fragments de clés PEM. Il ne publie que compteurs et chemins
en cas de match ; aucune valeur/pattern privée. Les graines browser restent en
mémoire et ne font pas partie de ce scan de fichiers. Les dumps natifs sont
vérifiés séparément dans le canari de rotation. Derniers compteurs minimisés :
[evidence/t04-checks.json](evidence/t04-checks.json). Un zéro n’est pas un audit
exhaustif de secrets inconnus ; aucun secret connu trouvé dans le snapshot livré.

**Verdict Verify T00–T04 : PASS.** CI/Lead Tech/merge non déduits de ce verdict.
S01 globale : IN_PROGRESS.
