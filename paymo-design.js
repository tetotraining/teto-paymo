(() => {
  const COLORS={red:'#E63946',orange:'#FF852F',yellow:'#FFD166',pink:'#f0aae3',purple:'#E085FF',green:'#B9F486',lightgreen:'#b9f068',pastelgreen:'#a7e2c8',blue:'#0D43FF',lightBlue:'#4EA8DE'};
  const NAMES={red:'red',orange:'orange',yellow:'yellow',pink:'pink',purple:'purple',green:'green',lightgreen:'lightgreen',pastelgreen:'pastelgreen',blue:'blue',lightBlue:'light Blue'};
  const KEYS=['red','orange','yellow','pink','purple','green','lightgreen','pastelgreen','blue','lightBlue'];
  const ACCENT_KEY='paymo_accent',DARK_KEY='paymo_dark_mode';

  function current(){
    const saved=localStorage.getItem(ACCENT_KEY)||'purple';
    const accent=KEYS.includes(saved)?saved:'purple';
    if(saved!==accent)localStorage.setItem(ACCENT_KEY,accent);
    return{dark:localStorage.getItem(DARK_KEY)!=='0',accent};
  }
  function resolvedAccent(key){return COLORS[key]||COLORS.purple}
  function accentInk(key){return ['red','blue'].includes(key)?'#ffffff':'#071006'}

  function applyDesign(){
    const s=current(),root=document.documentElement;
    root.dataset.theme=s.dark?'dark':'light';
    root.style.setProperty('--page-bg',s.dark?'#000000':'#ffffff');
    root.style.setProperty('--page-fg',s.dark?'#ffffff':'#111111');
    root.style.setProperty('--accent',resolvedAccent(s.accent));
    root.style.setProperty('--accent-ink',accentInk(s.accent));
    root.style.backgroundColor=s.dark?'#000000':'#ffffff';
    document.body.style.backgroundColor=s.dark?'#000000':'#ffffff';
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',s.dark?'#000000':'#ffffff');
  }

  function setupNav(){
    const add=document.getElementById('addBtn');
    if(add&&!add.querySelector('.paymo-add-orb')) add.innerHTML='<span class="paymo-add-orb" aria-hidden="true"></span>';
  }

  function injectStyles(){
    if(document.getElementById('paymo-design-style'))return;
    const style=document.createElement('style');
    style.id='paymo-design-style';
    style.textContent=`
      :root{--page-bg:#000;--page-fg:#fff;--accent:#E085FF;--accent-ink:#071006}
      html,body,.app{background:var(--page-bg)!important}
      .app{padding-bottom:calc(120px + env(safe-area-inset-bottom))!important}
      .page-title{color:var(--page-fg)!important}

      .bottom-nav{height:calc(92px + env(safe-area-inset-bottom))!important;padding:0 0 env(safe-area-inset-bottom)!important;display:flex!important;justify-content:space-around!important;align-items:stretch!important;grid-template-columns:none!important}
      .nav-btn,.add-btn{width:20%!important;height:auto!important;margin:0!important;border:0!important;background:none!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:4px!important}
      .nav-btn{color:#9ca198!important}
      .nav-btn svg{width:26px!important;height:26px!important;fill:currentColor!important;flex:0 0 26px}
      .nav-btn::after{content:"";display:block;width:1px;height:12px;flex:0 0 12px}
      .nav-btn.active{color:var(--accent)!important}

      .add-btn{position:relative!important;top:auto!important;border-radius:0!important;box-shadow:none!important;overflow:visible!important;color:var(--accent)!important}
      .add-btn::before,.add-btn::after{content:none!important}
      .paymo-add-orb{position:absolute;z-index:2;left:50%;top:50%;display:grid;place-items:center;width:92px;height:92px;border-radius:50%;background:var(--accent);transform:translate(-50%,-50%) translateY(-29px);box-shadow:0 6px 18px rgba(0,0,0,.22)}
      .paymo-add-orb::before,.paymo-add-orb::after{content:"";position:absolute;left:50%;top:50%;border-radius:999px;background:#fff;transform:translate(-50%,-50%)}
      .paymo-add-orb::before{width:46px;height:4px}
      .paymo-add-orb::after{width:4px;height:46px}

      .save,.payee.selected{background:var(--accent)!important;color:var(--accent-ink)!important}
      .menu-list{display:grid;gap:10px}
      .menu-item{width:100%;border:0;background:#f4f4f2;color:#111;border-radius:20px;padding:18px 20px;display:flex;align-items:center;justify-content:space-between;font-weight:800;font-size:16px;text-align:left}
      .menu-item span:last-child{font-size:24px;line-height:1;color:#888}
      .design-view{padding-bottom:16px}
      .design-head{display:flex;align-items:center;gap:10px;margin-bottom:18px}
      .design-back{width:38px;height:38px;border:0;border-radius:50%;background:#f4f4f2;color:#111;font-size:26px;line-height:1;display:grid;place-items:center}
      .design-title{margin:0;color:var(--page-fg);font-size:30px;font-weight:900;letter-spacing:-1px}
      .settings-label{display:block;color:var(--page-fg);font-size:13px;font-weight:800;margin:18px 4px 8px}
      .design-card{background:#f4f4f2;color:#111;border-radius:22px;padding:18px 20px}
      .design-card-row{display:flex;align-items:center;justify-content:space-between;gap:18px;font-weight:800}
      .toggle{appearance:none;width:50px;height:30px;background:#d1d1d1;border-radius:999px;position:relative;transition:.18s;border:0;flex:none}
      .toggle:before{content:"";position:absolute;width:24px;height:24px;left:3px;top:3px;border-radius:50%;background:#fff;box-shadow:0 1px 4px #0002;transition:.18s}
      .toggle:checked{background:var(--accent)}
      .toggle:checked:before{transform:translateX(20px)}
      .color-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px 8px;background:#f4f4f2;border-radius:22px;padding:18px 10px}
      .color-option{display:grid;place-items:center;gap:7px;cursor:pointer;color:#111;font-size:11px;text-align:center}
      .color-option input{position:absolute;opacity:0;pointer-events:none}
      .color-dot{width:38px;height:38px;border-radius:50%;background:var(--swatch);display:block;border:3px solid transparent;box-shadow:0 0 0 1px #0001}
      .color-option input:checked+.color-dot{border-color:#111;box-shadow:0 0 0 3px #fff,0 0 0 5px #111}
      .color-option small{font-size:9px;font-weight:700;white-space:nowrap}
    `;
    document.head.appendChild(style);
  }

  function designControls(){
    const s=current();
    return `<span class="settings-label">ベースカラー</span><section class="design-card"><div class="design-card-row"><strong>ダークモード</strong><input id="paymoDarkModeToggle" class="toggle" type="checkbox" ${s.dark?'checked':''}></div></section><span class="settings-label">サブカラー</span><div class="color-grid">${KEYS.map(k=>`<label class="color-option"><input type="radio" name="paymoAccent" value="${k}" ${s.accent===k?'checked':''}><span class="color-dot" style="--swatch:${COLORS[k]}"></span><small>${NAMES[k]}</small></label>`).join('')}</div>`;
  }

  function bindDesign(){
    const dark=document.getElementById('paymoDarkModeToggle');
    if(dark)dark.onchange=()=>{localStorage.setItem(DARK_KEY,dark.checked?'1':'0');applyDesign()};
    document.querySelectorAll('input[name="paymoAccent"]').forEach(r=>r.onchange=()=>{if(!r.checked)return;localStorage.setItem(ACCENT_KEY,r.value);applyDesign()});
  }

  function showView(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.getElementById(id)?.classList.add('active')}

  function buildMenu(){
    const menu=document.getElementById('menu'),app=document.querySelector('.app');if(!menu||!app)return;
    menu.innerHTML=`<h1 class="page-title">MENU</h1><div class="menu-list"><button id="openDesignSettings" class="menu-item"><span>デザイン設定</span><span>›</span></button></div>`;
    let design=document.getElementById('design');
    if(!design){design=document.createElement('section');design.id='design';design.className='view design-view';app.appendChild(design)}
    design.innerHTML=`<div class="design-head"><button id="designBack" class="design-back" aria-label="戻る">‹</button><h1 class="design-title">デザイン設定</h1></div>${designControls()}`;
    document.getElementById('openDesignSettings').onclick=()=>{showView('design');bindDesign()};
    document.getElementById('designBack').onclick=()=>showView('menu');
    bindDesign();
  }

  function init(){injectStyles();setupNav();applyDesign();buildMenu()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
