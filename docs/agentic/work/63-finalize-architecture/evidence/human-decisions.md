# Décisions humaines — mission de finalisation Architecture

Source : message utilisateur « CODEX — Finaliser Architecture DossierClé »,
reçu le 2026-10-11, issue #63. Résumé de transcription, pas preuve fournisseur.

- Architecture seulement ; aucun code, Design System, installation, POC,
  dépense, cloud, déploiement ou modification production.
- V1 sans client : local/synthétique/minimal ; pas Kubernetes, HA coûteuse,
  astreinte ou SLA. Production : exigences de sécurité/reprise maintenues.
- Scaleway Paris devient l’unique infrastructure ; PG17 managé remplace Cloud
  SQL D59 ; DB métier distincte par agence sur instance mutualisée ; réseau
  privé et PG non public commercial. Mistral externe reste retenu.
- Infra cible 100 €/mois, plafond indicatif 150 €, pas garantie ; dépassement à
  publier avec chiffrage réel. Aucun coffre existant confirmé.
- Inngest conservé auto-hébergé Docker/Compose ; résultats inconnus bloqués
  jusqu’à réconciliation ; idempotence/inbox/outbox/mandats/barrière conservés.
- Journal durable indépendant des révocations/suppressions accepté ; reprise
  intégrité→manuel→autonomie, réouverture par propriétaire ; RPO/RTO chacun<4 h
  à prouver avant commerce, non acquis.
- Gmail→Microsoft365→IMAP/SMTP TLS ; aucun pilote/profil IMAP identifié ; boîte
  manuelle tant que capacités nécessaires non qualifiées.
- Mistral : 5 €/agence/mois et 30 €/plateforme sans client ; suspension nouveaux
  traitements concernés au plafond ; hausse humaine ; BYOK/secours autorisés
  et manuel maintenus ; stateless ZDR avant réel, pas appel/benchmark ici.
- Keycloak conservé, TOTP/secours/session serveur/idle30 min/révocations/R01/
  isolation/audit maintenus ; récupération totale sous propriétaire, protection
  dernier admin ; aucune auth maison. D54 non abrogée par le nouveau message.
- Pièce20000000 octets ; PDF/JPEG/PNG automatiques, autres manuels ; AV/quarantaine ;
  purge originaux après traitement sous 24 h tous états ; métier3 ans après clôture
  hypothèse soumise à validation juridique/contractuelle.
- B09/B11/B12 acquis non rouverts sans motif ; 37 stories/versions/traçabilité
  contrôlées ; pas de preuve runtime présentée comme obtenue.
- Disponibilité interne99,5 %, aucun SLA sans client, propriétaire incidents
  heures ouvrées/support 0 €, aucun prestataire ; cible 24/7 à réévaluer pour commerce.
- N1 conception/capacité documentaire, N2 implémentation/QA, N3 exploitation/
  contrats commerciaux ; aucun report artificiel d’incompatibilité de conception.
- Revue indépendante puis PR documentaire ; aucune nouvelle liste de questions ;
  hypothèses réversibles pour détails non critiques ; arrêter après Architecture.

Les cadences de sauvegarde, choix Secret Manager, méthodes OIDC, candidats
modèles et paramètres techniques détaillés sont des décisions de conception
dans le mandat, pas des valeurs prétendument énoncées par l’utilisateur.
Les coûts/capacités/contrats ne sont pas des validations humaines de preuves.
