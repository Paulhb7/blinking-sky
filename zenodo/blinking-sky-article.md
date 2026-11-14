# Blinking Sky: a public web tool to watch the SPHEREx sky change, and twelve cold brown dwarf candidates found by crossing WISE with SPHEREx

**Paul Barbaste¹, Aziz [surname]²**

¹ H Company, Paris, France · ² [school, city]

NASA Space Apps Challenge 2026, challenge "Planet X and SPHEREx" · 14–15 November 2026

*Version 1.0 · not peer reviewed*

## Summary

Blinking Sky is a web tool that shows real images from NASA's SPHEREx mission and lets anyone see how a patch of sky changes, across dates and across colours. It reads small windows of the public level-2 images directly from NASA's archive in the visitor's browser, with no server of its own. On top of the viewer, we describe a simple test for cold brown dwarfs, the methane index, and the result of applying it to red, moving sources from CatWISE2020: 48 sources consistent with a late T or Y dwarf. Three were already typed from a spectrum (a blind test of the method), 33 are published candidates without a spectrum, and 12 have no publication that we could find. All 45 are candidates. None has been confirmed by spectroscopy.

## 1. Why this tool

SPHEREx maps the whole sky every six months in 102 near-infrared bands. Objects that are close to us move between two passes; cold objects have a colour signature that no star has. Nobody can look at more than a billion sources alone, and SPHEREx on its own does not say where to look. Blinking Sky is built on one idea: the interest lies in crossing data sets. WISE says where to look, SPHEREx says what the object is, and the tool lets anyone check.

The name comes from the blink comparator, and from the citizen-science tradition of Backyard Worlds, where volunteers blink WISE images to find moving objects.

## 2. What the tool does

- **Blink across dates.** For a chosen position, the exposures are grouped by SPHEREx pass (about six months apart) and stacked on one fixed, north-up sky grid. What moves between two passes is nearby.
- **Blink across colours.** The same position at 3.83–5.0 µm and in the methane band at 3.15–3.50 µm. A cold brown dwarf is bright in the first and almost gone in the second.
- **A map with real distances.** The Milky Way with the Sun at the origin: 15,739 ultracool dwarfs already typed by SPHEREx (Gagné et al. 2026) placed at a measured or estimated distance, 43,463 galaxies at their redshift distance (2MASS Redshift Survey), and the candidates and unchecked sources of this work.
- **The Solar System, which moves in hours.** 7,083 asteroids and comets that have a SPHEREx visit are placed where they were that day, with the Sun, the Earth and the planets. Clicking one reads the single exposures of its visit: the stars stay, the body moves.
- **A review queue.** 382 red, moving CatWISE sources that nobody has examined in SPHEREx. The visitor looks at one, votes, and sees the measured methane index. Votes stay in the visitor's browser.

## 3. How the images are read

The level-2 images are public in an Amazon S3 bucket that accepts byte-range requests from a web page. For each exposure the tool makes three small requests: the header (astrometric solution, a tangent-plane projection with third-order distortion terms), the wavelength table at the end of the file, and the 33 image rows that contain the position. This is about 0.3 MB per exposure instead of a 65 MB file. An index of the 1.6 million images, cut into small sky tiles, tells the browser which exposures cover a position.

Each window has its local median background removed, is resampled on a fixed grid of 2.05″ pixels (one third of a native 6.15″ pixel), and the windows are averaged after rejection of single-exposure outliers. Missing pixels stay black. Nothing is moved or amplified.

A quick-look flux is measured at the catalogued position with a Gaussian-weighted fit. Compared with the reference analysis (Section 4), pixel positions agree to 10⁻⁶ pixel and wavelengths exactly; the methane index of 2MASS J0415−0935 is 0.025 ± 0.003 in the browser against 0.033 ± 0.007 in the reference.

## 4. The methane test

**Index.** R = flux(3.15–3.50 µm) / flux(3.83–4.20 µm). Methane absorbs strongly near 3.3 µm in atmospheres colder than about 1,300 K. We call a "methane dip" R < 0.30 with a signal-to-noise ratio of at least 5 at 3.83–5.0 µm.

**Controls, away from the Galactic plane.**

| Class | N | Detected (S/N ≥ 5) | Methane dip |
|---|---|---|---|
| Confirmed T and Y dwarfs, W2 < 15.25 | 21 | 21 | 19 |
| Field stars | 65 | 58 | 0 |
| Red sources with no motion (W1−W2 0.8–2) | 51 | 38 | 0 |
| Very red sources with no motion (W1−W2 > 2) | 24 | 8 | 0 |
| Empty positions | 116 | 5 | 0 |

The two confirmed dwarfs without a dip have a background star in the SPHEREx pixel. No dip appears in 256 negative controls.

**Search.** From CatWISE2020 sources that are red in W1−W2 and show a proper motion, 1,681 were extracted; 970 were not detected by SPHEREx, 555 were blended with a neighbour, and 35 showed a dip. A fit of spectral templates and an image check removed three of them (a protostar, a dense core, a diffraction spike). Combined with sources from a published candidate list measured the same way, 48 sources remain, all fitted between T5 and Y0. Three of them turned out to be dwarfs already typed from a spectrum, picked blindly by the selection, with fitted types within about one subtype. The other 45 are candidates.

## 5. Twelve candidates with no publication found

