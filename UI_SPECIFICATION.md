# div.DICOM — Käyttöliittymän Toiminnallisuus- ja Vuorovaikutusspesifikaatio (UI Specification)

Tämä dokumentti määrittelee tarkasti div.DICOM -katselimen käyttöliittymän sovittujen toiminnallisuuksien käyttäytymismallit, säännöt ja rajapinnat. Dokumentin tavoitteena on varmistaa, että sovelluksen toiminnallisuudet eivät unohdu tai rikkoudu tulevien kehitys- ja refaktorointivaiheiden aikana.

---

## 1. Viewportien Ikkunajako & Layout Tree

### 1.1 Jakorajat ja mittasuhteet
- **Maksimirajat**: Katselin sallii korkeintaan **6 vierekkäistä saraketta** (horisontaalisesti) ja korkeintaan **4 päällekkäistä riviä** (vertikaalisesti). Rajat tarkistetaan apufunktioilla `canSplitNode` ja `getLayoutDimensions`.
- **Indeksien allokointi**: Sisäkkäisissä jaoissa (nested split) uuden viewportin indeksi lasketaan koko layout-puun tasolta (`getNextAvailableViewportIndex`), mikä takaa uniikit indeksit ja estää ruutujen sekoittumisen.

### 1.2 Jakolinjojen vuorovaikutus ja muistaminen (Panel Sizes)
- **Kiinteä leveys ilman heilahtelua**: Jakolinjoilla (`PanelResizeHandle`) on vakioleveys (`w-1` / `h-1`), eikä palkki paksuunnu hiiren ollessa sen päällä (`hover`). Tämä estää viereisten kuvien tärähtelyn ja hyppimisen (*layout jitter*).
- **Värikorostus & osuma-alue**: Hiiren osuessa jakolinjalle palkki korostuu siniseksi (`#3584F5`). Tarttumisen helpottamiseksi linjalla on laajennettu näkymätön osuma-alue (`before:absolute before:-inset-x-2` / `before:-inset-y-2`) tasolla `z-40`.
- **Tapahtumien eristys**: Jakolinja pysäyttää hiiritapahtumat (`e.stopPropagation()`), ja viewportin kanvaasi ohittaa jakolinjalle osuvat klikkaukset. Jakolinjan siirto ei koskaan muuta kuvan ikkunointia (WW/WL) tai zoomausta.
- **Jakolinjojen muisti focus-tilassa**: Käyttäjän siirtämät jakolinjojen suhteet tallennetaan muistiin (`panelSizesMap`) `PanelSizes`-rakenteena (`{ size0: number, size1: number }`) ja asetetaan `PanelGroup`-komponentille `defaultLayout`-parametrilla. Kun ruutu avataan focus-tilaan ja palataan takaisin, jakolinjat säilyvät täsmälleen asetetuissa kohdissa.

---

## 2. Monivalinta (Ctrl+Click) ja Nopea Linkitys (Fast Linking)

