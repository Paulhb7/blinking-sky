# Space Apps project page — texts to paste

Team: Apollo XXI · Challenge: Planet X and SPHEREx
Text in [brackets] is for the authors to fill in. Every link must be tested in a private browser window before submitting.

---

## Project Name

Blinking Sky

---

## Summary (limit 1,500 characters; 50–200 words suggested)

Blinking Sky is a public web tool that lets anyone watch the sky change in real images from NASA's SPHEREx mission. Pick an object or any position, and the tool blinks it across dates and across colours. An asteroid crosses the frame in hours. A nearby brown dwarf shifts from one six-month pass to the next. A cold atmosphere is bright at 4 µm and almost gone at 3.3 µm, where methane absorbs.

There is nothing to install and no account. For any position, the browser reads small pieces of the public SPHEREx files straight from NASA's archive: about 0.3 MB per exposure instead of a 65 MB file. A 3D map places every object at its real distance, from 7,083 asteroids and comets to 15,739 dwarfs and 43,463 galaxies.

The same blink led to a result. By crossing WISE, which says where to look, with SPHEREx, which says what the object is, we list 12 cold brown dwarf candidates for which we found no publication. They are candidates, not confirmed objects. A queue of 382 more sources that nobody has examined is open for anyone to review.

---

## Project Demonstration (link)

[public link to the 30-second video, or to the 7-slide deck]

## Project (link)

[public address of the tool]

---

## Project Details

Images to insert are marked [image: file name]; the files are in `images/`.

**Try it in one minute**

Open https://blinking-sky.vercel.app and click “Open the sky”.

1. Type “Ceres” in the search box. Six real exposures taken a few hours apart load from NASA's archive: the stars stay, Ceres moves.
2. Open “WISE 0855−0714” under “Start here” and blink “Across dates”. The coldest known brown dwarf, 7 light-years away, shifts between May 2025, November 2025 and May 2026.
3. Open any source under “Candidates · no publication found” and blink “Across colours”. The source is there at 4 µm and gone in the methane band.
4. Click “Show me one nobody has checked” and judge a source yourself.

[image: 05-solar-system-ceres.png]

**What it does**

The challenge asks for a public tool that makes it easy to see how SPHEREx images change over time. Blinking Sky shows change on three time scales, with real images each time: hours for the Solar System, months and years for our nearest neighbours, and no change at all for distant galaxies, which is the reference. It has three parts.

1. A blink viewer. For any position, the SPHEREx exposures are grouped by pass (about six months apart) and stacked on one fixed, north-up grid. The visitor blinks between dates to see motion, and between two colours (3.83–5.0 µm and the methane band at 3.15–3.50 µm) to see what the object is made of.
2. A map with real distances. The Milky Way with the Sun at the origin: 15,739 ultracool dwarfs already typed by SPHEREx, 43,463 galaxies at their redshift distance, and the Solar System with the Sun, the Earth, the planets and 7,083 asteroids and comets placed where they were on the day SPHEREx saw them. Clicking any dot opens its real images.
3. A review queue. 382 red, moving WISE sources that nobody has examined in SPHEREx. The visitor looks at one, says what they see, and then sees the measured methane index.

[image: 07-brown-dwarf-wise0855-dates.png]
[image: 04-solar-system-map.png]

**How it works**

SPHEREx level-2 images are public in a cloud archive that accepts partial requests from a web page. For each exposure the tool asks for three small pieces: the header with the astrometric solution, the wavelength table, and the few image rows that contain the position. That is about 0.3 MB instead of a 65 MB file. An index of the 1.6 million images, cut into small sky tiles, tells the browser which exposures cover a position. Each window has its background removed and is resampled on a common grid; windows are averaged after rejecting single-exposure outliers. Nothing is moved or amplified, and missing pixels stay black.

We checked the in-browser reader against a reference analysis in Python: pixel positions agree to a millionth of a pixel, and the methane index of a known dwarf comes out at 0.025 ± 0.003 in the browser against 0.033 ± 0.007 in the reference.

**What we found**

We use one simple test, the methane index: the flux at 3.15–3.50 µm divided by the flux at 3.83–4.20 µm. Below 0.30, with a signal-to-noise ratio of at least 5, we call it a methane dip.

- On controls, 19 of 21 confirmed cold dwarfs show the dip. The two that do not have a background star in the SPHEREx pixel.
- None of 256 negative controls (field stars, red sources with no motion, empty positions) shows it.
- Applied to red, moving sources from CatWISE2020, the test leaves 48 sources consistent with a late T or Y dwarf. Three were already typed from a spectrum: the selection found them blindly, which checks the method. For 33 published candidates, SPHEREx adds spectral evidence. For 12, we found no publication.

All 45 are candidates. None is confirmed by spectroscopy, and some of the 12 may already be known to other teams. The full table, with positions and measurements, is being deposited on Zenodo. [add the link once the deposit is made, or remove this sentence]

[image: 08-candidate-methane-band.png]

**Why it is creative**

- Blinking in colour. The blink comparator is a century old and is used on dates. We also blink two wavelengths, which turns a spectral feature into something anyone can see: the object vanishes.
- No server. The whole pipeline (finding the exposures, reading them, aligning and stacking them, measuring the source) runs in the visitor's browser on NASA's public files.
- One map for everything SPHEREx sees, at real distances, from an asteroid 3 au away to a galaxy 49 million light-years away.
- Crossing data sets. SPHEREx alone does not say where to look, and WISE alone does not say what an object is. Together they do.

**Benefits and intended impact**

- Anyone can look at real SPHEREx images within seconds, on any position, with nothing to install.
- The blink is the method of the citizen-science project Backyard Worlds: Planet 9, applied to a new mission. A volunteer who knows one will understand the other.
- The review queue lets visitors examine real sources that nobody has looked at in SPHEREx.
- The candidate table gives observers a short list for follow-up spectroscopy.
- Because the site is static and reads NASA's archive directly, it costs nothing to keep online and will show new SPHEREx passes as they are released, once the image index is rebuilt.

[image: 10-review-queue.png]

**What we considered**

- Honest images. The pictures are averages of real exposures. The round bodies drawn next to them are illustrations built from the measurements, and are labelled “not an image”.
- Honest words. Every source is called a candidate. “No publication found” means absent from the catalogues and lists we searched, not “unknown”.
- Privacy. Nothing a visitor does is sent anywhere; votes stay in their browser.
- Access. No account, no download, and each object costs a few megabytes to load.

**Limits**

- SPHEREx pixels are 6.15″ wide. Only the fastest neighbours move visibly between two passes; for most candidates the evidence is the colour blink, and the motion comes from WISE.
- The test is reliable to W2 ≈ 15.2 and works about one time in two down to W2 = 16.0.
- It does not work in the Galactic plane, where sources are blended in the pixel.
- The in-browser measurement is a quick look; it is less precise than the reference analysis.
- Votes are not collected yet, so the queue does not produce a shared result.

**Tools**

TypeScript, React, Vite and three.js (WebGL) for the web tool; Python with astropy and numpy to prepare the tables; static hosting. The only live data source is NASA's archive.

**What was done before and during the event**

The methane analysis, the index of SPHEREx images and the lists of exposures for Solar System bodies were prepared by one team member in the days before the event. The web tool, its in-browser image reader, the maps, the review queue and the texts were made during the 48 hours. The project journal separates the two.

**What comes next**

- Collect the votes, so that several people looking at the same source produce a shared answer.
- Ask for spectra of the 12 candidates.
- Extend the search to the next SPHEREx data release.

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
