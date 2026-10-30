(() => {
  if (document.getElementById('paymo-graph-detail-size-style')) return;
  const style = document.createElement('style');
  style.id = 'paymo-graph-detail-size-style';
  style.textContent = `
    #paymoGraphDetail .paymo-graph-detail-title{font-size:18px!important}
    #paymoGraphDetail .paymo-graph-detail-month{font-size:20px!important}
    #paymoGraphDetail .paymo-graph-detail-total{font-size:30px!important}
    #paymoGraphDetail .paymo-graph-detail-group-name{font-size:20px!important}
    #paymoGraphDetail .paymo-graph-detail-group-total{font-size:18px!important}
    #paymoGraphDetail .paymo-graph-detail-columns,
    #paymoGraphDetail .paymo-graph-detail-row{
      grid-template-columns:64px 72px minmax(0,1fr)!important;
      column-gap:8px!important;
    }
    #paymoGraphDetail .paymo-graph-detail-columns span:nth-child(2),
    #paymoGraphDetail .paymo-graph-detail-due{text-align:left!important}
    #paymoGraphDetail .paymo-graph-detail-date,
    #paymoGraphDetail .paymo-graph-detail-due{font-size:15px!important}
    #paymoGraphDetail .paymo-graph-detail-amount-cell,
    #paymoGraphDetail .paymo-graph-detail-columns span:last-child{text-align:right!important}
    #paymoGraphDetail .paymo-graph-detail-amount{font-size:17px!important}
    #paymoGraphDetail .paymo-graph-detail-paid{font-size:11px!important}
  `;
  document.head.appendChild(style);
})();