| Designation (CWISE) | W2 | S/N | R | Fitted type | Proper motion (mas/yr, RA, Dec) | Note |
|---|---|---|---|---|---|---|
| J235953.52−280957.6 | 15.05 | 12.4 | 0.03 ± 0.05 | T7 ± 1 | −7, −285 | Red point source in z only |
| J043050.49−072453.9 | 15.52 | 10.3 | 0.09 ± 0.07 | T7 ± 1 | 155, 244 | Colours and motion of a late T dwarf |
| J111646.88−233305.8 | 15.34 | 10.1 | 0.05 ± 0.07 | T7 ± 1 | −326, 56 | Colours of a late T dwarf |
| J121122.23−160045.9 | 15.30 | 8.2 | 0.03 ± 0.09 | T7 ± 1 | −222, −106 | Colours of a late T dwarf |
| J143401.92−065526.3 | 15.78 | 7.6 | 0.09 ± 0.13 | T8 ± 1 | −272, −164 | Seen in J only |
| J020114.67−325005.1 | 15.64 | 7.1 | 0.11 ± 0.08 | T7 ± 1 | 329, 135 | Motion confirmed by optical astrometry |
| J114142.55+592837.2 | 15.53 | 6.9 | 0.06 ± 0.12 | T7 ± 1 | −237, 9 | Red point source in z |
| J101027.39+152220.6 | 15.51 | 6.9 | 0.03 ± 0.14 | T7 ± 1 | −240, 122 | Fragile: faint blue source 0.9″ away |
| J000415.20−213707.8 | 15.53 | 6.6 | −0.03 ± 0.10 | T7 ± 1 | −172, −259 | Colours of a late T dwarf |
| J140138.51−200050.1 | 15.80 | 6.4 | −0.03 ± 0.12 | T8 ± 1 | 365, 12 | Motion confirmed by optical astrometry |
| J013425.70+333752.4 | 15.57 | 5.7 | 0.01 ± 0.17 | T7 ± 1 | 372, −48 | Fragile: faint source 1.4″ away |
| J234020.49−084813.3 | 15.65 | 5.0 | 0.02 ± 0.16 | T7 ± 1 | −185, −352 | S/N at the limit |

Nine of the twelve have a red counterpart in deep optical imaging (z = 21.1–22.1, not seen in g or r), and seven have a J magnitude, with colours expected for late T dwarfs. Two are marked fragile because a faint neighbour lies inside the SPHEREx pixel.

"No publication found" means absent from SIMBAD, the SIMPLE archive, the UltracoolSheet, MOCAdb, the published SPHEREx tables and about fifteen candidate lists. A full-text literature search was not possible. Some of these objects may already be known to other teams; we would be glad to be told, and will update the table.

The other 33 candidates were published earlier as candidates without a spectrum; for them SPHEREx adds spectral evidence. The complete table is in `blinking-sky-candidates.csv`.

## 6. Limits

- The types come from stacked low-resolution SPHEREx photometry, not from classical spectroscopy. At S/N below 10 the fit mostly says "late T": read ± 1 to 2 subtypes.
- The test is reliable to W2 ≈ 15.2, works about one time in two to W2 = 16.0, and not beyond.
- It is not usable for searching in the Galactic plane (|b| < 12°), where most sources are blended in the 6.15″ pixel.
- The "likely" level (R + 1σ < 0.30) was added after seeing the data.
- The in-browser quick look is less precise than the reference analysis and applies no pixel flags.
- Distances marked estimated come from the fitted type and the W2 magnitude; distances marked assumed are placeholders.
- In the Solar System view each body is drawn at the date of its SPHEREx visit, so the dots are not one snapshot; planets are placed with two-body orbits.

## 7. What was done before and during the event

The methane analysis (Sections 4 and 5), the index of SPHEREx images and the lists of exposures for Solar System bodies were produced by the first author in the days before the event. The web tool, its in-browser reader, the maps, the review queue and this text were made during the 48 hours of the event. The repository's journal separates the two.

## 8. Files in this deposit

- `blinking-sky-article.md`: this text.
- `blinking-sky-candidates.csv`: the 45 candidates, the 3 blind-test dwarfs and the 4 rejected false dips, with positions, magnitudes, motions, methane index, fitted type and notes.
- [to add by the authors: source code archive of the tool; review queue `queue.json`; control table]

## Acknowledgements and data

This work uses data from SPHEREx (NASA/JPL-Caltech), served by the NASA/IPAC Infrared Science Archive; CatWISE2020 and unWISE; the SPHEREx ultracool dwarf table of Gagné et al. (2026); Gaia DR3; the UltracoolSheet; the SIMPLE archive; SIMBAD and VizieR (CDS, Strasbourg); the DESI Legacy Imaging Surveys; the VISTA Hemisphere Survey; the NOIRLab Source Catalog; the 2MASS Redshift Survey; the IRSA Moving Object Search Tool and JPL Horizons. We thank the Backyard Worlds: Planet 9 project, whose way of looking at the sky inspired this tool.

## References

[To complete and check by the authors before deposit: full bibliographic entries for the SPHEREx mission paper, CatWISE2020 (Marocco et al. 2021), Gagné et al. 2026, Kirkpatrick et al. 2024, Backyard Worlds (Kuchner et al. 2017), 2MASS Redshift Survey (Huchra et al. 2012), and the candidate lists searched.]
