# Research — #71 / S01 T05 Invitations propriétaire et création durable

## Statut et mandat

`RESEARCH: PASS` — 2026-10-14, entrée EXISTING, mode LARGE, après
[revue indépendante](research-review.md).
Mandat courant : créer le ticket, traiter tous les écarts dans Research → Design
→ Plan, faire revoir ces artefacts, fournir le prompt de l’implementer puis arrêter.
Aucune implémentation, installation ou mise en service dans cette mission.
Les anciens livrables S01 restent des sources ; aucun gate produit n’est recréé.

## Objectif et cadrage

Ticket [#71](https://github.com/issa-diallo/dossiercle/issues/71).
Reprendre la tranche T05 du [Plan S01](../S01/plan.md#t05--invitations-propriétaire-et-création-durable)
sur le code fusionné, puis définir une préparation exploitable avant Execute.
Les AC du ticket couvrent propriétaire fort, preuve humaine minimale, préparation
IdP réconciliable, issue/revoke/claim, création atomique et idempotence, isolation
et API stricte. T06 provisioning, T07 ACTIVE, T08 UI, facturation et intégrations
IA/mail restent hors périmètre. Agence initiale **PROVISIONING**, membership ADMIN
et opération **PENDING** ; T05 ne crée aucune base agence ni droit métier.

Entrée EXISTING justifiée : tranche cadrée d’une story déjà préparée, socle réel
T00–T04 désormais fusionné, sans nouveau produit ni changement de stack.
PRD/Stories/Story Review/Architecture/Design System sont disponibles ; leurs PASS
documentaires historiques ne deviennent pas une preuve runtime T05.

## Révision et isolation

- Base `main@71c4536981aa61656b3b7ad0df42ed9c14facd00`, vérifiée sur GitHub.
- Cette base contient #68, squash `62cfda3a30bbf1d1706ecbf73456bffab2e56907`.
- Git fetch puis `git merge-base --is-ancestor 62cfda3… origin/main` : exit 0.
- Branche `feat/71-s01-t05`, worktree `worktrees/71-s01-t05`.
- Un écrivain : orchestrateur /root, uniquement artefacts de préparation.
- Exploration indépendante /root/t05_research_code : lecture seule du code,
  des migrations et des tests ; synthèse intégrée ci-dessous.
- Isolation Git créée pour protéger la préparation. Le gate Worktree Setup
  applicatif reste **non exécuté** ; aucun service, `.local`, secret ou port créé.
- Ancien worktree T04 et ses ressources conservés.

## Sources et contradictions

Ordre README, METHOD, WORKFLOW, COMMITS, documents produit, ADR, ticket, artefacts.
Lectures : index, SCALING, SAFETY, EXISTING_PROJECT, CONTEXT, MODELS, rôles,
templates Research/Design/Plan, DEVELOPMENT et PULL_REQUESTS ; Story S01,
Research/Design/Plan S01 et revues ; registre D04/D05/D40/D54/D57/D73–D82,
ARCHITECTURE_OTP, ADR002/004/023/024/025/029 et Design System.
Le skill secure-web-dev cadre les frontières d’accès ; feature-design-assistant
structure la préparation, sans rouvrir les choix acquis ni répéter des approvals.

Les bandeaux STATUS/STORIES et les rapports Ship T04 sont des checkpoints avant
fusion. Le fait GitHub et l’attestation indépendante rétrospective de la session
confirment la fusion et la réussite CI de la tête T04 `bfb62c6`, mais ne prouvent
pas un Lead Tech final antérieur à cette fusion. Aucun PASS de séquencement ajouté.
Le Design S01 dit historiquement « endpoints à créer » : les DTO/OpenAPI existent
maintenant, les endpoints métier T05 sont effectivement absents.

## Socle observé

| Zone | Fait sourcé | Conséquence T05 |
|---|---|---|
| Stack | `package.json`, `apps/api/package.json` : Node24/pnpm12, Nest12/Express5, TS6 ; PG17/Drizzle dans adapters | Pins/lock conservés, aucun nouveau fournisseur |
| Contrats | `packages/contracts/src/agency.contracts.ts` : objets stricts, name NFC+trim 1–120 points Unicode, email domaine normalisé, UUID, ETag fort, token43 caractères | Réutiliser ; ne pas accepter rôle/sub/locator client |
| OpenAPI | `packages/contracts/openapi.yaml` contient toutes routes Design ; `apps/api/test/agency.contract.spec.ts` vérifie document et headers | Présence de contrat distincte d’un endpoint réel |
| Tables | `packages/adapters/src/postgres/control.schema.ts`, migrations control0001–0003 | Invitation, agency, authority, session, membership, opération, idem, audit, outbox existants |
| Unicité | `control.agency.invitation_root_id` UNIQUE ; `canonical_name_hash` non unique | Même racine/name : même création ; même racine/autre name :409 ; pas unicité globale du nom/email |
| Autorité | `control.repository.ts:16` : `withLockedAuthority` sur transaction existante, lock réellement tenu, comparaison J1 | Barrière jusqu’au commit/fin de lecture ; guard seul insuffisant |
| Session | `apps/api/src/auth/auth.service.ts:42` : withSession/withClaimSession, Origin/CSRF, preuve native, refresh humain, epochs | Principal sujet/racine doit rester serveur, replay après autorisation courante |
| Verrous | `auth.service.ts:58` : invitation FOR SHARE puis autorité exclusive, puis session et projection agence | Mutation invitation exige voie exclusive dès le début ; éviter promotion tardive/deadlock |
| Identité | `keycloak-adapter.ts:121` : username UUID exact, import id réservé, readback subject/contact/root | Réutiliser pour réconciliation succès incertain sans second compte |
| Enrôlement | `enrollment-coordinator.ts:28` : admit consomme receipt durable par racine/version ; confirm délivre BFF fort | Admission pré-MFA différente du claim métier T05 |
| Audit | `audit-writer.ts` : rôle INSERT dédié dans transaction caller, eventId audit/outbox commun | Acquittement 202 après commit, aucune écriture indépendante d’audit postérieure |
| Dispatcher | `outbox-dispatcher.ts`, son test | Duplications Inngest admises ; T05 ne lance pas provisioner ni effets T06 |
| API effective | `apps/api/src/main.ts`, `app.module.ts`, `identity/coordinator.server.ts:57` | AuthModule seul ; bodyParser:false ; middleware réserve les routes auth puis proxy natif |
| Erreurs | `coordinator.server.ts:58` : filter limité401/403/503 | Ajouter codes sûrs400/404/409/429 pour T05 sans transformer erreurs natives |
| Environnement | `scripts/worktree-setup.sh:49–50`, workflow `s01-t04.yml` | Nom/branche T04 imposés ; adaptation nécessaire au ticket71 avant Setup |

## Écarts identifiés et décisions à préciser en Design

1. **Preuves owner absentes** : `identityConfirmationRef` n’existe que dans DTO,
   OpenAPI et test. Invitation possède `recovery_channel_ref text` nullable,
   sans stockage confirmation. Définir registre privé minimal, permissions,
   liaison owner/contact/sujet/racine et procédure humaine/fixture explicite.
   Ne pas inventer table existante ni modifier silencieusement migration0001.
2. **Orchestration owner→invité** : owner et invité sont deux autorités différentes.
   Définir ordre des transactions/verrous, PENDING indépendant avant import et
   réconciliation après timeout. `createUser` existe ; un409 natif est actuellement
   une erreur dépendance, pas un succès réconcilié automatique.
3. **Droits SQL séparés** : `migrate.ts:77` accorde mutations agence/invitation à
   control_api, sans UPDATE account_authority ; `:108` donne au coordinator les
   mutations identity et seulement UPDATE(identity_status) invitation.
   Définir une capacité/procédure étroite ou une séparation de composants ;
   ni rôle migrator dans API, ni credentials administratifs diffusés au client.
4. **Claim** : withClaimSession prend FOR SHARE. Définir verrou exclusif invitation
   avant autorité pour deux claims concurrents. Le risque est déduit du code,
   pas une panne runtime observée.
5. **Secret après callback** : `/enrollment/start` supprime le fragment et le
   callback efface le cookie grant. Le token raw n’est plus disponible au frontend.
   Définir continuité via receipt serveur liée au sujet/racine/session, sans GET
   secret, localStorage, réémission implicite ni confusion admission/claim.
6. **Révocation/réémission** : `ControlRepository.deny` ne modifie pas invitation.
   `private-control-fixture.ts` ne remplace pas un service T05 ; elle est explicitement
   synthétique et utilise une capacité migration privée aux tests.
7. **API** : modules platform/agencies et domaine lifecycle absents ; wiring,
   parseur JSON32Kio, validations headers/versions, rate-limit et traduction
   erreurs à ajouter sans ouvrir chemins natifs alternatifs.
8. **Worktree** : accepter branche/nom dédiés tout en maintenant identité racine,
   namespace Compose, owner nonroot, secrets0400/RO et origineTLS isolée.

Ces points sont des travaux de Design/Plan, pas des décisions d’Architecture
invalidées. Aucune contradiction de fournisseur ou de frontière majeure trouvée.
Research peut passer après revue ; DoR Execute exige leur résolution documentée.

## Flux courant et flux attendu

Actuel : fixture privée SQL/import → invitation ISSUED → admission grant
pré-MFA → UI native → Code/PKCE + confirmation PI/Keycloak → BFF fort limité.
Les fixtures ne prouvent pas invitation propriétaire ni création durable T05.

Attendu : confirmation humaine privée → owner fort réserve invitation et commande
PENDING → import IdP réconcilié → issue unique → enrôlement T04 → claim sujet fort
→ transaction centrale création PROVISIONING/membership PENDING/opération ACCEPTED
+ audit/outbox/idem →202 après commit → GET propre pour reprise.

## Sécurité, données et dépendances

- Auth : Keycloak/PI natifs et BFF opaque T04, aucun password/TOTP maison.
- Autorisation : ownerSubject configuré serveur et scope platform fort ; invité
  avec racine liée/session forte ; une simple vue Session n’est pas une capacité.
- Isolation : projection centrale uniquement ; aucun locator/DSN/base/role fourni
  par client, aucune base agence créée et aucun accès métier T05.
- Données : contact invité minimisé, owner identifié par sujet opaque ; preuve privée non publique ; aucune
  pièce d’identité, corps IdP, secret, URL d’action ou token dans audit/log/idem/GET.
- Actions externes : IdP/PI synthétiques privés existants uniquement, aucun mail
  ou cloud métier ; PENDING durable précède effet sensible, résultat incertain fermé.
- Validation humaine : confirmation contact/canal privée obligatoire avant issue ;
  le test marque explicitement toute fixture, jamais vérification humaine supposée.
- Observabilité : codes stables, corrélation UUID, audits minimaux, versions/étapes ;
  erreurs natives et SQL restent privées, aucune trace DOM ou URL secrète publiée.
- Rollback : conserver DB/J1/clés ; revert code n’annule pas deny/epochs. Perte ou
  divergence d’une preuve/J1 ferme l’action, jamais auto-restauration CONFIRMED.
- Dépendances : #67/#68 fusionnés ; T06 dépend T05 ; T07 dépend T06 + V3. B05/B06
  non requis pour espace vide, toujours désactivés ; N3 commercial reste ultérieur.

## Tests disponibles et preuves à produire

Inspection seulement : tests contracts Zod/OpenAPI, schema.integration,
authority-journal.integration, enrollment-coordinator.integration,
native-identity/native-enrollment.integration, auth.integration,
outbox.integration et tests/auth/s01-auth.spec.ts. Ils distinguent PostgreSQL
réel avec frontière native simulée des scénarios natifs navigateur TLS.
Vitest unit/contracts/integration et scripts build/auth existants identifiés.

Plan doit prévoir V1 lifecycle/canonicalisation ; V2 concurrency claim/création,
idem/version/TTL/revoke, perte de réponse, audit rollback, timeout/doublon import ;
V4 vrais endpoints/headers/corps/statuts/erreurs/isolement ; non-régression T04.
Ajouter contrôle environnement branche/worktree avec refus avant mutation.
Les critères complets S01 et runtime T05 restent non démontrés dans cette mission.

## Recherche ciblée et limites

Exploration de `apps/api`, `packages/contracts/domain/adapters/testing`, `scripts`,
`infra/local`, `tests/auth`, `.github`, avec rg --files/rg -n puis lectures ciblées.
AGENTS racine seul dans le worktree ; aucun AGENTS imbriqué détecté par la recherche
sans node_modules/.local/worktrees. Deux recherches initiales ont visé des noms
supposés absents (`contracts/`, `tests/e2e`, `identity.integration.spec.ts`) : exit2,
puis portée corrigée vers packages/contracts, tests/auth et native-identity.
Leur sortie tronquée/absence seule n’a servi à aucun verdict.
Sources locales datées du 2026-10-14 ; aucun besoin de documentation fournisseur
nouvelle pour ces constats. Aucun fichier privé lu, aucun service ni test runtime lancé.
Coût/quota et configuration précise du modèle hérité non observables.

## Research Gate

- [x] Code fusionné et contrats inspectés ; base explicitement identifiée.
- [x] Dépendances, fichiers, droits SQL et points d’intégration identifiés.
- [x] Risques, secrets, actions externes, preuves futures et rollback documentés.
- [x] Aucun blocker Architecture indispensable trouvé ; gaps cadrés pour Design.
- [x] Revue indépendante PASS reçue ; précision sur le contact invité intégrée.

Verdict : **PASS** documentaire. Design peut commencer ; aucun runtime T05 validé.
