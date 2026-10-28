(() => {
  const STORAGE_KEY='paymo_payees_v1';
  let editOriginalName=null;

  const normalize=color=>String(color||'').toUpperCase();
  function loadItems(){
    try{
      const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
      return Array.isArray(value)?value:[];
    }catch{return[]}
  }
  function usedColors(excludeName=null){
    return new Set(loadItems().filter(item=>!excludeName||item.name!==excludeName).map(item=>normalize(item.color)));
  }
  function injectStyle(){
    if(document.getElementById('paymo-unique-colors-style')) return;
    const style=document.createElement('style');
    style.id='paymo-unique-colors-style';
    style.textContent=`
      .item-color-btn:disabled{opacity:.18;filter:grayscale(.35);pointer-events:none}
      .item-color-btn:disabled .item-color-dot{box-shadow:0 0 0 1px #00000012!important;border-color:transparent!important}
      .item-color-status{font-size:11px;color:#777;line-height:1.4;margin:0 2px}
      .item-color-status.full{color:#c62828;font-weight:800}
    `;
    document.head.appendChild(style);
  }
  function ensureStatus(id,host){
    if(!host) return null;
    let el=document.getElementById(id);
    if(!el){
      el=document.createElement('div');
      el.id=id;
      el.className='item-color-status';
      host.insertAdjacentElement('afterend',el);
    }
    return el;
  }
  function selectedColor(selector,dataKey){
    const selected=document.querySelector(`${selector}.selected`);
    return normalize(selected?.dataset?.[dataKey]);
  }
  function chooseFirstAvailable(buttons){
    const first=[...buttons].find(btn=>!btn.disabled);
    if(first) first.click();
    return first;
  }
  function refreshAdd(){
    const picker=document.getElementById('itemColorPicker');
    if(!picker) return;
    const used=usedColors();
    const buttons=picker.querySelectorAll('[data-add-color]');
    buttons.forEach(btn=>{btn.disabled=used.has(normalize(btn.dataset.addColor))});
    const selected=picker.querySelector('.item-color-btn.selected');
    if(selected?.disabled) chooseFirstAvailable(buttons);
    const available=[...buttons].filter(btn=>!btn.disabled).length;
    const add=document.getElementById('itemAddButton');
    if(add) add.disabled=available===0;
    const status=ensureStatus('itemAddColorStatus',picker);
    if(status){
      status.textContent=available===0?'10色すべて使用中です。新しい項目を追加するには、既存項目を削除してください。':'使用中の色は選択できません';
      status.classList.toggle('full',available===0);
    }
  }
  function refreshEdit(){
    const panel=document.getElementById('itemEditPanel');
    const picker=document.getElementById('itemEditColorPicker');
    const input=document.getElementById('itemEditNameInput');
    if(!panel||panel.hidden||!picker||!input){
      editOriginalName=null;
      return;
    }
    if(editOriginalName===null) editOriginalName=input.value;
    const used=usedColors(editOriginalName);
    const buttons=picker.querySelectorAll('[data-edit-color]');
    buttons.forEach(btn=>{btn.disabled=used.has(normalize(btn.dataset.editColor))});
    const selected=picker.querySelector('.item-color-btn.selected');
    if(selected?.disabled) chooseFirstAvailable(buttons);
    const available=[...buttons].filter(btn=>!btn.disabled).length;
    const save=document.getElementById('itemEditSave');
    if(save) save.disabled=available===0;
    const status=ensureStatus('itemEditColorStatus',picker);
    if(status){
      status.textContent='他の項目で使用中の色は選択できません';
      status.classList.remove('full');
    }
  }
  function refresh(){
    injectStyle();
    refreshAdd();
    refreshEdit();
  }
  function addSelectionIsValid(){
    const color=selectedColor('#itemColorPicker [data-add-color]','addColor');
    return color&&!usedColors().has(color);
  }
  function editSelectionIsValid(){
    if(editOriginalName===null){
      const panel=document.getElementById('itemEditPanel');
      const input=document.getElementById('itemEditNameInput');
      if(panel&&!panel.hidden&&input) editOriginalName=input.value;
    }
    const color=selectedColor('#itemEditColorPicker [data-edit-color]','editColor');
    return color&&!usedColors(editOriginalName).has(color);
  }
  document.addEventListener('click',event=>{
    const add=event.target.closest?.('#itemAddButton');
    if(add&&!addSelectionIsValid()){
      event.preventDefault();
      event.stopImmediatePropagation();
      refreshAdd();
      return;
    }
    const save=event.target.closest?.('#itemEditSave');
    if(save&&!editSelectionIsValid()){
      event.preventDefault();
      event.stopImmediatePropagation();
      refreshEdit();
    }
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key!=='Enter') return;
    if(event.target?.id==='itemNameInput'&&!addSelectionIsValid()){
      event.preventDefault();event.stopImmediatePropagation();refreshAdd();
    }
    if(event.target?.id==='itemEditNameInput'&&!editSelectionIsValid()){
      event.preventDefault();event.stopImmediatePropagation();refreshEdit();
    }
  },true);
  const observer=new MutationObserver(refresh);
  function init(){
    refresh();
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
