# Reprise de vérification — #76 / S01–T07

## Mandat et périmètre

Reprise LARGE autorisée par l’utilisateur : réconcilier le gate T06 sans reset,
rejouer le retry renforcé, compléter la matrice puis revue indépendante. Le
mandat initial sans commit/push/PR/Ship/cleanup reste applicable. Un seul écrivain.

## Faits vérifiés à la reprise

- Identité worktree et `worktree-setup.sh --check` PASS.
- Gate `BLOCKED`, exécution `BLOCKED`, tentative 2, quatre backends enregistrés.
- La première version du test forçait FAILED depuis READY sans modifier le step;
  l’opération a donc commencé la tentative 2 avec step READY. La version corrigée
  `SECRETS_REFERENCED` n’a pas pu démarrer car le gate était déjà bloqué.
- Le reconciler T06 refuse par provenance les tuples T07, pourtant admis par le
  provisioner T07. Adaptation bornée : accepter les deux partitions disjointes
  déjà vérifiées, toujours sur le tuple exact opération/agence/root. Aucun autre
  contrôle de fencing, backend, autorité, readback ou preuve n’est modifié.
- L’inspection sans confirmation passe après cette adaptation : exécution
  BLOCKED et quatre backends enregistrés. Aucun effet n’est réémis par inspection.

## Récupération préparée

1. Revue indépendante du contrôle de provenance et de cette récupération.
2. `s01-t06-reconcile <execution> --confirm-synthetic` : arrêt réel de l’instance
   exacte, absence des backends, readbacks exhaustifs, preuve privée fsyncée,
   transaction FENCED/FAILED/IDLE. Le présent mandat fournit la confirmation
   humaine de la réconciliation synthétique. Aucun reset/rotation/suppression.
3. L’ancienne fixture artificielle garde son checkpoint READY, ses ressources,
   son compteur et ses preuves. Si le reconciler la rend retryable, quarantaine
   hôte auditée : après preuve FENCED, tuple T07 exact, gate IDLE, agence FAILED
   non activée et opération FAILED/READY/EXECUTION_UNCERTAIN, mettre seulement
   retryable=false. Ne pas rembobiner le step ni l’epoch/attempt/generation.
4. Redémarrage via les scripts identifiés, test renforcé corrigé sur une nouvelle
   fixture T07. Vérifier même opération/DB/runtime secret/migration secret.
5. Couvrir fautes centrales, concurrence, révocation/native/J1 et reprise de
   projection; exécuter les non-régressions et obtenir revue indépendante finale.

## État

RECOVERY: PASS — fencing/readbacks/réconciliation/quarantaine exécutés et revus.
Verify/Review produit restent ouverts jusqu’à la matrice complémentaire.

## Fait nouveau : base migrée fermée

Le premier fencing a arrêté l’instance exacte et ses backends, mais le readback a
refusé la base fermée (`RECONCILE_CLOSED_DATABASE_REQUIRES_INSPECTION`). Aucune
transition FENCED/IDLE n’a été publiée. Le provisioner avait fermé la base sur
l’erreur de reprise; le gate reste BLOCKED. Cette exécution de diagnostic a
utilisé Node22 hôte par erreur; les commandes suivantes utilisent explicitement
le PATH Node24/pnpm épinglé du worktree.

Extension préparée et soumise à revue avant usage :

- Reprendre un conteneur déjà arrêté sans le redémarrer. Son identité tmpfs
  disparue ne peut pas être récupérée par docker cp ; la trace hôte réelle du
  premier fencing lie l’instance exacte à son arrêt et aux backends absents,
  complétée par une attestation privée et l’inventaire du namespace.
- Après fencing prouvé uniquement, pour une base fermée déjà migrée : tous les
  effets CONFIRMED, propriétaire/tag/OID/création exacts, zéro session et aucun
  CONNECT sauf le propriétaire migration. Runtime et PUBLIC restent fermés.
- Ouvrir temporairement uniquement ALLOW_CONNECTIONS pour la session migration
  hôte; transaction `BEGIN READ ONLY`, vérification complète marker/checksum,
  configuration, audit et ACL internes avec CONNECT runtime attendu false.
- Refermer ALLOW_CONNECTIONS en finally après fermeture du pool, vérifier zéro
  session/base fermée. Aucun grant, schéma, contenu, rôle, clé ou version modifié.
