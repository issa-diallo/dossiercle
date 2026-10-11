# Design — socle agentique #65

**PASS.** Reporter les ressources portables du commit source épinglé, après
lecture du diff. Templates et rôles réutilisables sont synchronisés ; AGENTS reçoit
une section locale de garanties et README une navigation adaptée à DossierClé.
COMMITS conserve le contenu antérieur avec le contrat final de PR ajouté.

Ne pas copier README racine du produit source, STATUS source, artefacts source,
installateur, tests du produit source ou configurations globales/outils optionnels.
Le checker portable est reporté pour PRODUCT/EXISTING ; CI existante le lance.
Les preuves futures de stack/gates relèvent des documents projet conservés.
Aucune UI : Design System hors périmètre, aucun design applicatif.
Rollback : restauration sélective depuis Git base c004fc0, ou revert du commit
unique après livraison. Sauvegarde tar des fichiers préexistants avant édition,
manifest SHA256 versionné ; aucune suppression globale/worktree.