### 2.1 Viewportien valinta
- **Valinta**: Pitämällä `Ctrl` (tai Macilla `Cmd`) pohjassa ja klikkaamalla viewportteja käyttäjä voi valita 1–4 ruutua missä tahansa järjestyksessä.
- **Visuaalinen palaute**: Valitut ruudut korostuvat sinisellä hehkuvalla kehyksellä (`ring-2 ring-[#3584F5]`) ja saavat vasempaan yläkulmaan valintajärjestyksen mukaisen numeromerkin (**#1**, **#2**, **#3**, **#4**). Kun vähintään kaksi ruutua on valittuna, merkissä lukee myös **Linked**.
- **Poistaminen**: Ruudun klikkaaminen uudelleen `Ctrl` pohjassa poistaa sen valinnan.

### 2.2 Nopea linkitys (Fast Linking / Syncing)
- Kun 2–4 ruutua on valittuna, toiminnot linkittyvät automaattisesti reaaliajassa:
  - **Zoom**: Yhdessä valitussa ruudussa tehty zoomaus skaalaa samassa suhteessa kaikki linkitetyt ruudut samanaikaisesti.
  - **Pan**: Yhdessä ruudussa tehty siirtäminen siirtää kaikkia linkitettyjä ruutuja.
  - **WW/WL**: Ikkunointitason ja -leveyden säätö säätää kaikkia linkitettyjä ruutuja ja päivittää niiden HUD-arvot reaaliajassa.

### 2.3 Monivalinnan nollaus
- **Ctrl-napautus**: Pelkkä `Ctrl`-näppäimen painaminen alas ja ylös (ilman hiiriklikkausta) nollaa kaikki valinnat ja linkityksen välittömästi.
- **Esc-näppäin**: Painamalla `Escape` monivalinta ja linkitys tyhjennetään.

---

## 3. Nopea Ikkunointi (Quick Layout)

- **Aktivointi**: Kun 1–4 ruutua on valittuna, yläpalkin **Grid Layout** -painike muuttuu siniseksi sykkiväksi toimintopainikkeeksi laskurilla.
- **Suoritus**: Painamalla **`Enter`** tai klikkaamalla sinistä Grid Layout -nappia (joka ei tällöin avaa valikkoa) valitut sarjat avataan välittömästi puhtaaseen ikkunajakoon numerojärjestyksessä:
  - **1 ruutu valittu**: 1x1 Single
  - **2 ruutua valittu**: 1x2 Columns (#1 vasen, #2 oikea)
  - **3 ruutua valittu**: 1x3 Columns (#1 vasen, #2 keski, #3 oikea)
  - **4 ruutua valittu**: 2x2 Grid (#1 vasen ylä, #2 oikea ylä, #3 vasen ala, #4 oikea ala)
- **Ikkunoinnin ja zoomauksen siirtyminen**: `handleQuickLayout` siirtää kunkin sarjan omat ikkunointiarvot (`windowCenter`, `windowWidth`), suhteellisen zoomauksen (`zoomRatio`) ja siirtymän suoraan uuteen kohderuutuun (`srcIdx -> targetIdx`), jotta kuvan kontrasti tai suurennus ei muutu tai ylivalotu.

---

## 4. Focus-tila (Maximize) & Suhteellinen Skaalaus

### 4.1 Focus-tilaan siirtyminen ja poistuminen
- **Tuplaklikkaus**: Viewportin tuplaklikkaus (tai kelluvan toimintopalkin Maximize-painike) suurentaa ruudun koko näytön 1x1 focus-tilaan. Uusi tuplaklikkaus (tai Restore-painike) palauttaa moniruutunäkymän.
- **Action Bar focus-tilassa**: Focus-tilassa kelluvassa toimintopalkissa näytetään **vain yksi palautuskuvake** (`Minimize2`), jotta käyttäjä ei sekoita focus-tilaa pysyvään 1x1-jakoon.

### 4.2 Suhteellinen skaalaus (`zoomRatio = scale / fitScale`)
- Kuvan zoomaus lasketaan aina suhteessa kunkin näkymän omaan ikkunan kokoon:
  - Jos kuva on 2x2-ruudussa perussovituksessa (100%), se täyttää 1x1 focus-tilassa koko näytön (100% sovitus koko näytölle).
  - Jos kuvaa on zoomattu leesiioon (esim. 200%), se aukeaa 1x1 focus-tilaan 200% suurennettuna suhteessa koko näytön alaan samaan kohteeseen kohdistettuna.
  - Palattaessa takaisin moniruutunäkymään kuva palaa suhteelliseen 200% suurennokseensa pienessä ruudussa.

### 4.3 Reset Layout
- Poistuu välittömästi focus-tilasta takaisin alkuperäiseen Hanging Protocol -asetteluun.
- Nollaa kaikkien ruutujen zoomaukset ja siirtymät takaisin 100% perussovitukseen (`fitToWindow`).
- Palauttaa jakolinjojen suhteet tasajakoon.
- Tyhjentää monivalinnat.

---

## 5. Kuvasarjojen Raahaus & Natiivi DICOM LUT/VOI

- **Raahauksen korostus**: Kun sarjaa raahataan Files-paneelista viewportin päälle, aktiivinen kohderuutu korostuu sinisellä kehyksellä ja opasteella (*"Drop Series into Viewport X"*).
- **Natiivin LUT/VOI:n palautus**: Kun sarja pudotetaan tai ladataan viewporttiin:
  - Ruudussa aiemmin olleen sarjan ikkunointi-, kontrasti-, rotaatio- ja zoomausasetukset unohdetaan täysin.
  - Uudelle sarjalle kutsutaan `cornerstone.getDefaultViewportForImage(element, image)`, joka ottaa käyttöön suoraan kyseisen sarjan omat `windowCenter`-, `windowWidth`- ja `voiLUT`-arvot.
  - Kuva sovitetaan automaattisesti kyseisen ruudun kokoon (`fitToWindow`).

---

## 6. Hiirieleet, Työkalut & Mittaukset

### 6.1 Oletustyökalu käynnistyessä
- Sovelluksen käynnistyessä aktiivisena työkaluna on **`none`** (ei lukittua työkalua).

### 6.2 Suorat hiirieleet
- **Oikea painike pohjassa**: WW/WL -ikkunoinnin säätö.
- **Keskimmäinen painike (tai rulla) pohjassa**: Pan / kuvan siirto.
- **Oikea + Vasen painike samanaikaisesti (`buttons === 3`)**: Zoomaus (*Chord Zoom*). Ele lukittuu zoom-tilaan (`isChordZooming`), jolloin ikkunointi (WW/WL) ei muutu missään vaiheessa eletapahtumaa tai painikkeita vapautettaessa.

### 6.3 Mittaustyökalut
- **Automaattinen sulkeutuminen**: Length-, Angle- ja ROI -työkalut kytkeytyvät automaattisesti pois päältä (`setActiveTool('none')`), kun mittauksen piirtäminen valmistuu.
- **ROI-monikulmion sulkeminen**: ROI sulkeutuu, kun loppupiste viedään alkupisteen päälle tai tuplaklikataan kanvaasia.
- **Roskakoriin poisto**: Mittauksen (ROI, Length, Angle) raahaaminen kelluvan punaisen roskakorin päälle poistaa mittauksen siististi.
- **Valikoiden automaattisulkeutuminen**: Mittauslista- ja Layout-valikot sulkeutuvat automaattisesti, kun klikataan viewportia tai valitaan toinen työkalu.
