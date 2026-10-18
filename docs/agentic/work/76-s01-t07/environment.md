# Worktree Setup0b — #76 / S01–T07

> Historique de préparation / qualification du socle. Les résultats et ressources
> de l’implémentation sont actualisés dans [Verify](verify.md) et le
> [handoff](handoff-implementation.md). Le PASS Setup ne vaut pas PASS T07.

`SETUP: PASS` — setup froid et contrôle réel terminés, [revue indépendante PASS](setup-review.md).
Le PASS visé porte sur le socle synthétique existant, aucun runtime activation T07.

## Identité et isolement

- Worktree `/home/issa/Workspace/perso/dossiercle/worktrees/76-s01-t07`.
- Branche `feat/76-s01-t07`, base/HEAD135f0ea ; projet Compose `s01-9c74466403ef`.
- TLS loopback39187, PostgreSQL loopback54217 ; DB, volumes, réseau, clés et J1
  propres au hash du worktree, mounts et modes vérifiés par --check.
- Setup0a et revue PASS avant premier setup froid ; seul couple identité exact
  ajouté, aucune fonction/capacité/certificat T07 implémenté.

## Preuves exécutées

`bash scripts/worktree-setup.sh --synthetic` : code0. Setup froid depuis ce
worktree, distributions/lock épinglés, dépendances frozen sans scripts lifecycle,
Firefox privé, image privacyIDEA, services et configuration native existante.
Build contracts/domain/adapters/testing et migrations centrales existantes
exécutés par le script, checksum observé
`e5d7928caaa1b6f9d145c1102f5119321defcc1cf385fe8356272c9dc7b4632a`, schemaVersion1.
Contrôle T05 des rôles/memberships/ACL exécuté par le script, réussi.

`bash scripts/worktree-setup.sh --check` après fin du setup : code0. Validation
identité Git, config Compose effective, mounts/modes/ressources propres, manifeste
syntheticOnly et frontière capacités du socle. Aucun secret publié.

Sept services réellement observés running/healthy : ingress, inngest, keycloak,
mailpit, postgres, privacyidea, redis. Aucun identity-coordinator/t06-provisioner/
t06-orchestrator démarré. Aucun worker/saga/fixture agence/activation T07 lancé.
Les messages de setup disent explicitement « MFA NOT QUALIFIED / BUSINESS CLOSED » :
la qualification V3 héritée n’est pas prétendue rejouée dans cet environnement.

[Capture minimisée](setup-evidence.json), empreinte du log privé :
`c56047e1a466657525a9b271c57d6b2ec8e23b90c07f3f7b0d11d0c1cf3407bc`.
Log conservé `.local/evidence/t07-setup.log`, mode0600, hors Git ; clés/credentials
privés hors livrables. Aucune copie de logs bruts dans le dépôt.

## Limites et conservation

Aucun test applicatif T07 ni suite auth native exécutée ici. La vue POST/GET
complète, capacités SQL T07, certificats/transport T07 et fixtures nouvelles
restent à implémenter/qualifier dans le futur Execute. Tests du seul contrôle
identité :25 cas PASS, décrits dans Setup0a. Aucun DoR activation déduit du setup.

Les sept services restent conservés et actifs ; volumes/bases/keys/J1/worktrees
et versions sont conservés, aucun down/prune/cleanup ni suppression de ressource.
Aucune fusion/déploiement ; aucune commande supplémentaire de mutation autorisée
par le handoff. Le prochain implementer reprend le worktree et vérifie --check
avant tout travail, puis suit Plan et les gates d’implémentation.

## Gate

- [x] Environnement isolé/reproductible fourni par scripts existants.
- [x] Setup froid/code0 et --check/code0, sept services sains, profils métier inactifs.
- [x] Commandes tests disponibles, versions/lock/migrations du socle préparées.
- [x] Données/ressources conservées, aucune fonction T07 implicite.
- [x] Revue indépendante PASS du résultat et des preuves, aucun finding ouvert.

Verdict : PASS du socle synthétique seulement ; aucun PASS applicatif T07.
