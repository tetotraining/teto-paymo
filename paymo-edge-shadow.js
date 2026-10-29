(() => {
  function removeAllEdgeShadows() {
    const styleId = 'paymo-no-edge-shadow-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .paymo-main-edge-shadow,
        .paymo-screen-edge-shadow{
          display:none!important;
          opacity:0!important;
          background:none!important;
          box-shadow:none!important;
        }
        .upcoming-payment-divider{
          display:none!important;
        }
      `;
      document.head.appendChild(style);
    }

    document.getElementById('paymoScreenEdgeShadowLeft')?.remove();
    document.getElementById('paymoScreenEdgeShadowRight')?.remove();
    document.getElementById('paymo-screen-edge-shadow-style')?.remove();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeAllEdgeShadows, { once:true });
  } else {
    removeAllEdgeShadows();
  }
})();
