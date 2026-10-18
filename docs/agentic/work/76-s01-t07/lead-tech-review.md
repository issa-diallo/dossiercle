# Review — S01–T07 / #76 — Lead Tech PR

## Verdict

**PASS_WITH_MINOR** — aucun Critical/Major ouvert. Rapport historique sur
`a43124fd38494c02b78804bdc7eb527d4265dbbd`, après cinq CI SUCCESS.
Il n’atteste pas le commit qui l’ajoute : ultime attestation hors diff requise
après sa CI, conservée en session et dans la description de PR autorisée.

## Révision et indépendance

- Mission : Lead Tech final, LARGE ; reviewer `/root/ship_lead_tech` distinct de
  l’implementer `/root` et des reviewers `/root/t07_review`, `/root/t07_final_review`.
- Capacité héritée ; niveau exact non observable, High recommandé, aucun override prétendu.
- PR : https://github.com/issa-diallo/dossiercle/pull/77
- Base : `135f0eab07f017e9b8a35c704dd1342f53cc2b51`.
- Tête : `a43124fd38494c02b78804bdc7eb527d4265dbbd`.
- Date : 18 octobre 2026, après terminaison T07 à 20:20 UTC.
- Lecture seule stricte : aucun fichier écrit, test/service lancé, commentaire,
  approval ou action Git mutante. Rapport retourné en session, consigné par root.
- PR/SHA/CI relus directement via API après terminaison T07 ; trois commits
  intermédiaires alors examinés, squash final prévu après autorisation future.

## Inputs reviewed

Ticket #76 et extension de mandat ; AC/Plan S01 ; README/méthode/rôle/conventions ;
Research/Design/Plan et préparation ; ADR auth, J1, idempotence et transaction
privée ; Execute/Verify/Review/Recovery/Goals/handoff/Ship ; diff complet ;
frontières auth/SQL/HTTP/mTLS/projection ; manifestes et preuves privées/CI.

## Findings

### Critical

Aucun.

### Major

Aucun ouvert. Deux défauts de préparation froide corrigés et requalifiés :

1. Sélection historique ineffective : `--exclude` CLI ne retirait pas T07.
   `--before-activation` sélectionne positivement les 11 fichiers historiques
   après le schéma séparé. Défaut complet conservé. Preuves : local13+98 PASS,
   puis préparation froide et runner complet SUCCESS dans la CI finale.
2. J1 absent avant T06 : démarrage explicite du coordinateur natif et attente de
   santé. Initialisation native vérifie l’existant, création neuve exclusive,
   sans troncature/rotation. CI froide complète SUCCESS.

Échecs antérieurs documentés, aucun PASS rétroactif attribué aux anciennes têtes.

### Minor

LT-M2 hérité : avertissement de sérialisation pg8, aucune montée de version T07.
Responsable mainteneur/Lead Tech ; échéance avant montée majeure pg.
Aucun changement supplémentaire requis pour cette PR.

### Nit

Aucun.

## Acceptance criteria

- [x] A1 — READY/PENDING sans accès ; prepared local exact et bindings avant publication.
- [x] A2 — Transaction membership/agence/opération/audit/outbox/idempotence ; fautes/CAS/MVCC/SIGKILL.
- [x] A3 — Réponses perdues/concurrence sans second octroi ni événement.
- [x] A4 — Autorité/J1/session/identité revalidées après I/O ; expiration/révocation ferment l’octroi.
- [x] A5 — Onboarding/ADMIN propre, isolation, rôles/scopes interdits, CSRF/Origin.
- [x] A6 — GET minimisé/no-store, polling sans refresh, READY distinct d’ACTIVE.
- [x] A7 — Retry borné/admission sérialisée ; mêmes opération/base/secrets ; scanner après commit.
- [x] A8 — Projection privée idempotente et reprise après panne/redémarrage.
- [x] A9 — IA/mail/modules désactivés ; socle historique/V3/isolation/scans conservés.

## Architecture / security

- [x] Stack/frontières existantes ; aucun moteur/fournisseur ajouté.
- [x] Isolation agence/bindings et autorisations courantes contrôlés côté serveur.
- [x] Entrées strictes, SQL paramétré, destinations privées fixes.
- [x] Identités mTLS distinctes/routes bornées ; aucun credential migration dans l’API.
- [x] Confirmation humaine/D57 conservées ; aucune migration/checksum historique modifié.
- [x] Rollback : bloquer octrois, drainer sous mandat, conserver ACTIVE acquis,
  audit/outbox/J1/bases/réservations/clés/versions.

Dépassement de taille justifié par cohérence atomique dans Plan/Ship/PR.

## Evidence assessment

- [x] 58/58 sources Ship exactes ; manifeste SHA256
  `19355cf25223267bff285e6949a1a28d69d4cf0fcb82ac7f6ad22068d22bf01b`.
- [x] 13/13 empreintes des preuves privées vérifiées ; sources applicatives inchangées.
- [x] CI T07 : unités114, contrats25, capacités/mTLS6, T06 complet, V3 13/13,
  intégration13 puis123/14fichiers, scans sans match ; nombres recoupés, pas un total unique.
- [x] Build/préparation froide/méthode/whitespace SUCCESS.
- [x] Certificat froid : bloc réel setup puis deux rechecks sans rotation examinés.
- [x] Réparation opérateur ancienne projection distinguée de la reprise automatique.

Cinq liens/SHA/résultats : [preuve CI minimisée](ship-ci-evidence.json).
Logs CI consultés directement ; aucun test exécuté par ce reviewer.
Qualification synthétique, mesure nominale sans garantie sous charge ; N3 avant
usage réel. Artefacts accidentels privés conservés, provenance non établie,
aucun rendu/transfert par le reviewer.

## Conclusion

PASS_WITH_MINOR historique sur a43124fd. Techniquement prêt pour gate humain,
sous D57. Aucun mandat de fusion/déploiement/cleanup. Après commit du rapport,
cinq nouvelles CI SUCCESS puis ultime attestation RO hors diff indispensables.
