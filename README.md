# richie.digital

Starfield space stuff

## structure

```
index.html
css/style.css       — all variables at the top, tweak freely
js/stars.js         — canvas warp field
js/nameplate.js     — text styles + glitch + collapse sequence
js/nav.js           — hover trigger + warp speed hook
CNAME               — custom 


**add a text style** — open `js/nameplate.js`, add a function to the `styles` array before the last entry. the last entry always triggers the collapse-to-nav sequence.

**change cycle speed** — find `setInterval(cycle, 2800)` near the bottom of nameplate.js.

**nav items** — edit the `<a>` tags in index.html.

**colors / sizing** — css variables in style.css `:root`.
