# richie.digital

Starfield calling card. No frameworks, no build step, no nonsense.

## structure

```
index.html
css/style.css       — all variables at the top, tweak freely
js/stars.js         — canvas warp field
js/nameplate.js     — text styles + glitch + collapse sequence
js/nav.js           — hover trigger + warp speed hook
CNAME               — custom domain for GitHub Pages
```

## deploy to GitHub Pages

1. push this repo to github
2. settings > pages > deploy from branch > main > / (root)
3. custom domain: richie.digital
4. tick "enforce HTTPS"

## DNS (Cloudflare)

Four A records pointing @ to GitHub's IPs:
```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```
One CNAME: www -> yourusername.github.io

## tweaking

**add a text style** — open `js/nameplate.js`, add a function to the `styles` array before the last entry. the last entry always triggers the collapse-to-nav sequence.

**change cycle speed** — find `setInterval(cycle, 2800)` near the bottom of nameplate.js.

**nav items** — edit the `<a>` tags in index.html.

**colors / sizing** — css variables in style.css `:root`.
