/* EcoCraft Digital — storefront. Site data is server-rendered into #appdata; orders go to /api/orders. */
"use strict";

let DATA;
try{ DATA = JSON.parse(document.getElementById('appdata').textContent); }
catch(e){ DATA = {}; }

/* ensure home-layout defaults exist (back-compat with older saved data) */
function ensureDefaults(d){
  if(!d||!d.design)return;
  const g=d.design;
  if(!g.heroStyle)g.heroStyle='side';
  if(!Array.isArray(g.homeSections)||!g.homeSections.length)
    g.homeSections=[{id:'featured',on:true},{id:'features',on:true},{id:'about',on:true}];
  if(!Array.isArray(g.featuredIds))g.featuredIds=[];
}
ensureDefaults(DATA);

/* ---------- color helpers ---------- */
function hx(h){h=(h||'#000').replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return[0,2,4].map(i=>parseInt(h.substr(i,2),16));}
function toHex(a){return '#'+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');}
function mix(a,b,t){const A=hx(a),B=hx(b);return toHex(A.map((v,i)=>v+(B[i]-v)*t));}
const lighten=(c,t)=>mix(c,'#ffffff',t), darken=(c,t)=>mix(c,'#000000',t);

/* The palette is fixed by the brand kit (store.css). Only the heading font stays editable in the back office. */
function applyTheme(){
  let s=document.getElementById('dyn-theme');
  if(!s){s=document.createElement('style');s.id='dyn-theme';document.head.appendChild(s);}
  s.textContent=`:root{--hfont:"${DATA.design.headingFont||'Frank Ruhl Libre'}";}`;
}

/* ---------- state ---------- */
let cart=loadCart(), route={name:'home'}, activeCat='all';
let orderResult=null, placing=false, checkoutCfg=null, currentOrder=null;

function loadCart(){try{return JSON.parse(localStorage.getItem('ec_cart')||'{}');}catch(e){return{};}}
function saveCart(){currentOrder=null;try{localStorage.setItem('ec_cart',JSON.stringify(cart));}catch(e){}} /* a changed cart means a new order */
function cartCount(){return Object.values(cart).reduce((a,b)=>a+b,0);}
function P(){return DATA.products;}
function findP(id){return P().find(x=>x.id===id);}
function cartItems(){return Object.keys(cart).map(id=>({p:findP(id),q:cart[id]})).filter(x=>x.p);}
function cartTotal(){return cartItems().reduce((a,x)=>a+Number(x.p.price)*x.q,0);}
function cur(){return DATA.design.currency||'₪';}
function money(n){return n+cur();}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function addToCart(id,silent){cart[id]=(cart[id]||0)+1;saveCart();updateCartBadge();if(!silent)openCart();}
function setQty(id,q){if(q<=0)delete cart[id];else cart[id]=q;saveCart();}

/* ---------- orders ---------- */
async function placeOrder(customer,extra){
  const items=cartItems().map(({p,q})=>({id:p.id,quantity:q}));
  const res=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer,items,...extra})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||!data.success)throw new Error(data.error||'שגיאה ביצירת ההזמנה');
  return data.order;
}

