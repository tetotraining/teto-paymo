(() => {
  const STORAGE_KEY='paymo_payees_v1';
  const COLORS=['#E63946','#FF852F','#FFD166','#0D43FF','#4EA8DE','#E085FF','#B9F486','#5b5ce2','#00a67a','#999999'];

  function loadItems(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(raw===null) return [];
      const saved=JSON.parse(raw);
      if(Array.isArray(saved)) return saved.filter(x=>x&&typeof x.name==='string'&&x.name.trim()).map((x,i)=>({name:x.name.trim().slice(0,30),color:x.color||COLORS[i%COLORS.length]}));
    }catch{}
    return [];
  }

  function saveItems(items){localStorage.setItem(STORAGE_KEY,JSON.stringify(items))}

  function syncApp(items=loadItems()){
    try{
      PAYEES.splice(0,PAYEES.length,...items.map(x=>({...x})));
      if(!PAYEES.some(x=>x.name===selectedPayee)) selectedPayee=PAYEES[0]?.name||'';
      if(typeof renderPayees==='function') renderPayees();
      if(items.length===0){
        const host=document.getElementById('payees');
        if(host) host.innerHTML='<div class="payee-empty">メニューの「項目登録」から追加してください</div>';
      }
      const save=document.getElementById('saveBtn');
      if(save) save.disabled=items.length===0;
      if(typeof render==='function') render();
    }catch{}
  }

  function injectStyles(){
    if(document.getElementById('paymo-items-style')) return;
    const style=document.createElement('style');
    style.id='paymo-items-style';
    style.textContent=`
      .item-register-view{padding-bottom:16px}
      .item-add-card{background:#f4f4f2;border-radius:20px;padding:12px;display:flex;gap:8px}
      .item-name-input{min-width:0;flex:1;border:1px solid #d7d7d4;background:#fff;border-radius:14px;padding:13px 14px;outline:none;color:#111}
      .item-add-btn{border:0;border-radius:14px;background:var(--accent);color:var(--accent-ink);font-weight:900;padding:0 18px}
      .item-register-list{display:grid;gap:8px;margin-top:12px}
      .item-register-row{background:#f4f4f2;color:#111;border-radius:18px;padding:11px 12px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px}
      .item-register-dot{width:11px;height:11px;border-radius:50%}
      .item-register-name{font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .item-actions{display:flex;align-items:center;gap:5px}
      .item-action{width:34px;height:34px;border:0;border-radius:10px;background:#fff;color:#111;font-size:17px;font-weight:900;display:grid;place-items:center}
      .item-action:disabled{opacity:.28}
      .item-delete{color:#d62828;font-size:16px}
      .item-note{color:var(--page-fg);opacity:.58;font-size:12px;line-height:1.5;margin:9px 4px 0}
      .item-empty{background:#f4f4f2;color:#777;border-radius:18px;padding:20px;text-align:center;font-size:13px}
      .payee-empty{grid-column:1/-1;background:#fff;border:1px solid #d7d7d4;border-radius:15px;padding:14px;text-align:center;color:#777;font-size:12px}
      #saveBtn:disabled{opacity:.35}
    `;
    document.head.appendChild(style);
  }

  function showView(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.getElementById(id)?.classList.add('active')}
  function escapeHtml(value){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

  function renderList(){
    const host=document.getElementById('itemRegisterList');
    if(!host) return;
    const items=loadItems();
    if(items.length===0){host.innerHTML='<div class="item-empty">項目はまだ登録されていません</div>';return}
    host.innerHTML=items.map((item,i)=>`<div class="item-register-row" data-index="${i}"><span class="item-register-dot" style="background:${item.color}"></span><span class="item-register-name">${escapeHtml(item.name)}</span><span class="item-actions"><button class="item-action" data-move="up" ${i===0?'disabled':''} aria-label="上へ">↑</button><button class="item-action" data-move="down" ${i===items.length-1?'disabled':''} aria-label="下へ">↓</button><button class="item-action item-delete" data-delete="1" aria-label="削除">×</button></span></div>`).join('');
    host.querySelectorAll('.item-register-row').forEach(row=>{
      const index=Number(row.dataset.index);
      row.querySelector('[data-move="up"]')?.addEventListener('click',()=>moveItem(index,-1));
      row.querySelector('[data-move="down"]')?.addEventListener('click',()=>moveItem(index,1));
      row.querySelector('[data-delete]')?.addEventListener('click',()=>deleteItem(index));
    });
  }

  function moveItem(index,delta){const items=loadItems(),target=index+delta;if(target<0||target>=items.length)return;[items[index],items[target]]=[items[target],items[index]];saveItems(items);renderList();syncApp(items)}
  function deleteItem(index){const items=loadItems();if(index<0||index>=items.length)return;items.splice(index,1);saveItems(items);renderList();syncApp(items)}
  function addItem(){const input=document.getElementById('itemNameInput');if(!input)return;const name=input.value.trim().slice(0,30);if(!name){input.focus();return}const items=loadItems();if(items.some(x=>x.name===name)){input.select();return}items.push({name,color:COLORS[items.length%COLORS.length]});saveItems(items);input.value='';renderList();syncApp(items);input.focus()}

  function buildItemRegistration(){
    const menuList=document.querySelector('#menu .menu-list'),app=document.querySelector('.app');
    if(!menuList||!app) return;
    if(!document.getElementById('openItemRegistration')){const button=document.createElement('button');button.id='openItemRegistration';button.className='menu-item';button.innerHTML='<span>項目登録</span><span>›</span>';menuList.prepend(button)}
    let view=document.getElementById('itemRegistration');
    if(!view){view=document.createElement('section');view.id='itemRegistration';view.className='view item-register-view';app.appendChild(view)}
    view.innerHTML=`<div class="design-head"><button id="itemRegisterBack" class="design-back" aria-label="戻る">‹</button><h1 class="design-title">項目登録</h1></div><div class="item-add-card"><input id="itemNameInput" class="item-name-input" maxlength="30" placeholder="カード・支払先名" /><button id="itemAddButton" class="item-add-btn">追加</button></div><div id="itemRegisterList" class="item-register-list"></div><p class="item-note">この順番が「支払い準備」と支出登録画面に反映されます。</p>`;
    document.getElementById('openItemRegistration').onclick=()=>{renderList();showView('itemRegistration')};
    document.getElementById('itemRegisterBack').onclick=()=>showView('menu');
    document.getElementById('itemAddButton').onclick=addItem;
    document.getElementById('itemNameInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addItem()}});
    renderList();
  }

  function init(){injectStyles();syncApp();buildItemRegistration()}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
