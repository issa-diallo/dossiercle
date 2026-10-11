# Revue indépendante — MFA, Inngest et frontière des statuts

Date : 2026-10-11. **Verdict : PASS_WITH_MINOR documentaire dans le périmètre ci-dessous. 0 Critical, 0 Major, 1 Minor rédactionnel.** Ce verdict ne valide aucun choix humain, licence, conformité, runtime, production ou gate Architecture.

## Périmètre et indépendance

Lecture seule du worktree canonique `arch-b02-b12-architecture` : `arbitrage-go-no-go.md`, `benchmark-mfa.md`, `benchmark-infra-licence.md`, ADR018/019, ADR017 pour les limites de déploiement, et D54/D71. Aucun fichier du worktree modifié, aucun POC/runtime/install. Les propositions conservation/IA issues de ma propre recherche ne sont pas revues ni approuvées par moi dans ce verdict ; elles requièrent l’autre reviewer.

Le writer du corpus est distinct de ce reviewer. Des recherches antérieures sur Better Auth ont contribué au contexte ; leurs assertions ont été recomparées au code exact. Vérification des 29 fichiers du ledger MFA local : tailles et SHA-256 concordants, aucune divergence. Sources publiques exactes Keycloak et licence Inngest relues en complément ; pas d’affirmation fondée seulement sur un slogan produit.

## Finding restant

**RP01 — Minor, lisibilité des ajouts.** Espaces encore absents dans `benchmark-mfa.md` autour de `12 codes aléatoires12 caractères`, `Tag26.8.0`, `alphabet34`, `depuis26.3`, `Ni0 €`, `chiffragecloud`, et `clause13` dans ADR018/résumé. Corriger uniquement la prose nouvelle : « 12 codes aléatoires de 12 caractères », « tag 26.8.0 », « alphabet de 34 symboles », « depuis 26.3 », « ni 0 € », « chiffrage cloud », « clause 13 ». Préférer « Apache 2.0 » pour la licence. La passe de lisibilité root est en cours ; ce point ne change aucun verdict de fond.

## Vérifications satisfaisantes — MFA

- Better Auth reste adopté par D71 ; ADR019 est PROPOSED et indique qu’aucune substitution n’est acquise. Le NO GO vise le plugin natif 1.7.7 examiné à exigence inchangée, pas toute extension possible ou la bibliothèque entière. `viewBackupCodes` est correctement décrit serverOnly, sans lui inventer une route HTTP publique. CAS natif et limites runtime sont préservés.
- Keycloak est proposé conditionnellement, jamais déclaré entièrement conforme. Les modèles stockent réellement des hashes des recovery codes, le provider consomme le prochain code et le credential JPA porte @Version. Le dossier réserve correctement l’effet de transaction/conflit avant émission de session à Verify multi-instance : aucun succès concurrent prouvé par une annotation.
- D54 exige secret TOTP chiffré et clé hors DB. `OTPCredentialModel` sérialise `OTPSecretData` dans `secretData` ; aucune enveloppe applicative native démontrée. Le dossier dit explicitement que volumes/DB/WAL/backups chiffrés ne prouvent pas protection d’un dump SQL ni contre lecture SQL autorisée. Une éventuelle nouvelle interprétation de D54 est un arbitrage explicite, pas une conformité déjà acquise ; aucun provider cryptographique maison adopté.
- Invitation seule, récupération humaine D05, session application opaque, contrôle actuel des droits, idle humain/absolu, absence de tokens navigateur, refus IdP indisponible et risque d’auth offline permissive sont explicites. Les paramètres SSO ne sont pas présentés comme preuve de polling non renouvelant.
- Authentik/Kratos sont exclus sur le stockage/réaffichage natif examiné ; ZITADEL demeure alternative avec réserve source de concurrence et licence. Les conclusions ne deviennent pas exploits runtime prouvés. L’ajout d’un IdP Java persistant, ses coûts et réconciliation avec B04 restent visibles.

