(() => {
  function applyLabels(){
    const date=document.getElementById('date');
    const label=date?.closest('.field')?.querySelector(':scope > span');
    if(label) label.textContent='支払い請求日';
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',applyLabels,{once:true});
  else applyLabels();
})();
