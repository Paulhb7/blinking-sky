# Space Apps project page — v2, challenge checklist made explicit

Team: 102 Colours - Blinking Sky · Challenge: Planet X and SPHEREx
Text in [brackets] is for the authors to fill in or check. Everything outside brackets states only what the tool does today (verified in the code on 2026-11-14).

---

## Summary (limit 1,500 characters; 50–200 words suggested)

Blinking Sky is a public web tool that lets anyone watch the sky change in real images from NASA’s SPHEREx mission. Type an object name or the coordinates of any patch of sky: the tool plays its SPHEREx images like a little video, across dates and across colours, and draws the spectrum of the position from the same exposures. An asteroid crosses the frame in hours. A nearby brown dwarf shifts from one six-month pass to the next. A cold atmosphere is bright at 4 µm and almost gone at 3.3 µm, where methane absorbs.

There is nothing to install and no account. The browser reads small pieces of the public SPHEREx files straight from NASA’s archive: about 0.3 MB per exposure instead of a 65 MB file. A 3D map places every object at its real distance, from 7,083 asteroids and comets to 15,739 dwarfs and 43,463 galaxies. Tested on the five challenge targets, from Barnard’s Star to WISE 0855.

The same blink led to a result. By crossing WISE, which says where to look, with SPHEREx, which says what the object is, we list 12 cold brown dwarf candidates for which we found no publication. They are candidates, not confirmed objects. A queue of 382 more sources, with no SPHEREx examination we could find, is open for anyone to review.

[Keep “Tested on the five challenge targets” only once the three missing targets have been checked.]

---

## What does it do?

SPHEREx re-observes the whole sky every six months, in 102 bands of near-infrared light, and no one person can sift through a billion sources alone. Blinking Sky lets anyone watch the sky change in real SPHEREx images, on three time scales: hours for the Solar System, months and years for our nearest neighbours, and no change at all for distant galaxies, which is the reference. It has three parts.

1. A blink viewer. For any object name, or any position typed as coordinates, the visitor blinks between dates to see what moves, and between two colours (4 µm and the methane band at 3.15–3.50 µm) to see what the object is made of. The same exposures give a spectrum of the position, drawn as they arrive.
2. A map with real distances: the Sun, the Earth, the planets and 7,083 asteroids and comets placed where they were on the day SPHEREx saw them; 15,739 ultracool dwarfs already typed by SPHEREx; 43,463 galaxies. Clicking any dot opens its real images.
3. A review queue of 382 red, moving WISE sources for which we found no SPHEREx examination. The visitor looks at one, says what they see, then sees the measurement.

Try it in one minute at https://blinking-sky.vercel.app (“Open the sky”). Source code: https://github.com/Paulhb7/blinking-sky

- Type “Ceres” in the search box: six real exposures a few hours apart. The stars stay, Ceres moves.
- Open “WISE 0855−0714” and blink “Across dates”: the coldest known brown dwarf, 7 light-years away, shifts between May 2025 and May 2026.
- Open a source under “Candidates · no publication found” and blink “Across colours”: it is there at 4 µm and gone in the methane band.

## What the challenge asks, and where it is in the tool

- Enter the coordinates of a patch of sky. Yes. The search box takes a name, decimal degrees (“133.795 −7.245”) or sexagesimal (“08h55m10.8s −07°14′42″”). Any position opens, not only catalogued objects.
- A series of images like a little video, to spot moving objects. Yes. The dates play in a loop and can be stepped one by one. Solar System bodies show single exposures a few hours apart; everything else shows one stacked image per six-month pass.
- Easy to update with new data releases. Yes. One script cuts the archive’s footprint index (1.6 million images) into small tiles [N minutes on a laptop]; the viewer reads whatever the index contains, so a new release is a rebuild of the index, not of the tool. [The qr3 release was added this way on <date>.]
- The 102 bands. Partly. Two colours are blinked, and every band that covers the position goes into its spectrum (next point).
- Spectra on the fly. Yes. For any position, the browser bins the photometry of every exposure that covers it into a spectrum with 1σ bars and fits a template; one button completes it from 0.75 to 2.4 µm.
- Add or subtract images taken at different times. Yes. Exposures of the same pass are added (averaged after rejecting outliers), and a “What changed” frame shows the last date minus the first, with the brightness measured at each date.
- Choose the field of view. Yes. 2′, 4′ or 8′ across for any field read live; a wider field reads more of each exposure, about 0.3, 0.5 or 1 MB. Solar System bodies use a fixed 10′ field.
- Overlay data from other telescopes. Partly. Gaia DR3 proper motions predict where a nearby object should be at each date; for each candidate the panel shows the unWISE and Legacy Surveys DR10 cutouts of the same position, and SIMBAD and VizieR open in one click. There is no live overlay on the SPHEREx image yet.
- Coordinates in the URL. Yes. ?ra=133.795&dec=-7.245 opens that position, and ?fov=4 or ?fov=8 widens the field, so the viewer can be embedded in another page. A “Copy link” button gives the address of whatever is on screen; a link to a known field or an unchecked source reopens it as itself.
- Contamination flags. Partly. The Barnard demonstration applies the quality bits and offers a masked view; the live viewer does not apply pixel flags yet, and says so in its processing notes.
- Test targets. See below.

## Tested on the five challenge targets

- Barnard’s Star: two exposures, 2025-08-21 and 2026-08-18, near 1.9 µm. The star shifts north by [measured ″] against the reference stars; Gaia DR3 predicts 10.4″ per year. The core is saturated.
- Epsilon Indi B: [what one sees across the two passes].
- WISE 0855−0714: the shift between May 2025 and May 2026 is visible in one blink; the colour blink shows the methane dip.
- RW Aurigae: [the brightness changes between the two passes: what one sees].
- R Draconis: [same].

