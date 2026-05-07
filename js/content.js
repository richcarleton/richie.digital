// ── content.js — edit this to update site content ────────────────────────────
// SITE_CONTENT  → terminal commands that open text panels
// SITE_MEDIA    → terminal commands that trigger the zoom-through viewer

window.SITE_CONTENT = {

  work: {
    title: 'work',
    items: [
      { label: 'Project One',   sub: 'description or link' },
      { label: 'Project Two',   sub: 'description or link' },
      { label: 'Project Three', sub: 'description or link' },
    ],
  },

  music: {
    title: 'music',
    items: [
      { label: 'Track / Album One', sub: 'year or link' },
      { label: 'Track / Album Two', sub: 'year or link' },
    ],
  },

  about: {
    title: 'about',
    items: [
      { label: 'richie.digital', sub: 'one or two lines about you' },
    ],
  },

  contact: {
    title: 'contact',
    items: [
      { label: 'email',    sub: 'you@example.com' },
      { label: 'github',   sub: 'github.com/richcarleton' },
      { label: 'linkedin', sub: 'link or handle' },
    ],
  },

};

// ── media viewer entries ───────────────────────────────────────────────────────
// type: 'svg'   → renders inline, scales perfectly at any size
// type: 'image' → photo/raster, shown with label + sub caption below
//
// Add a command key, drop the file in img/ or wherever, update src.

window.SITE_MEDIA = {

  logo: {
    type:  'svg',
    src:   'img/favicon.svg',
    label: 'richie.digital',
    sub:   '',
  },

  // example image entry — swap src / label / sub for real content:
  // poster: {
  //   type:  'image',
  //   src:   'img/poster.jpg',
  //   label: 'Project Title',
  //   sub:   '2024',
  // },

};
