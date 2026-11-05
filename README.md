# Temple of Bahamut — multi-room D&D encounter maps

Thirteen independent 3D scenes controlled by one Dungeon Master on one screen. All are made from Three.js geometry, with no backend, external image assets or GLB models. The original **Library of the Last Wyrm** is retained, including its flying books, long bridge, statue, enemy spawns, camera controls, and success/failure flashes.

## Rooms

| Room | Environment and unique DM controls |
| --- | --- |
| Mass Chamber | Large Bahamut statue, Lady Runara, many pews, worshippers, priests and clickable exits |
| Hidden Library | The original scene: 1,000 animated books, 15×15 battle platform, five enemy types and cues |
| Dining Hall | Crowded monk/priest refectory, tables and food |
| Kitchen & Pantry | Overcooked-style workstations, ovens, chopping boards, sinks, pantry; summon **chickens, ducks, pigs and cows** |
| Healing Ward | Eight horizontally aligned sailor/pirate patients with caps, bandanas, uniforms and injuries; separated attendants, cots and medical supplies |
| Reliquary | Boots of Elvenkind, Cloak of the Manta Ray, Glass Slipper, Magical Rose, and Cloak of Bellowing on an open clothes rack; **toggle item names** and obstacle-aware guard patrols |
| Crypts & Catacombs | Twelve stone sarcophagi, funerary altar and **Guardians of Faith** |
| Hot Spring | Outdoor Japanese-style onsen with steaming water, rock pools, timber pavilion, cherry blossoms and lanterns |
| Toilets | Fully partitioned stalls and sinks/mirrors on both sides; urinals only in men’s area |
| Training Field | Eight training dummies and target stands, weapon racks; spawn Temple Monks and Monk Instructors |
| Loom Room | One large loom, woven cloth, supplies and one seamstress |
| Apple Garden | Eight apple trees and seven individual dwarven gardeners with tools and baskets |
| Store Room | Dusty crates, stacked boxes, barrels, sacks, cobwebs, and drifting dust particles |

## Player miniatures and gameplay

- Four original procedural low-poly heroes: **Lethia, Elsa, Gilchris, Leda**.
- **All heroes start unspawned in every room**, including the Library. Click a party member (or press `1`–`4`) and then click a **free floor tile** to place them. The pending hero entry says `PLACE`.
- Click a placed miniature or its party entry to select it; teal highlights indicate tiles it can reach in up to **six orthogonal steps**. Click a highlighted tile to move it, respecting room furniture and other pieces.
- `Remove hero` removes only the selected hero; `Unspawn all` removes the entire party.
- Kitchen animals and Training Field monks spawn the same way, and can be selected, moved, removed individually or cleared. Other scenes have no extra spawner.
- The Reliquary's artifact labels can be toggled. Two guards are stationed separately. Three additional guards enter and leave on staggered patrol cycles using four-neighbour tile routes that avoid blocked scenery, and pause when player miniatures are in their way. These are decorative guard actors rather than movable DM tokens.
- Camera: left-drag orbit, right-drag pan, wheel zoom, `Explore` cinematic isometric view, `Battle map` overhead, `Reset view`.
- Room dropdown always appears at the top; select a room to navigate. Some rooms also have glowing clickable portals; the Mass Chamber is the navigation hub.
- Room state intentionally resets upon navigation/reload (no server storage). This means every room starts without player spawns.

## Project files

```
index.html
src/
  entry.js           ← selects either the original library or one of the new rooms
  rooms.js           ← room names, routes and dropdown
  main.js            ← original library engine (party spawning added)
  temple.js          ← all twelve non-library 3D room builders and generic DM controls
  style.css          ← original HUD styles
  temple.css         ← dropdown and new room styling
package.json
vite.config.js        ← base './' for GitHub Pages under any repo path
.github/workflows/deploy.yml
.gitignore
README.md
```

## Run locally

1. Install **Node.js 22+**.
2. Open this directory in VS Code or a terminal.
3. Run:

```bash
npm install
npm run dev
```

4. Visit the URL Vite prints, normally `http://localhost:5173/`.
5. To check JavaScript syntax before launching, run `npm run check` (requires Node.js but no downloaded dependencies).
6. To verify production build locally:

```bash
npm run build
npm run preview
```

Open specific rooms directly using query strings, for example:

- `http://localhost:5173/?room=mass-chamber`
- `http://localhost:5173/?room=library`
- `http://localhost:5173/?room=reliquary`

## Deploy via GitHub Pages

1. Extract this project into a new (or existing) GitHub repository's **root** folder. Keep `src/`, `package.json`, `vite.config.js`, `index.html` and `.github/` intact.
2. Push these files to the **main** branch.
3. Under GitHub **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source.
4. The workflow in `.github/workflows/deploy.yml` installs dependencies, builds Vite, and publishes `dist/`. To deploy manually, go to **Actions → Publish Temple of Bahamut → Run workflow**.
5. Visit `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/` and choose rooms in the dropdown. GitHub Pages also supports bookmarkable query-based room links.

If replacing an existing library repository, back it up or make a Git branch first. This version modifies `src/main.js` to make library heroes initially unspawned, and adds all new files. Any separate custom changes to your existing library code should be reviewed before overwriting.

## Changing the design

- The twelve non-library room builders are `buildMass`, `buildDining`, `buildKitchen`, `buildHealing`, `buildReliquary`, `buildCrypts`, `buildHotSpring`, `buildToilets`, `buildTraining`, `buildLoom`, `buildGarden`, and `buildStore`, all inside `src/temple.js`.
- The global grid measures **23 × 19 squares** for new rooms, with `CELL = 1.55`, `STEP_LIMIT = 6`. The Library retains its own existing 15×15 arena and bridge.
- Furniture can block tile movement using `blockTile` or `blockRect`.
- Add room definitions in `src/rooms.js` and register the corresponding builder in `startTempleRoom()`.
- To adjust reliability/performance on low-end devices, lower the pixel ratio (currently 1.5 in new rooms) and reduce scenery counts.

## Limitations

- Designed as one browser session shared by the DM; not synchronized multiplayer or automated D&D combat.
- No persistent player positions between room changes. This is intentional to keep each room unspawned.
- Static decorative characters are low-poly visual scenery. Reliquary guard patrols use precomputed, grid-based obstacle avoidance, but do not use an advanced autonomous AI/physics engine.
- The project depends on npm packages `three` and `vite` at **installation time**, but requires no backend at runtime.

## Version 2 changes (November 2026)

- **Healing Ward:** beds and sailors are aligned head-to-pillow, with distinct sailor/pirate outfits, bandanas, caps, bandages, boots, and blankets. Beds have spaced attendants and compact screens that do not obstruct the scene.
- **NPC clearance:** standing NPCs in changed rooms reserve walkable squares; walking Reliquary guards follow grid paths instead of cutting through displays, walls or players.
- **Crypts:** each Guardian of Faith has winged armor, a sword, shield, a bright halo, luminous circular floor sigils, and an attached light source.
- **Washrooms:** men's and women's wings each have three enclosed stalls with angled doors and a three-basin wash station. The men's wing has three urinals and the women's wing has none. Each has a Mass Chamber exit.
- **New rooms:** Training Field, Loom Room, Apple Garden, and Store Room. Added these to the room dropdown and added four matching portals in the Mass Chamber.
- **Spawn controls:** Monk and Monk Instructor now work like kitchen animals: select, click a free tile to summon, move up to six squares, remove one, or clear all.

All rooms use procedural geometry. The new-room builder functions can be customized inside `src/temple.js`.
