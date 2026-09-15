(() => {
  'use strict';
  const Core=window.NockraCore;if(!Core)return;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(){
    const c=Core.state.config,slug=location.pathname.replace(/^\/+|\/+$/g,'').toLowerCase(),ticker=String(c.ticker||'').toLowerCase();
    if(slug && slug!=='coin.html' && ticker && slug!==ticker){document.title='Not Found | Nockra';$('coinRoot').innerHTML='<section class="not-found"><h1>Not here.</h1><p class="muted">The page you requested could not be found.</p><div class="public-actions"><a class="primary-button" href="/">Return home</a></div></section>';return;}
    document.title=`${c.ticker||'NOCKRA'} | ${c.coinName||'Nockra'}`;
    const ca=String(c.contractAddress||'').trim(),hasCa=Core.isAddress(ca),buy=Core.getBuyUrl(),x=Core.validUrl(c.xUrl)?c.xUrl:'';
    $('coinName').textContent=c.coinName||'Nockra';$('coinTicker').textContent=c.ticker||'NOCKRA';$('coinNetwork').textContent=c.network||'Robinhood Chain';$('coinDescription').textContent=c.description||'';
    const caWrap=$('coinCaWrap'); if(hasCa){caWrap.hidden=false;$('coinCa').textContent=ca;$('coinExplorer').href=Core.explorer('address',ca);}else caWrap.hidden=true;
    const buyBtns=document.querySelectorAll('[data-coin-buy]');buyBtns.forEach(a=>{if(buy){a.hidden=false;a.href=buy}else a.hidden=true});
    const xBtns=document.querySelectorAll('[data-coin-x]');xBtns.forEach(a=>{if(x){a.hidden=false;a.href=x}else a.hidden=true});
  }
  document.addEventListener('click',async e=>{const b=e.target.closest('[data-copy-ca]');if(!b)return;const ca=String(Core.state.config.contractAddress||'').trim();if(!Core.isAddress(ca))return;try{await navigator.clipboard.writeText(ca);const old=b.textContent;b.textContent=Core.state.lang==='zh'?'已复制':'Copied';setTimeout(()=>b.textContent=old,1200)}catch{}});
  Core.onChange(render);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
})();
