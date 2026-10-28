(() => {
  const STORAGE_KEY='paymo_payees_v1';
  const COLORS=['#E63946','#FF852F','#FFD166','#0D43FF','#4EA8DE','#E085FF','#B9F486','#5B5CE2','#00A67A','#999999'];
  let selectedColor=COLORS[0];
  let editIndex=null;
  let editSelectedColor=COLORS[0];

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
      .item-add-card,.item-edit-card{background:#f4f4f2;border-radius:20px;padding:12px;display:grid;gap:11px}
      .item-edit-card{margin-top:12px}
      .item-edit-title{font-size:14px;font-weight:900;color:#111;padding:2px 2px 0}
      .item-add-row,.item-edit-actions{display:flex;gap:8px}
      .item-name-input{min-width:0;flex:1;border:1px solid #d7d7d4;background:#fff;border-radius:14px;padding:13px 14px;outline:none;color:#111}
      .item-add-btn,.item-save-edit{border:0;border-radius:14px;background:var(--accent);color:var(--accent-ink);font-weight:900;padding:0 18px}
      .item-edit-actions button{flex:1;padding:12px;border:0;border-radius:14px;font-weight:900}
      .item-cancel-edit{background:#fff;color:#555}
      .item-save-edit{padding:12px}
      .item-color-label{font-size:12px;font-weight:800;color:#555;margin-left:2px}
      .item-color-picker{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
      .item-color-btn{appearance:none;border:0;background:transparent;padding:3px;display:grid;place-items:center}
      .item-color-dot{width:34px;height:34px;border-radius:50%;background:var(--item-color);border:3px solid transparent;box-shadow:0 0 0 1px #0001}
      .item-color-btn.selected .item-color-dot{border-color:#111;box-shadow:0 0 0 3px #fff,0 0 0 5px #111}
      .item-register-list{display:grid;gap:8px;margin-top:12px}
      .item-register-row{background:#f4f4f2;color:#111;border-radius:18px;padding:11px 12px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:9px}
      .item-register-dot{width:11px;height:11px;border-radius:50%}
      .item-register-name{font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .item-actions{display:flex;align-items:center;gap:4px}
      .item-action{width:32px;height:34px;border:0;border-radius:10px;background:#fff;color:#111;font-size:16px;font-weight:900;display:grid;place-items:center;padding:0}
      .item-action:disabled{opacity:.28}
      .item-edit svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
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

  function colorButtons(selected,target){
    return COLORS.map((color,i)=>`<button type="button" class="item-color-btn ${color===selected?'selected':''}" data-${target}-color="${color}" aria-label="カラー${i+1}"><span class="item-color-dot" style="--item-color:${color}"></span></button>`).join('');
  }

  function renderColorPicker(){
    const host=document.getElementById('itemColorPicker');
    if(!host) return;
    host.innerHTML=colorButtons(selectedColor,'add');
    host.querySelectorAll('[data-add-color]').forEach(btn=>btn.onclick=()=>{selectedColor=btn.dataset.addColor;renderColorPicker()});
  }

  function renderEditColorPicker(){
    const host=document.getElementById('itemEditColorPicker');
    if(!host) return;
    host.innerHTML=colorButtons(editSelectedColor,'edit');
    host.querySelectorAll('[data-edit-color]').forEach(btn=>btn.onclick=()=>{editSelectedColor=btn.dataset.editColor;renderEditColorPicker()});
  }

  function closeEdit(){
    editIndex=null;
    const panel=document.getElementById('itemEditPanel');
    if(panel) panel.hidden=true;
  }

  function openEdit(index){
    const items=loadItems();
    const item=items[index];
    if(!item) return;
    editIndex=index;
    editSelectedColor=item.color||COLORS[0];
    const panel=document.getElementById('itemEditPanel');
    const input=document.getElementById('itemEditNameInput');
    if(!panel||!input) return;
    panel.hidden=false;
    input.value=item.name;
    renderEditColorPicker();
    input.focus();
    input.select();
    panel.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function renderList(){
    const host=document.getElementById('itemRegisterList');
    if(!host) return;
    const items=loadItems();
    if(items.length===0){host.innerHTML='<div class="item-empty">項目はまだ登録されていません</div>';closeEdit();return}
    host.innerHTML=items.map((item,i)=>`<div class="item-register-row" data-index="${i}"><span class="item-register-dot" style="background:${item.color}"></span><span class="item-register-name">${escapeHtml(item.name)}</span><span class="item-actions"><button class="item-action" data-move="up" ${i===0?'disabled':''} aria-label="上へ">↑</button><button class="item-action" data-move="down" ${i===items.length-1?'disabled':''} aria-label="下へ">↓</button><button class="item-action item-edit" data-edit="1" aria-label="編集"><svg viewBox="0 0 24 24"><path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg></button><button class="item-action item-delete" data-delete="1" aria-label="削除">×</button></span></div>`).join('');
    host.querySelectorAll('.item-register-row').forEach(row=>{
      const index=Number(row.dataset.index);
      row.querySelector('[data-move="up"]')?.addEventListener('click',()=>moveItem(index,-1));
      row.querySelector('[data-move="down"]')?.addEventListener('click',()=>moveItem(index,1));
      row.querySelector('[data-edit]')?.addEventListener('click',()=>openEdit(index));
      row.querySelector('[data-delete]')?.addEventListener('click',()=>deleteItem(index));
    });
  }

  function moveItem(index,delta){
    const items=loadItems(),target=index+delta;
    if(target<0||target>=items.length) return;
    [items[index],items[target]]=[items[target],items[index]];
    saveItems(items);closeEdit();renderList();syncApp(items);
  }

  function deleteItem(index){
    const items=loadItems();
    if(index<0||index>=items.length) return;
    items.splice(index,1);
    saveItems(items);closeEdit();renderList();syncApp(items);
  }

  function addItem(){
    const input=document.getElementById('itemNameInput');
    if(!input) return;
    const name=input.value.trim().slice(0,30);
    if(!name){input.focus();return}
    const items=loadItems();
    if(items.some(x=>x.name===name)){input.select();return}
    items.push({name,color:selectedColor});
    saveItems(items);input.value='';renderList();syncApp(items);input.focus();
  }

  function saveEdit(){
    if(editIndex===null) return;
    const items=loadItems();
    const currentItem=items[editIndex];
    const input=document.getElementById('itemEditNameInput');
    if(!currentItem||!input){closeEdit();return}
    const newName=input.value.trim().slice(0,30);
    if(!newName){input.focus();return}
    if(items.some((x,i)=>i!==editIndex&&x.name===newName)){input.select();return}

    const oldName=currentItem.name;
    currentItem.name=newName;
    currentItem.color=editSelectedColor;
    saveItems(items);

    if(oldName!==newName){
      try{
        const changed=[];
        expenses.forEach(expense=>{
          if(expense.payee===oldName){expense.payee=newName;changed.push(expense)}
        });
        localStorage.setItem(KEY,JSON.stringify(expenses));
        if(selectedPayee===oldName) selectedPayee=newName;
        if(changed.length&&typeof window.paymoSyncExpenses==='function') window.paymoSyncExpenses(changed).catch(()=>{});
      }catch{}
    }

    closeEdit();renderList();syncApp(items);
  }

  function buildItemRegistration(){
    const menuList=document.querySelector('#menu .menu-list'),app=document.querySelector('.app');
    if(!menuList||!app) return;
    if(!document.getElementById('openItemRegistration')){const button=document.createElement('button');button.id='openItemRegistration';button.className='menu-item';button.innerHTML='<span>項目登録</span><span>›</span>';menuList.prepend(button)}
    let view=document.getElementById('itemRegistration');
    if(!view){view=document.createElement('section');view.id='itemRegistration';view.className='view item-register-view';app.appendChild(view)}
    view.innerHTML=`<div class="design-head"><button id="itemRegisterBack" class="design-back" aria-label="戻る">‹</button><h1 class="design-title">項目登録</h1></div><div class="item-add-card"><div class="item-add-row"><input id="itemNameInput" class="item-name-input" maxlength="30" placeholder="カード・支払先名" /><button id="itemAddButton" class="item-add-btn">追加</button></div><div class="item-color-label">カラー</div><div id="itemColorPicker" class="item-color-picker"></div></div><div id="itemEditPanel" class="item-edit-card" hidden><div class="item-edit-title">項目を編集</div><input id="itemEditNameInput" class="item-name-input" maxlength="30" placeholder="カード・支払先名" /><div class="item-color-label">カラー</div><div id="itemEditColorPicker" class="item-color-picker"></div><div class="item-edit-actions"><button id="itemEditCancel" class="item-cancel-edit">キャンセル</button><button id="itemEditSave" class="item-save-edit">保存</button></div></div><div id="itemRegisterList" class="item-register-list"></div><p class="item-note">この順番が「支払い準備」と支出登録画面に反映されます。</p>`;
    document.getElementById('openItemRegistration').onclick=()=>{closeEdit();renderList();renderColorPicker();showView('itemRegistration')};
    document.getElementById('itemRegisterBack').onclick=()=>{closeEdit();showView('menu')};
    document.getElementById('itemAddButton').onclick=addItem;
    document.getElementById('itemNameInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addItem()}});
    document.getElementById('itemEditCancel').onclick=closeEdit;
    document.getElementById('itemEditSave').onclick=saveEdit;
    document.getElementById('itemEditNameInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveEdit()}});
    renderColorPicker();renderList();
  }

  function init(){injectStyles();syncApp();buildItemRegistration()}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
