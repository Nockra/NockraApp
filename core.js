(() => {
  'use strict';

  const DEFAULT_CONFIG = Object.freeze({
    coinName: 'Nockra', ticker: 'NOCKRA', network: 'Robinhood Chain', contractAddress: '', xUrl: '',
    buyUrlTemplate: 'https://ponsfamily.com/launchpad/{ca}',
    description: 'A focused token creation, launch and management workspace for Robinhood Chain.',
    chain: { id: 4663, hexId: '0x1237', name: 'Robinhood Chain', rpcUrl: 'https://rpc.mainnet.chain.robinhood.com', explorerUrl: 'https://robinhoodchain.blockscout.com', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } },
    ponsV2: { factory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e', usdG: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168', publicSite: 'https://ponsfamily.com/launchpad' },
    uniswapV3: { factory: '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA', positionManager: '0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3', swapRouter: '0xCaf681a66D020601342297493863E78C959E5cb2', quoterV2: '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7', weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' },
    imageUploadEndpoint: '/api/upload'
  });

  const state = { config: typeof structuredClone === 'function' ? structuredClone(DEFAULT_CONFIG) : JSON.parse(JSON.stringify(DEFAULT_CONFIG)), account: null, lang: safeGet('nockra:lang') || 'en', theme: safeGet('nockra:theme') || 'dark' };
  const listeners = new Set();

  function safeGet(key){ try { return localStorage.getItem(key) || ''; } catch { return ''; } }
  function safeSet(key, value){ try { localStorage.setItem(key, value); } catch {} }
  function merge(base, extra){
    const out = Array.isArray(base) ? [...base] : { ...base };
    if (!extra || typeof extra !== 'object') return out;
    for (const [k,v] of Object.entries(extra)) out[k] = v && typeof v === 'object' && !Array.isArray(v) && base?.[k] && typeof base[k] === 'object' ? merge(base[k],v) : v;
    return out;
  }
  function isAddress(v){ return /^0x[a-fA-F0-9]{40}$/.test(String(v || '').trim()); }
  function validUrl(v){ try { const u = new URL(String(v || '')); return u.protocol === 'https:'; } catch { return false; } }
  function configValue(k){ return state.config?.[k]; }
  function getBuyUrl(){
    const ca = String(configValue('contractAddress') || '').trim();
    const template = String(configValue('buyUrlTemplate') || '').trim();
    if (!isAddress(ca) || !/^https:\/\//i.test(template) || !template.includes('{ca}')) return '';
    return template.replaceAll('{ca}', ca);
  }
  function tickerPath(){ const t = String(configValue('ticker') || '').trim().toLowerCase(); return /^[a-z0-9_-]{1,30}$/.test(t) ? `/${t}` : '/'; }
  function explorer(type, value){ const base = String(state.config.chain?.explorerUrl || '').replace(/\/$/,''); return `${base}/${type}/${value}`; }
  function emit(){ listeners.forEach(fn => { try { fn(state); } catch {} }); }
  function onChange(fn){ listeners.add(fn); return () => listeners.delete(fn); }

  async function loadConfig(){
    const controller = 'AbortController' in window ? new AbortController() : null;
    const timeout = setTimeout(() => controller?.abort(), 1800);
    try {
      const res = await fetch('/config.json', { cache: 'no-store', signal: controller?.signal });
      if (!res.ok) return;
      const json = await res.json();
      if (json && typeof json === 'object') state.config = merge(DEFAULT_CONFIG, json);
    } catch {} finally { clearTimeout(timeout); emit(); applyPublicConfig(); }
  }

  function applyTheme(theme){
    state.theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = state.theme;
    safeSet('nockra:theme', state.theme);
    document.querySelectorAll('[data-theme-label]').forEach(el => el.textContent = state.theme === 'dark' ? 'Light' : 'Dark');
  }
  function applyLanguage(lang){
    state.lang = lang === 'zh' ? 'zh' : 'en';
    document.documentElement.lang = state.lang === 'zh' ? 'zh-Hans' : 'en';
    safeSet('nockra:lang', state.lang);
    document.querySelectorAll('[data-en][data-zh]').forEach(el => { el.textContent = el.dataset[state.lang] || el.textContent; });
    document.querySelectorAll('[data-lang-label]').forEach(el => el.textContent = state.lang === 'zh' ? 'EN' : '中文');
    emit();
  }

  function applyPublicConfig(){
    const c = state.config;
    document.querySelectorAll('[data-config="coinName"]').forEach(el => el.textContent = c.coinName || 'Nockra');
    document.querySelectorAll('[data-config="ticker"]').forEach(el => { const raw=String(c.ticker||'NOCKRA').replace(/^\$/,''); el.textContent = '$' + raw; });
    document.querySelectorAll('[data-config="network"]').forEach(el => el.textContent = c.network || 'Robinhood Chain');
    document.querySelectorAll('[data-ticker-link]').forEach(el => el.setAttribute('href', tickerPath()));
    const x = validUrl(c.xUrl) ? c.xUrl : '';
    document.querySelectorAll('[data-x-link]').forEach(el => { if (x) { el.hidden = false; el.setAttribute('href', x); } else el.hidden = true; });
    const buy = getBuyUrl();
    document.querySelectorAll('[data-buy-link]').forEach(el => { if (buy) { el.hidden = false; el.setAttribute('href', buy); } else el.hidden = true; });
  }


  function toast(text){
    let n=document.getElementById('siteToast');
    if(!n){n=document.createElement('div');n.id='siteToast';n.setAttribute('role','status');n.style.cssText='position:fixed;right:18px;bottom:18px;z-index:120;max-width:320px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--text);box-shadow:var(--shadow);font:500 13px Poppins;';document.body.appendChild(n)}
    n.textContent=text;n.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>{n.hidden=true},2600);
  }

  function shortAddress(a){ return a ? `${a.slice(0,6)}…${a.slice(-4)}` : ''; }
  async function switchChain(){
    if (!window.ethereum?.request) return false;
    const target = String(state.config.chain?.hexId || '0x1237').toLowerCase();
    let current = String(await window.ethereum.request({ method: 'eth_chainId' })).toLowerCase();
    if (current === target) return true;
    try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: target }] }); }
    catch (e) {
      if (e?.code !== 4902 && !/unrecognized|unknown chain|not added/i.test(String(e?.message || ''))) return false;
      try {
        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{
          chainId: target,
          chainName: state.config.chain?.name || state.config.network || 'Robinhood Chain',
          nativeCurrency: state.config.chain?.nativeCurrency || { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: [state.config.chain?.rpcUrl].filter(Boolean),
          blockExplorerUrls: [state.config.chain?.explorerUrl].filter(Boolean)
        }] });
      } catch { return false; }
    }
    current = String(await window.ethereum.request({ method: 'eth_chainId' })).toLowerCase();
    return current === target;
  }
  async function connectWallet(){
    if (!window.ethereum?.request) return { ok: false, reason: 'wallet' };
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts?.[0]) return { ok: false, reason: 'account' };
      const chainOk = await switchChain();
      if (!chainOk) return { ok: false, reason: 'network' };
      state.account = accounts[0];
      safeSet('nockra:walletConnected', '1');
      updateWalletUI(); emit();
      return { ok: true, account: state.account };
    } catch { return { ok: false, reason: 'cancelled' }; }
  }
  function disconnectWallet(){ state.account = null; safeSet('nockra:walletConnected','0'); updateWalletUI(); emit(); }
  async function restoreWallet(){
    if (!window.ethereum?.request || safeGet('nockra:walletConnected') !== '1') return;
    try { const a = await window.ethereum.request({ method: 'eth_accounts' }); if (a?.[0]) { state.account = a[0]; updateWalletUI(); emit(); } } catch {}
  }
  function updateWalletUI(){
    document.querySelectorAll('[data-wallet-button]').forEach(btn => btn.textContent = state.account ? shortAddress(state.account) : (state.lang === 'zh' ? '连接钱包' : 'Connect Wallet'));
    document.querySelectorAll('[data-wallet-connected-only]').forEach(el => el.hidden = !state.account); const ex=document.getElementById('walletExplorer'); if(ex && state.account) ex.href=explorer('address',state.account);
  }

  function setupUI(){
    applyTheme(state.theme); applyLanguage(state.lang); applyPublicConfig(); updateWalletUI();
    document.addEventListener('click', async (e) => {
      const theme = e.target.closest('[data-theme-toggle]');
      if (theme) { e.preventDefault(); applyTheme(state.theme === 'dark' ? 'light' : 'dark'); return; }
      const lang = e.target.closest('[data-lang-toggle]');
      if (lang) { e.preventDefault(); applyLanguage(state.lang === 'en' ? 'zh' : 'en'); return; }
      const wallet = e.target.closest('[data-wallet-button]');
      if (wallet) {
        e.preventDefault();
        if (!state.account) { const r = await connectWallet(); if (!r.ok) toast(r.reason==='wallet' ? (state.lang==='zh'?'请在浏览器中打开兼容的钱包。':'Open a compatible browser wallet to connect.') : (state.lang==='zh'?'钱包连接未完成。':'Wallet connection was not completed.')); }
        else { const menu = document.querySelector('[data-wallet-menu]'); if (menu) menu.hidden = !menu.hidden; }
        return;
      }
      const disc = e.target.closest('[data-wallet-disconnect]');
      if (disc) { e.preventDefault(); disconnectWallet(); const menu = document.querySelector('[data-wallet-menu]'); if (menu) menu.hidden = true; return; }
      const mobile = e.target.closest('[data-mobile-toggle]');
      if (mobile) { e.preventDefault(); const p = document.querySelector('[data-mobile-panel]'); if (p) p.hidden = !p.hidden; return; }
      const closeMobile = e.target.closest('[data-mobile-panel] a');
      if (closeMobile) { const p = document.querySelector('[data-mobile-panel]'); if (p) p.hidden = true; }
      const outsideWallet = document.querySelector('[data-wallet-menu]');
      if (outsideWallet && !outsideWallet.hidden && !e.target.closest('.wallet-wrap')) outsideWallet.hidden = true;
    });
    if (window.ethereum?.on) {
      window.ethereum.on('accountsChanged', accounts => { state.account = accounts?.[0] || null; updateWalletUI(); emit(); });
      window.ethereum.on('chainChanged', () => emit());
    }
    void restoreWallet();
    void loadConfig();
  }

  window.NockraCore = { state, onChange, getBuyUrl, tickerPath, explorer, isAddress, validUrl, connectWallet, disconnectWallet, switchChain, shortAddress, applyPublicConfig };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupUI, { once: true }); else setupUI();
})();
