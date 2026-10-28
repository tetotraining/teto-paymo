(() => {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute(
      'content',
      'width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover'
    );
  }

  if (!document.getElementById('paymo-mobile-ui-style')) {
    const style = document.createElement('style');
    style.id = 'paymo-mobile-ui-style';
    style.textContent = `
      html,body,.sheet,.history-edit-sheet{
        scrollbar-width:none!important;
        -ms-overflow-style:none!important;
      }
      html::-webkit-scrollbar,
      body::-webkit-scrollbar,
      .sheet::-webkit-scrollbar,
      .history-edit-sheet::-webkit-scrollbar{
        display:none!important;
        width:0!important;
        height:0!important;
      }
      html,body{
        touch-action:pan-x pan-y;
        overscroll-behavior-x:none;
      }
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (event) => event.preventDefault(), { passive: false });
  document.addEventListener('gestureend', (event) => event.preventDefault(), { passive: false });
  document.addEventListener('dblclick', (event) => event.preventDefault(), { passive: false });
})();
