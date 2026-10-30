(() => {
  if (document.getElementById('paymo-subpages-style')) return;

  const style = document.createElement('style');
  style.id = 'paymo-subpages-style';
  style.textContent = `
    #design.design-view,
    #itemRegistration.item-register-view{
      position:fixed!important;
      inset:0!important;
      width:min(100%,430px)!important;
      height:100dvh!important;
      margin:0 auto!important;
      padding:calc(env(safe-area-inset-top) + 18px) 16px calc(28px + env(safe-area-inset-bottom))!important;
      box-sizing:border-box!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      -webkit-overflow-scrolling:touch;
      overscroll-behavior:contain;
      scrollbar-width:none;
      background:var(--page-bg,#000)!important;
      color:var(--page-fg,#fff)!important;
      z-index:45!important;
      display:block!important;
      visibility:hidden;
      pointer-events:none;
      transform:translate3d(100%,0,0);
      transition:transform 260ms cubic-bezier(.22,.72,.24,1),visibility 0s linear 260ms;
      will-change:transform;
    }
    #design.design-view::-webkit-scrollbar,
    #itemRegistration.item-register-view::-webkit-scrollbar{display:none;width:0;height:0}
    #design.design-view.active,
    #itemRegistration.item-register-view.active{
      visibility:visible;
      pointer-events:auto;
      transform:translate3d(0,0,0);
      transition:transform 260ms cubic-bezier(.22,.72,.24,1),visibility 0s;
    }
    body:has(#design.active),
    body:has(#itemRegistration.active){overflow:hidden!important}
    body:has(#design.active) .bottom-nav,
    body:has(#itemRegistration.active) .bottom-nav{
      visibility:hidden!important;
      pointer-events:none!important;
    }
  `;
  document.head.appendChild(style);
})();
