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
    .installment-grid{
      width:100%!important;
      min-width:0!important;
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
      gap:10px!important;
    }
    .installment-grid.three{
      grid-template-columns:repeat(3,minmax(0,1fr))!important;
      gap:8px!important;
    }
    .installment-subfield{
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
      overflow:hidden!important;
    }
    .installment-grid.three .installment-subfield>span{
      font-size:11px!important;
      letter-spacing:-.25px!important;
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
      box-sizing:border-box!important;
      overflow:hidden!important;
      contain:layout paint!important;
      margin:0!important;
    }
    .installment-grid.three .installment-date{
      height:48px!important;
      padding:0 3px!important;
      border-radius:14px!important;
      font-size:14px!important;
      letter-spacing:-.45px!important;
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
      box-sizing:border-box!important;
      overflow:hidden!important;
    }
    .installment-grid.three .installment-amount{
      padding:8px 6px!important;
      border-radius:14px!important;
    }
    .installment-grid.three .installment-amount b{
      flex:0 0 auto!important;
      margin-right:2px!important;
      font-size:17px!important;
    }
    .installment-grid.three .installment-amount input{
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
      font-size:20px!important;
      padding:0!important;
      text-align:center!important;
    }
  `;
  document.head.appendChild(style);
})();
