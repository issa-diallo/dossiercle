# Verify — report du socle agentique #65

**PASS pour les contrôles locaux.** 2026-10-11, worktree dédié,
source fcdc55f, cible base c004fc0. Bash/Python standard, données : fichiers du
dépôt, copie temporaire jetable pour le cas négatif. Aucun modèle exécuté en test.

Commandes réellement exécutées et résultats :

- `bash -n scripts/agentic-check.sh` : PASS.
- `bash scripts/agentic-check.sh` : PASS PRODUCT.
- `bash scripts/agentic-check.sh --existing` : PASS EXISTING.
- Options inconnues et argument supplémentaire : refus attendu, code2.
- Copie temporaire privée sans templateADR : refus attendu, code1 et nom manquant.
- `git diff --check` : PASS.
- Python standard : ressources comparées aux SHA du manifeste source, hors
  personnalisations AGENTS/README documentées ; liens locaux du socle existants.
- Comparaison Git contre c004fc0 : **175 fichiers protégés inchangés**, dont
  docs/product, ADR, STATUS, anciens work, hooks et configurations GitHub.

[Manifeste](migration.json) : hash source, avant report et sauvegarde tar.
Le rollback Git base est durable même si le fichier tar temporaire disparaît.
Checker : contrôle de présence, aucune preuve de gate ni d’obéissance des agents.
La CI et l’examen Lead Tech portent ensuite sur la tête livrée de la PR, sans
présumer leurs résultats avant observation. Aucun build/app/POC/cloud testé.

Critères locaux satisfaits : version source traçable ; socle reporté ; garanties
projet préservées ; preuves/statuts conservés ; aucun outil optionnel installé.