/* ---------- cover helpers ---------- */
function genCover(title,sub,from,to){
  return `<div class="gen-cover" style="background:linear-gradient(135deg,${from||'#6E8767'},${to||'#4F634A'})"><div><div class="gc-inner">${title||''}</div><small>${sub||''}</small></div></div>`;
}
function coverFor(p){
  if(p.img) return `<img src="${p.img}" alt="${esc(p.name)}">`;
  return genCover(esc(p.coverTitle||p.name),esc(p.coverSub||'EcoCraft'),p.coverFrom,p.coverTo);
}
function stars(r){let f=Math.round(r||0),s='';for(let i=0;i<5;i++)s+=i<f?'★':'☆';return s;}
function iconCheck(){return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';}
function catName(id){const c=DATA.categories.find(x=>x.id===id);return c?c.name:'';}

/* ============================================================
   RENDER
   ============================================================ */
const app=document.getElementById('app');

function render(){
  window.scrollTo(0,0);
  let h=header();
  const r=route.name;
  if(r==='home')h+=homePage();
  else if(r==='shop')h+=shopPage();
  else if(r==='product')h+=productPage(route.id);
  else if(r==='cart')h+=cartPage();
  else if(r==='checkout')h+=checkoutPage();
  else if(r==='success')h+=successPage();
  else if(r==='about')h+=aboutPage();
  h+=footer();
  app.innerHTML=h;
  app.querySelector('main')?.classList.add('fade');
  setDocMeta();bind();updateCartBadge();
}
/* ---------- URLs: every page has a real, crawlable path (the server pre-renders them) ---------- */
function pathFor(r){
  if(r.name==='shop')return '/shop'+(activeCat!=='all'?'?cat='+encodeURIComponent(activeCat):'');
  if(r.name==='about')return '/about';
  if(r.name==='cart')return '/cart';
  if(r.name==='checkout')return '/checkout';
  if(r.name==='product'&&r.id)return '/product/'+encodeURIComponent(r.id);
  return '/';
}
function routeFromPath(){
  const p=decodeURIComponent(location.pathname).replace(/\/+$/,'')||'/';
  if(p==='/shop'){const c=new URLSearchParams(location.search).get('cat');activeCat=c&&DATA.categories.some(x=>x.id===c)?c:'all';return{name:'shop'};}
  if(p==='/about')return{name:'about'};
  if(p==='/cart')return{name:'cart'};
  if(p==='/checkout')return{name:'checkout'};
  const m=p.match(/^\/product\/([^/]+)$/);
  if(m&&findP(m[1]))return{name:'product',id:m[1]};
  return{name:'home'};
}
function setDocMeta(){
  const d=DATA.design,b=d.brandName||'EcoCraft Digital';
  let t=b;
  if(route.name==='product'){const p=findP(route.id);if(p)t=p.name+' | '+b;}
  else if(route.name==='shop')t='כל המוצרים הדיגיטליים | '+b;
  else if(route.name==='about')t='עלינו | '+b;
  else if(route.name==='cart')t='עגלת קניות | '+b;
  else if(route.name==='checkout')t='סיום הזמנה | '+b;
  else if(d.heroTitle)t=b+' — '+d.heroTitle;
  document.title=t;
}
function nav(name,extra,fromHistory){
  if(name==='shop'&&!(extra&&extra.keepCat))activeCat='all';
  route={name,...(extra||{})};
  if(!fromHistory){try{history.pushState(null,'',pathFor(route));}catch(e){}}
  render();
}
window.addEventListener('popstate',()=>{route=routeFromPath();render();});

/* ---------- header ---------- */
function header(){
  const d=DATA.design;
  if(route.name==='checkout')return `<header><div class="wrap"><div class="nav co-nav"><a class="logo" href="/" data-nav="home"><img class="logo-img" src="/static/img/ecocraftdigital-logo.png" alt="${esc(d.brandName)}" width="64" height="64"></a><span class="co-secure"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>קופה מאובטחת</span></div></div></header>`;
  const links=[['home','בית'],['shop','חנות'],['about','עלינו']];
  return `<header><div class="wrap"><nav class="nav">
    <a class="logo" href="/" data-nav="home"><img class="logo-img" src="/static/img/ecocraftdigital-logo.png" alt="${esc(d.brandName)}" width="64" height="64">
      </a>
    <div class="nav-links" id="navlinks">${links.map(l=>`<a href="${pathFor({name:l[0]})}" data-nav="${l[0]}" class="${route.name===l[0]?'active':''}"${route.name===l[0]?' aria-current="page"':''}>${l[1]}</a>`).join('')}</div>
    <div class="nav-icons">
      <button class="icon-btn hamburger" id="burger" aria-label="תפריט"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
      <a class="icon-btn" href="/cart" data-nav="cart" aria-label="עגלה"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>${cartCount()?`<span class="cart-count">${cartCount()}</span>`:''}</a>
    </div>
  </nav></div></header>`;
}

/* ---------- home ---------- */
function featuredList(){
  /* ids are resolved on the server: configured products that can actually be delivered, 3 to 4 of them */
  return (DATA.featured||[]).map(id=>findP(id)).filter(Boolean);
}
function leadParas(t){return String(t||'').split('\n').filter(x=>x.trim()).map(x=>`<p class="lead">${esc(x)}</p>`).join('');}
function heroSection(){
  const d=DATA.design, style=d.heroStyle||'side';
  const inner=`<div class="hero-grid">
    <div>
      <span class="eyebrow">${esc(d.heroEyebrow)}</span>
      <h1>${esc(d.heroTitle)}</h1>
      ${leadParas(d.heroLead)}
      <div class="hero-cta"><a class="btn btn-primary" href="/shop" data-nav="shop">לכל המוצרים</a></div>
    </div>
    <div class="hero-media"><img src="${d.heroImg}" alt="${esc(d.brandName)}">
      ${d.heroBadge?`<div class="hero-badge"><span class="big">${esc(d.heroBadge)}</span><small>${esc(d.heroBadgeSub||'')}</small></div>`:''}
    </div>
  </div>`;
  if(style==='bg'){
    return `<section class="hero style-bg"><div class="hero-bgimg" style="background-image:url('${d.heroImg}')"></div><div class="hero-overlay"></div><div class="wrap">${inner}</div></section>`;
  }
  if(style==='center'){
    return `<section class="hero style-center"><div class="blob a"></div><div class="blob b"></div><div class="wrap">${inner}</div></section>`;
  }
  return `<section class="hero"><div class="blob a"></div><div class="blob b"></div><div class="wrap">${inner}</div></section>`;
}
function countLabel(n){return n===1?'מוצר אחד':n+' מוצרים';}
function homeSection(id){
  const d=DATA.design;
  if(id==='featured'){
    return `<section class="block"><div class="wrap">
      <div class="sec-head"><span class="eyebrow">הנבחרים שלנו</span><h2>${esc(d.featuredTitle||'מוצרים אהובים במיוחד')}</h2><p>${esc(d.featuredSub||'')}</p></div>
      <div class="grid">${featuredList().map(cardHTML).join('')}</div>
      <div style="text-align:center;margin-top:34px"><a class="btn btn-ghost" href="/shop" data-nav="shop">עוד מוצרים בחנות</a></div></div></section>`;
  }
  if(id==='categories'){
    const cats=DATA.categories.filter(c=>c.count>0);
    if(!cats.length)return '';
    return `<section class="block"><div class="wrap"><div class="sec-head"><span class="eyebrow">החנות</span><h2>בחרו קטגוריה</h2></div>
      <div class="cat-grid">${cats.map(c=>`<a class="cat-card" href="/shop?cat=${encodeURIComponent(c.id)}" data-cat="${esc(c.id)}"><span class="cat-name">${esc(c.name)}</span><span class="cat-count">${countLabel(c.count)}</span></a>`).join('')}</div></div></section>`;
  }
  if(id==='features'){
    return `<section class="block band"><div class="wrap"><div class="feat-grid">${(d.features||[]).map(f=>feat(f.icon,f.title,f.body)).join('')}</div></div></section>`;
  }
  if(id==='about'){
    return `<section class="block"><div class="wrap"><div class="about-grid">
      <div class="about-media"><img src="${d.aboutImg||d.heroImg}" alt="${esc(d.brandName)}"></div>
      <div><span class="eyebrow">הסיפור שלנו</span><h2>${esc(d.aboutTitle)}</h2>${aboutParas(d.aboutText)}
        <a class="btn btn-primary" href="/about" data-nav="about">קראי עוד עלינו</a></div></div></div></section>`;
  }
  if(id==='info'){
    const faq=(DATA.pages||[]).some(p=>p.slug==='faq');
    return `<section class="block band"><div class="wrap"><div class="sec-head"><span class="eyebrow">לפני שקונים</span><h2>איך זה עובד</h2></div>
      <div class="info-grid">${INFO_ITEMS.map(i=>`<div class="info-item"><h3>${i[0]}</h3><p>${i[1]}</p></div>`).join('')}</div>
      ${faq?'<p class="info-more"><a href="/faq">לשאלות נפוצות</a> · <a href="/contact">צור קשר</a></p>':'<p class="info-more"><a href="/contact">צור קשר</a></p>'}</div></section>`;
  }
  if(id==='cta'){
    return `<section class="block"><div class="wrap"><div class="cta-band"><h2>מוכנים להתחיל?</h2><p>עיינו במוצרים ובחרו את הכלי שמתאים לכם.</p><a class="btn btn-primary" href="/shop" data-nav="shop">לכל המוצרים</a></div></div></section>`;
  }
  return '';
}
/* Only statements that are true of how the store works (see the FAQ and the order flow). */
const INFO_ITEMS=[
  ['מוצרים דיגיטליים','כל המוצרים מיועדים להורדה. אין משלוח ואין צורך להמתין לדואר.'],
  ['קישור הורדה אישי','לאחר אישור התשלום מתקבל קישור הורדה אישי לקבצים שרכשתם.'],
  ['פירוט בכל מוצר','בעמוד של כל מוצר מופיעים תיאור מלא ומה כלול בו, כדי שתדעו מה מקבלים.'],
  ['שאלה או תקלה?','כתבו לנו בעמוד צור קשר ונעזור.']
];
function homePage(){
  const secs=(DATA.design.homeSections||[]).filter(s=>s.on).map(s=>homeSection(s.id)).join('');
  return `<main>${heroSection()}${secs}</main>`;
}
function aboutParas(t){return String(t||'').split('\n').filter(x=>x.trim()).map(p=>`<p>${esc(p)}</p>`).join('');}
function trustChip(t){return `<div class="chip">${iconCheck()}${esc(t)}</div>`;}
function feat(ic,title,body){
  const icons={bolt:'<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',globe:'<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',star:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',gift:'<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>'};
  return `<div class="feat"><div class="fi"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[ic]||icons.star}</svg></div><h4>${esc(title)}</h4><p>${esc(body)}</p></div>`;
}

/* ---------- card ---------- */
function cardHTML(p){
  return `<div class="card" data-prod="${p.id}">
    <div class="thumb">${p.tag?`<span class="card-tag ${p.tagType==='sage'?'sage':''}">${esc(p.tag)}</span>`:''}${coverFor(p)}</div>
    <div class="body"><div class="kicker">${esc(p.catName||catName(p.cat))}</div><h3><a href="/product/${encodeURIComponent(p.id)}" data-plink>${esc(p.name)}</a></h3>
      <div class="desc">${esc(p.short)}</div>
      <div class="foot"><div class="price">${money(p.price)}${p.old?`<span class="old">${money(p.old)}</span>`:''}</div>
        <button class="add-mini" data-add="${p.id}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>הוספה</button>
      </div></div></div>`;
}

/* ---------- shop ---------- */
function shopPage(){
  const cats=[{id:'all',name:'הכל'}].concat(DATA.categories.filter(c=>c.count>0));
  const list=activeCat==='all'?P():P().filter(p=>p.cat===activeCat);
  return `<main>
  <div class="page-head"><div class="wrap"><span class="eyebrow">החנות</span><h1>כל המוצרים הדיגיטליים</h1></div></div>
  <section class="block" style="padding-top:26px"><div class="wrap">
    <div class="cats">${cats.map(c=>`<a class="cat-pill ${activeCat===c.id?'active':''}" href="${c.id==='all'?'/shop':'/shop?cat='+encodeURIComponent(c.id)}" data-cat="${esc(c.id)}">${esc(c.name)}</a>`).join('')}</div>
    <div class="grid">${list.map(cardHTML).join('')||'<p style="color:var(--ink-soft)">אין מוצרים בקטגוריה זו עדיין.</p>'}</div>
  </div></section></main>`;
}

/* ---------- product ---------- */
/* Mirrors galleryHtml() in src/lib/ssr.ts. */
const PLAY='<svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="27" fill="rgba(0,0,0,.55)"/><path d="M22 17l17 10-17 10z" fill="#fff"/></svg>';
const ARROW='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>';
function galleryHtml(p){
  const slides=[...(p.img?[p.img]:[]),...(p.images||[])];
  const video=slides.length?p.video:null;
  if(slides.length<2&&!video)return '';
  const total=slides.length+(video?1:0);
  const img=(src,alt,extra,size)=>`<img src="${esc(src)}" alt="${esc(alt)}" width="${size}" height="${size}" ${extra}>`;
  const sl=slides.map((s,i)=>`<div class="g-slide${i===0?' on':''}">${img(s,`${p.name} - תמונה ${i+1}`,i===0?'fetchpriority="high" decoding="async"':'loading="lazy" decoding="async"',800)}</div>`);
  if(video)sl.push(`<div class="g-slide g-video" data-kind="${esc(video.kind)}" data-embed="${esc(video.embed)}"><button type="button" class="g-play" aria-label="הפעלת הסרטון">${img(slides[0],'','loading="lazy" decoding="async"',800)}<span class="g-playicon">${PLAY}</span></button></div>`);
  const th=slides.map((s,i)=>`<button type="button" class="g-thumb${i===0?' on':''}" data-go="${i}" aria-label="תמונה ${i+1}">${img(s,'','loading="lazy"',80)}</button>`);
  if(video)th.push(`<button type="button" class="g-thumb g-vthumb" data-go="${slides.length}" aria-label="סרטון">${img(slides[0],'','loading="lazy"',80)}<span>${PLAY}</span></button>`);
  return `<div class="gallery" data-gallery data-n="${total}"><div class="g-stage" role="group" aria-roledescription="carousel" aria-label="גלריית המוצר" tabindex="0">${sl.join('')}
    <button type="button" class="g-nav g-prev" data-dir="-1" aria-label="הקודם">${ARROW}</button><button type="button" class="g-nav g-next" data-dir="1" aria-label="הבא">${ARROW}</button>
    <div class="g-count" aria-live="polite"><span class="g-cur">1</span> / ${total}</div></div><div class="g-thumbs">${th.join('')}</div></div>`;
}
function initGallery(root){
  const slides=[...root.querySelectorAll('.g-slide')], thumbs=[...root.querySelectorAll('.g-thumb')], cur=root.querySelector('.g-cur');
  let i=0;
  function stopVideo(){slides.forEach(s=>{if(s.classList.contains('g-video')&&s.dataset.playing){s.dataset.playing='';const f=s.querySelector('iframe,video');if(f)f.remove();const b=s.querySelector('.g-play');if(b)b.hidden=false;}});}
  function go(n){
    n=(n+slides.length)%slides.length;if(n===i)return;
    stopVideo();i=n;
    slides.forEach((s,k)=>s.classList.toggle('on',k===i));
    thumbs.forEach((t,k)=>{t.classList.toggle('on',k===i);if(k===i)t.setAttribute('aria-current','true');else t.removeAttribute('aria-current');});
    if(cur)cur.textContent=i+1;
  }
  function play(slide){
    const kind=slide.dataset.kind, src=slide.dataset.embed||'';let el;
    if(kind==='file'&&/^https:\/\//.test(src)){el=document.createElement('video');el.src=src;el.controls=true;el.autoplay=true;el.playsInline=true;}
    else if(/^https:\/\/(www\.youtube-nocookie\.com\/embed\/[\w-]{11}|player\.vimeo\.com\/video\/\d+(\?h=\w{6,20})?)$/.test(src)){
      el=document.createElement('iframe');el.src=src+(src.includes('?')?'&':'?')+'autoplay=1'+(kind==='youtube'?'&rel=0':'');
      el.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';el.allowFullscreen=true;el.title='סרטון המוצר';
    } else return;
    el.className='g-embed';slide.appendChild(el);slide.dataset.playing='1';slide.querySelector('.g-play').hidden=true;
  }
  root.classList.add('js');
  root.querySelectorAll('[data-dir]').forEach(b=>b.onclick=()=>go(i+ +b.dataset.dir));
  thumbs.forEach(t=>t.onclick=()=>go(+t.dataset.go));
  const pb=root.querySelector('.g-play');if(pb)pb.onclick=()=>play(pb.closest('.g-slide'));
  const stage=root.querySelector('.g-stage');
  stage.addEventListener('keydown',e=>{if(e.target!==stage)return;if(e.key==='ArrowLeft'){go(i+1);e.preventDefault();}else if(e.key==='ArrowRight'){go(i-1);e.preventDefault();}});
  let x0=null;
  stage.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;},{passive:true});
  stage.addEventListener('touchend',e=>{if(x0===null)return;const dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>40)go(dx<0?i+1:i-1);},{passive:true});
}
function productPage(id){
  const p=findP(id);if(!p)return shopPage();
  return `<main><div class="wrap" style="padding-top:26px">
    <div class="crumb"><a data-nav="home">בית</a> › <a data-nav="shop">חנות</a> › ${esc(p.name)}</div>
    <div class="pd">
      <div class="pd-media">${galleryHtml(p)||(p.img?`<img src="${p.img}" alt="${esc(p.name)}">`:`<div class="gen-cover-wrap">${coverFor(p)}</div>`)}</div>
      <div>
        <div style="color:var(--blush-deep);font-weight:700;font-size:12.5px;margin-bottom:8px">${esc(p.catName||catName(p.cat))}</div>
        <h1>${esc(p.name)}</h1>
        ${p.reviews>0?`<div class="stars">${stars(p.rating)} <small>${p.rating||''} · ${p.reviews} ביקורות</small></div>`:''}
        <div class="pd-price">${money(p.price)}${p.old?`<span class="old">${money(p.old)}</span>`:''}</div>
        <p class="pd-desc">${esc(p.desc)}</p>
        <ul class="incl">${(p.incl||[]).map(i=>`<li>${iconCheck()}<span>${esc(i)}</span></li>`).join('')}</ul>
        <div class="pd-cta"><button class="btn btn-primary" data-add="${p.id}">הוספה לעגלה · ${money(p.price)}</button>
          <button class="btn btn-rose" data-buy="${p.id}">קנייה מהירה</button></div>
        <div class="note-box" style="margin-top:20px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>מוצר דיגיטלי — לאחר התשלום מקבלים קישור הורדה מיידי וגם עותק למייל. אין צורך בכתובת למשלוח.</span></div>
      </div>
    </div>
    <section class="block"><div class="sec-head" style="margin-bottom:26px"><h2 style="font-size:28px;color:var(--sage-deep)">אולי יעניין אותך גם</h2></div>
      <div class="grid">${P().filter(x=>x.id!==p.id).slice(0,3).map(cardHTML).join('')}</div></section>
  </div></main>`;
}

