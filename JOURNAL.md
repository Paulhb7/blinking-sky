# Journal — outil SPHEREx (Space Apps 2026)

Ce journal sépare ce qui existait avant le hackathon de ce qui a été fait pendant les 48 h.

## Travail antérieur (à déclarer)

- **Project Atlas** (`~/Desktop/h/holo-mars`) : la carte, la vue « Night sky », le filtre SPHEREx limité à l'étoile de Barnard (deux images, 6 novembre), la page `/spherex`.
- **Cadre du deck** (`presentation.tsx`, `presentation.css`) : écrit pour un pitch interne antérieur, repris tel quel.
- **Recherche de naines froides** (`~/Desktop/h/h-astronomists/spherex/H3_cold_dwarfs`) : méthode, mesures par image, ajustements de gabarits, vérification bibliographique. Commencée le soir du 13 novembre, terminée le matin du 14. Ce travail est donc antérieur au début officiel du hackathon et déclaré comme tel.
- **Maquette de cadrage** (artifact) : aucune ligne n'en est reprise dans le code.

## Samedi 14 novembre

- Branche `spaceapps/spherex-observatory` dans holo-mars, créée depuis `codex/oort-cloud-spherex`. Rien n'est commité ni poussé.
- `build_catalog.py` : met en forme les résultats H3 pour l'application (`public/data/spherex/cold-dwarfs.json`, images profondes dans `deep/`). Aucun accès réseau.
- `stack_images.py` : empile de vraies images SPHEREx par saison et par couleur pour chaque cible (`stacks.json`, `stacks/*.png`). Lecture par plages d'octets sur le bucket public, sans compte ni calcul payant. Volume lu : voir `../data_budget.txt`.
- Moteur : `sky-observations.js` gère plusieurs champs, des marqueurs cliquables sur le ciel, une échelle et le carré d'un pixel natif.
- Interface : liste des cibles dans le panneau « Sky filter », panneau de droite (images par date et par couleur, indice méthane, spectre mesuré, statut de publication, images profondes, fiche candidate imprimable).
- Présentation : `spherex-deck.tsx`, 13 slides, ouverte par la touche P ou `?present`. La vue SPHEREx tourne derrière les slides.
- Tests ajoutés dans `scripts/test-sky-observations.mjs`.
- Fond de ciel propre à la vue SPHEREx : les vraies étoiles brillantes du catalogue HYG (magnitude 8,5), une grille équatoriale, le contour de l'image. Il remplace le rendu du planétarium tant que le filtre est actif. La vue suivie se met nord en haut.
- Deck renommé « Blinking Sky », 14 slides, ouverture sur Backyard Worlds. Les slides de l'outil montrent des captures de l'interface entière (`public/spaceapps/`), prises dans l'application.

## Samedi 14 novembre, après-midi : outil autonome « Blinking Sky »

Décision de Paul : sortir l'outil d'Atlas. Tout est dans `app/` (Vite, React, three.js en WebGL), écrit pendant le week-end.

- `app/src/spherex/core.js` : lecture des images SPHEREx dans le navigateur par plages d'octets sur le bucket public, conversion ciel-pixel (TAN-SIP), table des longueurs d'onde, empilement, photométrie rapide, indice méthane. Validé contre les mesures Python : position au millionième de pixel, longueur d'onde exacte, indice de 2MASS 0415 0,025 ± 0,003 (référence 0,033 ± 0,007), de J2359 0,039 ± 0,038 (référence 0,033 ± 0,054). Script : `app/validate.mjs`.
- `build_index_tiles.py` : l'index des 1,6 million d'images (repris du volume Modal, lecture seule) découpé en 4 584 tuiles binaires, 58 Mo. Une page trouve les images de n'importe quelle position.
- `build_queue.py` : file de revue de 382 sources CatWISE rouges à mouvement marginal, jamais mesurées dans SPHEREx.
- `app/src/sky/` : ciel en three.js (58 719 vraies étoiles HYG, grille, lueur de Voie lactée illustrative, image posée sur la sphère), portrait 3D de l'objet dessiné d'après le type ajusté et l'indice méthane.
- `app/src/live.ts`, `App.tsx`, `Panel.tsx` : empilement en direct (environ 170 images, 50 Mo, 50 secondes), vote, fiche.

## Non fait

- Recherche à une position quelconque (l'outil montre des champs préparés).
- Vue 3D de l'objet pilotée par les données (prévue dans la maquette).
- Recherche ADS automatique ; calque DECam sur le ciel (les images profondes sont dans le panneau).
- 14 nov. (pendant les 48 h) : vue Système solaire. `build_solar.py` liste 7 083 astéroïdes et comètes ayant un passage SPHEREx (listes d'images issues du travail antérieur H1, déclaré comme tel) ; la carte place le Soleil, la Terre, les planètes et ces corps ; au clic, les 6 poses du passage sont lues en direct depuis l'archive (`startMover`).
- Changement dans le temps renforcé : image de différence (dernière date moins première) pour tout champ à plusieurs dates, luminosité mesurée date par date pour les champs lus en direct, et groupe « Stars that changed brightness » avec deux jeunes étoiles dont la variation avait été mesurée avant l'événement (pilote sur les variables) ; l'outil la remesure en direct : ×4,4 (Vela) et ×2,3 (Croix du Sud) à 3,8–5 µm.
- Illustrations 3D refaites : astéroïdes en roche bosselée (forme inventée, étiquetée comme telle), comètes avec halo, naines brunes avec ceintures nuageuses. Nouveau logo original (un œil dont la pupille est une étoile), sans élément de la NASA. Vidéo de démonstration remontée avec ces nouveautés.
