# Research — mise à jour du socle agentique #65

**PASS.** Entrée EXISTING : maintenance de la méthode déjà installée, sans nouveau
produit ni story applicative. Mode STANDARD : règles transverses et checker,
revue indépendante puis Lead Tech distincts. Architecture et Design System sont
hors périmètre de ce ticket ; leurs gates ne sont pas changés.

Source : agentic-dev-system main, commit
`fcdc55faecfc5a7f1b08c1e55b524cf3d0d609b8`, guide `docs/agentic/INSTALL.md`.
Cible : DossierClé main `c004fc0a89bee50ecdc99bcf30bcf1f2bff8d244`.
La PR Architecture #64 n’est pas fusionnée ; ne pas toucher à son worktree.

Comparaison : navigation/rôles/templates et checker anciens ; absence de
DEVELOPMENT, PULL_REQUESTS, MODELS, OPTIONAL_TOOLS, EXISTING_PROJECT et LOCAL.
COMMITS diffère uniquement par le contrat de commit logique final.
AGENTS existant est le socle précédent sans personnalisation métier ; conserver
explicitement ordre de sources, Unicode Gitmoji et autorisation humaine de fusion.
README reste produit, STATUS et docs/product/ADR/work historiques restent intacts.

INSTALL impose comparaison/sauvegarde puis report manuel ; FORCE interdit.
Source STATUS/work non distribués ; aucun template ne remplace un livrable produit.
Risques : dilution des règles projet, faux PASS et perte de preuves. Contrôles :
hashes de préservation, manifeste comparatif, liens, checker/syntaxe et revues.
Auth/données/tenants : aucune application exécutée, aucun secret manipulé ; seules
règles de travail changent. Actions externes limitées ticket/branche/PR autorisés.