/* ---------- cart ---------- */
function cartPage(){
  const items=cartItems();
  if(!items.length)return `<main><div class="wrap"><div class="empty">
    <svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
    <h3>העגלה שלך ריקה</h3><p>עדיין לא הוספת מוצרים. בואי נמצא משהו שתאהבי.</p>
    <div style="margin-top:22px"><button class="btn btn-primary" data-nav="shop">לחנות</button></div></div></div></main>`;
  return `<main><div class="page-head"><div class="wrap"><span class="eyebrow">עגלת קניות</span><h1>העגלה שלך</h1></div></div>
  <div class="wrap"><div class="cart-layout"><div class="cart-items">
    ${items.map(({p,q})=>`<div class="cart-row"><div class="ci-thumb">${coverFor(p)}</div>
      <div class="ci-info"><div class="kicker">${esc(p.catName||catName(p.cat))}</div><h4>${esc(p.name)}</h4><button class="ci-remove" data-remove="${p.id}">הסרה</button></div>
      <div class="qty"><button data-dec="${p.id}">−</button><span>${q}</span><button data-inc="${p.id}">+</button></div>
      <div class="ci-price">${money(p.price*q)}</div></div>`).join('')}
  </div>${summaryBox('checkout','המשך לתשלום')}</div></div></main>`;
}
function summaryBox(gotoName,label){
  const sub=cartTotal();
  return `<div class="summary"><h3>סיכום הזמנה</h3>
    <div class="sum-row"><span>סכום ביניים</span><span>${money(sub)}</span></div>
    <div class="sum-row"><span>מוצרים דיגיטליים</span><span>ללא משלוח</span></div>
    <div class="sum-row total"><span>סה"כ (כולל מע״מ)</span><b>${money(sub)}</b></div>
    <button class="btn btn-primary btn-block" style="margin-top:16px" data-nav="${gotoName}">${label}</button>
    <p style="text-align:center;font-size:13px;color:var(--ink-soft);margin:14px 0 0">תשלום מאובטח</p></div>`;
}

