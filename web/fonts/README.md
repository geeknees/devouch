# Workspace fonts

These unmodified Latin WOFF2 files are bundled locally. The workspace makes no
font requests to Google Fonts or another external service, and the build needs
no network access. Characters outside the supplied glyphs use the system
fallbacks declared in `web/style.css`.

- Instrument Serif: regular 400 and italic 400.
- IBM Plex Sans: a variable WOFF2 supplies normal 400 and 500 from one file.
- IBM Plex Mono: normal 400 and 500.

`sources.json` records the original Google Fonts download URLs and SHA-256
digests. All three families use the SIL Open Font License 1.1; the accompanying
`*-OFL.txt` files preserve each copyright and license from the pinned official
Google Fonts repository revision. Only line endings and trailing whitespace are
normalized; the manifest includes both source and vendored license digests.
`scripts/notices.rb` includes these complete
texts in both distribution notice files.

`scripts/build.ts` copies the WOFF2 files into `dist/web/fonts/`. Keep these files,
their provenance, and their licenses together when updating a typeface.
