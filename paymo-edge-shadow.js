(() => {
  function mountEdgeShadows() {
    if (document.getElementById('paymoScreenEdgeShadowLeft')) return;

    const style = document.createElement('style');
    style.id = 'paymo-screen-edge-shadow-style';
    style.textContent = `
      .paymo-main-edge-shadow{display:none!important}
      .paymo-screen-edge-shadow{
        position:fixed;
        top:0;
        bottom:calc(84px + env(safe-area-inset-bottom));
        width:26px;
        z-index:19;
        pointer-events:none;
      }
      .paymo-screen-edge-shadow.left{
        left:max(0px,calc(50% - 215px));
        background:linear-gradient(90deg,
          color-mix(in srgb,var(--page-fg,#fff) 18%,transparent) 0%,
          color-mix(in srgb,var(--page-fg,#fff) 8%,transparent) 38%,
          transparent 100%);
      }
      .paymo-screen-edge-shadow.right{
        right:max(0px,calc(50% - 215px));
        background:linear-gradient(270deg,
          color-mix(in srgb,var(--page-fg,#fff) 18%,transparent) 0%,
          color-mix(in srgb,var(--page-fg,#fff) 8%,transparent) 38%,
          transparent 100%);
      }
    `;
    document.head.appendChild(style);

    const left = document.createElement('div');
    left.id = 'paymoScreenEdgeShadowLeft';
    left.className = 'paymo-screen-edge-shadow left';

    const right = document.createElement('div');
    right.id = 'paymoScreenEdgeShadowRight';
    right.className = 'paymo-screen-edge-shadow right';

    document.body.append(left, right);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountEdgeShadows, { once:true });
  } else {
    mountEdgeShadows();
  }
})();