Sources exactes indépendamment recomparées : [recovery model Keycloak](https://github.com/keycloak/keycloak/blob/4246609cf2024c85016d3fb1254c3d2533367c31/server-spi/src/main/java/org/keycloak/models/credential/RecoveryAuthnCodesCredentialModel.java), [provider](https://github.com/keycloak/keycloak/blob/4246609cf2024c85016d3fb1254c3d2533367c31/services/src/main/java/org/keycloak/credential/RecoveryAuthnCodesCredentialProvider.java), [credential JPA](https://github.com/keycloak/keycloak/blob/4246609cf2024c85016d3fb1254c3d2533367c31/model/jpa/src/main/java/org/keycloak/models/jpa/entities/CredentialEntity.java), [TOTP model](https://github.com/keycloak/keycloak/blob/4246609cf2024c85016d3fb1254c3d2533367c31/server-spi/src/main/java/org/keycloak/models/credential/OTPCredentialModel.java).

## Vérifications satisfaisantes — Inngest et statuts

- Le benchmark identifie serveur v1.45.1 SSPL v1, concession Apache future au troisième anniversaire du logiciel concerné et régime SDK distinct. Il ne confond pas Apache futur et licence actuelle.
- La clause 13 est résumée avec ses cas plus larges qu’un dashboard public. Le profil moteur métier interne est une analyse de frontière raisonnable, pas un avis juridique d’exemption. Dashboard privé ne suffit pas ; usage commercial exact, obligations de distribution et avis/interprétation avant production demeurent explicites.
- ADR018 conserve le moteur choisi, reste PROPOSED pour la frontière/licence/déploiement, et propose Temporal seulement en cas d’incompatibilité. Ni toute utilisation SaaS interdite ni toute utilisation interne automatiquement autorisée n’est affirmée. Licences des alternatives par dépôt ne valent pas gel de distribution/transitives.
- Instances actif/secours, Redis persistant et backups maîtrisés sont une proposition ; exception tout-serverless explicite. Redis managé seul et multiréplicas ne deviennent pas PRA/HA prouvés. Chemin privé IPsec/BGP, PG sans IP publique et absence d’émetteur WIF natif démontré sont correctement bornés ; cadrage credentials/rotation et coûts restent à décider.
- « GO documentaire »/« GO technique conditionnel » est défini comme conception, sans autorisation production, certification licence ou mesure. D71 demeure acquis ; ADR017–021 restent PROPOSED, Architecture BLOCKED, Design System brouillon, aucun Execute produit ou nouveau POC. Le dossier ne clôt pas implicitement B07/B02 ni une réserve critique.

Source licence relue : [Inngest v1.45.1 LICENSE, clause 13 et future grant](https://github.com/inngest/inngest/blob/v1.45.1/LICENSE.md). Le résumé ne fournit aucune conclusion juridique définitive.

## Suite

Corriger RP01 ; recueillir l’autre revue sur conservation/IA et infrastructure complète. Le propriétaire doit choisir les propositions compatibles et résoudre la frontière TOTP/licence avant adoption finale. Les futures preuves de livraison restent dues dans leurs stories : ce dossier n’exige pas la reprise du POC arrêté et ne les déclare pas accomplies.

## Addendum de clôture — 2026-10-11

Relecture ciblée des corrections RP01 : espaces et formulations corrigés dans benchmark MFA, ADR018 et résumé d’arbitrage, y compris « un alphabet de 34 symboles, avec 12 caractères » et licence Apache 2.0. Le nombre 34 est cohérent avec la source UPPERNUM signalée par l’auteur ; aucun changement du verdict technique de concurrence/TOTP. **RP01 CLOSED. Verdict final : PASS documentaire dans le périmètre MFA/Inngest/statuts, 0 Critical, 0 Major, 0 Minor ouverts.** Le verdict initial ci-dessus reste journal historique. Conservation/IA restent exclues de cette revue et couvertes par l’autre reviewer. Aucune adoption de stack alternative, interprétation juridique définitive, autorisation de runtime ou Architecture PASS n’est donnée. Worktree resté en lecture seule pour ce reviewer.
