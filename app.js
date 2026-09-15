(async () => {
  'use strict';

  const DEFAULT_CONFIG = {
    coinName:'', ticker:'', network:'', contractAddress:'', xUrl:'', buyUrlTemplate:'', description:'', imageUploadEndpoint:'/api/upload',
    chain:{id:4663,hexId:'0x1237',name:'Solana',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrl:'https://rpc.mainnet.chain.robinhood.com',explorerUrl:'https://solscan.io'},
    ponsV2:{factory:'0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e',usdG:'0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',publicSite:'https://www.ponsfamily.com/launchpad'},
    uniswapV3:{factory:'0x1f7d7550B1b028f7571E69A784071F0205FD2EfA',positionManager:'0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3',swapRouter:'0xCaf681a66D020601342297493863E78C959E5cb2',quoterV2:'0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7',weth:'0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73'}
  };
  const mergeConfig=(a,b)=>({...a,...(b||{}),chain:{...a.chain,...(b?.chain||{}),nativeCurrency:{...a.chain.nativeCurrency,...(b?.chain?.nativeCurrency||{})}},ponsV2:{...a.ponsV2,...(b?.ponsV2||{})},uniswapV3:{...a.uniswapV3,...(b?.uniswapV3||{})}});
  // Capture the directory that actually served app.js. This makes the app work at a
  // domain root, inside a subdirectory, and from physical fallback pages.
  const APP_BASE_URL=(()=>{try{return new URL('.',document.currentScript?.src||document.baseURI).href}catch{return './'}})();
  const APP_BASE_PATH=(()=>{try{return new URL(APP_BASE_URL).pathname.replace(/\/+$/,'')||'/'}catch{return '/'}})();
  const siteHref=(path='')=>{try{return new URL(String(path||'').replace(/^\/+/,''),APP_BASE_URL).href}catch{return path||'./'}};
  function fixInternalUrls(root=document){
    root.querySelectorAll?.('a[href^="/"]').forEach(a=>{const raw=a.getAttribute('href');if(!raw)return;a.href=siteHref(raw)});
    root.querySelectorAll?.('img[src^="/assets/"]').forEach(img=>{const raw=img.getAttribute('src');if(raw)img.src=siteHref(raw)});
  }
  let C=mergeConfig(DEFAULT_CONFIG,window.NOCKRA_CONFIG||{});
  window.NOCKRA_CONFIG=C;
  async function loadConfig(){
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=setTimeout(()=>controller?.abort(),1800);
    try{
      const url=new URL('config.json',APP_BASE_URL).href;
      const r=await fetch(url,{cache:'no-store',signal:controller?.signal});
      if(!r.ok)return null;
      const json=await r.json();
      return json&&typeof json==='object'?json:null;
    }catch{return null}finally{clearTimeout(timer)}
  }
  async function refreshConfig(){
    const loaded=await loadConfig();
    if(!loaded)return;
    C=mergeConfig(DEFAULT_CONFIG,loaded);
    window.NOCKRA_CONFIG=C;
    try{hydratePublicConfig()}catch{}
    try{renderContracts()}catch{}
    try{route()}catch{}
    try{updateWalletUI()}catch{}
  }
  const storageGet=(k,f='')=>{try{return window.localStorage?.getItem(k)??f}catch{return f}};
  const storageSet=(k,v)=>{try{window.localStorage?.setItem(k,v)}catch{}};
  const storageRemove=k=>{try{window.localStorage?.removeItem(k)}catch{}};
  let E = window.ethers || null;
  const ARTIFACT = window.NOCKRA_TOKEN_ARTIFACT;
  const ZERO = '0x0000000000000000000000000000000000000000';
  const MAX_UINT128 = (1n << 128n) - 1n;
  const MIN_TICK = -887272;
  const MAX_TICK = 887272;

  const ERC20 = [
    'function name() view returns (string)','function symbol() view returns (string)','function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)','function balanceOf(address) view returns (uint256)',
    'function allowance(address,address) view returns (uint256)','function approve(address,uint256) returns (bool)',
    'function transfer(address,uint256) returns (bool)','function mint(address,uint256)','function mint(uint256)',
    'function burn(uint256)','function pause()','function unpause()','function paused() view returns (bool)'
  ];
  const OWNABLE = ['function owner() view returns (address)','function renounceOwnership()'];
  const ACCESS = [
    'function DEFAULT_ADMIN_ROLE() view returns (bytes32)','function MINTER_ROLE() view returns (bytes32)','function PAUSER_ROLE() view returns (bytes32)',
    'function hasRole(bytes32,address) view returns (bool)','function renounceRole(bytes32,address)'
  ];
  const PONS_READ = [
    'function launchEnabled() view returns (bool)','function canLaunch(address) view returns (bool)',
    'function launchConfigCount() view returns (uint256)',
    'function getLaunchConfig(uint256) view returns ((uint256 supply,uint256 curveFeeBps,uint256 phantomQuote,uint256 graduationThreshold,uint24 poolFee,int24 tickSpacing,bool enabled))',
    'function launchFee() view returns (uint256)','function maxCreatorTaxBps() view returns (uint256)',
    'function approvedPairTokens(address) view returns (bool)','function previewLaunchEconomics(uint256,address) view returns (bytes32)',
    'function launchForwarder() view returns (address)'
  ];
  const PONS_LAUNCH = [
    'function launchToken((string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,address creatorFeeRecipient,uint16 creatorTaxBps,bool buybackEnabled,bytes32 expectedEconomics,bytes32 salt) params,uint256 launchConfigId,address pairToken) payable returns (address token,address curve)'
  ];
  const PONS_LAUNCH_EXEMPT = [
    'function launchToken((string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,address creatorFeeRecipient,uint16 creatorTaxBps,bool buybackEnabled,bytes32 expectedEconomics,bytes32 salt) params,uint256 launchConfigId,address pairToken,address[] snipeTaxExemptions) payable returns (address token,address curve)'
  ];
  const PONS_FORWARDER = [
    'function launchAndBuy((string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,address creatorFeeRecipient,uint16 creatorTaxBps,bool buybackEnabled,bytes32 expectedEconomics,bytes32 salt) params,uint256 launchConfigId,address pairToken,uint256 quoteIn,uint256 minTokensOut,address recipient,address[] snipeTaxExemptions) payable returns (address token,address curve,uint256 tokensOut)'
  ];
  const V3_FACTORY = [
    'function getPool(address,address,uint24) view returns (address)',
    'function feeAmountTickSpacing(uint24) view returns (int24)'
  ];
  const V3_POSITION = [
    'function createAndInitializePoolIfNecessary(address token0,address token1,uint24 fee,uint160 sqrtPriceX96) payable returns (address pool)',
    'function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) payable returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)',
    'function positions(uint256 tokenId) view returns (uint96 nonce,address operator,address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 feeGrowthInside0LastX128,uint256 feeGrowthInside1LastX128,uint128 tokensOwed0,uint128 tokensOwed1)',
    'function decreaseLiquidity((uint256 tokenId,uint128 liquidity,uint256 amount0Min,uint256 amount1Min,uint256 deadline)) returns (uint256 amount0,uint256 amount1)',
    'function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max)) returns (uint256 amount0,uint256 amount1)',
    'function ownerOf(uint256 tokenId) view returns (address)'
  ];

  const TOOLS = [
    {id:'token-creator',name:'Token Creator',cat:'Create',icon:'token',desc:'Create a Solana token with supply, metadata and authority settings.'},
    {id:'pons-v2',name:'Buy on Pump.fun',cat:'Launch',icon:'launch',desc:'Launch through the live Pump.fun factory.',featured:true},
    {id:'multisender',name:'Multisender',cat:'Distribution',icon:'send',desc:'Send SOL or SPL tokens to multiple recipients.'},
    {id:'revoke',name:'Revoke Ownership',cat:'Controls',icon:'lock',desc:'Renounce Ownable control or selected AccessControl roles.'},
    {id:'mint',name:'Mint Tokens',cat:'Controls',icon:'plus',desc:'Mint on contracts that expose a supported mint function.'},
    {id:'burn',name:'Burn Tokens',cat:'Controls',icon:'burn',desc:'Burn tokens from the connected Solana wallet.'},
    {id:'create-pool',name:'Create Liquidity Pool',cat:'Liquidity',icon:'pool',desc:'Set up Solana liquidity planning workflows.'},
    {id:'add-liquidity',name:'Add Liquidity',cat:'Liquidity',icon:'liquidity',desc:'Mint a Uniswap V3 LP position.'},
    {id:'remove-liquidity',name:'Remove Liquidity',cat:'Liquidity',icon:'remove',desc:'Decrease and collect a V3 LP position.'},
    {id:'pause',name:'Pause Token',cat:'Controls',icon:'pause',desc:'Call pause() on compatible token contracts.'},
    {id:'unpause',name:'Unpause Token',cat:'Controls',icon:'play',desc:'Call unpause() on compatible token contracts.'},
    {id:'block',name:'Block Account',cat:'Controls',icon:'block',desc:'Call a supported blocklist pattern after simulation.'},
    {id:'unblock',name:'Unblock Account',cat:'Controls',icon:'unblock',desc:'Call a supported unblock pattern after simulation.'},
    {id:'token-page',name:'Token Page',cat:'Inspect',icon:'page',desc:'Read live ERC-20 supply, wallet balance and controls.'}
  ];
  function iconSvg(name){
    const common='fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
    const paths={
      token:'<circle cx="12" cy="12" r="7"/><path d="M9 9h6v6H9z"/>',
      launch:'<circle cx="12" cy="12" r="3.2"/><path d="M4.8 12a7.2 7.2 0 0 1 7.2-7.2M19.2 12a7.2 7.2 0 0 1-7.2 7.2"/>',
      send:'<circle cx="6" cy="7" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="6" cy="17" r="2"/><path d="M8 7.8l8 3M8 16.2l8-3"/>',
      lock:'<rect x="6" y="10" width="12" height="9" rx="2"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
      plus:'<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
      burn:'<path d="M12 3c1 4-2 5-2 8 0 2 1 3 2 3s2-1 2-3c2 2 3 4 3 6a5 5 0 0 1-10 0c0-4 3-6 5-14Z"/>',
      pool:'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
      liquidity:'<path d="M4 15c4-6 7-6 10 0 2 4 4 4 6 0"/><path d="M4 9c4-6 7-6 10 0 2 4 4 4 6 0"/>',
      remove:'<path d="M4 15c4-6 7-6 10 0 2 4 4 4 6 0"/><path d="M8 7h8"/>',
      pause:'<circle cx="12" cy="12" r="8"/><path d="M10 9v6M14 9v6"/>',
      play:'<path d="M7 6a8 8 0 1 0 10 0"/><path d="M12 4v8"/>',
      block:'<circle cx="12" cy="12" r="8"/><path d="m7 7 10 10"/>',
      unblock:'<path d="M5 5l14 14"/><path d="M17 7a8 8 0 0 0-10 10"/>',
      page:'<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5M10 12h5M10 16h5"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true" ${common}>${paths[name]||paths.page}</svg>`;
  }
  const GROUP_ORDER = ['Create','Launch','Liquidity','Distribution','Controls','Inspect'];
  const CATEGORY_COPY = {
    Create:'Start a token journey.', Launch:'Go live through Pump.fun.', Liquidity:'Work with Uniswap V3.',
    Distribution:'Send assets to holders.', Controls:'Use permissions defined by a token.', Inspect:'Read live token state.'
  };

  const state = {
    publicProvider: null,browserProvider:null,signer:null,account:null,chainOk:false,
    block:null,pons:null,launchConfigs:[],activeFilter:'All',controlInspection:null,ponsLogoUri:'',siteDisconnected:false
  };

  const safeConfigString = v => typeof v === 'string' ? v.trim() : '';
  const isPlaceholder = v => /^(?:CA_GOES_HERE|COIN NAME|ABC|YOUR_X_URL|YOUR_USERNAME|PLACEHOLDER|TODO|TBD|REPLACE_ME|\{ca\})$/i.test(safeConfigString(v));
  const coinName = () => (!isPlaceholder(C.coinName) && safeConfigString(C.coinName)) || 'Project';
  const ticker = () => (!isPlaceholder(C.ticker) && safeConfigString(C.ticker)) || '';
  const networkName = () => (!isPlaceholder(C.network) && safeConfigString(C.network)) || 'Network';
  const contractAddress = () => { const v=safeConfigString(C.contractAddress); return v && !isPlaceholder(v) ? v : ''; };
  const xUrl = () => { const v=safeConfigString(C.xUrl); try { const u=new URL(v); return /^https:$/.test(u.protocol) && /(^|\.)x\.com$/i.test(u.hostname) ? u.href : ''; } catch { return ''; } };
  const getBuyUrl = () => { const ca=contractAddress(); const tpl=safeConfigString(C.buyUrlTemplate); if(!ca || !tpl || isPlaceholder(tpl) || !tpl.includes('{ca}')) return ''; try { const u=new URL(tpl.replace('{ca}', encodeURIComponent(ca))); return /^https:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } };
  const tickerPath = () => { const t=ticker().toLowerCase().replace(/[^a-z0-9-]/g,''); return t?`/${t}`:''; };
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const short = (s,a=6,b=4) => !s ? '—' : s.length <= a+b+3 ? s : `${s.slice(0,a)}…${s.slice(-b)}`;
  const explorer = (type,value) => (String(C.network||'').toLowerCase()==='solana' ? `${C.chain.explorerUrl}/${type==='token'?'token':'account'}/${encodeURIComponent(value)}` : `${C.chain.explorerUrl}/${type}/${value}`);
  const isAddress = v => { const s=String(v||'').trim(); return (E ? (()=>{try{return E.isAddress(s)}catch{return false}})() : /^0x[a-fA-F0-9]{40}$/.test(s)) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s); };
  const addr = v => normalizeAddress(v) || String(v||'').trim();
  const nowPlus = seconds => BigInt(Math.floor(Date.now()/1000)+seconds);
  const normalizeAddress = v => {
    const raw=String(v||'').trim();
    if(E){try{return E.getAddress(raw)}catch{}}
    return (/^0x[a-fA-F0-9]{40}$/.test(raw) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(raw)) ? raw : '';
  };
  function loadExternalScript(src,timeoutMs=6500){
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');let done=false;
      const finish=(ok)=>{if(done)return;done=true;clearTimeout(timer);s.onload=null;s.onerror=null;ok?resolve():reject(new Error('load failed'))};
      const timer=setTimeout(()=>finish(false),timeoutMs);
      s.src=src;s.async=true;s.onload=()=>finish(true);s.onerror=()=>finish(false);document.head.appendChild(s);
    });
  }
  async function ensureEthersReady(){
    if(E) return E;
    if(window.ethers){E=window.ethers;return E}
    if(!window.NOCKRA_ETHERS_READY){
      window.NOCKRA_ETHERS_READY=(async()=>{
        const sources=[
          'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.5/ethers.umd.min.js',
          'https://cdn.jsdelivr.net/npm/ethers@6.13.5/dist/ethers.umd.min.js',
          'https://unpkg.com/ethers@6.13.5/dist/ethers.umd.min.js'
        ];
        for(const src of sources){try{await loadExternalScript(src);if(window.ethers)return window.ethers}catch{}}
        return null;
      })();
    }
    try{E=await window.NOCKRA_ETHERS_READY}catch{E=null}
    return E||null;
  }
  async function requireEthers(){
    const lib=await ensureEthersReady();
    if(!lib) throw new Error('Wallet tools are temporarily unavailable. Please try again.');
    return lib;
  }
  async function attachSigner(){
    const lib=await ensureEthersReady();
    if(!lib || !window.ethereum?.request || !state.account) return null;
    state.browserProvider=new lib.BrowserProvider(window.ethereum,'any');
    state.signer=await state.browserProvider.getSigner();
    const a=normalizeAddress(await state.signer.getAddress());
    if(a) state.account=a;
    return state.signer;
  }


  function errorText(err){
    const raw=String(err?.shortMessage||err?.reason||err?.message||'');
    if(/user rejected|user denied|ACTION_REJECTED|rejected the request/i.test(raw)) return 'The request was cancelled in your wallet.';
    if(/insufficient funds/i.test(raw)) return 'Your wallet does not have enough funds for this action and network fees.';
    if(/wrong network|chain|network changed|unsupported chain/i.test(raw)) return `Please connect your wallet to ${networkName()} and try again.`;
    if(/execution reverted|revert|call exception|missing revert data/i.test(raw)) return 'The contract did not accept this action. Check the token permissions, amounts and current on-chain state.';
    if(/wallet|provider|ethereum/i.test(raw)) return 'The wallet connection could not complete. Check your wallet and try again.';
    return 'The action could not be completed. Review the details and try again.';
  }
  function toast(message,type='info'){
    const n=document.createElement('div');n.className=`toast ${type}`;n.textContent=message;$('toastHost').appendChild(n);setTimeout(()=>n.remove(),5200);
  }
  function message(id,text,type='info',html=false){
    const n=$(id);if(!n)return;n.className=`tx-message show ${type}`;if(html)n.innerHTML=text;else n.textContent=text;
  }
  function clearMessage(id){const n=$(id);if(n){n.className='tx-message';n.textContent='';}}
  function busy(btn,on,text){if(!btn)return;if(on){btn.dataset.label=btn.textContent;btn.textContent=text||'Working…';btn.disabled=true}else{btn.textContent=btn.dataset.label||btn.textContent;btn.disabled=false}}
  function field(label,id,placeholder='',extra='',type='text',value=''){
    return `<label class="field"><span class="field-title"><span>${label}</span>${extra?`<em>${extra}</em>`:''}</span><input class="input" id="${id}" name="${id}" type="${type}" placeholder="${esc(placeholder)}" value="${esc(value)}" /></label>`;
  }
  function textarea(label,id,placeholder='',extra=''){
    return `<label class="field"><span class="field-title"><span>${label}</span>${extra?`<em>${extra}</em>`:''}</span><textarea class="textarea" id="${id}" name="${id}" placeholder="${esc(placeholder)}"></textarea></label>`;
  }
  function selectField(label,id,options,extra=''){
    return `<label class="field"><span class="field-title"><span>${label}</span>${extra?`<em>${extra}</em>`:''}</span><select class="select" id="${id}" name="${id}">${options.map(o=>`<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</select></label>`;
  }
  function imageFileField(label,id,extra=''){
    return `<label class="field"><span class="field-title"><span>${label}</span>${extra?`<em>${extra}</em>`:''}</span><span class="file-drop"><span class="file-preview" id="${id}Preview"><span>PNG<br>JPG<br>WEBP</span></span><span class="file-drop-copy"><strong>Select image</strong><small>Choose a square token image. Large images are optimized before upload.</small></span><input class="file-input" id="${id}" name="${id}" type="file" accept="image/png,image/jpeg,image/webp" /></span></label>`;
  }
  function safeProfileUrl(value){
    const v=String(value||'').trim();if(!v)return '';try{const u=new URL(v);return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}
  }
  function tokenProfileKey(address){return `nockra:token-profile:${String(address||'').toLowerCase()}`}
  function saveLocalTokenProfile(address,profile){try{localStorage.setItem(tokenProfileKey(address),JSON.stringify(profile))}catch{}}
  function getLocalTokenProfile(address){try{const raw=localStorage.getItem(tokenProfileKey(address));return raw?JSON.parse(raw):null}catch{return null}}
  function panel(title,body,cls=''){return `<section class="panel ${cls}"><h2>${title}</h2>${body}</section>`}
  function button(label,cls='action-button',type='submit',id=''){return `<button ${id?`id="${id}"`:''} class="${cls}" type="${type}">${label}</button>`}
  function txLink(hash,label='View transaction'){return `<a href="${explorer('tx',hash)}" target="_blank" rel="noopener noreferrer">${label}</a>`}
  function fmtUnits(value,decimals=18,max=6){
    if(value==null)return '—';const s=E.formatUnits(value,decimals);const [i,f='']=s.split('.');const ff=f.replace(/0+$/,'').slice(0,max);return ff?`${i}.${ff}`:i;
  }
  function fmtEth(value){return value==null?'—':`${fmtUnits(value,18,7)} ETH`}
  function parseAmount(value,decimals,label='Amount'){
    const s=String(value||'').trim();if(!/^\d+(\.\d+)?$/.test(s))throw new Error(`${label} must be a positive decimal number.`);return E.parseUnits(s,decimals);
  }
  function randomSalt(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return E.hexlify(bytes)}
  function isqrt(n){if(n<0n)throw new Error('Square root input cannot be negative.');if(n<2n)return n;let x0=1n<<(BigInt(n.toString(2).length)>>1n);let x1=(x0+n/x0)>>1n;while(x1<x0){x0=x1;x1=(x0+n/x0)>>1n}return x0}
  function decimalFraction(text){
    const s=String(text||'').trim();if(!/^\d+(\.\d+)?$/.test(s)||Number(s)<=0)throw new Error('Price must be greater than zero.');
    const [a,b='']=s.split('.');const frac=b.slice(0,18);return {n:BigInt((a||'0')+frac),d:10n**BigInt(frac.length)};
  }
  function sqrtPriceX96(price,dec0,dec1,invert=false){
    let {n,d}=decimalFraction(price);if(invert)[n,d]=[d,n];const q192=1n<<192n;
    const ratio=n*(10n**BigInt(dec1))*q192/(d*(10n**BigInt(dec0)));if(ratio<=0n)throw new Error('Price is too small for this pair.');
    const v=isqrt(ratio);if(v<=0n||v>=(1n<<160n))throw new Error('Price is outside the Uniswap V3 sqrt price range.');return v;
  }
  function parseLines(text,max=100){
    const lines=String(text||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);if(!lines.length)throw new Error('Add at least one recipient.');if(lines.length>max)throw new Error(`This interface supports up to ${max} recipients per run.`);
    return lines.map((line,i)=>{const parts=line.split(/[\s,;]+/).filter(Boolean);if(parts.length<2||!isAddress(parts[0]))throw new Error(`Line ${i+1} must be: address, amount`);return {address:addr(parts[0]),amountText:parts[1]}});
  }

  function renderToolNavigation(){
    const grouped=GROUP_ORDER.map(cat=>[cat,TOOLS.filter(t=>t.cat===cat)]).filter(([,items])=>items.length);
    $('toolsMenuGroups').innerHTML=grouped.map(([cat,items])=>`<div class="mega-group"><h3>${cat}</h3>${items.map(t=>`<a href="#tool/${t.id}"><span class="mega-icon">${iconSvg(t.icon)}</span><span>${t.name}${t.featured?'<span class="tool-badge">LIVE</span>':''}</span></a>`).join('')}</div>`).join('');
    $('sidebarGroups').innerHTML=grouped.map(([cat,items])=>`<div class="sidebar-group"><strong>${cat}</strong>${items.map(t=>`<button class="sidebar-tool" data-route-tool="${t.id}"><span>${iconSvg(t.icon)}</span><span>${t.name}</span></button>`).join('')}</div>`).join('');
    const cats=['All',...GROUP_ORDER.filter(c=>TOOLS.some(t=>t.cat===c))];
    $('categoryFilter').innerHTML=cats.map(c=>`<button type="button" data-filter="${c}" class="${c==='All'?'active':''}">${c}</button>`).join('');
    renderToolGrid();
  }
  function renderToolGrid(){
    const q=($('toolSearch')?.value||'').trim().toLowerCase();
    const groups=GROUP_ORDER.map(cat=>[cat,TOOLS.filter(t=>(state.activeFilter==='All'||state.activeFilter===cat)&&t.cat===cat&&(t.name.toLowerCase().includes(q)||t.desc.toLowerCase().includes(q)))]).filter(([,i])=>i.length);
    $('toolGrid').innerHTML=groups.length?groups.map(([cat,items])=>`<article class="tool-group-card"><div class="tool-group-head"><small>${cat.toUpperCase()}</small><h3>${CATEGORY_COPY[cat]}</h3></div>${items.map(t=>`<button class="tool-item ${t.featured?'featured':''}" data-route-tool="${t.id}" type="button"><span class="tool-icon">${iconSvg(t.icon)}</span><span><strong>${t.name}${t.featured?'<span class="tool-badge">LIVE</span>':''}</strong><small>${t.desc}</small></span></button>`).join('')}</article>`).join(''):`<div class="search-empty">No tool matches that search.</div>`;
  }
  function renderContracts(){
    const rows=[
      ['Pump.fun Factory',C.ponsV2.factory,'Launch rules, configs and direct launches'],
      ['Uniswap V3 Factory',C.uniswapV3.factory,'Pool discovery and tick spacing'],
      ['Uniswap V3 Position Manager',C.uniswapV3.positionManager,'Create pools and manage LP NFTs'],
      ['Wrapped ETH',C.uniswapV3.weth,'ERC-20 representation of ETH'],
      ['USDG',C.ponsV2.usdG,'Pons-supported pair asset when currently approved']
    ];
    $('contractList').innerHTML=rows.map(([name,address,note])=>`<div class="contract-row"><div><strong>${name}</strong><small>${note}</small><code>${address}</code></div><a href="${explorer('address',address)}" target="_blank" rel="noopener noreferrer">Blockscout </a></div>`).join('');
  }

  async function initPublic(){
    const lib=await ensureEthersReady();
    if(!lib){setNetworkOffline();return}
    try{
      state.publicProvider=new lib.JsonRpcProvider(C.chain.rpcUrl,C.chain.id,{staticNetwork:true});
      await refreshLive();
    }catch{setNetworkOffline()}
  }
  function setNetworkOffline(){
    ['rpcDot','headerRpcDot','workspaceRpcDot'].forEach(id=>$(id)?.classList.add('bad'));if($('rpcStatus'))$('rpcStatus').textContent='Unavailable';if($('ponsGate'))$('ponsGate').textContent='Unavailable';
  }
  async function readPons(){
    const f=new E.Contract(C.ponsV2.factory,PONS_READ,state.publicProvider);
    const [enabled,fee,maxTax,forwarder,count,block]=await Promise.all([f.launchEnabled(),f.launchFee(),f.maxCreatorTaxBps(),f.launchForwarder(),f.launchConfigCount(),state.publicProvider.getBlockNumber()]);
    const n=Number(count);if(!Number.isSafeInteger(n)||n<0||n>128)throw new Error('Unexpected Pons launch-option count.');
    const raw=await Promise.all(Array.from({length:n},(_,i)=>f.getLaunchConfig(i)));
    const configs=raw.map((x,i)=>({id:BigInt(i),supply:BigInt(x[0]),curveFeeBps:BigInt(x[1]),phantomQuote:BigInt(x[2]),graduationThreshold:BigInt(x[3]),poolFee:BigInt(x[4]),tickSpacing:BigInt(x[5]),enabled:Boolean(x[6])})).filter(x=>x.enabled);
    let canLaunch=null;if(state.account){try{canLaunch=Boolean(await f.canLaunch(state.account))}catch{canLaunch=false}}
    return {enabled:Boolean(enabled),fee:BigInt(fee),maxTax:BigInt(maxTax),forwarder,configs,block,canLaunch};
  }
  async function refreshLive(){
    try{
      const p=await readPons();state.pons=p;state.launchConfigs=p.configs;state.block=p.block;
      ['rpcDot','headerRpcDot','workspaceRpcDot'].forEach(id=>{const n=$(id);if(n)n.className='live-dot good'});
      if($('rpcStatus'))$('rpcStatus').textContent='Online';if($('latestBlock'))$('latestBlock').textContent=p.block.toLocaleString();if($('workspaceBlock'))$('workspaceBlock').textContent=`Block ${p.block.toLocaleString()}`;
      if($('ponsGate'))$('ponsGate').textContent=p.enabled?'Enabled':'Restricted';if($('ponsFeeHome'))$('ponsFeeHome').textContent=fmtEth(p.fee);updatePonsView();
    }catch{setNetworkOffline()}
  }
  async function ensureChain(){
    if(!window.ethereum)throw new Error('No injected EVM wallet was found in this browser.');
    let chain=String(await window.ethereum.request({method:'eth_chainId'})).toLowerCase();
    if(chain!==C.chain.hexId.toLowerCase()){
      try{await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:C.chain.hexId}]})}
      catch(err){
        if(err?.code!==4902&&!/unrecognized|not added/i.test(err?.message||''))throw err;
        await window.ethereum.request({method:'wallet_addEthereumChain',params:[{chainId:C.chain.hexId,chainName:C.chain.name||networkName(),nativeCurrency:C.chain.nativeCurrency,rpcUrls:[C.chain.rpcUrl],blockExplorerUrls:[C.chain.explorerUrl]}]});
      }
    }
    const final=String(await window.ethereum.request({method:'eth_chainId'})).toLowerCase();if(final!==C.chain.hexId.toLowerCase())throw new Error(`The wallet is not connected to ${networkName()}.`);state.chainOk=true;
  }
  async function connectWallet(){
    if(!window.ethereum?.request)throw new Error('No browser wallet was found.');
    const accounts=await window.ethereum.request({method:'eth_requestAccounts'});
    if(!accounts?.length)throw new Error('No wallet account was selected.');
    await ensureChain();
    state.account=normalizeAddress(accounts[0]) || accounts[0];
    state.siteDisconnected=false;
    storageRemove('nockra:wallet-disconnected');
    updateWalletUI();
    // Account connection must never wait on a third-party library CDN.
    // Signer attachment is upgraded in the background and required only for contract writes.
    void attachSigner().then(()=>{
      if(E && !state.publicProvider){try{state.publicProvider=new E.JsonRpcProvider(C.chain.rpcUrl,C.chain.id,{staticNetwork:true})}catch{}}
      if(state.publicProvider) void refreshLive();
    }).catch(()=>{state.signer=null;state.browserProvider=null});
    return state.account;
  }
  async function restoreWalletSession(){
    if(!window.ethereum?.request||storageGet('nockra:wallet-disconnected')==='1')return;
    try{
      const accounts=await window.ethereum.request({method:'eth_accounts'});
      if(!accounts?.length)return;
      state.account=normalizeAddress(accounts[0]) || accounts[0];
      const chain=String(await window.ethereum.request({method:'eth_chainId'})).toLowerCase();
      state.chainOk=chain===String(C.chain.hexId).toLowerCase();
      // Do not delay page routing while a remote library is loading.
      void attachSigner().catch(()=>{});
    }catch{state.account=null;state.signer=null;state.browserProvider=null}
  }
  function disconnectWallet(){
    state.account=null;state.signer=null;state.browserProvider=null;state.chainOk=false;state.siteDisconnected=true;
    storageSet('nockra:wallet-disconnected','1');
    if($('walletMenu'))$('walletMenu').hidden=true;
    updateWalletUI();updatePonsView();
  }
  async function requireWallet(){if(!state.account)await connectWallet();await ensureChain();await requireEthers();if(!state.signer)await attachSigner();if(!state.signer)throw new Error('The wallet connection could not complete. Check your wallet and try again.');return state.signer}
  function updateWalletUI(){
    const connected=Boolean(state.account);
    const zh=window.NockraI18n?.current?.()==='zh';
    const label=connected?short(state.account):(zh?'连接钱包':'Connect Wallet');
    if($('walletLabel'))$('walletLabel').textContent=label;
    $('connectWallet')?.classList.toggle('connected',connected);
    if($('sidebarWalletText'))$('sidebarWalletText').textContent=connected?short(state.account):(zh?'连接钱包':'Connect wallet');
    if($('walletStatusHome'))$('walletStatusHome').textContent=connected?short(state.account):'Not connected';
    if($('walletMenuAddress'))$('walletMenuAddress').textContent=connected?state.account:'';
    if($('walletExplorer'))$('walletExplorer').href=connected?explorer('address',state.account):'#';
    if(!connected&&$('walletMenu'))$('walletMenu').hidden=true;
    window.NockraI18n?.apply(document);
    updatePonsView();
  }

  function toolHeader(tool,subtitle,meta=''){
    return `<div class="tool-hero"><div><span class="eyebrow lime">${tool.cat.toUpperCase()} / ${esc(networkName()).toUpperCase()}</span><h1>${tool.name}</h1><p>${subtitle||tool.desc}</p></div><div class="tool-meta-card"><div><span>Network</span><strong>${esc(networkName())}</strong></div><div><span>Wallet</span><strong>${state.account?short(state.account):'Connect to transact'}</strong></div>${meta}</div></div>`;
  }
  function standardSide(lines,warning=''){
    return `<div class="side-stack">${panel('Before you sign',`<div class="steps">${lines.map((x,i)=>`<div class="step"><span>${i+1}</span><div><b>${x[0]}</b><p>${x[1]}</p></div></div>`).join('')}</div>`)}${warning?panel('Important',`<div class="notice warn">${warning}</div>`):''}</div>`;
  }

  function templateTokenCreator(tool){
    return toolHeader(tool,`Deploy a real ERC-20 contract directly from your wallet. The ${coinName()} preset uses OpenZeppelin role-based minting and pausing, 18 decimals, and holder burning.`,`<div><span>Contract model</span><strong>AccessControl</strong></div><div><span>Decimals</span><strong>18</strong></div>`)+
      `<div class="tool-layout"><form class="panel" id="creatorForm" data-action="create-token"><h2>Deploy token</h2><div class="form-grid">${field('Token name','creatorName','Nockra Example')}${field('Symbol','creatorSymbol','NCK')}</div>${field('Initial supply','creatorSupply','1000000','18 decimals')}
      <div class="profile-fields"><h3>Token profile</h3><p>Optional public links are saved with the local Nockra token profile after deployment. They do not change the ERC-20 contract.</p><div class="form-grid">${field('Website','creatorWebsite','https://example.com','Optional')}${field('X / Twitter','creatorTwitter','https://x.com/name','Optional')}</div><div class="form-grid">${field('Telegram','creatorTelegram','https://t.me/name','Optional')}${field('Discord','creatorDiscord','https://discord.gg/name','Optional')}</div>${textarea('Description','creatorDescription','Short project description','Optional')}</div>
      <div class="notice">Deployment and initial mint are separate on-chain actions. If the initial supply is greater than zero, your wallet will confirm the deployment first and the mint second.</div>
      <div class="switch-row"><span>I understand the deployer receives admin, minter and pauser roles</span><input id="creatorAck" type="checkbox" /></div>
      <div id="creatorMessage" class="tx-message"></div><div class="form-actions">${button(state.account?'Deploy token':'Connect wallet & deploy','action-button', 'submit','creatorButton')}</div></form>
      ${standardSide([['Review the deployment model',`${coinName()} deploys a fixed OpenZeppelin ERC20PresetMinterPauser build.`],['Estimate deployment',`Gas is estimated on ${networkName()} before broadcast.`],['Confirm deployment','The contract address comes from the mined deployment receipt.'],['Mint initial supply','If requested, the deployed contract mints to your connected wallet.']], 'A role-based token has no Ownable owner. Control is managed through admin, minter and pauser roles. Renouncing those roles can be permanent.')}</div>`;
  }

  function templateMultisender(tool){
    return toolHeader(tool,'Send native ETH or an ERC-20 to multiple addresses. This version uses real sequential wallet transactions rather than pretending a batch contract exists.',`<div><span>Execution</span><strong>Sequential transactions</strong></div><div><span>Maximum rows</span><strong>100</strong></div>`)+
      `<div class="tool-layout"><form class="panel" id="multisendForm" data-action="multisend"><h2>Recipients</h2>${selectField('Asset type','multiAsset',[['erc20','ERC-20 token'],['native','ETH']])}<div id="multiTokenWrap">${field('Token contract','multiToken','0x…')}</div>${textarea('Recipients','multiRecipients','0xRecipient, 125\n0xAnotherRecipient, 50','One address and amount per line')}
      <div class="notice">${coinName()} checks the total ERC-20 balance before starting. Each recipient is then sent as a separate transaction and confirmed before the next one begins.</div><div id="multiMessage" class="tx-message"></div><div id="multiProgress" class="progress-list"></div><div class="form-actions">${button(state.account?'Start transfers':'Connect wallet & review','action-button','submit','multiButton')}</div></form>
      ${standardSide([['Parse recipients','Addresses and amounts are validated locally.'],['Check balance','Token balance is read from the connected wallet.'],['Send sequentially','Each transfer is signed and confirmed individually.'],['Track receipts','Every successful transaction links to Blockscout.']], 'This is not a gas-optimized batching contract. For many recipients, you will approve many wallet prompts and pay gas for each transfer.')}</div>`;
  }

  function templateRevoke(tool){
    return toolHeader(tool,'Inspect the connected wallet’s control over a token, then renounce only controls that the contract actually exposes. Ownable and OpenZeppelin AccessControl are supported.',`<div><span>Ownable</span><strong>renounceOwnership()</strong></div><div><span>AccessControl</span><strong>renounceRole()</strong></div>`)+
      `<div class="tool-layout"><div><form class="panel" id="revokeInspectForm" data-action="inspect-revoke"><h2>Inspect controls</h2>${field('Token contract','revokeToken','0x…')}<div id="revokeInspectMessage" class="tx-message"></div><div class="form-actions">${button('Inspect my controls','action-button secondary')}</div></form><div id="revokeResult" class="panel danger-zone" style="margin-top:14px" hidden></div></div>
      ${standardSide([['Load ownership model',`${coinName()} probes owner() and standard OpenZeppelin roles.`],['Show only detected controls','No renounce action appears unless your wallet holds that control.'],['Require explicit confirmation','You must type REVOKE before sending.'],['Wait for receipts','Each selected role is renounced in a separate confirmed transaction.']], 'Renouncing ownership or administrative roles can permanently remove the ability to mint, pause, upgrade or manage a token. There may be no recovery path.')}</div>`;
  }

  function templateMint(tool){
    return toolHeader(tool,'Mint tokens only when the target contract exposes a compatible mint function and your connected wallet has permission.',`<div><span>Supported calls</span><strong>mint(address,uint256) / mint(uint256)</strong></div>`)+
      `<div class="tool-layout"><form class="panel" data-action="mint"><h2>Mint</h2>${field('Token contract','mintToken','0x…')}${selectField('Mint function','mintMode',[['to','mint(address,uint256)'],['self','mint(uint256) to connected wallet']])}<div id="mintRecipientWrap">${field('Recipient','mintRecipient',state.account||'0x…')}</div>${field('Amount','mintAmount','1000','Token decimals are read on-chain')}<div id="mintMessage" class="tx-message"></div><div class="form-actions">${button(state.account?'Simulate & mint':'Connect wallet & mint','action-button','submit','mintButton')}</div></form>
      ${standardSide([['Read decimals','Amount conversion uses the token’s live decimals().'],['Simulate the mint','The exact function call is tested from your connected wallet.'],['Sign only if valid','A permission failure prevents broadcast.'],['Confirm on-chain','Success is shown after the receipt succeeds.']])}</div>`;
  }

  function templateBurn(tool){
    return toolHeader(tool,'Permanently destroy tokens held by the connected wallet using the standard burn(uint256) extension when the token supports it.')+
      `<div class="tool-layout"><form class="panel" data-action="burn"><h2>Burn tokens</h2>${field('Token contract','burnToken','0x…')}${field('Amount','burnAmount','100','Token decimals are read on-chain')}<div class="notice warn">Burning reduces your balance and the token’s total supply. It cannot be reversed.</div><div id="burnMessage" class="tx-message"></div><div class="form-actions">${button(state.account?'Simulate & burn':'Connect wallet & burn','action-button danger','submit','burnButton')}</div></form>
      ${standardSide([['Load token state','Decimals and your current balance are read first.'],['Check your balance',`${coinName()} refuses an amount above the wallet balance.`],['Simulate burn(uint256)','Unsupported tokens fail before broadcast.'],['Confirm the receipt','The transaction link is shown only after confirmation.']])}</div>`;
  }

  function templatePause(tool,isPause=true){
    const verb=isPause?'pause':'unpause';
    return toolHeader(tool,`${isPause?'Pause':'Resume'} transfers on a compatible token contract. This requires the permission defined by that token, commonly a PAUSER_ROLE.`)+
      `<div class="tool-layout"><form class="panel" data-action="${verb}"><h2>${isPause?'Pause':'Unpause'} token</h2>${field('Token contract',`${verb}Token`,'0x…')}<div class="notice ${isPause?'warn':'good'}">Nockra calls <code>${verb}()</code> exactly. The token contract decides whether your wallet is allowed to do this.</div><div id="${verb}Message" class="tx-message"></div><div class="form-actions">${button(state.account?`Simulate & ${verb}`:`Connect wallet & ${verb}`,'action-button','submit',`${verb}Button`)}</div></form>
      ${standardSide([['Read paused state','If paused() is available, the current state is checked.'],['Simulate the control call',`The ${verb}() call is tested from your wallet.`],['Sign through your wallet',`${coinName()} never receives your private key.`],['Confirm on-chain','The updated paused state is read after confirmation.']])}</div>`;
  }

  function templateBlock(tool,unblock=false){
    const action=unblock?'unblock':'block';
    return toolHeader(tool,`${unblock?'Remove':'Apply'} a token-specific account restriction. Because blocklist APIs are not part of ERC-20, ${coinName()} probes several common function patterns and only broadcasts a call that successfully simulates.`,`<div><span>ERC-20 standard</span><strong>No standard blocklist API</strong></div>`)+
      `<div class="tool-layout"><form class="panel" data-action="${action}-account"><h2>${unblock?'Unblock':'Block'} account</h2>${field('Token contract',`${action}Token`,'0x…')}${field('Account',`${action}Account`,'0x…')}${selectField('Compatibility mode',`${action}Pattern`,[['auto','Auto-detect a supported pattern'],['blockAccount','blockAccount / unblockAccount'],['setBlocked','setBlocked(address,bool)'],['setBlacklist','setBlacklist(address,bool)'],['blacklist','blacklist / unBlacklist'],['blacklistAddress','blacklistAddress / unBlacklistAddress']])}<div class="notice">A successful simulation proves that the chosen call can execute from your connected wallet at the current state. It does not change the token contract’s own rules.</div><div id="${action}Message" class="tx-message"></div><div class="form-actions">${button(state.account?`Detect, simulate & ${action}`:`Connect wallet & ${action}`,'action-button','submit',`${action}Button`)}</div></form>
      ${standardSide([['Probe common APIs',`${coinName()} encodes known blocklist signatures.`],['Call from your address','eth_call simulates the candidate without changing state.'],['Use the first valid pattern','Auto mode sends only a pattern that simulated successfully.'],['Confirm the transaction','The receipt is linked on Blockscout.']], `Blocklisting is not part of ERC-20. Many tokens do not support it. ${coinName()} does not invent a restriction if the contract has no compatible function.`)}</div>`;
  }

  function templateCreatePool(tool){
    return toolHeader(tool,`Create and initialize a Uniswap V3 pool on ${networkName()}. Both assets must be ERC-20 contracts. Use WETH when you need an ETH-denominated pair.`,`<div><span>Position Manager</span><strong>${short(C.uniswapV3.positionManager)}</strong></div>`)+
      `<div class="tool-layout"><form class="panel" data-action="create-pool"><h2>Initialize pool</h2><div class="form-grid">${field('Token A','poolTokenA','0x…')}${field('Token B','poolTokenB','0x…')}</div>${selectField('Pool fee','poolFee',[['100','0.01%'],['500','0.05%'],['3000','0.30%'],['10000','1.00%']])}${field('Starting price','poolPrice','1','Token B per 1 Token A')}<div class="notice">The price is converted to Uniswap V3 <code>sqrtPriceX96</code> using the live token decimals. Token ordering is handled automatically.</div><div id="poolMessage" class="tx-message"></div><div class="form-actions">${button(state.account?'Check & create pool':'Connect wallet & create','action-button','submit','poolButton')}</div></form>
      ${standardSide([['Read token decimals','Both token contracts are checked before price conversion.'],['Check the V3 factory',`If the pool already exists, ${coinName()} links it instead of creating another.`],['Compute initialization price','The human price is mapped to sorted token0/token1 units.'],['Simulate Position Manager call','createAndInitializePoolIfNecessary is tested before sending.']], 'Pool initialization sets the first market price. A wrong starting price can create immediate arbitrage. Verify the asset order and price before signing.')}</div>`;
  }

  function templateAddLiquidity(tool){
    return toolHeader(tool,`Add liquidity by minting a full-range Uniswap V3 position NFT. ${coinName()} checks the pool, token approvals and the mint call before submission.`,`<div><span>Position type</span><strong>Full range</strong></div><div><span>Protocol</span><strong>Uniswap V3</strong></div>`)+
      `<div class="tool-layout"><form class="panel" data-action="add-liquidity"><h2>Mint LP position</h2><div class="form-grid">${field('Token A','addTokenA','0x…')}${field('Token B','addTokenB','0x…')}</div>${selectField('Pool fee','addFee',[['100','0.01%'],['500','0.05%'],['3000','0.30%'],['10000','1.00%']])}<div class="form-grid">${field('Token A amount','addAmountA','1000')}${field('Token B amount','addAmountB','1')}</div>${field('Slippage tolerance','addSlippage','5','Percent, used for amount0Min and amount1Min','number','5')}<div class="notice">If an allowance is too low, ${coinName()} asks for an exact approval to the ${networkName()} Uniswap V3 Position Manager before minting the LP NFT.</div><div id="addMessage" class="tx-message"></div><div class="form-actions">${button(state.account?'Check approvals & add':'Connect wallet & add','action-button','submit','addButton')}</div></form>
      ${standardSide([['Find the pool','The V3 factory must return an existing pool for the selected fee.'],['Read balances and allowances','Amounts are converted using each token’s decimals.'],['Approve exact amounts if needed','Approvals go only to the Position Manager.'],['Mint full-range position','Ticks are derived from the pool fee’s live tick spacing.']])}</div>`;
  }

  function templateRemoveLiquidity(tool){
    return toolHeader(tool,'Decrease liquidity from a Uniswap V3 position NFT and collect the resulting tokens to your connected wallet.',`<div><span>Ownership check</span><strong>ownerOf(tokenId)</strong></div>`)+
      `<div class="tool-layout"><form class="panel" data-action="remove-liquidity"><h2>Remove LP liquidity</h2>${field('Position NFT token ID','removeTokenId','12345')}${field('Percentage to remove','removePercent','100','1 to 100','number','100')}<div class="form-grid">${field('Minimum token0 out','removeMin0','0','Human units')}${field('Minimum token1 out','removeMin1','0','Human units')}</div><div class="switch-row"><span>I accept the entered minimum output amounts</span><input id="removeAck" type="checkbox" /></div><div class="notice warn">A minimum of 0 gives no output floor for that token. Enter non-zero minimums when you need explicit price protection.</div><div id="removeMessage" class="tx-message"></div><div class="form-actions">${button(state.account?'Inspect, simulate & remove':'Connect wallet & remove','action-button','submit','removeButton')}</div></form>
      ${standardSide([['Load the position',`${coinName()} reads token0, token1, fee and current liquidity.`],['Verify NFT ownership','The connected wallet must own the position NFT.'],['Decrease liquidity','The requested percentage and minimum outputs are simulated.'],['Collect owed tokens','After decrease confirms, collect is sent to your wallet.']])}</div>`;
  }

  function templateTokenPage(tool){
    return toolHeader(tool,`Inspect an ERC-20 directly from ${networkName()}. No indexer or invented profile data is used.`,`<div><span>Data source</span><strong>Token contract + wallet</strong></div>`)+
      `<div class="tool-layout single"><form class="panel" data-action="inspect-token"><h2>Load token</h2><div class="form-grid"><div>${field('Token contract','inspectToken','0x…')}</div><div class="form-actions" style="align-self:end;margin:0 0 13px">${button('Read live token','action-button','submit','inspectButton')}</div></div><div id="inspectMessage" class="tx-message"></div></form><div id="tokenProfile" hidden></div></div>`;
  }

  function templatePons(tool){
    const options=state.launchConfigs.length?state.launchConfigs.map(x=>[String(x.id),`Launch option #${x.id} · curve fee ${(Number(x.curveFeeBps)/100).toFixed(2).replace(/\.00$/,'')}%`]):[['','No launch option available']];
    return toolHeader(tool,'Launch a token directly through Pump.fun. Live factory terms are read again immediately before the wallet transaction.',`<div><span>Factory</span><strong>${short(C.ponsV2.factory)}</strong></div><div><span>Launch fee</span><strong id="ponsMetaFee">${state.pons?fmtEth(state.pons.fee):'Reading...'}</strong></div><div><span>Wallet gate</span><strong id="ponsMetaGate">${state.account?(state.pons?.canLaunch?'Eligible':'Checking'):'Connect to check'}</strong></div>`)+
      `<form class="tool-layout" data-action="pons-launch" id="ponsForm"><div class="side-stack"><section class="panel"><h2>1. Token metadata</h2><div class="form-grid">${field('Token name','ponsName','Example Token')}${field('Symbol','ponsSymbol','EXAMPLE')}</div>${imageFileField('Token image','ponsLogoFile','Required by Pump.fun')}${textarea('Description','ponsDescription','Describe the token','Optional')}<div class="form-grid">${field('Website','ponsWebsite','https://example.com','Optional')}${field('X / Twitter','ponsTwitter','https://x.com/name','Optional')}</div><div class="form-grid">${field('Telegram','ponsTelegram','https://t.me/name','Optional')}${field('Discord','ponsDiscord','https://discord.gg/name','Optional')}</div>${field('Farcaster','ponsFarcaster','https://warpcast.com/name','Optional')}</section>
      <section class="panel"><h2>2. Launch economics</h2>${selectField('Launch config','ponsConfig',options)}${selectField('Pair asset','ponsPair',[['native','ETH'],['usdg','USDG'],['custom','Custom Pons-approved ERC-20']])}<div id="ponsCustomPairWrap" hidden>${field('Custom pair token','ponsCustomPair','0x...')}</div>${field('Creator fee recipient','ponsRecipient',state.account||'Connected wallet','Defaults to connected wallet')}
      <div class="form-grid">${field('Creator tax','ponsTax','0','Percent','number','0')}<label class="field"><span class="field-title"><span>Buyback enabled</span><em>Pons setting</em></span><span class="switch-row"><span>Enable buyback</span><input id="ponsBuyback" type="checkbox" /></span></label></div>
      <h3 style="margin-top:24px">Optional initial creator buy</h3><div class="form-grid">${field('Pair asset amount','ponsDevBuy','0')}${field('Minimum tokens out','ponsMinOut','0','Raw token units')}</div>${textarea('Snipe-tax exemptions','ponsExemptions','0xAddress\n0xAddress','Optional, one per line, max 32')}</section></div>
      <div class="side-stack"><section class="panel"><h2>Live Pump.fun terms</h2><div class="stat-list"><div class="stat-row"><span>Factory launch enabled</span><strong id="ponsLiveEnabled">${state.pons?.enabled?'Yes':'-'}</strong></div><div class="stat-row"><span>Wallet can launch</span><strong id="ponsLiveEligible">${state.account?(state.pons?.canLaunch?'Yes':'No'):'Connect wallet'}</strong></div><div class="stat-row"><span>Launch fee</span><strong id="ponsLiveFee">${state.pons?fmtEth(state.pons.fee):'-'}</strong></div><div class="stat-row"><span>Max creator tax</span><strong id="ponsLiveTax">${state.pons?`${Number(state.pons.maxTax)/100}%`:'-'}</strong></div><div class="stat-row"><span>Launch-and-buy forwarder</span><strong class="address-line" id="ponsLiveForwarder">${state.pons?short(state.pons.forwarder):'-'}</strong></div></div><button type="button" class="action-button secondary" id="refreshPons" style="margin-top:14px">Refresh live terms</button></section>
      <section class="panel"><h2>Launch review</h2><div class="notice">Nockra pins the current Pump.fun economics into the launch parameters and simulates the exact call before your wallet is asked to sign.</div><div id="ponsMessage" class="tx-message"></div><div class="form-actions">${button(state.account?'Review & launch':'Connect wallet & check eligibility','action-button','submit','ponsButton')}</div></section></div></form><div id="ponsResult"></div>`;
  }

  function renderTool(id){
    const tool=TOOLS.find(t=>t.id===id)||TOOLS[0];
    document.querySelectorAll('.sidebar-tool').forEach(n=>n.classList.toggle('active',n.dataset.routeTool===tool.id));
    const map={
      'token-creator':templateTokenCreator,'multisender':templateMultisender,'revoke':templateRevoke,'mint':templateMint,'burn':templateBurn,
      'pause':t=>templatePause(t,true),'unpause':t=>templatePause(t,false),'block':t=>templateBlock(t,false),'unblock':t=>templateBlock(t,true),
      'create-pool':templateCreatePool,'add-liquidity':templateAddLiquidity,'remove-liquidity':templateRemoveLiquidity,'token-page':templateTokenPage,'pons-v2':templatePons
    };
    const html=(map[tool.id]||templateTokenPage)(tool);$('toolView').innerHTML=html.replace(/Nockra/g,esc(coinName())).replace(/Solana/g,esc(networkName()));document.title=`${tool.name} | ${coinName()}`;
    wireDynamicToolUI(tool.id);updatePonsView();window.NockraI18n?.apply($('toolView'));
  }

  async function assertContract(address,label='Contract'){
    if(!isAddress(address))throw new Error(`${label} is not a valid EVM address.`);const a=addr(address);const code=await state.publicProvider.getCode(a);if(code==='0x')throw new Error(`${label} has no contract code on ${networkName()}.`);return a;
  }
  async function tokenInfo(address,withBalance=true){
    const a=await assertContract(address,'Token contract');const t=new E.Contract(a,ERC20,state.publicProvider);
    const req=[t.name(),t.symbol(),t.decimals(),t.totalSupply()];if(withBalance&&state.account)req.push(t.balanceOf(state.account));
    const out=await Promise.all(req);return {address:a,contract:t,name:String(out[0]),symbol:String(out[1]),decimals:Number(out[2]),supply:BigInt(out[3]),balance:out[4]!==undefined?BigInt(out[4]):null};
  }
  async function sendContractCall(address,abi,method,args=[],overrides={},messageId,buttonId,label='Transaction'){
    await requireWallet();const c=new E.Contract(address,abi,state.signer);const fn=c[method];if(!fn)throw new Error(`The contract interface does not expose ${method}.`);
    await fn.staticCall(...args,overrides);const btn=$(buttonId);busy(btn,true,'Confirm in wallet…');const tx=await fn(...args,overrides);if(messageId)message(messageId,`${label} submitted. Waiting for confirmation… ${tx.hash}`);busy(btn,true,'Waiting for confirmation…');const receipt=await tx.wait();if(!receipt||receipt.status!==1)throw new Error('The transaction was mined but did not succeed.');return {tx,receipt};
  }
  async function approveExact(token,spender,amount,messageId,buttonId){
    const read=new E.Contract(token,ERC20,state.publicProvider);const allowance=BigInt(await read.allowance(state.account,spender));if(allowance>=amount)return null;const c=new E.Contract(token,ERC20,state.signer);if(allowance>0n){try{await c.approve.staticCall(spender,amount)}catch{const reset=await c.approve(spender,0n);message(messageId,`Resetting an existing allowance. Waiting for ${short(reset.hash,10,8)}…`);const rr=await reset.wait();if(!rr||rr.status!==1)throw new Error('Allowance reset failed.')}}
    await c.approve.staticCall(spender,amount);busy($(buttonId),true,'Approve token in wallet…');const tx=await c.approve(spender,amount);message(messageId,`Approval submitted. Waiting for confirmation… ${tx.hash}`);const receipt=await tx.wait();if(!receipt||receipt.status!==1)throw new Error('Token approval failed.');return tx.hash;
  }

  async function actionCreateToken(form){
    const btn=$('creatorButton');clearMessage('creatorMessage');try{
      await requireWallet();if(!$('creatorAck').checked)throw new Error('Confirm that you understand the role-based control model before deploying.');
      const name=$('creatorName').value.trim(),symbol=$('creatorSymbol').value.trim().toUpperCase();if(!name||name.length>64)throw new Error('Token name must be 1 to 64 characters.');if(!/^[A-Z0-9]{2,11}$/.test(symbol))throw new Error('Symbol must be 2 to 11 uppercase letters or numbers.');
      const supplyText=$('creatorSupply').value.trim()||'0';if(!/^\d+(\.\d+)?$/.test(supplyText))throw new Error('Initial supply must be a non-negative number.');const supply=E.parseUnits(supplyText,18);
      const factory=new E.ContractFactory(ARTIFACT.abi,ARTIFACT.bytecode,state.signer);const deployTx=await factory.getDeployTransaction(name,symbol);deployTx.from=state.account;
      busy(btn,true,'Estimating deployment…');const gas=await state.publicProvider.estimateGas(deployTx);message('creatorMessage',`Deployment simulation passed. Estimated gas: ${gas.toLocaleString()}.`);
      busy(btn,true,'Confirm deployment...');const contract=await factory.deploy(name,symbol);const deployment=contract.deploymentTransaction();message('creatorMessage',`Deployment submitted. Waiting for confirmation... ${deployment.hash}`);busy(btn,true,'Waiting for deployment...');await contract.waitForDeployment();const token=await contract.getAddress();const receipt=await deployment.wait();if(!receipt||receipt.status!==1)throw new Error('Deployment receipt did not succeed.');const localProfile={description:$('creatorDescription')?.value.trim()||'',website:safeProfileUrl($('creatorWebsite')?.value),twitter:safeProfileUrl($('creatorTwitter')?.value),telegram:safeProfileUrl($('creatorTelegram')?.value),discord:safeProfileUrl($('creatorDiscord')?.value)};if(Object.values(localProfile).some(Boolean))saveLocalTokenProfile(token,localProfile);
      if(supply>0n){busy(btn,true,'Confirm initial mint…');const tokenWrite=new E.Contract(token,ARTIFACT.abi,state.signer);try{await tokenWrite.mint.staticCall(state.account,supply);const tx=await tokenWrite.mint(state.account,supply);message('creatorMessage',`Token deployed at ${token}. Initial mint submitted: ${tx.hash}. Waiting…`);const mr=await tx.wait();if(!mr||mr.status!==1)throw new Error('Initial mint receipt failed.')}catch(err){message('creatorMessage',`The token contract was deployed at ${token}, but the initial mint did not complete: ${errorText(err)} <br>${txLink(deployment.hash,'View deployment')}`,'error',true);toast('Token deployed, initial mint did not complete.','warn');return}}
      message('creatorMessage',`<strong>${esc(name)} (${esc(symbol)}) is deployed.</strong><br><code>${token}</code><br>${txLink(deployment.hash,'View deployment')} · <a href="#tool/token-page?token=${token}">Open Token Page </a>`,'success',true);toast('Token deployment confirmed.','success');
    }catch(err){message('creatorMessage',errorText(err),'error')}finally{busy(btn,false);updateWalletUI()}
  }

  async function actionMultisend(){
    const btn=$('multiButton');clearMessage('multiMessage');$('multiProgress').innerHTML='';try{
      await requireWallet();const rows=parseLines($('multiRecipients').value,100);const native=$('multiAsset').value==='native';let info=null,total=0n;
      if(native){for(const r of rows){r.amount=parseAmount(r.amountText,18,'ETH amount');total+=r.amount}const bal=await state.publicProvider.getBalance(state.account);if(bal<=total)throw new Error(`The wallet balance is ${fmtEth(bal)}, which is not enough for ${fmtEth(total)} plus gas.`)}
      else{info=await tokenInfo($('multiToken').value,true);for(const r of rows){r.amount=parseAmount(r.amountText,info.decimals,`${info.symbol} amount`);total+=r.amount}if(info.balance<total)throw new Error(`The wallet holds ${fmtUnits(info.balance,info.decimals)} ${info.symbol}, but the transfer list totals ${fmtUnits(total,info.decimals)} ${info.symbol}.`)}
      message('multiMessage',`Validated ${rows.length} recipients. Total: ${native?fmtEth(total):`${fmtUnits(total,info.decimals)} ${info.symbol}`}. Each transfer will require a wallet signature.`);const progress=$('multiProgress');
      let completed=0;for(let i=0;i<rows.length;i++){const r=rows[i];busy(btn,true,`Recipient ${i+1} of ${rows.length}…`);let tx;
        if(native){await state.signer.estimateGas({to:r.address,value:r.amount});tx=await state.signer.sendTransaction({to:r.address,value:r.amount})}
        else{const token=new E.Contract(info.address,ERC20,state.signer);await token.transfer.staticCall(r.address,r.amount);tx=await token.transfer(r.address,r.amount)}
        const item=document.createElement('div');item.className='progress-item';item.innerHTML=`<span>${i+1}. ${short(r.address)}</span><strong>Pending ${short(tx.hash,8,6)}</strong>`;progress.appendChild(item);const receipt=await tx.wait();if(!receipt||receipt.status!==1)throw new Error(`Transfer ${i+1} was mined but failed.`);item.innerHTML=`<span>${i+1}. ${short(r.address)}</span><strong><a href="${explorer('tx',tx.hash)}" target="_blank" rel="noopener noreferrer">Confirmed </a></strong>`;completed++}
      message('multiMessage',`All ${completed} transfers are confirmed on ${networkName()}.`,'success');toast('Multisender run complete.','success');
    }catch(err){message('multiMessage',errorText(err),'error')}finally{busy(btn,false)}
  }

  async function inspectRevoke(){
    clearMessage('revokeInspectMessage');const result=$('revokeResult');result.hidden=true;try{
      await requireWallet();const token=await assertContract($('revokeToken').value,'Token contract');const findings={token,owner:null,roles:[]};
      try{const own=new E.Contract(token,OWNABLE,state.publicProvider);const owner=await own.owner();findings.owner=owner;if(owner.toLowerCase()!==state.account.toLowerCase())findings.ownerNotWallet=true}catch{}
      const access=new E.Contract(token,ACCESS,state.publicProvider);const roleDefs=[['DEFAULT_ADMIN_ROLE','Admin'],['MINTER_ROLE','Minter'],['PAUSER_ROLE','Pauser']];for(const [getter,label] of roleDefs){try{const role=await access[getter]();if(await access.hasRole(role,state.account))findings.roles.push({getter,label,role})}catch{}}
      state.controlInspection=findings;const hasOwner=findings.owner&&findings.owner.toLowerCase()===state.account.toLowerCase();
      if(!hasOwner&&!findings.roles.length){result.hidden=false;result.className='panel';result.innerHTML=`<h2>No supported control detected</h2><p class="panel-sub">${findings.ownerNotWallet?`owner() returned ${esc(findings.owner)}, which is not the connected wallet.`:'The contract did not expose an Ownable owner held by this wallet or standard OpenZeppelin roles held by this wallet.'}</p>`;return}
      result.hidden=false;result.className='panel danger-zone';result.innerHTML=`<h2>Irreversible control removal</h2><form id="revokeExecuteForm" data-action="execute-revoke">${hasOwner?`<label class="switch-row"><span>Renounce Ownable ownership <small style="display:block;color:#7b867d">Current owner ${short(findings.owner)}</small></span><input id="revokeOwnable" type="checkbox" /></label>`:''}${findings.roles.map((r,i)=>`<label class="switch-row"><span>Renounce ${r.label} role <small style="display:block;color:#7b867d">${short(r.role,10,8)}</small></span><input class="role-check" data-role-index="${i}" type="checkbox" /></label>`).join('')}${field('Type REVOKE to confirm','revokeConfirm','REVOKE')}<div id="revokeExecuteMessage" class="tx-message"></div><div class="form-actions">${button('Permanently renounce selected controls','action-button danger','submit','revokeExecuteButton')}</div></form>`;
      message('revokeInspectMessage','Control inspection completed. Select only the authority you intend to remove.','success');
    }catch(err){message('revokeInspectMessage',errorText(err),'error')}
  }

  async function executeRevoke(){
    const f=state.controlInspection,btn=$('revokeExecuteButton');clearMessage('revokeExecuteMessage');try{
      if(!f)throw new Error('Inspect the token controls again.');await requireWallet();if($('revokeConfirm').value.trim()!=='REVOKE')throw new Error('Type REVOKE exactly to continue.');
      const jobs=[];if($('revokeOwnable')?.checked)jobs.push({kind:'own',label:'ownership'});document.querySelectorAll('.role-check:checked').forEach(n=>{const r=f.roles[Number(n.dataset.roleIndex)];if(r)jobs.push({kind:'role',label:r.label,role:r.role})});if(!jobs.length)throw new Error('Select at least one control to renounce.');
      jobs.sort((a,b)=>a.label==='Admin'?1:b.label==='Admin'?-1:0);for(const job of jobs){busy(btn,true,`Renouncing ${job.label}…`);let c,tx;if(job.kind==='own'){c=new E.Contract(f.token,OWNABLE,state.signer);await c.renounceOwnership.staticCall();tx=await c.renounceOwnership()}else{c=new E.Contract(f.token,ACCESS,state.signer);await c.renounceRole.staticCall(job.role,state.account);tx=await c.renounceRole(job.role,state.account)}message('revokeExecuteMessage',`Submitted ${job.label} renounce. Waiting for confirmation… ${tx.hash}`);const receipt=await tx.wait();if(!receipt||receipt.status!==1)throw new Error(`${job.label} renounce failed.`)}
      message('revokeExecuteMessage','Every selected control was renounced and confirmed. Re-inspect the token to verify the new state.','success');toast('Selected token controls renounced.','success');
    }catch(err){message('revokeExecuteMessage',errorText(err),'error')}finally{busy(btn,false)}
  }

  async function actionMint(){
    const btn=$('mintButton');clearMessage('mintMessage');try{await requireWallet();const info=await tokenInfo($('mintToken').value,false);const amount=parseAmount($('mintAmount').value,info.decimals,'Mint amount');const mode=$('mintMode').value;let abi,method,args;
      if(mode==='to'){const r=$('mintRecipient').value.trim()||state.account;if(!isAddress(r))throw new Error('Recipient is not a valid EVM address.');abi=['function mint(address,uint256)'];method='mint';args=[addr(r),amount]}else{abi=['function mint(uint256)'];method='mint';args=[amount]}
      const {tx}=await sendContractCall(info.address,abi,method,args,{},'mintMessage','mintButton','Mint');message('mintMessage',`Mint confirmed for ${fmtUnits(amount,info.decimals)} ${esc(info.symbol)}. ${txLink(tx.hash)}`,'success',true);toast('Mint confirmed.','success')
    }catch(err){message('mintMessage',errorText(err),'error')}finally{busy(btn,false)}}

  async function actionBurn(){
    const btn=$('burnButton');clearMessage('burnMessage');try{await requireWallet();const info=await tokenInfo($('burnToken').value,true);const amount=parseAmount($('burnAmount').value,info.decimals,'Burn amount');if(info.balance<amount)throw new Error(`Wallet balance is ${fmtUnits(info.balance,info.decimals)} ${info.symbol}.`);const {tx}=await sendContractCall(info.address,['function burn(uint256)'],'burn',[amount],{},'burnMessage','burnButton','Burn');message('burnMessage',`Burn confirmed. ${fmtUnits(amount,info.decimals)} ${esc(info.symbol)} was destroyed. ${txLink(tx.hash)}`,'success',true);toast('Burn confirmed.','success')}catch(err){message('burnMessage',errorText(err),'error')}finally{busy(btn,false)}}

  async function actionPause(unpause=false){
    const verb=unpause?'unpause':'pause',btn=$(`${verb}Button`),mid=`${verb}Message`;clearMessage(mid);try{await requireWallet();const token=await assertContract($(`${verb}Token`).value,'Token contract');const read=new E.Contract(token,['function paused() view returns (bool)'],state.publicProvider);try{const current=Boolean(await read.paused());if(unpause&&!current)throw new Error('The token currently reports paused() = false.');if(!unpause&&current)throw new Error('The token currently reports paused() = true.')}catch(err){if(/currently reports/.test(err.message))throw err}
      const {tx}=await sendContractCall(token,[`function ${verb}()`],verb,[],{},mid,`${verb}Button`,verb);let after='';try{after=` paused() now returns ${await read.paused()}.`}catch{}message(mid,`${unpause?'Unpause':'Pause'} confirmed.${after} ${txLink(tx.hash)}`,'success',true);toast(`${unpause?'Unpause':'Pause'} confirmed.`,'success')
    }catch(err){message(mid,errorText(err),'error')}finally{busy(btn,false)}}

  const BLOCK_PATTERNS={
    blockAccount:{block:['function blockAccount(address)','blockAccount'],unblock:['function unblockAccount(address)','unblockAccount']},
    setBlocked:{block:['function setBlocked(address,bool)','setBlocked'],unblock:['function setBlocked(address,bool)','setBlocked']},
    setBlacklist:{block:['function setBlacklist(address,bool)','setBlacklist'],unblock:['function setBlacklist(address,bool)','setBlacklist']},
    blacklist:{block:['function blacklist(address)','blacklist'],unblock:['function unBlacklist(address)','unBlacklist']},
    blacklistAddress:{block:['function blacklistAddress(address)','blacklistAddress'],unblock:['function unBlacklistAddress(address)','unBlacklistAddress']}
  };
  async function actionBlock(unblock=false){
    const verb=unblock?'unblock':'block',btn=$(`${verb}Button`),mid=`${verb}Message`;clearMessage(mid);try{await requireWallet();const token=await assertContract($(`${verb}Token`).value,'Token contract');const accountRaw=$(`${verb}Account`).value;if(!isAddress(accountRaw))throw new Error('Account is not a valid EVM address.');const account=addr(accountRaw);const wanted=$(`${verb}Pattern`).value;const candidates=wanted==='auto'?Object.keys(BLOCK_PATTERNS):[wanted];let chosen=null,lastErr=null;
      for(const key of candidates){const def=BLOCK_PATTERNS[key]?.[verb];if(!def)continue;const [fragment,method]=def;const iface=new E.Interface([fragment]);const args=method.startsWith('set')?[account,!unblock]:[account];const data=iface.encodeFunctionData(method,args);try{await state.publicProvider.call({to:token,from:state.account,data});chosen={fragment,method,args,key};break}catch(err){lastErr=err}}
      if(!chosen)throw new Error(`No selected blocklist function successfully simulated from this wallet. ${lastErr?errorText(lastErr):''}`.trim());message(mid,`Detected compatible pattern: ${chosen.method}(). The exact call will now be sent.`);const {tx}=await sendContractCall(token,[chosen.fragment],chosen.method,chosen.args,{},mid,`${verb}Button`,verb);message(mid,`${unblock?'Unblock':'Block'} call confirmed using ${esc(chosen.method)}(). ${txLink(tx.hash)}`,'success',true);toast(`${unblock?'Unblock':'Block'} transaction confirmed.`,'success')
    }catch(err){message(mid,errorText(err),'error')}finally{busy(btn,false)}}

  async function basicToken(address,label='Token'){
    const a=await assertContract(address,`${label} contract`);const c=new E.Contract(a,ERC20,state.publicProvider);const [symbol,decimals]=await Promise.all([c.symbol(),c.decimals()]);return {address:a,symbol:String(symbol),decimals:Number(decimals),contract:c};
  }
  function sortPair(a,b){const aa=addr(a),bb=addr(b);if(aa.toLowerCase()===bb.toLowerCase())throw new Error('Token A and Token B must be different contracts.');return aa.toLowerCase()<bb.toLowerCase()?{token0:aa,token1:bb,aIs0:true}:{token0:bb,token1:aa,aIs0:false}}

  async function actionCreatePool(){
    const btn=$('poolButton');clearMessage('poolMessage');try{await requireWallet();busy(btn,true,'Reading token contracts…');const [a,b]=await Promise.all([basicToken($('poolTokenA').value,'Token A'),basicToken($('poolTokenB').value,'Token B')]);const sorted=sortPair(a.address,b.address);const fee=Number($('poolFee').value);const v3f=new E.Contract(C.uniswapV3.factory,V3_FACTORY,state.publicProvider);const [existing,spacing]=await Promise.all([v3f.getPool(sorted.token0,sorted.token1,fee),v3f.feeAmountTickSpacing(fee)]);if(BigInt(spacing)===0n)throw new Error('The selected fee tier is not enabled by this Uniswap V3 factory.');if(existing!==ZERO){message('poolMessage',`A pool already exists at <code>${existing}</code>. <a href="${explorer('address',existing)}" target="_blank" rel="noopener noreferrer">View pool </a>`,'success',true);return}
      const dec0=sorted.aIs0?a.decimals:b.decimals,dec1=sorted.aIs0?b.decimals:a.decimals;const sqrt=sqrtPriceX96($('poolPrice').value,dec0,dec1,!sorted.aIs0);const pm=new E.Contract(C.uniswapV3.positionManager,V3_POSITION,state.signer);busy(btn,true,'Simulating pool creation…');const predicted=await pm.createAndInitializePoolIfNecessary.staticCall(sorted.token0,sorted.token1,fee,sqrt);message('poolMessage',`Simulation passed. Predicted pool: ${predicted}. sqrtPriceX96: ${sqrt}.`);busy(btn,true,'Confirm in wallet…');const tx=await pm.createAndInitializePoolIfNecessary(sorted.token0,sorted.token1,fee,sqrt);message('poolMessage',`Pool creation submitted. Waiting for confirmation… ${tx.hash}`);busy(btn,true,'Waiting for confirmation…');const receipt=await tx.wait();if(!receipt||receipt.status!==1)throw new Error('Pool creation was mined but failed.');const pool=await v3f.getPool(sorted.token0,sorted.token1,fee);if(pool===ZERO)throw new Error('The transaction confirmed, but the V3 factory still reports no pool for this pair and fee.');message('poolMessage',`Pool created and initialized at <code>${pool}</code>. ${txLink(tx.hash)} · <a href="${explorer('address',pool)}" target="_blank" rel="noopener noreferrer">View pool </a>`,'success',true);toast('Liquidity pool confirmed.','success')
    }catch(err){message('poolMessage',errorText(err),'error')}finally{busy(btn,false)}}

  async function actionAddLiquidity(){
    const btn=$('addButton');clearMessage('addMessage');try{await requireWallet();busy(btn,true,'Reading pool and tokens…');const [a,b]=await Promise.all([basicToken($('addTokenA').value,'Token A'),basicToken($('addTokenB').value,'Token B')]);const sorted=sortPair(a.address,b.address);const fee=Number($('addFee').value);const amountA=parseAmount($('addAmountA').value,a.decimals,'Token A amount'),amountB=parseAmount($('addAmountB').value,b.decimals,'Token B amount');const amount0=sorted.aIs0?amountA:amountB,amount1=sorted.aIs0?amountB:amountA;const token0=sorted.aIs0?a:b,token1=sorted.aIs0?b:a;const v3f=new E.Contract(C.uniswapV3.factory,V3_FACTORY,state.publicProvider);const [pool,spacingRaw]=await Promise.all([v3f.getPool(sorted.token0,sorted.token1,fee),v3f.feeAmountTickSpacing(fee)]);if(pool===ZERO)throw new Error('No Uniswap V3 pool exists for this pair and fee. Create the pool first.');const spacing=Number(spacingRaw);if(!spacing)throw new Error('The selected fee tier is not enabled.');
      const [bal0,bal1]=await Promise.all([token0.contract.balanceOf(state.account),token1.contract.balanceOf(state.account)]);if(BigInt(bal0)<amount0)throw new Error(`${token0.symbol} balance is below the requested amount.`);if(BigInt(bal1)<amount1)throw new Error(`${token1.symbol} balance is below the requested amount.`);const slip=Number($('addSlippage').value);if(!Number.isFinite(slip)||slip<0||slip>=100)throw new Error('Slippage tolerance must be at least 0 and below 100 percent.');const bps=BigInt(Math.round(slip*100));const amount0Min=amount0*(10000n-bps)/10000n,amount1Min=amount1*(10000n-bps)/10000n;const tickLower=Math.ceil(MIN_TICK/spacing)*spacing,tickUpper=Math.floor(MAX_TICK/spacing)*spacing;
      busy(btn,true,'Checking approvals…');await approveExact(token0.address,C.uniswapV3.positionManager,amount0,'addMessage','addButton');await approveExact(token1.address,C.uniswapV3.positionManager,amount1,'addMessage','addButton');const params={token0:sorted.token0,token1:sorted.token1,fee,tickLower,tickUpper,amount0Desired:amount0,amount1Desired:amount1,amount0Min,amount1Min,recipient:state.account,deadline:nowPlus(1200)};const pm=new E.Contract(C.uniswapV3.positionManager,V3_POSITION,state.signer);busy(btn,true,'Simulating LP mint…');const prediction=await pm.mint.staticCall(params);message('addMessage',`Simulation passed. Position token ID is expected to be ${prediction[0]}.`);busy(btn,true,'Confirm LP mint…');const tx=await pm.mint(params);message('addMessage',`LP mint submitted. Waiting for confirmation… ${tx.hash}`);busy(btn,true,'Waiting for confirmation…');const receipt=await tx.wait();if(!receipt||receipt.status!==1)throw new Error('LP mint was mined but failed.');message('addMessage',`Liquidity position confirmed. Predicted NFT token ID: <strong>${prediction[0]}</strong>. ${txLink(tx.hash)}`,'success',true);toast('Liquidity position minted.','success')
    }catch(err){message('addMessage',errorText(err),'error')}finally{busy(btn,false)}}

  async function actionRemoveLiquidity(){
    const btn=$('removeButton');clearMessage('removeMessage');try{await requireWallet();if(!$('removeAck').checked)throw new Error('Confirm the minimum output amounts before continuing.');const idText=$('removeTokenId').value.trim();if(!/^\d+$/.test(idText))throw new Error('Position token ID must be an integer.');const tokenId=BigInt(idText);const percent=Number($('removePercent').value);if(!Number.isFinite(percent)||percent<=0||percent>100)throw new Error('Percentage must be above 0 and at most 100.');const pmRead=new E.Contract(C.uniswapV3.positionManager,V3_POSITION,state.publicProvider);const [owner,pos]=await Promise.all([pmRead.ownerOf(tokenId),pmRead.positions(tokenId)]);if(owner.toLowerCase()!==state.account.toLowerCase())throw new Error(`The connected wallet does not own position NFT #${tokenId}.`);const liquidity=BigInt(pos[7]);if(liquidity===0n)throw new Error('This position currently has zero liquidity.');const liquidityOut=liquidity*BigInt(Math.round(percent*100))/10000n;if(liquidityOut===0n)throw new Error('The selected percentage is too small for this position liquidity.');const [t0,t1]=await Promise.all([basicToken(pos[2],'Token0'),basicToken(pos[3],'Token1')]);const min0=parseAmount($('removeMin0').value||'0',t0.decimals,'Minimum token0'),min1=parseAmount($('removeMin1').value||'0',t1.decimals,'Minimum token1');const params={tokenId,liquidity:liquidityOut,amount0Min:min0,amount1Min:min1,deadline:nowPlus(1200)};const pm=new E.Contract(C.uniswapV3.positionManager,V3_POSITION,state.signer);busy(btn,true,'Simulating decrease…');const preview=await pm.decreaseLiquidity.staticCall(params);message('removeMessage',`Simulation passed. Current-state preview: ${fmtUnits(preview[0],t0.decimals)} ${t0.symbol} and ${fmtUnits(preview[1],t1.decimals)} ${t1.symbol}.`);busy(btn,true,'Confirm decrease…');const tx=await pm.decreaseLiquidity(params);message('removeMessage',`Decrease submitted. Waiting for confirmation… ${tx.hash}`);const receipt=await tx.wait();if(!receipt||receipt.status!==1)throw new Error('Decrease-liquidity transaction failed.');busy(btn,true,'Collecting tokens…');const collect={tokenId,recipient:state.account,amount0Max:MAX_UINT128,amount1Max:MAX_UINT128};const collectPreview=await pm.collect.staticCall(collect);const ctx=await pm.collect(collect);message('removeMessage',`Liquidity decreased. Collection submitted: ${ctx.hash}.`);const cr=await ctx.wait();if(!cr||cr.status!==1)throw new Error('Liquidity was decreased, but the collect transaction failed. Use the position manager to collect owed tokens manually.');message('removeMessage',`Removal confirmed. Collected approximately ${fmtUnits(collectPreview[0],t0.decimals)} ${esc(t0.symbol)} and ${fmtUnits(collectPreview[1],t1.decimals)} ${esc(t1.symbol)} at the collection simulation state. ${txLink(tx.hash,'Decrease tx')} · ${txLink(ctx.hash,'Collect tx')}`,'success',true);toast('Liquidity removed and collected.','success')
    }catch(err){message('removeMessage',errorText(err),'error')}finally{busy(btn,false)}}

  async function actionInspectToken(){
    const btn=$('inspectButton');clearMessage('inspectMessage');const profile=$('tokenProfile');profile.hidden=true;try{busy(btn,true,'Reading token…');const info=await tokenInfo($('inspectToken').value,true);let owner=null,paused=null,roles=[];try{owner=await new E.Contract(info.address,OWNABLE,state.publicProvider).owner()}catch{}try{paused=Boolean(await new E.Contract(info.address,['function paused() view returns (bool)'],state.publicProvider).paused())}catch{}if(state.account){const ac=new E.Contract(info.address,ACCESS,state.publicProvider);for(const [g,label] of [['DEFAULT_ADMIN_ROLE','Admin'],['MINTER_ROLE','Minter'],['PAUSER_ROLE','Pauser']]){try{const r=await ac[g]();roles.push([label,Boolean(await ac.hasRole(r,state.account))])}catch{}}}
      const localProfile=getLocalTokenProfile(info.address);const socialLinks=localProfile?Object.entries({Website:localProfile.website,X:localProfile.twitter,Telegram:localProfile.telegram,Discord:localProfile.discord}).filter(([,u])=>u):[];profile.hidden=false;profile.innerHTML=`<section class="panel" style="margin-top:14px"><div class="tool-hero" style="margin:0"><div><span class="eyebrow lime">LIVE TOKEN PROFILE</span><h1 style="font-size:42px">${esc(info.name)} <span style="color:var(--lime)">${esc(info.symbol)}</span></h1><p><code>${info.address}</code></p>${localProfile?.description?`<p>${esc(localProfile.description)}</p>`:''}${socialLinks.length?`<div class="token-socials">${socialLinks.map(([label,u])=>`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${label}</a>`).join('')}</div>`:''}</div><a class="button ghost" href="${explorer('address',info.address)}" target="_blank" rel="noopener noreferrer">Open Blockscout</a></div><div class="token-summary"><div><small>Total supply</small><strong>${fmtUnits(info.supply,info.decimals)} ${esc(info.symbol)}</strong></div><div><small>Decimals</small><strong>${info.decimals}</strong></div><div><small>Your balance</small><strong>${info.balance==null?'Connect wallet':`${fmtUnits(info.balance,info.decimals)} ${esc(info.symbol)}`}</strong></div><div><small>Paused</small><strong>${paused==null?'Not exposed':String(paused)}</strong></div></div><div class="stat-list">${owner?`<div class="stat-row"><span>owner()</span><strong class="address-line">${esc(owner)}</strong></div>`:''}${roles.map(r=>`<div class="stat-row"><span>Connected wallet has ${r[0]} role</span><strong>${r[1]?'Yes':'No'}</strong></div>`).join('')}<div class="stat-row"><span>Contract</span><strong class="address-line">${info.address}</strong></div></div><div class="form-actions"><a class="action-button secondary" href="#tool/mint?token=${info.address}">Mint tool</a><a class="action-button secondary" href="#tool/burn?token=${info.address}">Burn tool</a><a class="action-button secondary" href="#tool/revoke?token=${info.address}">Control tool</a></div></section>`;message('inspectMessage',`Live token data loaded from ${networkName()}.`,'success')
    }catch(err){message('inspectMessage',errorText(err),'error')}finally{busy(btn,false)}}

  async function imageToPayload(file){
    const allowed=['image/png','image/jpeg','image/webp'];if(!allowed.includes(file?.type))throw new Error('Choose a PNG, JPG or WebP image.');if(file.size>8*1024*1024)throw new Error('Choose an image smaller than 8 MB.');
    let blob=file;
    if(file.size>1400000&&file.type!=='image/webp'){
      try{const bitmap=await createImageBitmap(file);const max=1200,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.86));bitmap.close()}catch{}
    }
    if(!blob||blob.size>3500000)throw new Error('The selected image is too large to upload.');
    const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));return {name:(file.name||'token-image').replace(/[^a-zA-Z0-9._-]/g,'_'),type:blob.type||file.type,data:btoa(binary)};
  }
  async function uploadPonsLogo(){
    if(state.ponsLogoUri)return state.ponsLogoUri;const input=$('ponsLogoFile'),file=input?.files?.[0];if(!file)throw new Error('Select a token image before launching.');const payload=await imageToPayload(file);const endpoint=safeConfigString(C.imageUploadEndpoint)||'/api/upload';let r;try{r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})}catch{throw new Error('The image upload could not be completed. Please try again.')}if(!r.ok)throw new Error('The image upload could not be completed. Please try again.');let out;try{out=await r.json()}catch{throw new Error('The image upload could not be completed. Please try again.')}const uri=String(out?.uri||'').trim();if(!/^ipfs:\/\/[A-Za-z0-9]+/i.test(uri)&&!/^https:\/\//i.test(uri))throw new Error('The image upload could not be completed. Please try again.');if(new TextEncoder().encode(uri).length>512)throw new Error('The image upload could not be completed. Please try again.');state.ponsLogoUri=uri;return uri;
  }

  async function ponsPair(){
    const mode=$('ponsPair').value;let address=ZERO;if(mode==='usdg')address=C.ponsV2.usdG;else if(mode==='custom')address=$('ponsCustomPair').value.trim();if(address===ZERO)return {address:ZERO,symbol:'ETH',decimals:18,approved:true};const t=await basicToken(address,'Pair token');const f=new E.Contract(C.ponsV2.factory,PONS_READ,state.publicProvider);const approved=Boolean(await f.approvedPairTokens(t.address));if(!approved)throw new Error(`${t.symbol} is not currently approved as a Pump.fun pair asset.`);return {...t,approved}
  }
  function ponsExemptions(){const values=String($('ponsExemptions').value||'').split(/[\n,]+/).map(x=>x.trim()).filter(Boolean);if(values.length>32)throw new Error('Pump.fun accepts at most 32 snipe-tax exemptions.');const seen=new Set(),out=[];for(const v of values){if(!isAddress(v))throw new Error(`Invalid exemption address: ${v}`);const a=addr(v);if(!seen.has(a.toLowerCase())){seen.add(a.toLowerCase());out.push(a)}}return out}
  async function requirePonsLaunch(){await requireWallet();const p=await readPons();state.pons=p;state.launchConfigs=p.configs;updatePonsView();if(!p.canLaunch)throw new Error('The live Pump.fun launch gate does not currently allow this wallet to create a launch.');if(!p.configs.length)throw new Error('Pump.fun currently reports no enabled launch options.');return p}
  function ponsParams(meta,socials,recipient,taxBps,buyback,economics){return [meta.name,meta.symbol,meta.logo,meta.description,[socials.twitter||'',socials.telegram||'',socials.discord||'',socials.website||'',socials.farcaster||''],recipient,taxBps,buyback,economics,randomSalt()]}
  async function actionPonsLaunch(){
    const btn=$('ponsButton');clearMessage('ponsMessage');try{busy(btn,true,'Checking launch details...');const p=await requirePonsLaunch();const name=$('ponsName').value.trim(),symbol=$('ponsSymbol').value.trim().toUpperCase(),description=$('ponsDescription').value.trim();if(!name||name.length>64)throw new Error('Token name must be 1 to 64 characters.');if(!/^[A-Z0-9]{2,11}$/.test(symbol))throw new Error('Symbol must be 2 to 11 uppercase letters or numbers.');busy(btn,true,'Uploading token image...');const logo=await uploadPonsLogo();const pair=await ponsPair();const recipientRaw=$('ponsRecipient').value.trim()||state.account;if(!isAddress(recipientRaw))throw new Error('Creator fee recipient is not a valid EVM address.');const recipient=addr(recipientRaw);const tax=Number($('ponsTax').value||0);if(!Number.isFinite(tax)||tax<0)throw new Error('Creator tax cannot be negative.');const taxBps=Math.round(tax*100);if(taxBps>Number(p.maxTax))throw new Error(`Creator tax exceeds the live Pons maximum of ${Number(p.maxTax)/100}%.`);const configRaw=$('ponsConfig').value;if(configRaw==='')throw new Error('No enabled Pons launch option is selected.');const configId=BigInt(configRaw);if(!p.configs.some(x=>x.id===configId))throw new Error('That Pons launch option is no longer enabled. Refresh and choose an enabled config.');const quoteIn=parseAmount($('ponsDevBuy').value||'0',pair.decimals,'Creator buy');const minText=$('ponsMinOut').value.trim()||'0';if(!/^\d+$/.test(minText))throw new Error('Minimum tokens out must be an integer in raw token units.');const minOut=BigInt(minText);if(quoteIn===0n&&minOut>0n)throw new Error('Minimum tokens out only applies when the developer buy is above zero.');const exemptions=ponsExemptions();const fRead=new E.Contract(C.ponsV2.factory,PONS_READ,state.publicProvider);const economics=await fRead.previewLaunchEconomics(configId,pair.address);const params=ponsParams({name,symbol,logo,description},{twitter:$('ponsTwitter').value.trim(),telegram:$('ponsTelegram').value.trim(),discord:$('ponsDiscord').value.trim(),website:$('ponsWebsite').value.trim(),farcaster:$('ponsFarcaster').value.trim()},recipient,taxBps,$('ponsBuyback').checked,economics);
      let prediction,tx;if(quoteIn>0n){if(!p.forwarder||p.forwarder===ZERO)throw new Error('Pump.fun does not currently expose a launch-and-buy forwarder.');if(pair.address!==ZERO){busy(btn,true,'Checking pair-token allowance…');const balance=BigInt(await pair.contract.balanceOf(state.account));if(balance<quoteIn)throw new Error(`Wallet holds ${fmtUnits(balance,pair.decimals)} ${pair.symbol}, below the creator buy amount.`);await approveExact(pair.address,p.forwarder,quoteIn,'ponsMessage','ponsButton')};const value=pair.address===ZERO?p.fee+quoteIn:p.fee;const forwarder=new E.Contract(p.forwarder,PONS_FORWARDER,state.signer);busy(btn,true,'Simulating launch + buy…');prediction=await forwarder.launchAndBuy.staticCall(params,configId,pair.address,quoteIn,minOut,state.account,exemptions,{value});message('ponsMessage','Atomic launch-and-buy simulation passed. Confirm the live transaction in your wallet.');busy(btn,true,'Confirm launch…');tx=await forwarder.launchAndBuy(params,configId,pair.address,quoteIn,minOut,state.account,exemptions,{value})}
      else if(exemptions.length){const factory=new E.Contract(C.ponsV2.factory,PONS_LAUNCH_EXEMPT,state.signer);busy(btn,true,'Simulating launch…');prediction=await factory.launchToken.staticCall(params,configId,pair.address,exemptions,{value:p.fee});message('ponsMessage','Direct Pump.fun launch simulation passed.');busy(btn,true,'Confirm launch…');tx=await factory.launchToken(params,configId,pair.address,exemptions,{value:p.fee})}
      else{const factory=new E.Contract(C.ponsV2.factory,PONS_LAUNCH,state.signer);busy(btn,true,'Simulating launch…');prediction=await factory.launchToken.staticCall(params,configId,pair.address,{value:p.fee});message('ponsMessage','Direct Pump.fun launch simulation passed.');busy(btn,true,'Confirm launch…');tx=await factory.launchToken(params,configId,pair.address,{value:p.fee})}
      message('ponsMessage',`Launch submitted. Waiting for ${networkName()} confirmation… ${tx.hash}`);busy(btn,true,'Waiting for confirmation…');const receipt=await tx.wait();if(!receipt||receipt.status!==1)throw new Error('The launch transaction was mined but did not succeed.');const token=prediction[0],curve=prediction[1];message('ponsMessage',`Launch confirmed. Token: <code>${token}</code>. ${txLink(tx.hash)}`,'success',true);$('ponsResult').innerHTML=`<section class="result-card"><strong>${esc(name)} (${esc(symbol)}) is live</strong><code>Token ${token}</code><code>Curve ${curve}</code><a href="${explorer('address',token)}" target="_blank" rel="noopener noreferrer">Token on Blockscout </a> &nbsp; <a href="${explorer('address',curve)}" target="_blank" rel="noopener noreferrer">Curve on Blockscout </a> &nbsp; <a href="${C.ponsV2.publicSite}" target="_blank" rel="noopener noreferrer">Open Pons </a></section>`;toast('Pump.fun launch confirmed.','success');await refreshLive()
    }catch(err){message('ponsMessage',errorText(err),'error')}finally{busy(btn,false);updatePonsView()}}

  function updatePonsView(){
    if(!$('toolView'))return;const p=state.pons;
    if($('ponsMetaFee'))$('ponsMetaFee').textContent=p?fmtEth(p.fee):'Reading…';
    if($('ponsMetaGate'))$('ponsMetaGate').textContent=!state.account?'Connect to check':p?(p.canLaunch?'Eligible':'Not eligible'):'Checking';
    if($('ponsLiveEnabled'))$('ponsLiveEnabled').textContent=p?(p.enabled?'Yes':'No'):'—';if($('ponsLiveEligible'))$('ponsLiveEligible').textContent=!state.account?'Connect wallet':p?(p.canLaunch?'Yes':'No'):'Checking';if($('ponsLiveFee'))$('ponsLiveFee').textContent=p?fmtEth(p.fee):'—';if($('ponsLiveTax'))$('ponsLiveTax').textContent=p?`${Number(p.maxTax)/100}%`:'—';if($('ponsLiveForwarder'))$('ponsLiveForwarder').textContent=p?short(p.forwarder):'—';
    const sel=$('ponsConfig');if(sel&&p){const current=sel.value;sel.innerHTML=p.configs.length?p.configs.map(x=>`<option value="${x.id}">Launch option #${x.id} · curve fee ${(Number(x.curveFeeBps)/100).toFixed(2).replace(/\.00$/,'')}%</option>`).join(''):'<option value="">No launch option available</option>';if(p.configs.some(x=>String(x.id)===current))sel.value=current}
    const btn=$('ponsButton');if(btn){if(!state.account){btn.disabled=false;btn.textContent='Connect wallet & check eligibility'}else if(!p){btn.disabled=false;btn.textContent='Refresh & check eligibility'}else if(!p.canLaunch){btn.disabled=true;btn.textContent='Wallet not eligible in current Pons gate'}else{btn.disabled=false;btn.textContent='Review & launch'}}
  }

  function prefillFromHash(id){
    const hash=location.hash.slice(1),q=hash.includes('?')?hash.split('?')[1]:'';if(!q)return;const params=new URLSearchParams(q);const token=params.get('token');if(token&&isAddress(token)){
      const map={'token-page':'inspectToken','mint':'mintToken','burn':'burnToken','revoke':'revokeToken','pause':'pauseToken','unpause':'unpauseToken','block':'blockToken','unblock':'unblockToken'};const input=$(map[id]);if(input)input.value=token;
    }
  }
  function wireDynamicToolUI(id){
    if($('multiAsset'))$('multiAsset').addEventListener('change',()=>{$('multiTokenWrap').hidden=$('multiAsset').value==='native'});
    if($('mintMode'))$('mintMode').addEventListener('change',()=>{$('mintRecipientWrap').hidden=$('mintMode').value==='self'});
    if($('ponsPair'))$('ponsPair').addEventListener('change',()=>{$('ponsCustomPairWrap').hidden=$('ponsPair').value!=='custom'});
    if($('ponsLogoFile'))$('ponsLogoFile').addEventListener('change',e=>{state.ponsLogoUri='';const file=e.target.files?.[0],preview=$('ponsLogoFilePreview');if(!preview)return;preview.innerHTML='';if(file){const img=document.createElement('img');img.alt='Token image preview';img.src=URL.createObjectURL(file);img.onload=()=>URL.revokeObjectURL(img.src);preview.appendChild(img)}else{preview.innerHTML='<span>PNG<br>JPG<br>WEBP</span>'}});
    if($('refreshPons'))$('refreshPons').addEventListener('click',async()=>{const b=$('refreshPons');busy(b,true,'Refreshing');try{await refreshLive();toast('Live Pons terms refreshed.','success')}finally{busy(b,false)}});
    prefillFromHash(id);window.NockraI18n?.apply($('toolView'));
  }

  function setMeta(title,description){
    document.title=title;
    const d=$('metaDescription');if(d)d.setAttribute('content',description);
    const ot=$('ogTitle');if(ot)ot.setAttribute('content',title);
    const od=$('ogDescription');if(od)od.setAttribute('content',description);
    const tt=$('twitterTitle');if(tt)tt.setAttribute('content',title);
    const td=$('twitterDescription');if(td)td.setAttribute('content',description);
    const canonical=`${location.origin}${location.pathname}`;
    $('canonicalLink')?.setAttribute('href',canonical);$('ogUrl')?.setAttribute('content',canonical);
  }
  function hydratePublicConfig(){
    document.querySelectorAll('[data-brand-name]').forEach(n=>n.textContent=coinName());
    document.querySelectorAll('[data-network-name]').forEach(n=>n.textContent=networkName());
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(n=>{if(n.parentElement?.closest('script,style'))return;let t=n.nodeValue;if(coinName()!=='Nockra')t=t.replace(/Nockra/g,coinName());if(networkName()!=='Solana')t=t.replace(/Solana/g,networkName());n.nodeValue=t});
    document.querySelectorAll('[data-network-name]').forEach(n=>n.textContent=networkName());
    document.querySelectorAll('[data-nav-ticker]').forEach(n=>{const t=ticker();n.hidden=!t;if(t){n.textContent=t;n.setAttribute('href',tickerPath())}});
    const x=xUrl();['headerXLink','mobileXLink','footerXLink','homeXLink'].forEach(id=>{const n=$(id);if(n){n.hidden=!x;if(x)n.href=x}});
    const buy=getBuyUrl();['headerBuyLink','mobileBuyLink','footerBuyLink','homeBuyLink'].forEach(id=>{const n=$(id);if(n){n.hidden=!buy;if(buy)n.href=buy}});
    if($('homeTicker'))$('homeTicker').textContent=ticker()||coinName();if($('homeNetwork'))$('homeNetwork').textContent=networkName();
    const ca=contractAddress();if($('homeCaWrap'))$('homeCaWrap').hidden=!ca;if(ca&&$('homeCa'))$('homeCa').textContent=ca;
    const exp=$('footerExplorer');if(exp)exp.href=C.chain.explorerUrl;
    const fp=$('footerPons');if(fp)fp.href=C.ponsV2.publicSite;
    fixInternalUrls(document);
  }
  function copyButton(ca){ return ca ? `<button type="button" class="copy-button" data-copy-ca="${ca}">Copy CA</button>` : ''; }
  function buyButton(label='Buy'){ const u=getBuyUrl(); return u ? `<a class="button primary" href="${u}" target="_blank" rel="noopener noreferrer">${label}</a>` : ''; }
  function xButton(label='X'){ const u=xUrl(); return u ? `<a class="button ghost" href="${u}" target="_blank" rel="noopener noreferrer">${label}</a>` : ''; }
  function coinInfoRows(){
    const ca=contractAddress();
    return `<div class="public-kv"><div><span>Project</span><strong>${esc(coinName())}</strong></div><div><span>Ticker</span><strong>${esc(ticker())}</strong></div><div><span>Network</span><strong>${esc(networkName())}</strong></div>${ca?`<div><span>Contract</span><div class="ca-line"><code>${ca}</code>${copyButton(ca)}</div></div>`:''}</div>`;
  }
  function renderTickerPage(){
    const ca=contractAddress(),buy=getBuyUrl(),x=xUrl();
    setMeta(`${ticker()} | ${coinName()}`,`${coinName()} on ${networkName()}. Project information, links and purchase access.`);
    $('publicPageContent').innerHTML=`<section class="public-hero"><div><span class="eyebrow lime">${esc(networkName())} / ${esc(ticker())}</span><h1>${esc(coinName())}<br><span style="color:var(--lime)">${esc(ticker())}</span></h1><p>${esc(C.description||`${coinName()} is built for ${networkName()}.`)}</p><div class="public-actions">${buyButton('Buy')}${xButton('Open X')}<a class="button ghost" href="/docs">Read docs</a></div></div><div class="project-mark-panel"><img src="/assets/nockra-mark.png" alt="${esc(coinName())} logo" /></div></section><section class="public-section"><div class="public-section-grid"><div><span class="eyebrow">PROJECT INFORMATION</span><h2>One clear source.</h2></div><div>${coinInfoRows()}</div></div></section><section class="public-section"><div class="public-section-grid"><div><span class="eyebrow">HOW TO BUY</span><h2>Use the Pons Family launchpad.</h2></div><div><p>${buy?'Open the official Pons Family launchpad from the Buy action, connect a compatible wallet, confirm the token contract shown there and review the transaction before signing.':'Purchase access appears automatically when a valid project contract is available.'}</p>${buy?`<div class="public-actions">${buyButton('Open launchpad')}</div>`:''}</div></div></section><section class="public-section"><div class="public-section-grid"><div><span class="eyebrow">IMPORTANT LINKS</span><h2>Project access.</h2></div><div class="public-kv"><div><span>Docs</span><strong><a class="text-link" href="/docs">Project documentation </a></strong></div>${x?`<div><span>Community</span><strong><a class="text-link" href="${x}" target="_blank" rel="noopener noreferrer">X profile </a></strong></div>`:''}${ca&&isAddress(ca)?`<div><span>Explorer</span><strong><a class="text-link" href="${explorer('address',addr(ca))}" target="_blank" rel="noopener noreferrer">View contract </a></strong></div>`:''}</div></div></section>`;
  }
  function renderDocs(){
    const buy=getBuyUrl(),x=xUrl(),ca=contractAddress();
    setMeta(`Docs | ${coinName()}`,`Project documentation for ${coinName()} on ${networkName()}.`);
    $('publicPageContent').innerHTML=`<section class="public-hero"><div><span class="eyebrow lime">DOCUMENTATION</span><h1>${esc(coinName())}<br>Docs.</h1><p>Project information, token details, access links and general risk information in one concise reference.</p></div><div class="project-mark-panel"><img src="/assets/nockra-mark.png" alt="${esc(coinName())} logo" /></div></section><section class="public-section"><div class="public-section-grid"><nav class="docs-index" aria-label="Documentation sections"><a href="#introduction">Introduction</a><a href="#about-project">About</a><a href="#coin-information">Coin Information</a><a href="#how-to-buy">How to Buy</a><a href="#community">Community</a><a href="#faq">FAQ</a><a href="#risk">Risk Information</a></nav><div><div id="introduction"><span class="eyebrow">INTRODUCTION</span><h2>${esc(coinName())}</h2><p>${esc(C.description||`${coinName()} is a project on ${networkName()}.`)}</p></div><div id="about-project"><h3>About</h3><p>${esc(coinName())} provides a focused interface for creating, launching and managing ERC-20 tokens on ${esc(networkName())}, including direct wallet tools and Pump.fun launch access.</p></div><div id="coin-information"><h3>Coin Information</h3>${coinInfoRows()}</div><div id="how-to-buy"><h3>How to Buy</h3><p>${buy?'Use the Buy action to open the Pons Family launchpad for the configured contract. Check the address and transaction details before approving any wallet request.':'When a public project contract is available, purchase access is provided through the Pons Family launchpad.'}</p>${buy?`<div class="public-actions">${buyButton('Buy on Pons Family')}</div>`:''}</div><div id="community"><h3>Community</h3><p>${x?'The project X profile is the configured public social channel.':'Public community links are shown here when available.'}</p>${x?`<div class="public-actions">${xButton('Open X')}</div>`:''}</div><div id="faq"><h3>FAQ</h3><p><strong>Which network is used?</strong><br>${esc(networkName())}.</p><p><strong>Where are purchases routed?</strong><br>Available Buy actions open the Pons Family launchpad for the active project contract.</p><p><strong>Does ${esc(coinName())} custody wallet keys?</strong><br>No. Wallet approvals and transactions remain under the connected wallet.</p></div><div id="risk"><h3>Risk Information</h3><p>Digital assets and smart-contract interactions can involve substantial risk, including loss of funds, contract bugs, price volatility, liquidity risk and third-party protocol risk. Verify addresses, permissions and transaction details before signing. Nothing on this website is financial, legal or investment advice.</p></div></div></div></section>`;
  }
  function legalPage(kind){
    const pages={
      privacy:{title:'Privacy Policy',intro:'This policy explains how the public website handles information during normal use.',sections:[
        ['Wallet information',`When you connect a wallet, the interface may read the public wallet address and public on-chain data needed to provide requested tools. ${coinName()} does not receive your private keys or seed phrase.`],
        ['Local and technical data','The website may rely on browser storage or essential technical data to preserve interface state. Network providers and linked third-party services may process request metadata under their own policies.'],
        ['External services','Links and blockchain actions can involve wallet providers, RPC providers, explorers, Pons Family and decentralized protocols. Their handling of data is governed by their own terms and privacy practices.'],
        ['Your choices','You can use the informational portions of the website without connecting a wallet. You can also clear browser storage through your browser controls.']
      ]},
      terms:{title:'Terms of Use',intro:'By using this website, you agree to use it responsibly and to review transactions before signing.',sections:[
        ['Non-custodial software','The interface provides tools for interacting with public blockchain contracts. It does not hold your private keys and does not control transactions once submitted to the network.'],
        ['Your responsibility','You are responsible for verifying wallet addresses, token contracts, transaction parameters, permissions, fees and the legal consequences of your actions.'],
        ['No guarantees','Blockchain networks, wallets and third-party protocols can fail, change or become unavailable. The website is provided without a promise of uninterrupted availability or a guaranteed financial outcome.'],
        ['Prohibited use','Do not use the website to violate applicable law, compromise other users, abuse infrastructure or misrepresent the identity or origin of assets.']
      ]},
      disclaimer:{title:'Disclaimer',intro:`${coinName()} is software for blockchain interaction. It is not financial, investment, legal or tax advice.`,sections:[
        ['Digital asset risk','Tokens can lose all value. Smart contracts may contain vulnerabilities, liquidity may disappear and transactions may be irreversible.'],
        ['Third-party protocols',`Pons Family, ${networkName()} infrastructure, explorers, wallets and decentralized exchanges are independent services or protocols. Their operation can change without notice.`],
        ['Transaction review','Always verify the contract address, recipient, amount, network and wallet prompt before signing. A successful blockchain transaction does not imply that an asset or project is safe or suitable for you.']
      ]},
      cookies:{title:'Cookie Policy',intro:'The public website is designed to keep browser-side tracking minimal.',sections:[
        ['Essential storage','The interface may use browser storage required for preferences or functional state. These items support normal website operation rather than advertising.'],
        ['Third-party content','External services opened through links or wallet integrations may use their own cookies or storage. Their policies apply when you interact with them.'],
        ['Browser controls','You can remove or block browser storage using your browser settings. Blocking essential storage can affect some interface behavior.']
      ]}
    };
    return pages[kind];
  }
  function renderLegal(kind){
    const page=legalPage(kind);setMeta(`${page.title} | ${coinName()}`,`${page.title} for ${coinName()}.`);
    $('publicPageContent').innerHTML=`<section class="public-hero"><div><span class="eyebrow lime">LEGAL</span><h1>${page.title}</h1><p>${page.intro}</p></div><div class="project-mark-panel"><img src="/assets/nockra-mark.png" alt="${esc(coinName())} logo" /></div></section><section class="public-section"><div class="legal-copy">${page.sections.map(([h,p])=>`<h2>${h}</h2><p>${p}</p>`).join('')}<p>Last updated: September 2026.</p></div></section>`;
  }
  function render404(){
    setMeta(`Page not found | ${coinName()}`,`The requested page could not be found.`);
    $('publicPageContent').innerHTML=`<section class="not-found"><span class="code404">404</span><h1>Not here.</h1><p>The page you requested could not be found.</p><div class="public-actions"><a class="button primary" href="/">Return home</a></div></section>`;
  }
  async function copyConfiguredAddress(button){
    const ca=contractAddress();if(!ca)return;
    try{await navigator.clipboard.writeText(ca);const old=button.textContent;button.textContent='Copied';setTimeout(()=>button.textContent=old,1600)}catch{}
  }

  function route(){
    hydratePublicConfig();
    let path=(location.pathname||'/');
    const base=APP_BASE_PATH==='/'?'':APP_BASE_PATH;
    if(base&&path.startsWith(base))path=path.slice(base.length)||'/';
    path=path.replace(/\/+$/,'')||'/';
    path=path.replace(/\/index\.html$/i,'').replace(/\.html$/i,'')||'/';
    const hash=location.hash||'';
    const toolMatch=hash.match(/^#tool\/([^?]+)/);
    const isHome=path==='/';
    const isTicker=Boolean(tickerPath())&&path===tickerPath();
    const publicKind=path==='/docs'?'docs':path==='/privacy'?'privacy':path==='/terms'?'terms':path==='/disclaimer'?'disclaimer':path==='/cookies'?'cookies':isTicker?'ticker':(!isHome?'404':'');
    const inTool=isHome&&Boolean(toolMatch);
    $('homePage').hidden=!isHome||inTool;
    $('workspacePage').hidden=!inTool;
    $('publicPage').hidden=!publicKind;
    $('siteFooter').hidden=inTool;
    $('toolsMenu').hidden=true;$('toolsToggle').setAttribute('aria-expanded','false');
    if(inTool){renderTool(toolMatch[1]);window.scrollTo({top:0,behavior:'auto'});return}
    if(publicKind){if(publicKind==='ticker')renderTickerPage();else if(publicKind==='docs')renderDocs();else if(publicKind==='404')render404();else renderLegal(publicKind);fixInternalUrls($('publicPageContent'));window.NockraI18n?.apply($('publicPageContent'));window.scrollTo({top:0,behavior:'auto'});return}
    setMeta(`${coinName()} | ${networkName()} Token Tools`,`${coinName()} provides token creation, Pump.fun launching and management tools for ${networkName()}.`);
    const target=hash.replace(/^#/,'').split('?')[0];if(target&&target!=='home')setTimeout(()=>document.getElementById(target)?.scrollIntoView({behavior:'smooth'}),30);
  }

  async function handleSubmit(e){
    const form=e.target.closest('form[data-action]');if(!form)return;e.preventDefault();const a=form.dataset.action;
    const actions={
      'create-token':actionCreateToken,'multisend':actionMultisend,'inspect-revoke':inspectRevoke,'execute-revoke':executeRevoke,
      'mint':actionMint,'burn':actionBurn,'pause':()=>actionPause(false),'unpause':()=>actionPause(true),
      'block-account':()=>actionBlock(false),'unblock-account':()=>actionBlock(true),'create-pool':actionCreatePool,
      'add-liquidity':actionAddLiquidity,'remove-liquidity':actionRemoveLiquidity,'inspect-token':actionInspectToken,'pons-launch':actionPonsLaunch
    };
    if(actions[a])await actions[a]();
  }

  function applyTheme(theme){
    const value=theme==='light'?'light':'dark';document.documentElement.dataset.theme=value;storageSet('nockra:theme',value);const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',value==='light'?'#f4f6ef':'#080b09');
  }
  function toggleTheme(){applyTheme(document.documentElement.dataset.theme==='light'?'dark':'light')}
  async function onWalletButton(){
    if(state.account){$('walletMenu').hidden=!$('walletMenu').hidden;return}
    try{await connectWallet();toast(`Wallet connected to ${networkName()}.`,'success');const m=(location.hash||'').match(/^#tool\/([^?]+)/);if(m)renderTool(m[1])}catch(err){toast(errorText(err),'error')}
  }
  function setupEvents(){
    const on=(id,event,handler)=>{const el=$(id);if(el)el.addEventListener(event,handler)};
    on('connectWallet','click',onWalletButton);
    on('sidebarWallet','click',async()=>{if(state.account){const m=$('walletMenu');if(m)m.hidden=!m.hidden;return}try{await connectWallet();const match=(location.hash||'').match(/^#tool\/([^?]+)/);if(match)renderTool(match[1])}catch(err){toast(errorText(err),'error')}});
    on('disconnectWallet','click',()=>{disconnectWallet();toast('Wallet disconnected from Nockra.','success')});
    on('walletCopy','click',async()=>{if(!state.account)return;try{await navigator.clipboard.writeText(state.account);toast('Address copied.','success')}catch{}});
    on('languageToggle','click',()=>window.NockraI18n?.toggle());
    on('mobileLanguageToggle','click',()=>window.NockraI18n?.toggle());
    on('themeToggle','click',toggleTheme);
    on('mobileThemeToggle','click',toggleTheme);
    document.addEventListener('nockra:language',updateWalletUI);
    on('toolsToggle','click',()=>{const menu=$('toolsMenu'),toggle=$('toolsToggle');if(!menu||!toggle)return;const open=menu.hidden;menu.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open)$('menuToolSearch')?.focus()});
    on('menuToolSearch','input',e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('#toolsMenuGroups .mega-group a').forEach(a=>a.hidden=Boolean(q)&&!a.textContent.toLowerCase().includes(q));document.querySelectorAll('#toolsMenuGroups .mega-group').forEach(g=>g.hidden=!Array.from(g.querySelectorAll('a')).some(a=>!a.hidden))});
    document.addEventListener('click',e=>{
      const toolsMenu=$('toolsMenu'),toolsToggle=$('toolsToggle');
      if(toolsMenu&&toolsToggle&&!toolsMenu.hidden&&!e.target.closest('#toolsMenu')&&!e.target.closest('#toolsToggle')){toolsMenu.hidden=true;toolsToggle.setAttribute('aria-expanded','false')}
      const walletMenu=$('walletMenu');if(walletMenu&&!walletMenu.hidden&&!e.target.closest('.wallet-wrap')&&!e.target.closest('#sidebarWallet'))walletMenu.hidden=true;
      const routeBtn=e.target.closest('[data-route-tool]');if(routeBtn){e.preventDefault();location.hash=`#tool/${routeBtn.dataset.routeTool}`}
      const filter=e.target.closest('[data-filter]');if(filter){state.activeFilter=filter.dataset.filter;document.querySelectorAll('[data-filter]').forEach(n=>n.classList.toggle('active',n===filter));renderToolGrid();window.NockraI18n?.apply($('toolGrid'))}
      const copy=e.target.closest('[data-copy-ca]');if(copy){e.preventDefault();copyConfiguredAddress(copy)}
    });
    on('toolSearch','input',()=>{renderToolGrid();window.NockraI18n?.apply($('toolGrid'))});
    on('workspaceBack','click',()=>{location.hash='#tools'});
    on('homeCopyCa','click',e=>copyConfiguredAddress(e.currentTarget));
    document.addEventListener('submit',handleSubmit);
    on('mobileMenuButton','click',()=>{const panel=$('mobilePanel'),button=$('mobileMenuButton');if(panel)panel.hidden=false;if(button)button.setAttribute('aria-expanded','true')});
    on('closeMobile','click',()=>{const panel=$('mobilePanel'),button=$('mobileMenuButton');if(panel)panel.hidden=true;if(button)button.setAttribute('aria-expanded','false')});
    on('mobilePanel','click',e=>{if(e.target.closest('a')){const panel=$('mobilePanel');if(panel)panel.hidden=true}});
    window.addEventListener('hashchange',route);window.addEventListener('popstate',route);
    if(window.ethereum){
      window.ethereum.on?.('accountsChanged',async accounts=>{if(storageGet('nockra:wallet-disconnected')==='1'){state.account=null;state.signer=null;state.browserProvider=null;updateWalletUI();return}state.account=accounts?.[0]?(normalizeAddress(accounts[0])||accounts[0]):null;state.signer=null;state.browserProvider=null;if(state.account)void attachSigner().catch(()=>{});updateWalletUI();if(state.publicProvider)await refreshLive();const m=(location.hash||'').match(/^#tool\/([^?]+)/);if(m)renderTool(m[1])});
      window.ethereum.on?.('chainChanged',async()=>{if(!state.account)return;state.signer=null;state.browserProvider=null;try{state.chainOk=String(await window.ethereum.request({method:'eth_chainId'})).toLowerCase()===String(C.chain.hexId).toLowerCase();void attachSigner().catch(()=>{})}catch{state.chainOk=false}updateWalletUI();if(state.publicProvider)await refreshLive()})
    }
  }

  function boot(){
    try{applyTheme(storageGet('nockra:theme','dark')||'dark')}catch{}
    try{hydratePublicConfig()}catch{}
    try{renderToolNavigation()}catch{}
    try{renderContracts()}catch{}
    try{setupEvents()}catch{}
    try{updateWalletUI()}catch{}
    try{route()}catch{}
    try{window.NockraI18n?.apply(document)}catch{}
    document.documentElement.dataset.appReady='true';
    // Network/config work is always background work. It can never block the interface.
    void refreshConfig();
    void restoreWalletSession().then(()=>{try{updateWalletUI();route()}catch{}}).catch(()=>{});
    void initPublic();
  }
  boot();
})().catch(()=>{document.documentElement.dataset.appReady='false'});
