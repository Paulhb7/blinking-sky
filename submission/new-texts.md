# Blinking Sky — new texts to paste

Only what is new since the last version of the project page. Each block says where it goes.

---

## 1. Summary (replaces the whole Summary, 1,408 characters)

Blinking Sky is an open-source, citizen-science web tool that lets anyone watch the sky change in real images from NASA’s SPHEREx mission, and vote on what they see. Type a listed object or the coordinates of any patch of sky: the tool plays its SPHEREx images like a little video, across dates and across colours, and draws the spectrum of the position from the same exposures. An asteroid crosses the frame in hours. A nearby brown dwarf shifts from one six-month pass to the next. A cold atmosphere is bright at 4 µm and almost gone at 3.3 µm, where methane absorbs.

There is nothing to install and no account. The browser reads small pieces of the public SPHEREx files straight from NASA’s archive: about 0.3 MB per exposure instead of a 65 MB file. A 3D map places every object at its real distance, from 7,083 asteroids and comets to 15,739 dwarfs and 43,463 galaxies. One click adds WISE and optical images of the same patch, aligned on the SPHEREx image. Tested on the challenge targets Barnard’s Star and WISE 0855.

The same blink led to a result. By crossing WISE, which says where to look, with SPHEREx, which says what the object is, we list 12 cold brown dwarf candidates for which we found no publication. They are candidates, not confirmed objects. A queue of 382 more sources is open for anyone to review. Inspired by Backyard Worlds: Planet 9, every vote is shared with the community.

---

## 2. New section: Community votes (add after "What is the intended impact?")

**Community votes**

Inspired by Backyard Worlds: Planet 9, Blinking Sky asks many eyes to look at the same sources. Each of the 382 unchecked sources can be opened by anyone: the visitor blinks it in two colours, says what the source at the centre does (fades in methane, stays the same, two sources, artefact, nothing there), then sees the tool's own measurement. Votes are shared: one vote per visitor and per source, with no name and no account. A community page (https://blinking-sky.vercel.app/?community) shows how many votes have been cast, how many sources have been looked at, the latest votes and the most looked-at sources; each line opens its source. When several visitors agree that a source fades in the methane band, it becomes a candidate worth a telescope's time. The votes were opened on the last day of the event, so the counts are still small; the demo video shows the page with sample votes, labelled as demo data.

---

## 3. Next to the video link (the note on demo data)

The community page in the video shows sample votes, labelled "Demo data" on screen: the real votes were opened on the last day of the event. The live page, https://blinking-sky.vercel.app/?community, shows only real votes.

---

## 4. "What does it do?", point 3 (replaces the current point 3)

3. A review queue of 382 red, moving WISE sources for which we found no SPHEREx examination. The visitor looks at one, says what they see, then sees the measurement and what other visitors said. A community page shows the totals and the latest votes.

---

## 5. "Try it in one minute" (add these two lines)

- Open a star under "Stars that changed brightness": the tool measures it at each date. The one in Vela is 4.4 times brighter after one year.
- Click "+ Other surveys" on any object: the WISE and optical images of the same field, aligned on the SPHEREx image.

---

## 6. "Tested on the challenge targets" (add these three lines)

- Epsilon Indi B: the brown dwarf pair shifts by about one SPHEREx pixel to the south-east between April 2025 and September 2026; "What changed" shows where it was and where it is.
- RW Aurigae: it fades from 2.19 Jy in September 2025 to 1.19 Jy in September 2026 at 3.8–5 µm, 1.8 times fainter, read date by date (quick look).
- R Draconis: too bright for the tool. Its core saturates the detector at every date, so its brightness cannot be read.

Links to open them:
- Epsilon Indi B: https://blinking-sky.vercel.app/?ra=331.0960&dec=-56.8010
- RW Aurigae: https://blinking-sky.vercel.app/?ra=76.95642&dec=30.40142
- R Draconis: https://blinking-sky.vercel.app/?ra=248.16758&dec=66.75494

---

## 7. "What is the intended impact?" (replaces the sentence that begins "Next, we want to collect the votes…")

Votes are now shared: each source shows what every visitor said of it, with no name and no account, and a community page lists the latest votes. Next, we want to moderate the votes and turn agreement between visitors into a ranked list for follow-up.

---

## 8. "How is your project creative?" (replaces the points "No server" and "Crossing data sets")

- Almost no server. Finding the exposures, reading them, aligning and stacking them, measuring the source and drawing its spectrum all happen in the visitor’s browser, on NASA’s public files. The only server code counts the votes.
- Crossing data sets. SPHEREx alone does not say where to look, and WISE alone does not say what an object is. Together they do. The tool makes the crossing visible: for any position, one click loads the WISE and optical images of the same patch of sky, aligned on the SPHEREx image, and blinks the three.

---

## 9. New section: What factors did your team consider? (the sixth question of the form, still missing)

**What factors did your team consider?**

Honest images: the pictures are averages of real exposures, and the 3D bodies are labelled as illustrations. Honest words: every source is called a candidate, and "no publication found" means absent from the lists we searched. Privacy: two things leave the page, and only when the visitor asks: a sky position, to load other surveys, and a vote on an unchecked source, with no name and no account. Limits: SPHEREx pixels are 6.15″ wide, so only the fastest neighbours move visibly; the in-browser measurements are quick looks, not final photometry.

---

## 10. "What tools…" (add this sentence: the work done before the event)

The methane analysis, the image index and the lists of Solar System exposures were prepared by one team member before the event; the web tool was built during the 48 hours. The code is open source under the MIT licence.

---

## 11. "What the challenge asks" (replaces line 7, and adds a line 9)

7. Other telescopes: yes. One click loads the WISE and optical images of the same field, aligned on the SPHEREx image, and blinks the three; SIMBAD and VizieR open in one click.
9. Citizen science: yes. Votes on the 382 unchecked sources are shared between visitors, inspired by Backyard Worlds: Planet 9.

---

## 12. Resources to add to "Space Agency Partner & Other Data"

- Legacy Surveys viewer (WISE and optical cut-outs): https://www.legacysurvey.org/viewer
- Upstash Redis (storage of the votes): https://upstash.com/
- Music of the demo video, "Floating Cities" by Kevin MacLeod, CC BY 4.0: https://incompetech.com/music/royalty-free/music.html
- NASA/JPL-Caltech SPHEREx all-sky map (cover image), if you use that cover: [link to the NASA page you took it from]