## How does it work?

SPHEREx level-2 images are public in a cloud archive that accepts partial requests from a web page. For each exposure the browser asks for three small pieces: the header with the astrometric solution, the wavelength table, and the few image rows that contain the position. That is about 0.3 MB instead of a 65 MB file. An index of the 1.6 million images, cut into small sky tiles, tells the browser which exposures cover a position. Each window has its background removed and is put on one fixed, north-up grid; windows of the same pass (about six months apart) are averaged after rejecting single-exposure outliers. Nothing is moved or amplified, and missing pixels stay black.

To say what an object is, we use one simple test, the methane index: the flux at 3.15–3.50 µm divided by the flux at 3.83–4.20 µm [check: the viewer text says 3.83–5.0 µm; use one range or explain the two]. Below 0.30, with a signal-to-noise ratio of at least 5, we call it a methane dip. On controls, 19 of 21 confirmed cold dwarfs show the dip (the two others have a background star in the pixel), and none of 256 negative controls [say what they are, e.g. “M dwarfs and random stars”] does. We checked the in-browser reader against a reference analysis in Python: pixel positions agree to a millionth of a pixel.

## What benefits does it have?

Anyone can look at real SPHEREx images within seconds, on any position, with no account and nothing to install. It gives a result. Applied to red, moving sources from CatWISE2020, the methane test leaves 48 sources consistent with a late T or Y dwarf, the coldest kind of brown dwarf. Three were already typed from a spectrum: the selection found them blindly, which checks the method. For 33 published candidates, SPHEREx adds spectral evidence. For 12, we found no publication. All are candidates; none is confirmed by spectroscopy, and some of the 12 may already be known to other teams.

The candidate table gives observers a short list for follow-up spectroscopy; it will be deposited on Zenodo after the hackathon. The site is static and reads NASA’s archive directly, so it costs nothing to keep online.

## What is the intended impact?

SPHEREx re-observes the whole sky every six months, and nobody can look at more than a billion sources alone. We want the public to do with SPHEREx what volunteers of Backyard Worlds: Planet 9 did with WISE: blink, notice, report. The review queue is the first step: 382 real sources with no SPHEREx examination that we could find, open to anyone. Next, we want to collect the votes so that several people looking at the same source produce a shared answer, ask for spectra of the 12 candidates, and extend the search to the next SPHEREx data release. After the hackathon we will write up the twelve candidates as a Research Note of the AAS and deposit the table on Zenodo: Paul, who already has an author account, will submit it with Aziz.

The three clearest of the twelve candidates (methane index below 0.30 means a dip):
1. CWISE J235953.52−280957.6 · T7 ± 1 · W2 15.05 (WISE 4.6 µm magnitude) · S/N 12.4 · index 0.03 ± 0.05
2. CWISE J043050.49−072453.9 · T7 ± 1 · W2 15.52 · S/N 10.3 · index 0.09 ± 0.07
3. CWISE J111646.88−233305.8 · T7 ± 1 · W2 15.34 · S/N 10.1 · index 0.05 ± 0.07
The full ranked table of twelve, with the images at 4 µm and in the methane band, is in the repository.

## What tools, coding languages, hardware, or software did you use?

- Web tool: TypeScript, React, Vite and three.js (WebGL). Static hosting on Vercel.
- Source code: https://github.com/Paulhb7/blinking-sky
- Data preparation: Python with astropy and numpy.
- Data: SPHEREx level-2 images from NASA/IPAC IRSA; CatWISE2020; Gaia DR3 (proper motions); the SPHEREx ultracool-dwarf catalogue of Gagné et al. 2026; unWISE and Legacy Surveys DR10 cutouts; the IRSA Moving Object Search Tool for predicted positions. [Complete with the other sources listed in the data fields.]
- Hardware: two laptops. No server and no paid computing. [Check that this also holds for the data preparation.]
- [Built before the hackathon: <the open-source map base, link>. Built during the 48 hours: everything SPHEREx, the blink viewer, the spectra, the queue, the candidates.]

## How is your project creative?

- Blinking in colour. The blink comparator is a century old and is used on dates. We also blink two wavelengths, which turns a spectral feature into something anyone can see: the object vanishes.
- No server. Finding the exposures, reading them, aligning and stacking them, measuring the source and drawing its spectrum all happen in the visitor’s browser, on NASA’s public files.
- One map for everything SPHEREx sees, at real distances, from an asteroid 3 au from the Sun to a galaxy 49 million light-years away.
- Crossing data sets. SPHEREx alone does not say where to look, and WISE alone does not say what an object is. Together they do.

## Three scales in one tool

The same gesture, click and blink, works at three scales of the Universe, and the visitor zooms from one to the next without leaving the map.

- The Solar System. The Sun, the Earth and the planets on their orbits, with 7,083 asteroids and comets seen by SPHEREx. Here the sky changes in hours.
- The Milky Way. Our neighbourhood of the galaxy, with the Sun at the origin: 15,739 dwarfs already typed by SPHEREx, the candidates of this work and the 382 unexamined sources. Here the sky changes in months and years.
- The cosmic web. 43,463 galaxies at their measured redshift distance, out to hundreds of millions of light-years, drawing the filaments and voids of the large-scale structure. Here nothing moves, and each galaxy opens on its real SPHEREx image.
- [The sky view. The celestial sphere as seen from the Earth’s surface, where any typed position opens its live images. Confirm the wording.]
