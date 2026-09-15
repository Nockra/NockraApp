# Nockra Final Stable Pack

This build includes an interaction-loader fix so the UI does not wait for external blockchain libraries before navigation, theme, language, tool routing, and menus become usable. Ethers loads in the background with parallel CDN fallbacks. Wallet authorization and chain switching use the injected wallet directly, while contract actions wait for the library only when needed.

## Deployment

Deploy the **contents of this folder** as the site root. `index.html`, `config.json`, `vercel.json`, `_redirects`, `app.js`, and `bootstrap.js` must stay at the root.

The known public routes (`/nockra`, `/docs`, `/privacy`, `/terms`, `/disclaimer`, `/cookies`) have both physical static fallbacks and Vercel rewrites.

Production-oriented Robinhood Chain token-tooling interface with the Pons V2 launch flow.

## Public project values
Public brand/project values live in `config.json`: coin name, ticker, network label, contract address, X URL and the Pons Family buy URL template. The Buy destination is generated from `buyUrlTemplate` by replacing `{ca}` with `contractAddress`.

Do not put private keys, seed phrases, wallet credentials or API secrets in `config.json`.

## Routes
- `/`
- `/{ticker in lowercase}`, for example `/nockra`
- `/docs`
- `/privacy`
- `/terms`
- `/disclaimer`
- `/cookies`
- branded 404 page
- tool workspaces at `/#tool/<tool-id>`

The pack includes both SPA rewrites and physical fallback route folders for the default ticker and public pages. This prevents direct-page refreshes such as `/nockra` or `/docs` from falling through to a hosting-provider 404.

## Wallet connection
The header wallet button requests wallet access when disconnected. Once connected, clicking the same button opens a wallet menu containing Copy address, View on explorer and Disconnect. Disconnect clears the Nockra browser session. Wallet-extension site permissions remain under the wallet extension's own controls.

Robinhood Chain parameters are included in `config.json`, so compatible injected wallets can switch to or add the network when required.

## Pons V2 token image upload
The Pons V2 form uses a real local image chooser rather than asking visitors for a logo URI. PNG, JPEG and WebP are accepted. The browser optimizes oversized raster images before upload and the resulting IPFS URI is passed to the Pons V2 launch transaction.

The included Vercel serverless endpoint is `api/upload.js`. For production image uploads, add a server-side environment secret named `PINATA_JWT` to the deployment. The secret is never sent to the browser and must not be added to `config.json`.

If you use another image-storage provider, replace the server implementation while preserving the `{ ok: true, uri: "ipfs://..." }` response shape expected by the front end.

## Themes and language
The interface includes dark and light themes and English/Chinese switching. Preferences are stored in browser local storage. Poppins is the only UI font family requested by the stylesheet.

## Hosting
- Vercel: deploy this folder as the project root. `vercel.json` is included.
- Netlify-compatible hosts: `_redirects` is included.
- Traditional static hosting: upload the complete folder. Physical route fallback folders are included for the shipped default routes.

The ZIP is packaged with `index.html`, `vercel.json`, assets and source files at the archive root. Do not deploy an extra parent directory above them.

## Local review
From the project root:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080/`. Physical public routes can also be reviewed locally with a trailing slash, such as `http://localhost:8080/nockra/`.

## Transaction testing
All blockchain writes require a compatible injected EVM wallet, Robinhood Chain RPC access, sufficient gas funds, the relevant token permissions and user approval. Mainnet transactions should be tested with the deployment wallet before public release.
