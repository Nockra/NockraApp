import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const exists=f=>fs.existsSync(path.join(root,f));
const must=(cond,msg)=>{if(!cond)throw new Error(msg)};
const cfg=JSON.parse(read('config.json'));
const html=read('index.html');
const app=read('app.js');
const css=read('styles.css');
const i18n=read('i18n.js');
const bootstrap=read('bootstrap.js');

must(cfg.network==='Robinhood Chain','network must be Robinhood Chain');
must(cfg.chain?.id===4663 && String(cfg.chain?.hexId).toLowerCase()==='0x1237','Robinhood Chain ID mismatch');
must(cfg.chain?.name==='Robinhood Chain','wallet chain name missing');
must(cfg.buyUrlTemplate==='https://ponsfamily.com/launchpad/{ca}','buy template mismatch');
const buy=(template,address)=>template.replace('{ca}',address);
must(buy(cfg.buyUrlTemplate,'ABC123')==='https://ponsfamily.com/launchpad/ABC123','ABC123 buy URL replacement failed');
must(buy(cfg.buyUrlTemplate,'XYZ999')==='https://ponsfamily.com/launchpad/XYZ999','XYZ999 buy URL replacement failed');
must(cfg.imageUploadEndpoint==='/api/upload','image upload endpoint mismatch');

for(const [f,src] of [['app.js',app],['bootstrap.js',bootstrap],['token-artifact.js',read('token-artifact.js')],['i18n.js',i18n]]) new vm.Script(src,{filename:f});

for(const href of ['/docs','/privacy','/terms','/disclaimer','/cookies']) must(html.includes(`href="${href}"`),`missing link ${href}`);
for(const f of ['docs/index.html','privacy/index.html','terms/index.html','disclaimer/index.html','cookies/index.html','nockra/index.html','404.html']) must(exists(f),`missing route fallback ${f}`);
must(read('vercel.json').includes('"handle": "filesystem"') && read('vercel.json').includes('"dest": "/index.html"'),'Vercel SPA route fallback missing');
must(read('_redirects').includes('/* /index.html 200'),'static SPA redirect missing');

for(const tool of ['token-creator','pons-v2','multisender','revoke','mint','burn','create-pool','add-liquidity','remove-liquidity','pause','unpause','block','unblock','token-page']) must(app.includes(`id:'${tool}'`),`missing tool ${tool}`);

must(app.includes("tpl.replace('{ca}',ca)"),'dynamic {ca} replacement helper missing');
must(app.includes("path==='/docs'") && app.includes("path==='/privacy'") && app.includes("path==='/cookies'"),'route handlers missing');
must(app.includes('function disconnectWallet()') && html.includes('id="disconnectWallet"'),'wallet disconnect missing');
must(app.includes("method:'eth_requestAccounts'") && app.includes('wallet_switchEthereumChain') && app.includes('wallet_addEthereumChain'),'wallet connect/switch flow incomplete');
must(html.includes('id="languageToggle"') && app.includes('NockraI18n?.toggle'),'language toggle missing');
must(html.includes('id="themeToggle"') && app.includes('function toggleTheme()'),'theme toggle missing');
must(i18n.includes("'zh-CN'") && i18n.includes("localStorage.getItem('nockra:lang')"),'Chinese localization state missing');
must(css.includes('font-family:"Poppins"!important'),'Poppins global font rule missing');
for(const m of css.matchAll(/font-family\s*:\s*([^;}]+)/g)){const value=m[1];must(/Poppins|var\(--font\)/.test(value),`non-Poppins font family found: ${value}`)}

for(const id of ['creatorWebsite','creatorTwitter','creatorTelegram','creatorDiscord','creatorDescription']) must(app.includes(id),`token creator social/profile field missing: ${id}`);
must(app.includes("imageFileField('Token image','ponsLogoFile'") && app.includes('type="file"'),'Pons file image selector missing');
must(!/Logo URI|logo URI/i.test(html+app),'Pons UI still asks for Logo URI');
must(exists('api/upload.js') && read('api/upload.js').includes('PINATA_JWT') && read('api/upload.js').includes('ipfs://'),'image upload backend missing');

const publicSource=html+app+i18n;
must(!/charity/i.test(publicSource),'charity reference remains in public app');
must(!/CA_GOES_HERE|YOUR_X_URL|YOUR_USERNAME|Lorem Ipsum|Update config\.json|Missing configuration|Configuration error|Development mode|stack trace/i.test(html),'HTML contains a prohibited visible marker');
must(app.includes('isPlaceholder') && app.includes('CA_GOES_HERE'),'placeholder suppression is missing');
const arrowChars=/[→↗←↓↑⇢⇠➜➝➞➟➠➡⟶⟵›»❯❮▶▷◀◁]/u;
must(!arrowChars.test(publicSource+css),'arrow glyph remains in public source');
for(const ch of publicSource){must(ch.codePointAt(0)<0x1F000,`emoji-range character remains: U+${ch.codePointAt(0).toString(16)}`)}
must(!app.includes('M6 18 18 6M11 6h7v7') && !app.includes('M4 12h13M13 8l4 4-4 4'),'arrow-shaped tool icons remain');

for(const asset of ['assets/favicon.png','assets/nockra-mark.png','assets/nockra-badge.png']) must(exists(asset),`missing ${asset}`);
console.log('QA passed: routes, wallet flow, tools, Poppins, Chinese/theme toggles, social fields, file upload, arrows/emoji and public cleanliness.');
