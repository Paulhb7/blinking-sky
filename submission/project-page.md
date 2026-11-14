# Space Apps project page — texts to paste

Team: Apollo XXI · Challenge: Planet X and SPHEREx
Text in [brackets] is for the authors to fill in. Every link must be tested in a private browser window before submitting.

---

## Project Name

Blinking Sky

---

## Summary (limit 1,500 characters; 50–200 words suggested)

Blinking Sky is a public web tool that shows real images from NASA's SPHEREx mission and lets anyone see how a patch of sky changes. Pick a position and the tool blinks it across dates, six months apart, and across colours. What moves between two dates is nearby; what is bright at 4 µm and almost gone at 3.3 µm is a cold atmosphere with methane.

The images are read live from NASA's public archive, directly in the visitor's browser: no account, no download, no server of our own. A 3D map places every object at its real distance, from asteroids that move in hours to brown dwarfs that move in years.

It answers the challenge by making SPHEREx images easy to compare over time, and it shows why that matters: by crossing WISE, which says where to look, with SPHEREx, which says what the object is, we list 12 cold brown dwarf candidates for which we found no publication. They are candidates, not confirmed objects. A queue of 382 more sources is open for anyone to review.

---

## Project Demonstration (link)

[public link to the 30-second video, or to the 7-slide deck]

## Project (link)

[public address of the tool]

---

## Project Details

**What it does**

Blinking Sky has three parts.

1. A blink viewer. For any position, the SPHEREx exposures are grouped by pass (about six months apart) and stacked on one fixed, north-up grid. The visitor blinks between dates to see motion, and between two colours (3.83–5.0 µm and the methane band at 3.15–3.50 µm) to see what the object is made of.
2. A map with real distances. The Milky Way with the Sun at the origin: 15,739 ultracool dwarfs already typed by SPHEREx, 43,463 galaxies at their redshift distance, and the Solar System with the Sun, the Earth, the planets and 7,083 asteroids and comets placed where they were on the day SPHEREx saw them. Clicking an asteroid reads the single exposures of its visit: the stars stay, the body moves.
3. A review queue. 382 red, moving WISE sources that nobody has examined in SPHEREx. The visitor looks at one, votes, and sees the measured methane index. Votes stay in the visitor's browser.

**How it works**

SPHEREx level-2 images are public in a cloud archive that accepts partial requests from a web page. For each exposure the tool asks for three small pieces: the header with the astrometric solution, the wavelength table, and the few image rows that contain the position. That is about 0.3 MB instead of a 65 MB file. An index of the 1.6 million images, cut into small sky tiles, tells the browser which exposures cover a position. Each window has its background removed and is resampled on a common grid; windows are averaged after rejecting single-exposure outliers. Nothing is moved or amplified.

**The science check**

We use one simple test, the methane index: the flux at 3.15–3.50 µm divided by the flux at 3.83–4.20 µm. Below 0.30, with a signal-to-noise ratio of at least 5, we call it a methane dip. On controls, 19 of 21 confirmed cold dwarfs show the dip, and none of 256 negative controls (field stars, red sources with no motion, empty positions) does. Applied to red, moving sources from CatWISE2020, the test leaves 48 sources consistent with a late T or Y dwarf: 3 already typed from a spectrum, found blindly, which checks the method; 33 published candidates for which SPHEREx adds spectral evidence; and 12 with no publication that we could find. All are candidates. None is confirmed by spectroscopy, and some may already be known to other teams.

**Benefits and intended impact**

- Anyone can look at real SPHEREx images within seconds, with nothing to install.
- The blink is the method of the citizen-science project Backyard Worlds: Planet 9, applied to a new mission. A volunteer who knows one will understand the other.
- The review queue turns visitors into reviewers of real, unexamined sources.
- The candidate table gives observers a short list for follow-up spectroscopy.

**Limits we state in the tool**

- The test is reliable to W2 ≈ 15.2 and works about one time in two down to W2 = 16.0.
- It does not work in the Galactic plane, where sources are blended in the 6.15″ SPHEREx pixel.
- The in-browser measurement is a quick look; it is less precise than the reference analysis.
- The round bodies drawn next to the images are illustrations built from the measurements, not pictures.

**Tools**

TypeScript, React, Vite and three.js (WebGL) for the web tool; Python with astropy and numpy for the tables. Hosting is static: the only live data source is NASA's archive.

**What was done before and during the event**

The methane analysis, the index of SPHEREx images and the lists of exposures for Solar System bodies were prepared by one team member in the days before the event. The web tool, its in-browser image reader, the maps, the review queue and the texts were made during the 48 hours. The repository's journal separates the two.

[One or two sentences on the use of AI tools, if the authors choose to state it here as well as in the SI field.]

---

## Use of Super Intelligence (SI)

To select by the authors from the list on the form. The form requires that code written with such tools be acknowledged in descriptive text and metadata.

---

## NASA Data

| Link text | Link URL |
|---|---|
| SPHEREx mission data at NASA/IPAC IRSA | https://irsa.ipac.caltech.edu/Missions/spherex.html |
| SPHEREx public cloud archive (level-2 images) | https://nasa-irsa-spherex.s3.us-east-1.amazonaws.com/ |
| CatWISE2020 catalog (WISE / NEOWISE) at IRSA | https://irsa.ipac.caltech.edu/Missions/catwise.html |
| IRSA Moving Object Search Tool (MOST) | https://irsa.ipac.caltech.edu/applications/MOST/ |
| JPL Horizons | https://ssd.jpl.nasa.gov/horizons/ |
| Backyard Worlds: Planet 9 (NASA citizen science) | https://www.zooniverse.org/projects/marckuchner/backyard-worlds-planet-9 |

## Space Agency Partner & Other Data

| Link text | Link URL |
|---|---|
| Gaia DR3 (ESA) | https://www.cosmos.esa.int/web/gaia/dr3 |
| SPHEREx ultracool dwarf table, Gagné et al. 2026 | [link to the paper or table] |
| 2MASS Redshift Survey | http://tdc-www.harvard.edu/2mrs/ |
| SIMBAD (CDS, Strasbourg) | https://simbad.cds.unistra.fr/simbad/ |
| VizieR (CDS, Strasbourg) | https://vizier.cds.unistra.fr/ |
| DESI Legacy Imaging Surveys | https://www.legacysurvey.org/ |
| The UltracoolSheet | http://bit.ly/UltracoolSheet |
| SIMPLE archive of brown dwarfs | https://simple-bd-archive.org/ |
| three.js | https://threejs.org/ |
| React | https://react.dev/ |
| Vite | https://vite.dev/ |
| React Bits (interface components) | https://reactbits.dev/ |
| Motion (animation library) | https://motion.dev/ |
| Lucide (icons) | https://lucide.dev/ |
| Astropy | https://www.astropy.org/ |
| Music in the demo video: “Floating Cities” by Kevin MacLeod, CC BY 4.0 | https://incompetech.com/music/royalty-free/music.html |
