# Goal d’implémentation — #71 / S01 T05

`GOAL: ACTIVE` — 2026-10-15. Ce document complète le Goal de préparation conservé.

Résultat attendu : confirmation propriétaire, invitation native réconciliable,
grant émis/révoqué, claim sûr, création durable d’une agence PROVISIONING avec
ADMIN PENDING et opération ACCEPTED/PENDING. Livraison limitée à READY_FOR_HUMAN.

## Critères mesurables

- [x] AC1 : endpoints réels refusent anonyme, rôle non owner et racine étrangère ;
  autorisation J1 courante avant replay.
- [x] AC2 : preuve signée liée owner/contact/sujet/racine ; import natif unique
  réconciliable après timeout/duplicate, sans confirmation fictive.
- [x] AC3 : lien une fois, TTL10min, versions/epochs courants, sessions fermées
  avant réémission ; REVOKED terminal et panne J1 fermée.
- [x] AC4 : callback/receipt/session atomiques ; claim {} et legacy liés au même
  reçu courant, concurrence et révocation couvertes.
- [x] AC5 : création202 après commit atomique agence PROVISIONING, ADMIN PENDING,
  opération ACCEPTED/PENDING, audit/outbox/idem ; aucune ACTIVE ni locator.
- [x] AC6 : deux sessions/connexions, replay courant, une création par root/name ;
  conflits409 pour body/name différents.
- [x] AC7 : reprise après crash/commit ou réponse perdue, même agency/operation ;
  head divergent refuse sans restaurer une ancienne autorité.
- [x] AC8 : HTTP strict, limites et Origin/CSRF/TLS ; aucune fuite token dans GET,
  logs, audit ou stockage navigateur.
- [x] Non-régression T04 native, migrations0001–0003 inchangées, ACL PG réelles,
  build/contracts/intégration/navigateur PASS avec preuves sans secrets.
- [ ] Setup/Execute/Verify et revues indépendantes favorables ; PR dédiée,
  Gitmoji/Fixes#71, CI de tête PASS et examen Lead Tech base/tête finales.

## Contraintes et preuves

Un écrivain, environnement frais et synthétique isolé ; DB/J1/clés/fixtures/autres
worktrees conservés. T06–T10, ACTIVE, IA/mail/facturation/cloud/déploiement/cleanup
exclus. Pas de fusion sans instruction humaine applicable.

Checkpoint initial conservé : étape0a [handoff bootstrap](setup-0a-handoff.md),
puis revue0a PASS et étape0b/Setup PASS indépendant. État courant : Execute et
[Verify](verify.md) PASS locaux sur les huit AC ; rapports des revues Setup/locks
conservés. Les preuves déterministes seules ne validaient aucun AC runtime.

Arrêt final attendu : READY_FOR_HUMAN après preuves et revues ; en cas de blocker
réel, documenter fait, périmètre affecté et résolution requise.


## État après Verify local

Objectif **ACTIVE** : les huit AC et régression locale sont prouvés (unit87,
contrats6, PG110, navigateur13), mais revue finale indépendante, commits/PR, CI de
tête et Lead Tech final restent nécessaires. Aucune fusion/déploiement autorisé.
[Handoff courant](handoff-implementation.md), [preuves](verification-evidence.json).