/* ---------- side cart ---------- */
let drawerOpener=null;
function drawerInner(){
  const items=cartItems(), total=cartTotal();
  const rec=P().find(p=>!cart[p.id]&&p.deliverable);
  const rows=items.map(({p,q})=>`<div class="dr-row"><div class="dr-info"><h4>${esc(p.name)}</h4>
      <div class="dr-qty"><button type="button" data-ddec="${p.id}" aria-label="הפחתת כמות: ${esc(p.name)}">−</button><span aria-live="polite">${q}</span><button type="button" data-dinc="${p.id}" aria-label="הוספת כמות: ${esc(p.name)}">+</button>
      <button type="button" class="dr-remove" data-dremove="${p.id}">הסרה</button></div></div><div class="dr-price">${money(p.price*q)}</div></div>`).join('');
  return `<div class="dr-head"><h2 id="drTitle">העגלה שלך</h2><button type="button" class="dr-close" aria-label="סגירת העגלה">✕</button></div>
    <div class="dr-body">${items.length?rows:'<p class="dr-empty">העגלה ריקה.</p>'}
      ${items.length&&rec?`<div class="dr-rec"><span class="dr-rec-t">אולי יעניין אותך</span><div class="dr-rec-row"><div><b>${esc(rec.name)}</b><div class="dr-note">${money(rec.price)}</div></div><button type="button" class="btn btn-ghost btn-sm" data-dadd="${rec.id}">הוספה</button></div></div>`:''}</div>
    <div class="dr-foot">${items.length?`<div class="dr-total"><span>סה"כ (כולל מע״מ)</span><b>${money(total)}</b></div>
      <button type="button" class="btn btn-primary btn-block" data-dcheckout>לקופה</button>`:''}
      <button type="button" class="dr-continue" data-dclose>המשך קנייה</button></div>`;
}
function drawerKey(e){
  const el=document.getElementById('cartDrawer');if(!el)return;
  if(e.key==='Escape'){closeCart();return;}
  if(e.key!=='Tab')return;
  const f=[...el.querySelectorAll('button:not([disabled]),a[href]')];if(!f.length)return;
  const first=f[0],last=f[f.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
}
function openCart(opener){
  closeCart(true);
  drawerOpener=opener||document.activeElement;
  const el=document.createElement('div');el.className='drawer-back';el.id='cartDrawer';
  el.innerHTML=`<aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drTitle"></aside>`;
  document.body.appendChild(el);document.body.classList.add('no-scroll');
  paintDrawer('.dr-close');
  document.addEventListener('keydown',drawerKey);
}
function paintDrawer(focusSel){
  const el=document.getElementById('cartDrawer');if(!el)return;
  const dr=el.querySelector('.drawer');dr.innerHTML=drawerInner();
  el.onclick=e=>{if(e.target===el)closeCart();};
  dr.querySelector('.dr-close').onclick=()=>closeCart();
  dr.querySelectorAll('[data-dclose]').forEach(b=>b.onclick=()=>closeCart());
  const co=dr.querySelector('[data-dcheckout]');if(co)co.onclick=()=>{closeCart(true);nav('checkout');};
  dr.querySelectorAll('[data-dinc]').forEach(b=>b.onclick=()=>{setQty(b.dataset.dinc,(cart[b.dataset.dinc]||0)+1);updateCartBadge();paintDrawer('[data-dinc="'+b.dataset.dinc+'"]');});
  dr.querySelectorAll('[data-ddec]').forEach(b=>b.onclick=()=>{setQty(b.dataset.ddec,(cart[b.dataset.ddec]||0)-1);updateCartBadge();paintDrawer(cart[b.dataset.ddec]?'[data-ddec="'+b.dataset.ddec+'"]':'.dr-close');});
  dr.querySelectorAll('[data-dremove]').forEach(b=>b.onclick=()=>{delete cart[b.dataset.dremove];saveCart();updateCartBadge();paintDrawer('.dr-close');});
  dr.querySelectorAll('[data-dadd]').forEach(b=>b.onclick=()=>{cart[b.dataset.dadd]=(cart[b.dataset.dadd]||0)+1;saveCart();updateCartBadge();paintDrawer('.dr-close');});
  const f=dr.querySelector(focusSel||'.dr-close');if(f)f.focus();
}
function closeCart(silent){
  const el=document.getElementById('cartDrawer');if(!el)return;
  el.remove();document.body.classList.remove('no-scroll');document.removeEventListener('keydown',drawerKey);
  if(!silent&&drawerOpener&&document.contains(drawerOpener))drawerOpener.focus();
}

/* ---------- checkout: one page, no account ---------- */
const MAIL_FIX={'gmial.com':'gmail.com','gmai.com':'gmail.com','gamil.com':'gmail.com','gmail.co':'gmail.com','gmail.con':'gmail.com','hotmial.com':'hotmail.com','hotmai.com':'hotmail.com','hotmail.con':'hotmail.com','yaho.com':'yahoo.com','yahooo.com':'yahoo.com','outlok.com':'outlook.com','walla.co':'walla.co.il'};
function suggestMail(v){const m=String(v).trim().toLowerCase().match(/^([^@\s]+)@([^@\s]+)$/);return m&&MAIL_FIX[m[2]]?m[1]+'@'+MAIL_FIX[m[2]]:'';}
function quickMethods(){
  const c=checkoutCfg;if(!c||!c.gateway||!c.quickPay)return [];
  const m=[];
  if(c.quickPay.bit)m.push(['bit','Bit']);
  if(c.quickPay.applePay&&window.ApplePaySession)m.push(['applePay','Apple Pay']);
  if(c.quickPay.googlePay)m.push(['googlePay','Google Pay']);
  return m;
}
function checkoutPage(){
  const items=cartItems();if(!items.length)return cartPage();
  const sub=cartTotal(), gw=checkoutCfg&&checkoutCfg.gateway, card=gw&&checkoutCfg.embeddedCard, quick=quickMethods();
  const lk=(slug,label)=>hasPage(slug)?`<a href="${pageHref(slug)}" target="_blank" rel="noopener">${label}</a>`:label;
  return `<main class="co-main"><div class="wrap"><h1 class="co-title">סיום הזמנה</h1>
  <div class="co-layout"><form id="coForm" novalidate>
    ${quick.length?`<div class="co-card"><h3>תשלום מהיר</h3><div class="quick">${quick.map(([k,l])=>`<button type="button" class="btn btn-ghost quick-btn" data-quick="${k}">${l}</button>`).join('')}</div><p class="co-sub" style="margin:12px 0 0">או מלאי את הפרטים ושלמי בכרטיס.</p></div>`:''}
    <div class="co-card"><h3>הפרטים שלך</h3><p class="co-sub">לכתובת זו יישלחו הקבלה והקובץ.</p>
      <div class="field"><label for="coEmail">כתובת אימייל</label><input type="email" id="coEmail" name="email" autocomplete="email" inputmode="email" placeholder="name@example.com" maxlength="200" required aria-describedby="mailHint"><div id="mailHint" class="field-hint" aria-live="polite"></div></div>
      <div class="field"><label for="coName">שם מלא (לקבלה)</label><input type="text" id="coName" name="name" autocomplete="name" placeholder="השם שלך" maxlength="120" required></div></div>
    <div class="co-card"><h3>תשלום</h3>
      ${card?`<div id="cardArea" class="card-area"><p class="co-sub">טופס התשלום יוצג כאן אחרי לחיצה על "תשלום".</p></div>`:`<p class="co-sub">אחרי שליחת ההזמנה יוצגו מספר ההזמנה וקישורי התשלום. הקובץ יישלח לאימייל אחרי שנאשר ידנית את קבלת התשלום.</p>`}
      <label class="check-row"><input type="checkbox" id="coTerms" required><span>אני מאשרת את ${lk('terms','התקנון')} ואת ${lk('refunds','מדיניות הביטולים')}.</span></label>
      <label class="check-row"><input type="checkbox" id="coMarketing"><span>אשמח לקבל עדכונים ומבצעים במייל (אפשר להסיר בכל עת).</span></label>
      <p id="coErr" class="co-err" role="alert"></p>
      <button type="submit" class="btn btn-primary btn-block" id="placeOrder">${gw?'תשלום '+money(sub):'שליחת הזמנה'}</button>
      <p id="payStatus" class="pay-status" role="status" aria-live="polite"></p></div>
  </form>
  <aside class="summary co-summary"><h3>ההזמנה שלך</h3>
    ${items.map(({p,q})=>`<div class="sum-row"><span>${esc(p.name)}${q>1?' × '+q:''}</span><span>${money(p.price*q)}</span></div>`).join('')}
    <div class="sum-row total"><span>סה"כ (כולל מע״מ)</span><b>${money(sub)}</b></div>
    <p class="sum-note">מוצרים דיגיטליים, ללא משלוח.</p></aside>
  </div></div></main>`;
}
function coFail(id,msg){
  const err=document.getElementById('coErr');if(err)err.textContent=msg;
  document.querySelectorAll('#coForm [aria-invalid]').forEach(x=>x.removeAttribute('aria-invalid'));
  const f=document.getElementById(id);if(f){f.setAttribute('aria-invalid','true');f.focus();}
  return false;
}
async function submitCheckout(method){
  if(placing)return;
  const email=document.getElementById('coEmail').value.trim(), name=document.getElementById('coName').value.trim();
  const terms=document.getElementById('coTerms').checked, marketing=document.getElementById('coMarketing').checked;
  document.getElementById('coErr').textContent='';
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return coFail('coEmail','נא להזין כתובת אימייל תקינה');
  if(!name)return coFail('coName','נא למלא שם מלא');
  if(!terms)return coFail('coTerms','כדי להמשיך צריך לאשר את התקנון ואת מדיניות הביטולים');
  const po=document.getElementById('placeOrder'), label=po.textContent;
  placing=true;po.disabled=true;po.textContent='שולחת…';
  try{
    if(!currentOrder)currentOrder=await placeOrder({name,email},{terms:true,marketing,method:method||'card'});
    const o=currentOrder;
    if(o.approveUrl){location.href=o.approveUrl;return;} /* automatic PayPal: the cart is cleared when the customer returns paid */
    if(o.embedUrl){showPayFrame(o);po.hidden=true;return;}
    orderResult={...o,email};cart={};saveCart();currentOrder=null;nav('success');
  }catch(err){coFail('coEmail',err.message);po.disabled=false;po.textContent=label;}
  finally{placing=false;}
}
function showPayFrame(o){
  const area=document.getElementById('cardArea');if(!area)return;
  area.innerHTML=`<iframe class="card-frame" src="${esc(o.embedUrl)}" title="טופס תשלום מאובטח" allow="payment"></iframe>`;
  area.querySelector('iframe').focus();
}
window.addEventListener('message',e=>{
  const d=e.data;
  if(e.origin!==location.origin||!d||d.source!=='ecocraft-mockpay'||!currentOrder)return;
  const st=document.getElementById('payStatus');
  if(d.outcome==='pending'){if(st)st.textContent='מאמתים את התשלום...';return;}
  if(d.outcome==='success'&&d.token){
    orderResult={paid:true,downloadUrl:'/download/'+encodeURIComponent(d.token)};
    cart={};saveCart();currentOrder=null;nav('success');return;
  }
  /* failed: the order stays open, so retrying reuses it instead of creating a duplicate */
  if(st)st.innerHTML='התשלום לא עבר. העגלה נשמרה. <button type="button" class="linklike" id="retryPay">לנסות שוב</button>';
  const area=document.getElementById('cardArea');if(area)area.innerHTML='';
  const r=document.getElementById('retryPay');if(r)r.onclick=()=>{st.textContent='';showPayFrame(currentOrder);};
});

/* ---------- success / about ---------- */
function successPage(){
  const o=orderResult;
  if(o&&o.paid)return `<main><div class="wrap"><div class="success">
    <div class="checkwrap">${iconCheck()}</div><h1>התשלום התקבל — תודה!</h1>
    <p>הקבצים שלך מוכנים להורדה. שמרי את הקישור — הוא אישי וזמין תמיד.</p>
    <div style="margin-top:22px"><a class="btn btn-primary" href="${esc(o.downloadUrl)}">להורדת הקבצים</a></div>
    <div style="margin-top:22px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap"><button class="btn btn-ghost" data-nav="shop">להמשך קנייה</button><button class="btn btn-ghost" data-nav="home">לדף הבית</button></div>
  </div></div></main>`;
  if(!o)return `<main><div class="wrap"><div class="success"><h1>לא נמצאה הזמנה</h1><div style="margin-top:26px"><button class="btn btn-primary" data-nav="shop">לחנות</button></div></div></div></main>`;
  const bit=DATA.design.bitUrl||'';
  const rows=o.items.map(i=>`
    <div class="dl-row"><div class="dl-info"><h4>${esc(i.name)}${i.quantity>1?' × '+i.quantity:''}</h4>
      ${i.paypalUrl
        ?`<a class="btn btn-primary btn-sm" href="${esc(i.paypalUrl)}" target="_blank" rel="noopener">תשלום ${money(i.price*i.quantity)} ב-PayPal</a>`
        :''}
    </div></div>`).join('');
  return `<main><div class="wrap"><div class="success">
    <div class="checkwrap">${iconCheck()}</div>
    <h1>ההזמנה התקבלה!</h1><p>מספר הזמנה: <b>#${esc(o.id)}</b> · סה"כ ${money(o.total)}</p>
    <p>כדי להשלים את הרכישה, שלמי <b>${money(o.total)}</b> באחת מהדרכים. לאחר שנאשר את קבלת התשלום (ידנית, בדרך כלל בתוך יום עסקים) נשלח את הקובץ לאימייל <b>${esc(o.email)}</b>.</p>
    <div class="dl-list">${bit?`<div class="dl-row"><div class="dl-info"><h4>תשלום ב-Bit</h4><a class="btn btn-primary btn-sm" href="${esc(bit)}" target="_blank" rel="noopener">לתשלום ${money(o.total)} ב-Bit</a></div></div>`:''}${rows}</div>
    ${bit||o.items.some(i=>i.paypalUrl)?'':`<p class="dl-pending">פרטי התשלום יישלחו אלייך באימייל <b>${esc(o.email)}</b>.</p>`}
    <p style="font-size:13.5px;color:var(--ink-soft);margin-top:18px"><b>חשוב:</b> סכום התשלום הוא ${money(o.total)}. בהערה לתשלום כתבי את מספר ההזמנה #${esc(o.id)}, כדי שנוכל לזהות אותו.</p>
    <div style="margin-top:26px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap"><button class="btn btn-primary" data-nav="shop">להמשך קנייה</button><button class="btn btn-ghost" data-nav="home">לדף הבית</button></div>
  </div></div></main>`;
}
function aboutPage(){
  const d=DATA.design;
  return `<main><div class="page-head"><div class="wrap"><span class="eyebrow">${esc(d.brandName)}</span><h1>נעים להכיר</h1></div></div>
  <section class="block" style="padding-top:24px"><div class="wrap"><div class="about-grid">
    <div class="about-media"><img src="${d.aboutImg||d.heroImg}" alt="${esc(d.brandName)}"></div>
    <div><h2>${esc(d.aboutTitle)}</h2>${aboutParas(d.aboutText)}
      <div style="margin-top:22px"><button class="btn btn-primary" data-nav="shop">למוצרים שלנו</button></div></div>
  </div></div></section>
  ${(d.aboutSections||[]).length?`<section class="block" style="padding-top:8px"><div class="wrap prose">${d.aboutSections.map(x=>`${x.title?`<h2>${esc(x.title)}</h2>`:''}${aboutParas(x.body)}`).join('')}</div></section>`:''}
  <section class="block band"><div class="wrap"><div class="feat-grid">${(d.features||[]).map(f=>feat(f.icon,f.title,f.body)).join('')}</div></div></section></main>`;
}

/* ---------- footer ---------- */
const SYSTEM_PAGES=['faq','terms','privacy','refunds'];
function hasPage(slug){return (DATA.pages||[]).some(x=>x.slug===slug);}
function pageHref(slug){return SYSTEM_PAGES.includes(slug)?'/'+slug:'/page/'+encodeURIComponent(slug);}
function waLink(phone){const g=String(phone).replace(/\D/g,'');return 'https://wa.me/'+(g.startsWith('972')?g:g.replace(/^0/,'972'));}
function contactLinks(d){
  return [d.contactPhone?`<a href="${esc(waLink(d.contactPhone))}" target="_blank" rel="noopener">וואטסאפ ${esc(d.contactPhone)}</a>`:'',
    d.whatsappUrl?`<a href="${esc(d.whatsappUrl)}" target="_blank" rel="noopener">ערוץ וואטסאפ</a>`:'',
    d.instagramUrl?`<a href="${esc(d.instagramUrl)}" target="_blank" rel="noopener">אינסטגרם</a>`:'',
    d.contactEmail?`<a href="mailto:${esc(d.contactEmail)}">${esc(d.contactEmail)}</a>`:''].join('');
}
function footer(){
  const d=DATA.design;
  if(route.name==='checkout')return `<footer class="co-foot"><div class="wrap"><span>© 2026 ${esc(d.brandName)}</span>${[hasPage('terms')?`<a href="${pageHref('terms')}">תקנון</a>`:'',hasPage('refunds')?`<a href="${pageHref('refunds')}">מדיניות ביטולים</a>`:'',hasPage('privacy')?`<a href="${pageHref('privacy')}">פרטיות</a>`:'','<a href="/contact">יצירת קשר</a>'].join('')}</div></footer>`;
  return `<footer><div class="wrap"><div class="foot-grid${contactLinks(d)?' five':''}">
    <div><div class="logo" data-nav="home" style="margin-bottom:14px"><img class="logo-img" src="/static/img/ecocraftdigital-logo.png" alt="${esc(d.brandName)}" width="64" height="64"></div>
      <p>${esc(d.footerTagline||'')}</p></div>
    <div><h5>חנות</h5>${DATA.categories.filter(c=>c.count>0).map(c=>`<a data-cat="${c.id}">${esc(c.name)}</a>`).join('')}<a data-nav="shop">כל המוצרים</a></div>
    <div><h5>מידע</h5><a href="/about" data-nav="about">עלינו</a>${(DATA.pages||[]).map(p=>`<a href="${pageHref(p.slug)}">${esc(p.title)}</a>`).join('')}<a href="/contact">צור קשר</a></div>
    ${contactLinks(d)?`<div><h5>יצירת קשר</h5>${contactLinks(d)}</div>`:''}
    <div><h5>הישארי מעודכנת</h5><p>קבלי טיפים ומבצעים ישירות למייל.</p><div class="newsletter"><input type="email" placeholder="האימייל שלך"><button class="btn btn-primary" id="subBtn">הרשמה</button></div></div>
  </div><div class="foot-bottom"><span>© 2026 ${esc(d.brandName)} · כל הזכויות שמורות</span>
  </div></div></footer>`;
}

/* ============================================================
   BINDINGS
   ============================================================ */
function bind(){
  app.querySelectorAll('[data-nav]').forEach(el=>{
    if(el.tagName==='A'&&!el.getAttribute('href'))el.setAttribute('href',pathFor({name:el.dataset.nav}));
    el.onclick=e=>{e.preventDefault();nav(el.dataset.nav);};
  });
  app.querySelectorAll('[data-plink]').forEach(el=>el.onclick=e=>e.preventDefault()); /* the card handler navigates */
  app.querySelectorAll('[data-prod]').forEach(el=>el.onclick=e=>{if(e.target.closest('[data-add]'))return;nav('product',{id:el.dataset.prod});});
  app.querySelectorAll('[data-add]').forEach(el=>el.onclick=e=>{e.stopPropagation();addToCart(el.dataset.add);});
  app.querySelectorAll('[data-buy]').forEach(el=>el.onclick=e=>{e.stopPropagation();addToCart(el.dataset.buy,true);nav('checkout');});
  app.querySelectorAll('[data-cat]').forEach(el=>{if(el.tagName==='A'&&!el.getAttribute('href'))el.setAttribute('href','/shop?cat='+encodeURIComponent(el.dataset.cat));el.onclick=e=>{e.preventDefault();activeCat=el.dataset.cat;nav('shop',{keepCat:true});};});
  app.querySelectorAll('[data-inc]').forEach(el=>el.onclick=()=>{setQty(el.dataset.inc,(cart[el.dataset.inc]||0)+1);render();});
  app.querySelectorAll('[data-dec]').forEach(el=>el.onclick=()=>{setQty(el.dataset.dec,(cart[el.dataset.dec]||0)-1);render();});
  app.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{delete cart[el.dataset.remove];saveCart();render();});
  app.querySelectorAll('[data-gallery]').forEach(initGallery);
  const b=document.getElementById('burger');if(b)b.onclick=()=>document.getElementById('navlinks').classList.toggle('open');
  const cf=document.getElementById('coForm');
  if(cf){
    cf.onsubmit=e=>{e.preventDefault();submitCheckout('card');};
    cf.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>submitCheckout(b.dataset.quick));
    const em=document.getElementById('coEmail'),hint=document.getElementById('mailHint');
    em.onblur=()=>{
      const fix=suggestMail(em.value);
      hint.innerHTML=fix?`התכוונת ל-<button type="button" class="linklike" id="fixMail">${esc(fix)}</button>?`:'';
      const fb=document.getElementById('fixMail');if(fb)fb.onclick=()=>{em.value=fix;hint.textContent='';};
    };
  }
  app.querySelectorAll('.icon-btn[data-nav="cart"]').forEach(el=>el.onclick=e=>{e.preventDefault();openCart(el);});
  const sb=document.getElementById('subBtn');if(sb)sb.onclick=()=>toast('נרשמת לרשימת התפוצה ✓');
}
function updateCartBadge(){
  const btn=document.querySelector('[data-nav="cart"]');if(!btn)return;
  let b=btn.querySelector('.cart-count');const c=cartCount();
  if(b)b.textContent=c;
  if(!b&&c)btn.insertAdjacentHTML('beforeend',`<span class="cart-count">${c}</span>`);
  if(b&&!c)b.remove();
}
let toastT;
function toast(msg,isErr){const t=document.getElementById('toast');t.innerHTML=msg;t.className='toast show'+(isErr?' err':'');clearTimeout(toastT);toastT=setTimeout(()=>t.className='toast',2600);}


