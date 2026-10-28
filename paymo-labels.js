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
      .field:has(#date){
        min-width:0!important;
        max-width:100%!important;
        overflow:hidden!important;
      }
      #date.date-input{
        -webkit-appearance:none!important;
        appearance:none!important;
        display:block!important;
        inline-size:100%!important;
        width:100%!important;
        min-inline-size:0!important;
        min-width:0!important;
        max-inline-size:100%!important;
        max-width:100%!important;
        block-size:48px!important;
        height:48px!important;
        margin:0!important;
        padding:0 13px!important;
        border:1px solid #d7d7d4!important;
        border-radius:15px!important;
        box-sizing:border-box!important;
        overflow:hidden!important;
      }
      #date.date-input::-webkit-date-and-time-value{
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        width:100%!important;
        height:100%!important;
        min-height:100%!important;
        margin:0!important;
        padding:0!important;
        line-height:1!important;
        text-align:center!important;
      }
      #date.date-input::-webkit-datetime-edit{
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        width:100%!important;
        height:100%!important;
        margin:0!important;
        padding:0!important;
      }
    `;
    document.head.appendChild(style);
  }
  function init(){applyLabels();fixDateField()}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
