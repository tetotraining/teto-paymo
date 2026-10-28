(() => {
  function applyLabels(){
    const date=document.getElementById('date');
    const label=date?.closest('.field')?.querySelector(':scope > span');
    if(label) label.textContent='支払い請求日';
  }
  function fixDateField(){
    if(document.getElementById('paymo-date-field-fix')) return;
    const style=document.createElement('style');
    style.id='paymo-date-field-fix';
    style.textContent=`
      #date.date-input{
        display:block!important;
        width:100%!important;
        min-width:0!important;
        max-width:100%!important;
        height:48px!important;
        margin:0!important;
        padding:0 13px!important;
        box-sizing:border-box!important;
      }
      #date.date-input::-webkit-date-and-time-value{
        min-height:0!important;
        text-align:center!important;
      }
    `;
    document.head.appendChild(style);
  }
  function init(){applyLabels();fixDateField()}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
