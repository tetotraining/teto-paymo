(() => {
  const SHELF_ICON=`<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="20" width="9" height="28" rx="1.5"/><path d="M10 27h9"/><rect x="23" y="13" width="9" height="35" rx="1.5"/><path d="M23 21h9"/><rect x="36" y="23" width="8" height="25" rx="1.5"/><path d="M36 30h8"/><rect x="48" y="17" width="8" height="31" rx="1.5"/><path d="M48 24h8"/><path d="M8 52h48v5H8z"/><path d="M13 57v3M51 57v3"/></g></svg>`;
  const GRAPH_ICON=`<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"><rect x="11" y="32" width="10" height="21" rx="2.5"/><rect x="27" y="22" width="10" height="31" rx="2.5"/><rect x="43" y="11" width="10" height="42" rx="2.5"/></g></svg>`;
  const $=id=>document.getElementById(id);
  const yen=n=>'¥'+Number(n||0).toLocaleString('ja-JP');
  const dateOf=e=>String(e?.usage_date||e?.usageDate||e?.date||'').slice(0,10);
  const payeeOf=e=>String(e?.payee||e?.item||e?.name||'その他');
  const amountOf=e=>Number(e?.amount||0);
  function source(){
    if(Array.isArray(window.expenses))return window.expenses;
    try{return JSON.parse(localStorage.getItem('ready-expenses-v1')||'[]')}catch(_){return[]}
  }
  function monthKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
  function render(){
    const root=$('categorySpendRows');if(!root)return;
    const key=monthKey();
    const map=new Map();
    source().forEach(e=>{const d=dateOf(e);if(!d.startsWith(key))return;const p=payeeOf(e);map.set(p,(map.get(p)||0)+amountOf(e))});
    const rows=[...map.entries()].sort((a,b)=>b[1]-a[1]);
    const total=rows.reduce((s,r)=>s+r[1],0);
    $('categorySpendTotal').textContent=yen(total);
    root.innerHTML=rows.length?rows.map(([name,amount])=>`<div class="category-spend-row"><span>${name}</span><b>${yen(amount)}</b></div>`).join(''):'<div class="category-spend-empty">今月の支出はありません。</div>';
  }
  function setup(){
    const notify=document.querySelector('.nav-btn[data-view="notify"]');
    if(notify){notify.setAttribute('data-view','categorySpend');notify.setAttribute('aria-label','項目別支出');notify.innerHTML=SHELF_ICON}
    const graph=document.querySelector('.nav-btn[data-view="graph"]');
    if(graph){graph.setAttribute('aria-label','グラフ');graph.innerHTML=GRAPH_ICON}
    const app=document.querySelector('.app');
    if(app&&!$('categorySpend')){const s=document.createElement('section');s.id='categorySpend';s.className='view';s.innerHTML='<h1 class="page-title">項目別支出</h1><div class="card"><div class="label">今月の支出</div><div id="categorySpendTotal" class="money">¥0</div><div id="categorySpendRows"></div></div>';app.appendChild(s)}
    if(!document.getElementById('paymo-category-spend-style')){const style=document.createElement('style');style.id='paymo-category-spend-style';style.textContent='.category-spend-row{display:flex;align-items:center;justify-content:space-between;padding:15px 0;border-top:1px solid var(--theme-line,#293029);font-size:16px}.category-spend-row:first-child{border-top:0}.category-spend-row b{font-size:17px}.category-spend-empty{padding:24px 0;color:var(--theme-muted,#777);text-align:center;font-size:13px}';document.head.appendChild(style)}
    document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.view==='categorySpend')setTimeout(render,0)}));
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
