# Ship — S01–T07 / #76

**SHIP: EN COURS — mandat commit, PR et CI ; fusion/déploiement/cleanup exclus.**

## Préconditions et candidat

Execute PASS, Verify PASS, Review indépendante PASS, Goal technique SATISFIED,
aucun Critical/Major ouvert. Voir [Verify](verify.md) et [Review](review.md).
Branche `feat/76-s01-t07`, remote `origin` / `issa-diallo/dossiercle`, base
`135f0eab07f017e9b8a35c704dd1342f53cc2b51`. Le
[manifeste Ship](ship-source-manifest.json) distingue le candidat final du
manifeste historique d’implémentation. Preuves brutes restent privées.

Le mandat utilisateur Ship succède explicitement au mandat d’implémentation
sans commit. La mission s’arrête à READY_FOR_HUMAN ; D57 reste applicable.

## Ajustements de livraison et qualification

Le setup froid écrivait le certificat T07 avec le serial de la CA alors que le
consumer exige `t07-activation-tls/ca.srl`. Alignement du bloc de génération sur
ce chemin propre au client, sans toucher clés/certificats/versions existants.
Test réel privé du bloc exact du setup froid et de deux rechecks : PASS, aucun
changement de clé/certificat/serial après génération. Preuve minimisée et script
conservés dans `.local/ship/`, aucune recréation du worktree local.

CI T07 ajoutée : préparation historique sans activation T07 puis runner complet
T06 → V3 natif entier → V2 entier/T07 → scan secrets. Les trois workflows
historiques exécutent leurs tests PG sans les deux nouveaux fichiers T07 ; ces
fichiers sont tous exécutés dans le job T07 complet après V3, sans skip.
`s01-integration-test.sh` relaie les arguments de sélection au second Vitest ;
son invocation par défaut reste complète. Les assertions/manifests T05/T06
restent inchangés. YAML cinq workflows et syntaxe bash PASS.

## Périmètre de PR et atomicité

Une PR pour #76. Dépassement des cibles 1–3 fichiers/100 lignes justifié par le
même octroi indivisible : auth/locks, réservation/audit, transaction centrale,
contrats, clients/handlers privés, reprise, capacités et leurs tests/adaptations
CI doivent être cohérents. Une division permettrait des droits partiels ou des
preuves manquantes. Les artefacts LARGE de préparation et vérification sont
conservés. Un commit logique final prévu après squash ; les commits intermédiaires
éventuels servent à consigner preuves/revue, sans réécrire l’historique publié.

## PR / CI / Lead Tech

Publication et résultats CI à consigner après exécution, aucun PASS CI anticipé.
Lead Tech distinct de l’implementer et des premiers reviewers :
`/root/ship_lead_tech`, lecture seule, modèle/capacité hérités ; High recommandé
pour sécurité, niveau exact non prétendu. Rapport sous `lead-tech-review.md` ;
attestation finale après la dernière tête/CI conservée en session hors diff.

## Déploiement et rollback

Aucune nouvelle migration ni checksum historique changé. Rôles/capacités et
identité synthétique bornés. Aucun credential migration dans l’API. Rollback
futur : bloquer les octrois, drainer par protocole sûr si autorisé et revenir à
un runtime compatible en conservant ACTIVE acquis, audit/outbox/J1, réservations,
bases, clés et versions. Aucun rollback/reset/destruction exécuté.

Suivis non bloquants : LT-M2 pg8 avant montée majeure ; artefacts accidentels
privés/provenance non établie conservés ; mesure nominale locale sans garantie
sous charge. Dix services et ressources synthétiques conservés actifs à l’entrée.

## Gate humain

Pas d’autorisation de fusion, déploiement ou cleanup dans ce mandat. Issue #76
reste ouverte jusqu’à décision humaine applicable et fusion. Verdict attendu :
READY_FOR_HUMAN après CI et ultime attestation Lead Tech, jamais DONE ici.
