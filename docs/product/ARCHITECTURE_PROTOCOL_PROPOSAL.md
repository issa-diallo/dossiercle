# Proposition de protocoles B02/B03 — pack de décision

> **Suite D81 : Architecture PASS N1** après [résolution OTP](ARCHITECTURE_OTP.md)
> et [revue indépendante](../agentic/work/63-finalize-architecture/otp-review.md).
> Les verdicts BLOCKED du corpus précédent sont historiques ; aucun POC réautorisé.

> **Autorité actuelle #63 :** D74/ADR-023 retient optionA dispatcher fermé ; D75/ADR-024 retient J1 journal indépendant. Les options B/J2 et demandes de POC ci-dessous restent historiques non adoptées. Aucun POC/reprise autorisé. [Matrice actuelle](ARCHITECTURE_FINALIZATION.md).

Date finale : 2026-10-11, préparation commencée le 10. Mode LARGE. Statut : PROPOSED / NON EXÉCUTÉ. Recherche et spécification documentaire ; transcription documentaire dans le worktree ARCH-B02-B12 ; aucune ressource cloud, test runtime ni garantie obtenue. Les deux options préservent bases distinctes par agence, autorité métier PG, worker calcul sans credential d’effet, aucun exactly-once SMTP et aucun rappel d’effet déjà parti. Elles ne changent aucune stack approuvée. Toute modification du sens de « stop effectif » exige arbitrage explicite.

## Distinction nécessaire avant de choisir

Il existe trois instants différents : préparation d’une intention, admission par le dispatcher, début réel de l’appel réseau. Un commit PostgreSQL `EN_COURS_EXTERNE` précédant l’appel ne prouve pas que le réseau a commencé. Un contrôle central puis une transaction agence ne sont pas une transaction unique. Un worker suspendu après contrôle puis réveillé après perte de lock demeure dangereux si son réseau/credential d’effet reste utilisable.

Le gate B02 doit tester spécifiquement « révocation validée après admission et avant réseau », « pause processus avant send », « lock PG perdu », « partition », « ancien dispatcher toujours vivant ». Un protocole qui sait seulement dédupliquer ses intentions ne satisfait pas automatiquement la barrière.

## Option A — dispatcher sérialisé et failover fermé

### Mécanisme proposé

Un dispatcher dédié est seul détenteur des credentials et seul composant autorisé par réseau à joindre les fournisseurs d’effet. Les workers lui soumettent uniquement `(agency_id, intent_id, expected_fence)` ; contenu et destinataire sont chargés depuis base agence. Un acteur sérialisé par agence traite les émissions et les restrictions ; toutes API de stop/takeover/révocation des capacités doivent passer par cette porte, y compris les restrictions centrales. Une réplique qui n’est pas active n’a aucun accès réseau d’effet.

Chemin émission :

1. Charger la session/service et la permission centrale courante ; verrouiller les autorités centrales pertinentes selon un ordre documenté (agence puis membership/validation déterministes).
2. Verrouiller l’intention et l’état agence dans une connexion distincte ; vérifier politique, attribution, fence, tag, validation exacte, quarantaine, horaires et budget selon type.
3. Persister une tentative unique et l’audit durable ; les erreurs ou résultats de commit incertains ferment l’émission. Enregistrer le statut d’admission distinct du statut de réseau réellement commencé.
4. Garder la sérialisation du dispatcher et des restrictions pendant le début de l’appel ; enregistrer l’instant/log d’appel observé. Une restriction arrivée pendant l’appel devient effective pour les prochaines sorties et affiche l’effet en cours, jamais une annulation garantie.
5. Enregistrer `CONFIRME`, échec certain ou `RESULTAT_INCONNU`. Sans preuve fournisseur, aucun nouveau send.

Chemin restriction : le dispatcher bloque immédiatement toute nouvelle admission de la portée ; il persiste la restriction centrale puis agence de façon idempotente et monotone, avec identifiant de commande et état `PENDING/APPLIED`. Une interruption entre stores reste restrictive. Le demandeur reçoit « appliqué » seulement après preuve que la porte d’émission a traité la commande et que les stores sont convergents ; aucune UI ne confond un stop demandé et un effet rappelé.

