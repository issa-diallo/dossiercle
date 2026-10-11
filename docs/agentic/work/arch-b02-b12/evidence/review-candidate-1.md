# Revue indépendante ARCH-B02-B12 — candidat gelé 1

Date : 2026-10-11. Verdict : **BLOCKED** documentaire. **0 Critical, 3 Major, 5 Minor**. Architecture reste BLOCKED indépendamment de ce verdict ; aucune installation/dépense/infra ni mutation du worktree par reviewer.

Candidat : `/home/issa/Workspace/perso/worktrees/arch-b02-b12-architecture`, base 54967be6ff915822779230bae01ca5eec615f972, 32 fichiers. Empreinte reçue et fichiers revérifiés : `577e372cbb8d960a05e1c0c3fb3fcdfd90f368fc220561128ddc88860bc4500b`, aucun mismatch par rapport à `/tmp/dossiercle-arch-candidate.json`.

Indépendance : reviewer non writer du worktree ; a fourni antérieurement exploration et fiche POC en /tmp. Cette contribution POC a été relue séparément par reviewer infra, rapport `/tmp/dossiercle-arch-cross-review.md`, intégré ici. Aucun verdict indépendant issu du seul auteur de cette fiche.

## Findings à corriger

### FR01 — Major : l’export courant exige encore un conteneur EML

`docs/product/ARCHITECTURE.md:214`. La matrice actuelle des effets demande le scan de chaque fichier « et conteneur EML ». D63, ADR014 et Architecture §export excluent explicitement toute exportation EML/original, même encodée. Cette ligne actuelle n’est pas un journal historique couvert par supersession ; elle dirige encore la conception d’export vers un format interdit.

Correction : appliquer un contrôle de sécurité aux seuls fichiers dérivés CSV/JSON et à l’archive export autorisée ; retirer EML de cette précondition sans retirer les contrôles sécurité.

### FR02 — Major : la matrice réouvre un arbitrage horaire déjà validé

`docs/product/ARCHITECTURE.md:213`. « exception horaire des rapports non décidée tant que B09 ouvert » oppose le tableau courant à D67/#42 : créneaux dans les horaires d’action, configuration incompatible refusée et legacy empêchée. B09 pending humain/qualification ne rend pas à nouveau cette décision produit ouverte.

Correction : citer D66/D67/ADR016, aucun rapport pendant fermeture et slots dans horaires d’action ; réserver le pending à qualification/gate, sans exception horaire implicite. Ajuster aussi le cas de preuve voisin « rapport sans règle fermetures approuvée » vers preuve de règle acquise correctement appliquée.

### FR03 — Major : la poursuite de phases POC peut contourner un arrêt obligatoire

`docs/product/ARCHITECTURE_POC_PROPOSAL.md:47`. Après échec, la fiche permet d’explorer phases indépendantes sans distinguer échec fonctionnel, dépassement budget/quota et incident sécurité. Q4 et la section Arrêts imposent arrêt immédiat au contournement MFA/fuite/egress/plafond. Le découpage ne peut autoriser un nouveau download/process après cet arrêt.

Correction : toute condition d’arrêt sécurité, réseau, dépense ou plafond met fin à l’essai et déclenche nettoyage/rapport. Phases indépendantes ne reprennent qu’après correction et nouvelle autorisation si nécessaire, dans bornes globales restantes ; aucun reset implicite de budget. Finding confirmé indépendamment CR01 infra.

### FR04 — Minor : référence re-MFA ambiguë dans nouvel ADR

`docs/adr/014-originaux-temporaires-export-derive.md:41`. « droits/résiliation/re-MFA de D42/D44 maintenus » peut être lu comme maintien d’une obligation de re-MFA. D44 refuse expressément la re-MFA spécifique export et D63 le conserve correctement.

Correction : écrire « droits, fenêtre de résiliation, archive 24 h et refus de re-MFA spécifique export maintenus ».

### FR05 — Minor : réautorisation du destinataire pas explicitement reprise

`docs/product/ARCHITECTURE_DECISIONS.md:458` (D67), et passages dérivés ADR016/PRD/S25. #42 précise « nouveau destinataire ou destinataire réautorisé ... via nouveau binding ». Les textes courants disent nouveau binding mais ne rappellent pas explicitement que réautoriser crée ce binding, sans ancien curseur.

Correction minimale : expliciter nouveau ou réautorisé dans D67/ADR016 et critère S25, sans nouveau produit ni réouverture D3.

### FR06 — Minor : ADR005 prescrit corps brut sans qualifier le protocole SDK

`docs/adr/005-inngest-scaleway-conditionnel.md:73`. L’injonction « authentifier chaque callback sur corps brut » ne reçoit pas de pointeur d’autorité actuelle, tandis que Architecture:440 et remediation imposent la canonicalisation/méthodes du SDK exact épinglé. Le corps brut ne peut être présumé contrat universel GET/POST/PUT. Une source SDK actuelle expose des handlers JSON et une validation propre ; ceci ne prouve pas l’algorithme de la version candidate sans lecture du tag exact.

Correction : addendum technique SDK exact et protocole documenté/testé par méthode, ou reformuler l’injonction courante ; ne pas retirer signature ni anti-rejeu. Finding CR02 infra repris.

