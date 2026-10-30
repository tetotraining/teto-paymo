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
    const theme=s.dark
      ?{base:'#050605',surface:'#101310',text:'#f5f5f3',muted:'#9ca198',line:'#293029'}
      :{base:'#f5f5f3',surface:'#ffffff',text:'#0b0d0b',muted:'#666b65',line:'#d9ddd8'};
    root.dataset.theme=s.dark?'dark':'light';
    root.style.setProperty('--page-bg',theme.base);
    root.style.setProperty('--page-fg',theme.text);
    root.style.setProperty('--surface',theme.surface);
    root.style.setProperty('--theme-muted',theme.muted);
    root.style.setProperty('--theme-line',theme.line);
    root.style.setProperty('--bg',theme.base);
    root.style.setProperty('--card',theme.surface);
    root.style.setProperty('--text',theme.text);
    root.style.setProperty('--muted',theme.muted);
    root.style.setProperty('--line',theme.line);
    root.style.setProperty('--nav',theme.surface);
    root.style.setProperty('--accent',resolvedAccent(s.accent));
    root.style.setProperty('--accent-ink',accentInk(s.accent));
    root.style.backgroundColor=theme.base;
    document.body.style.backgroundColor=theme.base;
    let meta=document.querySelector('meta[name="theme-color"]');
    if(!meta){
      meta=document.createElement('meta');
      meta.name='theme-color';
      document.head.appendChild(meta);
    }
    if(meta)meta.setAttribute('content',theme.base);
    let statusBar=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if(!statusBar){
      statusBar=document.createElement('meta');
      statusBar.name='apple-mobile-web-app-status-bar-style';
      document.head.appendChild(statusBar);
    }
    statusBar.setAttribute('content',s.dark?'black':'default');
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
      :root{--page-bg:#050605;--page-fg:#f5f5f3;--surface:#101310;--theme-muted:#9ca198;--theme-line:#293029;--accent:#E085FF;--accent-ink:#071006}
      html,body,.app{background:var(--page-bg)!important;color:var(--page-fg)!important}
      .app{padding-bottom:calc(120px + env(safe-area-inset-bottom))!important}
      .page-title,.design-title,.settings-label{color:var(--page-fg)!important}
      .card{background:var(--surface)!important;color:var(--page-fg)!important}
      .row,.upcoming-payment-row{border-color:var(--theme-line)!important}
      .chart-head span,.bar-label,.empty,.placeholder,.small,.upcoming-payments-title,.upcoming-payment-date{color:var(--theme-muted)!important}
      .bar,#homeChart .stack-bar.zero{background:var(--page-fg)!important}

      .bottom-nav{height:calc(92px + env(safe-area-inset-bottom))!important;padding:0 0 env(safe-area-inset-bottom)!important;display:flex!important;justify-content:space-around!important;align-items:stretch!important;grid-template-columns:none!important;background:var(--surface)!important;border-top-color:var(--theme-line)!important}
      .nav-btn,.add-btn{width:20%!important;height:auto!important;margin:0!important;border:0!important;background:none!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:4px!important}
      .nav-btn{color:var(--theme-muted)!important}
      .nav-btn svg{width:45px!important;height:45px!important;fill:currentColor!important;flex:0 0 45px}
      .nav-btn::after{content:"";display:block;width:1px;height:12px;flex:0 0 12px}
      .nav-btn.active{color:var(--accent)!important}

      .add-btn{position:relative!important;top:auto!important;border-radius:0!important;box-shadow:none!important;overflow:visible!important;color:var(--accent)!important}
      .add-btn::before,.add-btn::after{content:none!important}
      .paymo-add-orb{position:absolute;z-index:2;left:50%;top:50%;display:grid;place-items:center;width:92px;height:92px;border-radius:50%;background:var(--accent);transform:translate(-50%,-50%) translateY(-29px);box-shadow:0 6px 18px rgba(0,0,0,.22)}
      .paymo-add-orb::before,.paymo-add-orb::after{content:"";position:absolute;left:50%;top:50%;border-radius:999px;background:#fff;transform:translate(-50%,-50%)}
      .paymo-add-orb::before{width:46px;height:4px}
      .paymo-add-orb::after{width:4px;height:46px}

      .sheet,.history-edit-sheet{background:var(--surface)!important;color:var(--page-fg)!important}
      .sheet .grab,.history-edit-sheet .grab{background:var(--theme-muted)!important}
      .close,.design-back{background:var(--page-bg)!important;color:var(--page-fg)!important}
      .amount,.date-input,.payee,.history-edit-input,.history-edit-split-button,.history-edit-payee,.payee-empty{background:var(--surface)!important;color:var(--page-fg)!important;border-color:var(--theme-line)!important}
      .amount input,.date-input,.history-edit-input{color:var(--page-fg)!important}
      .date-input{color-scheme:dark}
      html[data-theme="light"] .date-input,html[data-theme="light"] .history-edit-input[type="date"]{color-scheme:light}
      .save,.payee.selected,.history-edit-split-button.selected,.history-edit-payee.selected,.history-edit-save{background:var(--accent)!important;color:var(--accent-ink)!important;border-color:var(--accent)!important}
      .history-edit-delete{background:color-mix(in srgb,#E63946 12%,var(--surface))!important;color:#E63946!important}
      .toast{background:var(--surface)!important;color:var(--page-fg)!important;border:1px solid var(--theme-line)!important}

      .menu-list{display:grid;gap:10px}
      .menu-item{width:100%;border:0;background:var(--surface)!important;color:var(--page-fg)!important;border-radius:20px;padding:18px 20px;display:flex;align-items:center;justify-content:space-between;font-weight:800;font-size:16px;text-align:left}
      .menu-item span:last-child{font-size:24px;line-height:1;color:var(--theme-muted)!important}
      .design-view{padding-bottom:16px}
      .design-head{display:flex;align-items:center;gap:10px;margin-bottom:18px}
      .design-back{width:38px;height:38px;border:0;border-radius:50%;font-size:26px;line-height:1;display:grid;place-items:center}
      .design-title{margin:0;font-size:30px;font-weight:900;letter-spacing:-1px}
      .settings-label{display:block;font-size:13px;font-weight:800;margin:18px 4px 8px}
      .design-card{background:var(--surface)!important;color:var(--page-fg)!important;border-radius:22px;padding:18px 20px}
      .design-card-row{display:flex;align-items:center;justify-content:space-between;gap:18px;font-weight:800}
      .toggle{appearance:none;width:50px;height:30px;background:#39393d;border-radius:999px;position:relative;transition:.18s;border:0;flex:none}
      html[data-theme="light"] .toggle{background:#d1d1d6}
      .toggle:before{content:"";position:absolute;width:24px;height:24px;left:3px;top:3px;border-radius:50%;background:#fff;box-shadow:0 1px 4px #0002;transition:.18s}
      .toggle:checked{background:var(--accent)}
      .toggle:checked:before{transform:translateX(20px)}
      .color-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px 8px;background:var(--surface)!important;border-radius:22px;padding:18px 10px}
      .color-option{display:grid;place-items:center;gap:7px;cursor:pointer;color:var(--page-fg)!important;font-size:11px;text-align:center}
      .color-option input{position:absolute;opacity:0;pointer-events:none}
      .color-dot{width:38px;height:38px;border-radius:50%;background:var(--swatch);display:block;border:3px solid transparent;box-shadow:0 0 0 1px var(--theme-line)}
      .color-option input:checked+.color-dot{border-color:var(--surface);box-shadow:0 0 0 3px var(--accent)}
      .color-option small{font-size:9px;font-weight:700;white-space:nowrap;color:var(--theme-muted)}
      .color-option input:checked~small{color:var(--page-fg)!important}

      .item-add-card,.item-edit-card,.item-register-row,.item-empty{background:var(--surface)!important;color:var(--page-fg)!important}
      .item-edit-title,.item-register-name{color:var(--page-fg)!important}
      .item-name-input,.item-action,.item-cancel-edit{background:var(--surface)!important;color:var(--page-fg)!important;border-color:var(--theme-line)!important}
      .item-color-label,.item-color-status,.item-note,.item-empty,.payee-empty{color:var(--theme-muted)!important}
      .item-color-dot{box-shadow:0 0 0 1px var(--theme-line)!important}
      .item-color-btn.selected .item-color-dot{border-color:var(--surface)!important;box-shadow:0 0 0 3px var(--accent)!important}
      .item-delete{color:#E63946!important}
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
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)applyDesign()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
