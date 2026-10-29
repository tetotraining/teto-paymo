(() => {
  function injectSelectionStyles() {
    if (document.getElementById('paymo-selection-clarity-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-selection-clarity-style';
    style.textContent = `
      :root{--accent-ink:#fff!important;}
      .split-button,.history-edit-split-button{
        background:var(--surface)!important;
        color:var(--page-fg)!important;
        border-color:var(--theme-line)!important;
        box-shadow:none!important;
        transition:background .16s ease,color .16s ease,border-color .16s ease,box-shadow .16s ease,transform .08s ease;
      }
      .split-button.selected,.history-edit-split-button.selected,
      .payee.selected,.history-edit-payee.selected,
      .save,.history-edit-save{
        background:var(--accent)!important;
        color:#fff!important;
        -webkit-text-fill-color:#fff!important;
        border-color:var(--accent)!important;
      }
      .split-button.selected,.history-edit-split-button.selected{
        box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 38%,transparent)!important;
      }
      .split-button:active,.history-edit-split-button:active,.payee:active,.history-edit-payee:active{
        transform:scale(.98);
      }
      .payee.selected,.history-edit-payee.selected{
        box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 38%,transparent)!important;
      }
      .toggle:checked{
        box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 30%,transparent)!important;
      }
      .installment-date,
      .sheet #installmentDetails input.installment-date.date-input{
        -webkit-appearance:none!important;
        appearance:none!important;
        background:var(--surface)!important;
        background-color:var(--surface)!important;
        color:var(--page-fg)!important;
        -webkit-text-fill-color:var(--page-fg)!important;
        border-color:var(--theme-line)!important;
        box-shadow:inset 0 0 0 1000px var(--surface)!important;
        color-scheme:dark;
      }
      .installment-date::-webkit-date-and-time-value,
      .installment-date::-webkit-datetime-edit,
      .installment-date::-webkit-datetime-edit-fields-wrapper{
        background:transparent!important;
        color:var(--page-fg)!important;
        -webkit-text-fill-color:var(--page-fg)!important;
      }
      html[data-theme="light"] .installment-date,
      html[data-theme="light"] .sheet #installmentDetails input.installment-date.date-input{
        color-scheme:light;
      }
    `;
    document.head.appendChild(style);
  }

  injectSelectionStyles();
})();
