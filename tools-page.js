(() => {
  'use strict';
  function init(){
    const input=document.getElementById('toolSearch');const grid=document.getElementById('allTools');if(!input||!grid)return;
    input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();grid.querySelectorAll('.tool-row').forEach(row=>{row.hidden=!!q&&!row.textContent.toLowerCase().includes(q);});});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