### FR07 — Minor : lisibilité des ajouts et formulation de protections auth

Espaces manquants nouveaux : `ARCHITECTURE_POC_PROPOSAL.md:31` (« coverage-v85.0.3 », paquets/versions fusionnés), `STORIES.md:118,618` (« Archive24 h », « normalement8h45 », « à16h00 »), handoff50:98 (« dansPR », « sansPASS »), autres ajouts proches. Les noms exacts et versions deviennent ambigus.

Correction : passe limitée aux ajouts ; matrice paquet/version sous table ou lignes lisibles. Clarifier le critère password correct/incorrect sans différence d’énumération (comptes existants/inexistants), et que la régénération secours invalide tous anciens codes atomiquement et impose session fraîche+TOTP courant (CR03 infra). Pas réécriture corpus historique.

### FR08 — Minor : distinguer rapport généré et mail original archivé

`docs/product/PRD.md:422,954`, et S27. « Rapport conservé dans historique/archivé » reste un besoin acquis, mais le mail envoyé intégral ne doit pas devenir une archive EML cachée sous D62. Le principe global borne déjà la conservation ; une précision locale évite la confusion en Design.

Correction : conserver l’artefact de synthèse généré, sa révision et son hash, avec état/provenance de livraison, sans archive du message SMTP/EML transporté ni des originaux reçus. Ne pas supprimer le rapport généré lui-même nécessaire à S27/reprise identique.

## Points validés de fond

- 32 hashes revérifiés sans divergence ; lecture complète des nouveaux ADR, remediation/protocoles/POC et artefacts ; examen des diffs courants PRD/Stories/Architecture/registre/ADR/status/research/handoff.
- Recalcul indépendant des rubriques dépendances : 37 stories, dépendances identiques à HEAD, DAG acyclique.
- D01–D59 historiques et Q1–Q6/StoryReview/DesignSystem préservés selon contrôles root ; supersessions bornées, D59 limité Cloud SQL PostgreSQL 17 Enterprise HA Paris/PITR/TLS, sans adoption PG technique Inngest, SKU, prix ou preuve opérationnelle.
- D60–D68 transposent décisions acquises sans présenter propositions SLO/rétention/quotas/runtime/licence/POC comme décisions. B11 review puis gate humain séparés, B09 clôture locale proposée, Architecture BLOCKED et37 stories BACKLOG.
- Minimisation temporaire/AV, originaux source messagerie, provenance descriptive sans URL/deep link, export dérivé seul et retrait client/OTP correspondent #33. Reprise strictement périodée sans défaut/hors-période/suggestion d’élargissement, confirmation in-app sans mandat ni rétroactivité préservées.
- Sources primaires relues : commentaire humain #42 confirme D1/D2/D3 incluant réautorisation ; commentaire #33 confirme 63 tests/revue et aucune clôture automatique ; #50/#51 fusionnés, revue narrative reconnue malgré reviews[] sans attribution native GitHub. Log parent double 63/63 sous Python 3.12.3 distinct du journal Python 3.14.7 historique. Mémoire/RLock/faux transport ne sont jamais vendus comme crash/processus/PG/HA/PRA.
- Infrastructure A/B/J1/J2 reste PROPOSED ; fenêtre admission/réseau, ancien worker après perte lock, fencing egress réel, absence exactly-once SMTP et cohérence causale/révocations hors rollback traités honnêtement. Aucune topo/réseau/IAM/coût adopté silencieusement.
- Q4 gate intégral présent : OTel/Inngest/k6/SBOM/OpenAPI/rollback conservés ; budgets 2 h/2 Go non garantis et phases 6 h/8 h non adoptées ; distribution Chromium/bases scanners séparément à approuver et runtime sans Internet.
- Node 22.23.1 satisfait engines Vitest 5.0.3 `^22.12.0 || ^24.0.0 || >=26.0.0`, mais pas contrat Q4 Node `>=24.21.0 <25` : pas correction technique nécessaire, seulement lisibilité de Vitest 5.
- Sources publiques ciblées reconsultées au 11/10 : prix Mistral Small 4/OCR 4.1 concordants, options Cloud SQL privées/publiques concordantes. Aucun tarif ou catalogue transformé en contrat/benchmark.

## Risques et suite

Ces findings concernent la cohérence documentaire ; aucune vulnérabilité produit exécuté ni faux test n’a été constaté. Corriger FR01–FR03, traiter minors et geler une nouvelle empreinte, puis refaire revue ciblée des deltas/identité. Ne pas déclarer B11/ArchitecturePASS sur la seule correction de ce rapport. Les décisions humaines restantes et preuves B02/B03/B04/B05/B06/B07/B08/B10/B12 sont maintenues.

Sources officielles relues : https://github.com/issa-diallo/dossiercle/issues/42#issuecomment-5966676710 ; https://github.com/issa-diallo/dossiercle/issues/33#issuecomment-5967415396 ; https://docs.mistral.ai/inference/pricing ; https://www.scaleway.com/en/docs/generative-apis/reference-content/data-privacy/ ; https://docs.cloud.google.com/sql/docs/postgres/connection-options ; https://raw.githubusercontent.com/inngest/inngest-js/main/packages/inngest/src/components/InngestCommHandler.ts (source vivante, pas qualification tag candidat).
