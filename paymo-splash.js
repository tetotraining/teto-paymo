(() => {
  if (document.getElementById('paymo-launch-style')) return;

  const root = document.documentElement;
  root.classList.add('paymo-launching');

  const style = document.createElement('style');
  style.id = 'paymo-launch-style';
  style.textContent = `
    html.paymo-launching::before{
      content:"";
      position:fixed;
      inset:0;
      width:100vw;
      height:100dvh;
      background:#000;
      z-index:99998;
      pointer-events:none;
    }
    #paymo-launch-splash{
      position:fixed;
      z-index:99999;
      inset:0;
      width:100vw;
      height:100dvh;
      background:#000;
      opacity:1;
      pointer-events:none;
    }
    #paymo-launch-splash img{
      position:absolute;
      display:block;
      width:min(30vw,150px);
      height:auto;
      left:50%;
      top:50%;
      transform:translate(-50%,-50%);
      opacity:0;
      transition:opacity 1s ease;
    }
    #paymo-launch-splash img.fade-in{opacity:1}
    #paymo-launch-splash img.fade-away{opacity:0}
  `;
  document.head.appendChild(style);

  const preload = document.createElement('link');
  preload.rel = 'preload';
  preload.as = 'image';
  preload.href = '/paymo-icon-192-v2.png';
  document.head.appendChild(preload);

  function mount() {
    if (document.getElementById('paymo-launch-splash')) return;

    const splash = document.createElement('div');
    splash.id = 'paymo-launch-splash';
    splash.innerHTML = '<img id="paymo-launch-splash-img" src="/paymo-icon-192-v2.png" alt="" width="150" height="150">';
    document.body.appendChild(splash);

    const img = document.getElementById('paymo-launch-splash-img');
    let started = false;

    const start = () => {
      if (started) return;
      started = true;
      setTimeout(() => img?.classList.add('fade-in'), 1000);
      setTimeout(() => {
        img?.classList.remove('fade-in');
        img?.classList.add('fade-away');
      }, 4000);
      setTimeout(() => {
        splash.remove();
        root.classList.remove('paymo-launching');
      }, 5000);
    };

    if (img?.complete) start();
    else {
      img?.addEventListener('load', start, { once:true });
      img?.addEventListener('error', start, { once:true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once:true });
  else mount();
})();
