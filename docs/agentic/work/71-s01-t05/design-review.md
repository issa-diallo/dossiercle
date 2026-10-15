# Review indépendante — #71 / T05 Design et ADR030

## Verdict et indépendance

**PASS après corrections/revalidation** — 2026-10-14, Critical0/Major0/Minor0.
Reviewer `/root/t05_preparation_review`, distinct du rédacteur `/root`,
du reviewer Research et du conseiller `/root/t05_design_advice`.
Modèle/niveau hérités ; configuration précise non observable. Lecture seule,
aucun fichier, test, installation, service ou état GitHub modifié.
Base `71c4536981aa61656b3b7ad0df42ed9c14facd00` et artefacts locaux non committés.

## Entrées et portée

Ticket exact, Research PASS, Design #71, ADR030, Design/Plan S01,
AuthService/EnrollmentCoordinator/KeycloakAdapter, migrations et ACL,
audit writer et bootstrap. Revue de préparation, pas revue de code exécuté ni
Lead Tech/CI. Les AC applicatifs restent à démontrer en Execute/Verify.

## Findings historiques corrigés

Premier verdict **CHANGES_REQUIRED**, Major1/Minor2 :
- Major : version+1 ne permettait pas reissue après CONFIRMED/CLAIMED, alors
  qu’EnrollmentCoordinator exige PENDING. Correction : nouvel epoch/J1 PENDING
  fsync et fermeture sessions avant token/version, commande stable et reprise,
  racine/agence conservées ; REVOKED terminal T05.
- Minor : username technique désormais exactement égal subjectId partout.
- Minor : préfiltre owner limité platform/TXB, pas aux invités claim/création.

Revalidation ciblée reçue : trois findings levés, aucun nouveau finding.
Permissions identity_status restent coordinator, pas profil T05. Profil NOLOGIN,
colonnes/defaults, restauration audit et préverrous multisujets sont réalisables
sur le socle ; ce profil ne sandboxe pas le coordinateur habilité.

## Assessment et suite

Preuves Ed25519 sans clé privée runtime, records existants minimaux, confirmation
humaine distincte des fixtures ; receipt callback/session atomique, union claim
stricte compatible ; réservation TXA durable, préparation TXB fermée ; création
PROVISIONING/ADMIN PENDING/opération ACCEPTED sans provisioning/ACTIVE cohérentes.
Échecs natifs/SQL distingués, snapshots anciens jamais réautorisants.

Design Gate PASS ; Plan doit affecter fichiers, commandes et tests à ces invariants,
notamment concurrence T04/T05, reprise des commandes et ACL réelles.
Tests/runtime non exécutés à cette phase, aucun AC fonctionnel validé.