- Chaque preuve d’effet reste comparée au readback; défaut d’inspection ou de
  refermeture = BLOCKED. Preuve `CLOSED_DATABASE_VERIFIED` distingue ce cas de
  `CLOSED_DATABASE_UNMIGRATED`; la base reste fermée après la procédure.


## Résultats réels de récupération

- L’archive hôte Codex du premier appel confirme le passage de `containerFence`
  avant l’erreur readback. Extraction privée du seul call/output et du code de
  fence connu, SHA-256 `9cfb051226142f8691835b4ef7ff1ef46eaa102e0b9ebc8c63113675d1b15d8b`.
  L’inventaire RO global de 63 conteneurs, le conteneur exact arrêté, ses mounts
  privilégiés uniques, cgroups absents et quatre backends absents sont liés dans
  une attestation privée; aucun lien d’instance n’est déduit des seuls horaires.
- L’identité tmpfs disparue après l’arrêt est désormais couverte par une preuve
  stop privée fsyncée AVANT le readback. La reprise vérifie scope, instance,
  conteneur, StartedAt inchangé, intégrité et namespace; aucun restart incertain.
- Revue indépendante préalable du fence/readback : PASS après corrections ACL
  effective NULL/PUBLIC et finally de refermeture. Usage strictement hôte privé.
- Confirmation réelle Node24 : FENCED, gate IDLE, six effets présents et DB fermée
  vérifiée (marker, checksum, audit, ACL), inspection refermée sans sessions.
  Preuve SHA-256 `a04632c3f94d00c2d7e5b38abd31afd83cf90161fc67f8729b3746f3a5d53293`.
- Quarantaine distincte : revue PASS_WITH_MINOR, mineur corrigé avant usage;
  preuve fence+stop+trace et modes contrôlés, CAS retryable=false/version+1,
  audit durable. Step READY, attempt2, locator et effets inchangés.
  Preuve SHA-256 `8e7f19667a6c542e93721fa1ee59e6b6d8c374b9f0a92c8c5d37b54b74895826`.
- Redémarrage T06 identifié : PASS, sync native signée 200, aucun reset ni
  suppression/rotation. Manifestes T05/T06/T07 exhaustifs/disjoints.
- Rejeu ciblé A7 corrigé : PASS, 1 test/3 filtrés, 70.09 s. L’opération attempt2
  arrive READY/SUCCEEDED avec même base, rôle migration et références runtime /
  migration qu’avant l’échec simulé SECRETS_REFERENCED. Le retry est audité sans
  outbox directe; replay unique, wakeup scanner après commit.

Preuves brutes et scripts hôte ad hoc conservés dans `.local/t06-fencing/`,
`.local/t07-recovery/` et `.local/t07-quarantine.mjs`; non publiés et privés.
Aucune base, version de secret, J1, fixture ou compteur n’a été réinitialisé.

## Rattrapage des anciennes projections locales

Après le runner global PASS, inventaire RO des sources T07 ACTIVE liées à
audit/outbox/manifeste exacts : 21 sources, 17 projections locales exactes,
4 absentes, 0 divergente. Cette dette provenait des anciens parcours synthétiques
échoués avant corrections ; elle n’a pas été effacée ni masquée.

Réparation opérateur relue avant usage : 4 événements centraux DELIVERED existants
uniquement, tuple agence/root/acteur/opération exact, état ACTIVE/version/schema1.
Le script privé appelle le handler `activationProjection` et le client mTLS
`provisionerProjectActivation` existants dans le conteneur orchestrator ; le rôle
dispatcher recharge la source, le provisioner vérifie propriétaire/tag/ACL et
relit l’audit local. Aucun nouvel octroi, audit central, outbox, idempotence ou
événement moteur. Snapshots centraux avant/après identiques.

Résultat réel : 4 appels ACK, inventaire indépendant final **21/21 exacts,
0 absent, 0 divergent**. Preuve privée durable0400/fsync, SHA-256
`c0144b150355268d9f4703d6a1fd61d90ad7bec542acb2201c6637ffeefed4fa`.
L’inventaire généré initial est conservé octet pour octet, vérifié contre
l’empreinte préparée ; les résumés avant/après sont conservés.

Ce résultat est une **projection réparée par opérateur**, pas une attestation de
succès Inngest pour ces quatre anciennes exécutions. La reprise automatique
Inngest après panne/redémarrage est démontrée séparément par les tests T07 frais.
Le gate reste IDLE, zéro exécution RUNNING/BLOCKED, ancienne exécution FENCED ;
aucun changement de ressources, clés, versions ou checksums historiques.
