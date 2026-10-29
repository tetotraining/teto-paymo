(() => {
  if (document.getElementById('paymo-installments-layout-fix')) return;
  const style = document.createElement('style');
  style.id = 'paymo-installments-layout-fix';
  style.textContent = `
    .installment-details{
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
      overflow:hidden!important;
    }
    .installment-grid,
    .installment-grid.three{
      width:100%!important;
      min-width:0!important;
      grid-template-columns:1fr!important;
      gap:12px!important;
    }
    .installment-subfield{
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
      overflow:hidden!important;
    }
    .installment-subfield>span{
      font-size:12px!important;
      letter-spacing:0!important;
    }
    .installment-date{
      -webkit-appearance:none!important;
      appearance:none!important;
      display:block!important;
      inline-size:100%!important;
      width:100%!important;
      min-inline-size:0!important;
      min-width:0!important;
      max-inline-size:100%!important;
      max-width:100%!important;
      height:48px!important;
      padding:0 8px!important;
      border-radius:15px!important;
      font-size:16px!important;
      letter-spacing:0!important;
      box-sizing:border-box!important;
      overflow:hidden!important;
      contain:layout paint!important;
      margin:0!important;
    }
    .installment-date::-webkit-date-and-time-value,
    .installment-date::-webkit-datetime-edit{
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
      margin:0!important;
      padding:0!important;
      overflow:hidden!important;
    }
    .installment-amount{
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
      padding:8px 10px!important;
      border-radius:15px!important;
      box-sizing:border-box!important;
      overflow:hidden!important;
    }
    .installment-amount b{
      flex:0 0 auto!important;
      margin-right:4px!important;
      font-size:18px!important;
    }
    .installment-amount input{
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
      font-size:23px!important;
      padding:0!important;
      text-align:center!important;
    }
  `;
  document.head.appendChild(style);
})();
