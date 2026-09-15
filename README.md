# Nockra portable build

This build fixes subdirectory deployment and favicon collisions. It works at a domain root or under a path such as `/NockraApp/`.

- No `<base href="/">` is used.
- Every internal HTML link and asset reference is relative to the project.
- `core.js` discovers the project base from its own script URL and loads `config.json` from that base.
- `/nockra/` and every tool are physical directories containing `index.html`.
- The Nockra favicon is embedded directly in every page and also supplied as PNG/ICO.

Deploy the contents of this directory, not the parent directory.
