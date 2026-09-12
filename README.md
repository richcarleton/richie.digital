# richie.digital

Starfield space stuff + Ricardo's platform adventure

## structure

```
index.html          — landing page: starfield/terminal/face-mesh page (type "catalog" or "?")
catalog.html        — 90s-catalogue grid linking out to every unit (was index.html)
css/style.css       — all variables at the top, tweak freely (used by index.html)
js/stars.js         — canvas warp field
js/nameplate.js     — text styles + glitch + collapse sequence
js/nav.js           — hover trigger + warp speed hook
CNAME               — custom 

ricardo/            — platform game (in progress)
webGL/              — dither planet viewer
motobang/           — motorcycle suit configurator
spline/             — spline-domain toolpath flow field toy
```

## tweaks

**add a text style** — open `js/nameplate.js`, add a function to the `styles` array before the last entry. the last entry always triggers the collapse-to-nav sequence.

**change cycle speed** — find `setInterval(cycle, 2800)` near the bottom of nameplate.js.

**nav items** — hidden terminal commands live in js/terminal.js; the visible grid tiles are `<a>` tags in catalog.html.

**colors / sizing** — css variables in style.css `:root`.

## Ricardo adjustments

**jump height** — now 16 tiles/s takeoff (was 13.5)

**climbing** — ladder/rope logic reworked for smooth top transitions

**fall damage** — removed entirely
