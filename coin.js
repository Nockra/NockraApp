(() => {
  'use strict';
  const Core=window.NockraCore;if(!Core)return;
  const $=id=>document.getElementById(id);
  function routeSlug(){
    const parts=location.pathname.split('/').filter(Boolean).map(x=>decodeURIComponent(x).toLowerCase());
    if(parts.at(-1)==='index.html') parts.pop();
    const last=parts.at(-1)||'';
    if(last==='coin.html') return '';
    return last;
  }
  function render(){
    const c=Core.state.config||{};
    const tickerRaw=String(c.ticker||'NOCKRA').replace(/^\$/,'').trim();
    const ticker=tickerRaw.toLowerCase();
    const slug=routeSlug();
    if(slug && ticker && slug!==ticker){
      document.title='Not Found | Nockra';
      const root=$('coinRoot');
      if(root) root.innerHTML=`<section class="not-found"><span class="eyebrow lime">404</span><h1>Not here.</h1><p class="muted">The page you requested could not be found.</p><div class="public-actions"><a class="primary-button" href="${Core.appUrl('')}">Return home</a></div></section>`;
      return;
    }
    const display='$'+tickerRaw;
    document.title=`${display} | ${c.coinName||'Nockra'}`;
    const title=document.querySelector('meta[property="og:title"]');if(title)title.content=`${display} | ${c.coinName||'Nockra'}`;
    const ca=String(c.contractAddress||'').trim(),hasCa=Core.isAddress(ca),buy=Core.getBuyUrl(),x=Core.validUrl(c.xUrl)?c.xUrl:'';
    if($('coinName')) $('coinName').textContent=c.coinName||'Nockra';
    if($('coinTicker')) $('coinTicker').textContent=display;
    if($('coinNetwork')) $('coinNetwork').textContent=c.network||'Solana';
    if($('coinDescription')) $('coinDescription').textContent=c.description||'';
    const caWrap=$('coinCaWrap');
    if(caWrap){
      if(hasCa){caWrap.hidden=false;$('coinCa').textContent=ca;$('coinExplorer').href=Core.explorer((String(c.network||'').toLowerCase()==='solana'?'token':'address'),ca)}
      else caWrap.hidden=true;
    }
    document.querySelectorAll('[data-coin-buy]').forEach(a=>{if(buy){a.hidden=false;a.href=buy}else{a.hidden=true;a.removeAttribute('href')}});
    document.querySelectorAll('[data-coin-x]').forEach(a=>{if(x){a.hidden=false;a.href=x}else{a.hidden=true;a.removeAttribute('href')}});
  }
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-copy-ca]');if(!b)return;
    const ca=String(Core.state.config.contractAddress||'').trim();if(!Core.isAddress(ca))return;
    try{await navigator.clipboard.writeText(ca);const old=b.textContent;b.textContent=Core.state.lang==='zh'?'已复制':'Copied';setTimeout(()=>b.textContent=old,1200)}catch{}
  });
  Core.onChange(render);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
})();