### Failover et limite essentielle

Ni le mutex du processus ni les locks PG ne protègent un ancien dispatcher suspendu qui perd son lock puis se réveille avec réseau encore ouvert. Reprise uniquement après fencing **réel de l’ancien egress** (isolation réseau/arrêt vérifié/révocation fournisseur), pas après simple expiration d’un bail. Si cette isolation ne peut être prouvée, les émissions restent fermées. La durée de ce fencing et l’impossibilité de fenêtres de recouvrement restent à démontrer.

Avantage : protocole proche du monolithe et possibilité de fermeture conservatrice, faible débit attendu. Coût : appels tenus sous sérialisation, locks/pools bloqués, opérateur/fencing egress, disponibilité dégradée lors d’incertitude. Deux connexions PG avec ordre uniforme ne procurent pas atomicité distribuée ; toute perte d’une connexion bloque, mais arrêter effectivement un send déjà préparé est une obligation runtime non prouvée. POC B02 indispensable.

## Option B — porte d’egress durable séparée avec commandes ordonnées

### Mécanisme proposé

Ajouter une porte d’egress spécifique derrière le dispatcher. Elle est seule à pouvoir utiliser les credentials/joindre les fournisseurs ; aucun dispatcher métier ne possède cette capacité. Dans une autorité centrale minimale distincte des données métier, un flux durable par agence ordonne `DENY_SCOPE`, `REPLACE_FENCE`, `ADMIT_ATTEMPT` et états de commande. Il contient identifiants opaques, scope, versions et hashes, jamais corps e-mail ou pièces. Chaque commande possède numéro monotone et clé d’idempotence.

1. La transaction agence prépare l’intention et outbox. Le dispatcher calcule et revalide toutes préconditions typées.
2. Il demande l’admission avec références/fences ; la porte vérifie les restrictions centrales courantes et consomme une admission unique. Restrictions et admissions ont un ordre commun.
3. La porte revalide l’agence au moment d’exécuter, sous mécanisme de sérialisation avec les transitions agence. Toute impossibilité de revalidation ferme l’effet. Elle enregistre « admission » et « réseau commencé » séparément.
4. Une restriction est opposable dès commit du flux de porte ; son applicateur ferme les nouvelles admissions et retire les admissions non commencées. Commandes agence et centrales sont propagées de façon restrictive, les extensions ne deviennent actives qu’après convergence.
5. Une tentative commencée conserve son identité et son résultat inconnu. L’egress ne renvoie jamais automatiquement après résultat ambigu ; le fournisseur factice ou API réelle doit prouver le résultat.

### Ce qui n’est pas démontré

Le flux durable règle l’ordre des commandes, pas à lui seul l’ordre commit/réseau. Il faut encore établir que la porte ne peut envoyer après un `DENY_SCOPE` avec une admission devenue périmée, ni que deux réplicas de porte peuvent partager credentials. Le service egress doit être fail-stop ou effectivement fencé au réseau/fournisseur ; un fence transporté dans un appel SMTP sans vérification ne suffit pas. Même difficulté de dernier intervalle avant network send que l’option A, déplacée dans un composant plus petit.

Une variante qui définit « début effet = admission durable » est plus simple mais changerait la sémantique de l’arrêt : un appel pourrait commencer après le stop tout en ayant été admis avant. Ne pas l’adopter implicitement. Si ce changement est souhaité, documenter et obtenir arbitrage produit avant de prétendre fermer B02.

Avantage : surface privilégiée réduite et journal de décision unique, meilleures preuves de commande et isolation worker. Coût : composant privilégié supplémentaire, latence, journal central de commandes sans contenu métier, compatibilité multi-réplicas et responsabilité de failover à qualifier. Une nouvelle frontière structurante nécessite ADR ; ce n’est pas un choix acquis.

## Proposition PRA — génération et révocations hors rollback

### Option J1 : journal d’autorité distinct, append-only

