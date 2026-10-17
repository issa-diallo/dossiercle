# Review — Plan #74 / S01 T06

## Révision1 — CHANGES_REQUIRED

Reviewer indépendant `/root/t06_reviewer`, 2026-10-16, base b18cd38.
Ticket/Research/Design/Plan confrontés au code. Lecture seule, aucun test/service/
installation/.local/secret/publication. Configuration héritée, modèle/niveau/coût
précis non observables ; auteur distinct. Critical0/Major2.

### P1 Major — ancien runtime non fermé par le fingerprint

Plan initial promettait ancien runtime refusant0004 ; code réel ControlRepository/
AuthService ne vérifie pas de modèle compilé et assertSchema compare seulement
empreinte SQL stockée/réelle. Ancien runtime peut rester actif sans admission100.
Correction : protocole arrêt/drain/absence des anciens process avant migration,
ingress fermé, nouveau build identifié et check startup, aucun mode mixte ; distinguer
ancien migrateur checksum-inconnu de l’ancien runtime sans cette protection.
Rollback sans relance automatique de l’ancien code sur0004. Design et tests à corriger.

### P2 Major — réveil durable de reprise insuffisamment défini

Nouveau réveil sans type/stockage UNIQUE concret et consommateur Design n’acceptant
que creation-accepted ; outbox impose déjà UNIQUE(type,resource_id,version).
Correction : type/version/payload serveur précis, relation durable op/version/
tentative, unicité, audit/outbox, grants reconciler et handler ; tests deux scans,
ancien callback et nouvelle livraison après déduplication moteur.

### Couverture et limites

Autres points couverts :0a avant setup74, SQL immuables, D1/D2, locks/admission/J1/
fencing, tests réels par AC, fixtures exhaustives disjointes,13 scénarios natifs,
CI de tête/review/Lead Tech, READY sans ACTIVE et D57. Pas de preuve runtime prématurée
exigée. Corrections P1/P2 consignées dans Design/Plan ; relecture indépendante attendue.

## Révision2 — PASS, Design également revalidé

Retour indépendant `/root/t06_reviewer`, 2026-10-16 : **PASS**, aucun Critical/Major
ouvert. Relecture des corrections dans Design ET Plan et de leurs impacts globaux.

- P1 clos : protocole hors ligne avec absence vérifiée des anciens processus,
  ingress fermé et nouveau build contrôlé ; refus ancien migrateur distingué de
  l’ancien runtime ; rollback sans relance aveugle.
- P2 clos : table wakeup, compteur/générations, contraintes UNIQUE, événement
  agency.provisioning-wakeup et ses validations jusqu’au handler ; réservation
  atomique/SECURITY DEFINER bornée, ordre sans inversion FK, rounds/tentatives
  bornés et commande conservée au backlog.
- Admission avant J1, gate global, capacités/mounts, fixtures et READY/ACTIVE
  restent cohérents ; tests futurs identifiés par AC.

Avis documentaire et statique, aucun runtime/test/service/.local/secret exécuté
ou lu. **Research → Design → Plan peuvent être transmis PASS à l’implementer** ;
Setup/Execute/Verify/Review code/CI/Ship restent des phases futures.

## Transmission finale — PASS

Dernière lecture indépendante `/root/t06_reviewer` de implementation-prompt, handoff,
goal, contrôles et bandeau STATUS/ticket : **PASS**, aucune correction bloquante
ni instruction dangereuse. Étape0a revue avant setup, conservation des artefacts/
ressources, frontière READY, Verify/Review/CI/Lead Tech et fusion humaine cohérents.
Goal SATISFIED et état PLANNED limités à la préparation ; aucun gate runtime ou
S01 DONE déclaré acquis. Aucun test/service/modification/publication par reviewer.
