(() => {
  const localToday=()=>{
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  function setupDateFields(){
    const billingDate=document.getElementById('date');
    const billingField=billingDate?.closest('.field');
    if(!billingDate||!billingField)return;

    const billingLabel=billingField.querySelector(':scope > span');
    if(billingLabel)billingLabel.textContent='支払い請求日';

    let usageDate=document.getElementById('usageDate');
    if(!usageDate){
      const usageField=document.createElement('div');
      usageField.className='field';
      usageField.innerHTML='<span>ご利用日</span><input id="usageDate" class="date-input" type="date" />';
      billingField.parentNode.insertBefore(usageField,billingField);
      usageDate=document.getElementById('usageDate');
    }

    if(usageDate&&!usageDate.value)usageDate.value=localToday();

    const addBtn=document.getElementById('addBtn');
    if(addBtn&&!addBtn.dataset.usageDateBound){
      addBtn.dataset.usageDateBound='1';
      addBtn.addEventListener('click',()=>{
        requestAnimationFrame(()=>{
          const input=document.getElementById('usageDate');
          if(input)input.value=localToday();
        });
      });
    }
  }

  function fixDateFields(){
    if(document.getElementById('paymo-date-field-fix'))return;
    const style=document.createElement('style');
    style.id='paymo-date-field-fix';
    style.textContent=`
      .field:has(#date),.field:has(#usageDate){
        min-width:0!important;
        max-width:100%!important;
        overflow:hidden!important;
      }
      #date.date-input,#usageDate.date-input{
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
      #date.date-input::-webkit-date-and-time-value,#usageDate.date-input::-webkit-date-and-time-value{
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
      #date.date-input::-webkit-datetime-edit,#usageDate.date-input::-webkit-datetime-edit{
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

  function init(){setupDateFields();fixDateFields()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