Proposer un journal sécurité/résiliation dans un store distinct de l’ensemble restauré central/agences (instance séparée et politique IAM distincte, localisation/région à arbitrer). Append-only logique avec droits runtime sans UPDATE/DELETE ; sauvegarde/réplication et copie inviolable/versionnée selon produit qualifié. Chaque événement contient `(command_id, agency_id/user_id opaque, scope, generation, sequence, denial/factor_epoch/tombstone, recorded_at)` et preuve d’intégrité. Ne pas stocker anciens secrets/facteurs dans le journal.

Pour révocation : journaliser durablement le refus/epoch avant mutation central/agence ; si seconde écriture échoue, refus reste valide et la saga reprend. L’accusé positif exige journal durable. Les octrois/élargissements restent inactifs tant que leur état final et journal de génération ne sont pas concordants. Pour MFA, un epoch post-backup interdit l’ancien facteur restauré ; réenrôlement selon parcours validé si nouvel état non récupérable. Lecture du journal/génération requise pour rouvrir ; journal inconnu = fermé.

La notion « distinct » est un périmètre opératoire : l’outil de restore n’a pas droit de rembobiner ce store. Sur panne régionale/perte du store lui-même, sa copie doit être retrouvée et validée ; existence d’un second store seule ne prouve ni indépendance de faute ni durabilité.

### Option J2 : fermeture globale et reconstruction humaine

Conserver génération de reprise/tombstones durables hors rollback, puis invalider toutes sessions **et toutes capacités autonomes restaurées**. Avant réouverture, le propriétaire et les administrateurs refont une revue restrictive des memberships, facteurs, boîtes, abonnements et validations ; aucun ancien TOTP seul ne prouve identité. Toute validation d’effet restaurée devient inutilisable sans nouvelle confirmation exacte. Agence supprimée reste interdite via tombstone indépendant.

Avantage : évite prétendre reconstruire un journal fin perdu. Coût : forte indisponibilité, capacité opératoire et identité humaine fiable indispensables, vraisemblance RTO <4h limitée avec nombreuses agences. Ne convient comme alternative d’Architecture que si débit revue et incident AZ sont bornés et prouvés. Les tombstones/générations restent nécessaires et ne peuvent être reconstruits permissivement depuis un vieux snapshot.

## Cut cohérent et preuve à produire

Manifeste signé/versionné : points PG central/agences/techniques, schemas, watermarks métier, génération et séquence journal indépendant, objets temporaires réellement nécessaires, permissions, fences/intents/timers reconstructibles, état Redis ou mode perte totale. Pas de sauvegarde durable d’originaux ajoutée.

Un tuple de points est valide seulement si tous les liens causaux sont reconstruits ou restent fermés avec écarts explicites. Une révocation post-cut s’applique depuis journal actuel ; elle ne doit pas être supprimée pour rendre les timestamps alignés. Une intention avant cut dont résultat fournisseur est après cut demeure inconnue à réconcilier ; jamais « non envoyé ». Source messagerie retrouvée ne reconstruit ni validation humaine ni mandat/révocation ni fait téléphonique.

Pour le watermark récupérable, joindre liste des opérations acquittées après celui-ci : récupérables, perdues explicitement ou inconnues. RPO = incident − dernier cut vérifié récupérable ; RTO inclut détection, mobilisation, fencing egress, génération/journal, restore, réconciliation, contrôles et accord de réouverture. Les branches ne sont parallèles que si leurs dépendances sont prouvées.

## Décision attendue et verdict

Choisir A ou B et J1 ou J2, préciser le sens du stop et les stores/privilèges/coûts, puis demander une qualification bornée avec reviewer indépendant. Le mandat documentaire permet préparation/revue immédiates. Aucun PASS n’est acquis : absence de transaction PG+SMTP, fences ignorés par fournisseur, pause de processus, perte des locks, perte du journal et bornes RTO sont explicitement non démontrés. Les suites production restent futures.

Sources : [ADR-006](../adr/006-effets-idempotence-fencing.md), [D58/D59](ARCHITECTURE_DECISIONS.md#d58), [Q2 historique](ARCHITECTURE_Q2_B02_B04.md), [Q5 historique](ARCHITECTURE_Q5_B03_B08_B10.md), [remediation](ARCHITECTURE_REMEDIATION.md). Propositions A/B/J1/J2 non adoptées, aucune modification de stack ou sens du stop acquise.
