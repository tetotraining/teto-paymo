(() => {
  const SHELF_ICON=`<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="20" width="9" height="28" rx="1.5"/><path d="M10 27h9"/><rect x="23" y="13" width="9" height="35" rx="1.5"/><path d="M23 21h9"/><rect x="36" y="23" width="8" height="25" rx="1.5"/><path d="M36 30h8"/><rect x="48" y="17" width="8" height="31" rx="1.5"/><path d="M48 24h8"/><path d="M8 52h48v5H8z"/><path d="M13 57v3M51 57v3"/></g></svg>`;
  const GRAPH_ICON=`<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"><rect x="11" y="32" width="10" height="21" rx="2.5"/><rect x="27" y="22" width="10" height="31" rx="2.5"/><rect x="43" y="11" width="10" height="42" rx="2.5"/></g></svg>`;
  const $=id=>document.getElementById(id);
  const yen=n=>'¥'+Number(n||0).toLocaleString('ja-JP');
  const dateOf=e=>String(e?.usage_date||e?.usageDate||e?.date||'').slice(0,10);
  const payeeOf=e=>String(e?.payee||e?.item||e?.name||'その他');
  const amountOf=e=>Number(e?.amount||0);
  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const formatDate=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return '日付なし';const [y,m,d]=value.split('-');return `${y}/${Number(m)}/${Number(d)}`};

  function source(){
    if(Array.isArray(window.expenses))return window.expenses;
    try{return JSON.parse(localStorage.getItem('ready-expenses-v1')||'[]')}catch(_){return[]}
  }

  function registeredItems(){
    try{
      const saved=JSON.parse(localStorage.getItem('paymo_payees_v1')||'[]');
      if(Array.isArray(saved))return saved.filter(x=>x&&String(x.name||'').trim()).map(x=>({name:String(x.name).trim(),color:x.color||'#999999'}));
    }catch(_){}
    return [];
  }

  function itemsWithHistory(rows){
    const items=registeredItems(),seen=new Set(items.map(x=>x.name));
    rows.forEach(row=>{const name=payeeOf(row);if(!seen.has(name)){items.push({name,color:'#999999'});seen.add(name)}});
    return items;
  }

  function historyFor(name,rows){
    return rows.map((expense,index)=>({expense,index,date:dateOf(expense)}))
      .filter(x=>payeeOf(x.expense)===name)
      .sort((a,b)=>String(b.date).localeCompare(String(a.date))||b.index-a.index);
  }

  function historyRow(item){
    return `<div class="category-history-row"><span class="category-history-date">${escapeHtml(formatDate(item.date))}</span><b class="category-history-amount">${yen(amountOf(item.expense))}</b></div>`;
  }

  function render(){
    const root=$('categorySpendRows');if(!root)return;
    const rows=source(),items=itemsWithHistory(rows);
    if(!items.length){root.innerHTML='<div class="category-spend-empty">項目はまだ登録されていません。</div>';return}
    root.innerHTML=items.map(item=>{
      const history=historyFor(item.name,rows),visible=history.slice(0,5),peek=history[5];
      const body=history.length
        ? `${visible.map(historyRow).join('')}${peek?`<div class="category-history-peek">${historyRow(peek)}</div>`:''}`
        : '<div class="category-history-empty">まだ履歴がありません。</div>';
      return `<section class="category-history-card"><div class="category-history-title"><i class="category-history-dot" style="background:${escapeHtml(item.color)}"></i><span>${escapeHtml(item.name)}</span></div><div class="category-history-list">${body}</div></section>`;
    }).join('');
  }

  function setup(){
    const notify=document.querySelector('.nav-btn[data-view="notify"]');
    if(notify){notify.setAttribute('data-view','categorySpend');notify.setAttribute('aria-label','項目別履歴');notify.innerHTML=SHELF_ICON}
    const graph=document.querySelector('.nav-btn[data-view="graph"]');
    if(graph){graph.setAttribute('aria-label','グラフ');graph.innerHTML=GRAPH_ICON}
    const app=document.querySelector('.app');
    if(app&&!$('categorySpend')){const s=document.createElement('section');s.id='categorySpend';s.className='view';s.innerHTML='<h1 class="page-title">項目別履歴</h1><div id="categorySpendRows" class="category-history-sections"></div>';app.appendChild(s)}
    else if($('categorySpend')){$('categorySpend').innerHTML='<h1 class="page-title">項目別履歴</h1><div id="categorySpendRows" class="category-history-sections"></div>'}
    if(!document.getElementById('paymo-category-spend-style')){
      const style=document.createElement('style');style.id='paymo-category-spend-style';style.textContent=`
        .category-history-sections{display:grid;gap:14px;padding-bottom:10px}
        .category-history-card{background:var(--surface,#101310);color:var(--page-fg,#f5f5f3);border-radius:24px;padding:18px 20px;overflow:hidden}
        .category-history-title{display:flex;align-items:center;gap:10px;font-size:18px;font-weight:900;margin-bottom:8px;min-width:0}
        .category-history-title span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .category-history-dot{width:11px;height:11px;border-radius:50%;flex:0 0 11px}
        .category-history-list{overflow:hidden}
        .category-history-row{height:58px;display:flex;align-items:center;justify-content:space-between;gap:14px;border-top:1px solid var(--theme-line,#293029)}
        .category-history-row:first-child{border-top:0}
        .category-history-date{font-size:14px;font-weight:700;color:var(--theme-muted,#9ca198)}
        .category-history-amount{font-size:18px;font-weight:900;white-space:nowrap}
        .category-history-peek{height:29px;overflow:hidden;opacity:.34;pointer-events:none}
        .category-history-peek .category-history-row{height:58px;border-top:1px solid var(--theme-line,#293029)}
        .category-history-empty,.category-spend-empty{padding:18px 0 8px;color:var(--theme-muted,#777);text-align:center;font-size:13px}
      `;document.head.appendChild(style)
    }
    document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.view==='categorySpend')setTimeout(render,0)}));
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
