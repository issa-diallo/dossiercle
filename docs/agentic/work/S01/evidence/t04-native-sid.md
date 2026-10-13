# Correction SID native — 2026-10-12

Preuve réelle : callback Code signé vérifie acr2, sujet/issuer et présence de la
session native ; la confirmation locale refuse CONFIRM_SID_FORMAT. Readback KC
privé des sessions récentes : longueur24, alphabet base64url sans padding, UUID
false. Aucun SID/token/code/secret dans les rapports.

Research/Design/Plan imposent UUID pour sujet/racine/resolver, pas pour SID OIDC.
La spécification Back-Channel Logout définit SID comme chaîne opaque par issuer :
https://openid.net/specs/openid-connect-backchannel-1_0.html#OPLogout .
Revue indépendante /root/s01_environment_review : correction minimale conforme.

Validateur partagé natif borné1–128 base64url, spécifique à la version KC26.8
qualifiée ; ce n’est pas une syntaxe OIDC générale. UUID sujet/racine inchangés.
Clé de stockage = dérivation SHA256, domaine s01.native-sid + issuer fixe + SID
exact case sensitive, format UUID pour la table d’idempotence. Même clé pour
bindings, receipts et verrous ; SID brut seulement dans payload chiffré.

Aucune session native BFF n’avait été émise avant cette correction. Les anciennes
fixtures SQL simulant SID UUID utilisent leur clé brute historique ; ce sont des
preuves antérieures non réutilisables comme sessions de production. Elles restent
sur disque, ne sont ni migrées ni effacées ; les contrôles natifs de production
ferment ces fixtures simulées. Nouveaux tests SQL utilisent SID opaque24.
Qualification complète native et matrice V3 toujours requises.