/* ---------- boot ---------- */
if(DATA.design)applyTheme();
fetch('/api/checkout/config').then(r=>r.json()).then(d=>{checkoutCfg=d;if(route.name==='checkout'&&!currentOrder)render();}).catch(()=>{});
/* returning from PayPal: ?paid=<download token> after a captured payment, ?payment=cancelled|failed|pending otherwise */
const q=new URLSearchParams(location.search);
let bootToast=null;
if(q.get('paid')){
  orderResult={paid:true,downloadUrl:'/download/'+encodeURIComponent(q.get('paid'))};
  cart={};saveCart();route={name:'success'};
}else if(q.get('payment')){
  const m={cancelled:'התשלום בוטל — העגלה שלך נשמרה.',pending:'התשלום עדיין בעיבוד. נעדכן ברגע שיאושר.',failed:'לא הצלחנו לאמת את התשלום. אם חויבת, פני אלינו עם מספר ההזמנה.'};
  bootToast=[m[q.get('payment')]||m.failed,q.get('payment')!=='cancelled'&&q.get('payment')!=='pending'];
}
if(!q.get('paid'))route=routeFromPath();
if(q.get('paid')||q.get('payment')){try{history.replaceState(null,'',location.pathname);}catch(e){}}
if(document.body.dataset.static){
  /* content pages (FAQ, legal, contact) are rendered by the server; only wire up the chrome */
  const bg=document.getElementById('burger');if(bg)bg.onclick=()=>document.getElementById('navlinks').classList.toggle('open');
  updateCartBadge();
  const cf=document.getElementById('contactForm');
  if(cf)cf.onsubmit=async e=>{
    e.preventDefault();
    const out=document.getElementById('ctMsgOut'),btn=document.getElementById('ctSend');
    out.style.color='inherit';btn.disabled=true;
    try{
      const res=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        name:document.getElementById('ctName').value,email:document.getElementById('ctEmail').value,orderRef:document.getElementById('ctRef').value,
        message:document.getElementById('ctMsg').value,website:document.getElementById('ctWebsite').value})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.success){out.textContent=data.error||'לא הצלחנו לשלוח, נסי שוב';out.style.color='var(--blush-deep)';btn.disabled=false;return;}
      cf.reset();out.textContent='תודה! ההודעה נשלחה ונחזור אלייך בהקדם 💚';
    }catch(err){out.textContent='לא הצלחנו לשלוח, נסי שוב';out.style.color='var(--blush-deep)';btn.disabled=false;}
  };
}else{
  render();
  if(bootToast)toast(bootToast[0],bootToast[1]);
}
