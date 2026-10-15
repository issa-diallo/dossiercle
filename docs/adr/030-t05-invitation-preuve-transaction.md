# ADR-030 — Lier invitation T05, preuve privée et transaction d’autorité

## Statut et références

`ACCEPTED` documentaire — 2026-10-14, préparation #71/S01 T05, sans implémentation,
après [revue Design indépendante](../agentic/work/71-s01-t05/design-review.md).
Précise ADR004/024/025/029 et Design S01 ; aucune décision utilisateur remplacée.
Décideur documentaire : orchestrateur, après revue indépendante du Design.

## Contexte

Le socle fusionné fournit MFA/BFF/J1 et tables centrales, mais pas la procédure
de confirmation owner ni les mutations invitation/création. Le runtime général
n’a pas les droits d’autorité ; le coordinator identity n’a pas les droits agence.
J1 global reste verrouillé jusqu’au commit : imbriquer des transactions owner et
invité peut bloquer. Après callback, le token d’invitation n’est plus au navigateur.
T05 doit garder une acceptation atomique sans nouvelle migration de schéma.

## Décision

Retenir un processus coordinateur privé habilité, une connexion/transaction,
préverrouillage de toutes racines puis autorités avant J1, et un profil SQL
NOLOGIN control_t05 limité par colonnes, activable explicitement sans héritage.
Le profil général control_api ne reçoit aucun droit d’autorité nouveau.
Le deny natif reste fsync/SQL sous verrou avant refus ; pas de rollback puis
réautorisation à partir d’une projection ancienne.

Preuve humaine Ed25519 : clé privée uniquement dans la procédure owner, clé
publique dans runtime ; records minimaux signés immuables dans idem existante,
paire UUID owner/contact/subject/root liée et TTL24h. Elle atteste une procédure
humaine, pas un contrôle automatique d’identité ; fixture marquée synthétique.
Reçu callback lié à la session forte écrit atomiquement avec BFF ; claim accepte
union stricte {} / {token}, avec ce reçu obligatoire dans les deux branches.
Le Design T05 définit les limites et les permissions exactes.

## Alternatives réellement examinées

- Refresh coordinator puis transaction API réauthentifiée : garde les rôles actuels,
  mais ajoute deux voies auth et exige convergence deny après rollback métier.
  Non retenu pour conserver la propriété existante sous verrou.
- Fonction SECURITY DEFINER métier : capacité étroite possible, mais nouvelle
  migration/procédure SQL et maintenance supplémentaire. Non retenue ici.
- Registre privé MAC : protège contre forge SQL, mais runtime détenteur de la clé
  peut forger l’attestation. Ed25519 sépare signataire et vérificateur.
- Token renvoyé en GET/storage navigateur : contraire aux contraintes ; non retenu.

## Conséquences et limites

Atomicité centrale et deny T04 conservés ; pas nouvelle DB, dépendance ou moteur
auth/jobs. Réservation PENDING et import réconciliable restent deux phases durables,
pas transaction distribuée supposée. Les ACL/bootstrap, verrous multisujets,
restauration de rôle audit et nouveau secret de signature demandent des tests.
Un coordinateur compromis n’est pas isolé par les profils qu’il peut activer.
Signature et clé publique ne prouvent pas à elles seules l’identité humaine.
Clé perdue/head divergent = refus ; pas de régénération/restauration automatique.
Node24 fournit les primitives [crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html) ;
PG17 distingue héritage et activation explicite de [rôle](https://www.postgresql.org/docs/17/role-membership.html),
et RESET ROLE revient au rôle de session ([SET ROLE](https://www.postgresql.org/docs/17/sql-set-role.html)).
Lectures primaires 2026-10-14, pas preuve runtime.

## Validation et rollback

Implementer/reviewer : ACL négatives, concurrence multisujets/T04, claim/revoke,
faux records/signatures, clé absente, panne J1/import/audit/commit et non-fuite.
Échéance : Execute/Verify T05 avant exposition synthétique de ses endpoints.
Avant réel/commercial : propriétaire, gestion des clés/procédure humaine/IAM et
reprise à qualifier N2/N3 ; aucun déploiement autorisé par cet ADR.
Rollback code par revert humain, conserver DB/records/J1/clés ; aucun ancien
CONFIRMED rétabli. Perte d’une preuve ferme seulement l’action concernée.
