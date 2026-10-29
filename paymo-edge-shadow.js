(() => {
  const VIEW_ORDER = ['home', 'graph', 'notify', 'menu'];
  let touch = null;
  let hideTimer = null;

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
        opacity:0;
        transition:opacity 90ms ease;
      }
      .paymo-screen-edge-shadow.visible{opacity:1}
      .paymo-screen-edge-shadow.left{
        left:max(0px,calc(50% - 215px));
        background:linear-gradient(90deg,
          rgba(0,0,0,.30) 0%,
          rgba(0,0,0,.14) 42%,
          rgba(0,0,0,0) 100%);
      }
      .paymo-screen-edge-shadow.right{
        right:max(0px,calc(50% - 215px));
        background:linear-gradient(270deg,
          rgba(0,0,0,.30) 0%,
          rgba(0,0,0,.14) 42%,
          rgba(0,0,0,0) 100%);
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

    const show = () => {
      clearTimeout(hideTimer);
      left.classList.add('visible');
      right.classList.add('visible');
    };

    const hide = (delay = 0) => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        left.classList.remove('visible');
        right.classList.remove('visible');
      }, delay);
    };

    document.addEventListener('click', (event) => {
      const button = event.target?.closest?.('.nav-btn[data-view]');
      if (!button) return;
      const active = document.querySelector('.view.active');
      if (!active || active.id === button.dataset.view) return;
      show();
      hide(300);
    }, true);

    document.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 1) {
        touch = null;
        return;
      }
      const viewport = event.target?.closest?.('#paymoMainViewport');
      const active = document.querySelector('.view.active');
      if (!viewport || !active || !VIEW_ORDER.includes(active.id)) {
        touch = null;
        return;
      }
      if (event.target?.closest?.('input,textarea,select,[contenteditable="true"],[data-no-page-swipe]')) {
        touch = null;
        return;
      }
      const t = event.touches[0];
      touch = { x:t.clientX, y:t.clientY, activeId:active.id, shown:false };
    }, { passive:true });

    document.addEventListener('touchmove', (event) => {
      if (!touch || event.touches.length !== 1) return;
      const t = event.touches[0];
      const dx = t.clientX - touch.x;
      const dy = t.clientY - touch.y;
      if (Math.abs(dx) < 9 || Math.abs(dx) < Math.abs(dy) * 1.15) return;

      const index = VIEW_ORDER.indexOf(touch.activeId);
      const nextIndex = index + (dx < 0 ? 1 : -1);
      if (nextIndex < 0 || nextIndex >= VIEW_ORDER.length) return;

      if (!touch.shown) {
        touch.shown = true;
        show();
      }
    }, { passive:true });

    document.addEventListener('touchend', () => {
      if (touch?.shown) hide(300);
      touch = null;
    }, { passive:true });

    document.addEventListener('touchcancel', () => {
      if (touch?.shown) hide(180);
      touch = null;
    }, { passive:true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountEdgeShadows, { once:true });
  } else {
    mountEdgeShadows();
  }
})();
