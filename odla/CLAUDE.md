# CLAUDE.md – ODLA

Keep this file current. When the workflow, the structure or a standing preference changes, update it in the same change.

## Workflow

- ODLA lives in `odla/` on its own branch in the WO repo, apart from the training app. It is a standalone static app: `index.html` plus `scene.js` (the 3D module) and the icons.
- Talk to Simon in Swedish. The app's text is Swedish.
- Check changes in a phone-width browser (390 px) with Playwright, and on iPad Air sizes (820×1180, 1180×820) when the layout changes.
- Same look, feel and motion as RECIPES and KNIT (simonjsv98/recipes, simonjsv98/knit): Google Sans, #F3F2EF background, fixed top bar, colour tiles on the start page, a list page with a coloured title and dot, short fades between pages, swipe right to go back, sheets that slide up and down, a fixed button at the bottom, the update button with the circle wipe. The motion code is copied from KNIT; keep them in step.
- ODLA's colours: deep green #24412C with pale lime #D4EC9A (dots #8CC152) for LANDET; rust #B4502A with #FFE3D2 for SÄSONG (the colour of the rebar fence); pale sage #DCE7C5 with #24412C for DAGBOK.

## Structure

- `index.html`: everything except the 3D scene. `CROPS` (sowing, planting and harvest months for southern Sweden, family, and how the crop is drawn in 3D), `sketch()` (the garden as first sketched from Simon's photos), the views (start, LANDET, SÄSONG, DAGBOK), the map (`drawPlan`, drawn as SVG in metres) and the sheets.
- `build/scene-src.js`: the 3D model with three.js. Run `npm install` and `npm run build` in `odla/` after changing it; that writes `scene.js`. Commit the rebuilt `scene.js`.
- Coordinates are metres. x runs from the west fence eastwards, y from the front fence (where the gate and the stone-edged border are) backwards. The map has north (the back) up. In 3D the front faces the camera.
- Data is saved in localStorage under `odla-data`: `garden` (fence size, gate, beds, items), `plantings` (crop, bed, year and the stretch of the bed it takes, `from`–`to` as fractions of the bed's long side, with optional dates), `log` (the journal) and `done` (ticked tasks). It can be saved to and read from a file.
- A planting's dates (sown, planted, first harvest, cleared) decide how big it looks in 3D at the time chosen with the slider; without dates the crop's usual months are used.
- Crop rotation (`ROT_GROUPS`, `FAM_GROUP`): potatis & tomat → ärtväxter → kål & gurkväxter → rot, lök & blad. A bed's suggestion follows from what took most of it the year before.

## The sketch

All measurements in `sketch()` are guesses from five photos from summer 2026: a fenced plot (about 12 × 8 m) of rebar mesh on wooden posts, a wooden gate at the east end of the front, raised beds (wood and white-painted), a pea bed with a bamboo A-frame and tomatoes, hooped fleece tunnels, a red obelisk with rhubarb, a compost of red boards at the back, a white stool, and a stone-edged border with dill outside the front fence. Replace them with Simon's measurements as he gives them.
