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

function genThemeCSS(c){
  const sage=c.sage,sd=c.sageDeep,rose=c.rose,cream=c.cream,ink=c.ink;
  const L=`:root{
    --cream:${cream};--cream-2:${mix(cream,ink,.06)};--card:${lighten(cream,.55)};
    --sage:${sage};--sage-deep:${sd};--sage-soft:${mix(sage,cream,.55)};
    --rose:${rose};--rose-soft:${mix(rose,cream,.58)};
    --ink:${ink};--ink-soft:${mix(ink,cream,.4)};--line:${mix(cream,ink,.14)};
    --gold:#C9A25A;--good:${sd};--hfont:"${DATA.design.headingFont||'Frank Ruhl Libre'}";}`;
  const dBg=mix(sd,'#000',.80), dBg2=mix(sd,'#000',.74), dCard=mix(sd,'#000',.70);
  const D=`{
    --cream:${dBg};--cream-2:${dBg2};--card:${dCard};
    --sage:${lighten(sage,.22)};--sage-deep:${lighten(sage,.42)};--sage-soft:${mix(sage,'#000',.5)};
    --rose:${lighten(rose,.14)};--rose-soft:${mix(rose,'#000',.5)};
    --ink:${mix(cream,'#fff',.55)};--ink-soft:${mix(cream,dBg,.5)};--line:${mix(sd,'#000',.5)};
    --gold:#D6B36B;--good:${lighten(sage,.2)};--hfont:"${DATA.design.headingFont||'Frank Ruhl Libre'}";}`;
  return L
    +`@media (prefers-color-scheme:dark){:root:not([data-theme="light"])${D}}`
    +`:root[data-theme="dark"]${D}`;
}
function applyTheme(){
  let s=document.getElementById('dyn-theme');
  if(!s){s=document.createElement('style');s.id='dyn-theme';document.head.appendChild(s);}
  s.textContent=genThemeCSS(DATA.design.colors);
}

/* ---------- state ---------- */
let cart=loadCart(), route={name:'home'}, activeCat='all';
let orderResult=null, placing=false, coupon=null, draft={name:'',email:'',phone:''};

function loadCart(){try{return JSON.parse(localStorage.getItem('ec_cart')||'{}');}catch(e){return{};}}
function saveCart(){try{localStorage.setItem('ec_cart',JSON.stringify(cart));}catch(e){}}
function cartCount(){return Object.values(cart).reduce((a,b)=>a+b,0);}
function P(){return DATA.products;}
function findP(id){return P().find(x=>x.id===id);}
function cartItems(){return Object.keys(cart).map(id=>({p:findP(id),q:cart[id]})).filter(x=>x.p);}
function cartTotal(){return cartItems().reduce((a,x)=>a+Number(x.p.price)*x.q,0);}
function cur(){return DATA.design.currency||'₪';}
function money(n){return cur()+n;}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function addToCart(id,silent){cart[id]=(cart[id]||0)+1;saveCart();updateCartBadge();if(!silent)toast('נוסף לעגלה ✓');}
function setQty(id,q){if(q<=0)delete cart[id];else cart[id]=q;saveCart();}

/* ---------- orders ---------- */
async function placeOrder(customer){
  const items=cartItems().map(({p,q})=>({id:p.id,quantity:q}));
  const res=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer,items,coupon:coupon?coupon.code:''})});
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
  if(r.name==='shop')return '/shop';
  if(r.name==='about')return '/about';
  if(r.name==='cart')return '/cart';
  if(r.name==='checkout')return '/checkout';
  if(r.name==='product'&&r.id)return '/product/'+encodeURIComponent(r.id);
  return '/';
}
function routeFromPath(){
  const p=decodeURIComponent(location.pathname).replace(/\/+$/,'')||'/';
  if(p==='/shop')return{name:'shop'};
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
  route={name,...(extra||{})};
  if(!fromHistory){try{history.pushState(null,'',pathFor(route));}catch(e){}}
  render();
}
window.addEventListener('popstate',()=>{route=routeFromPath();render();});

/* ---------- header ---------- */
function header(){
  const d=DATA.design;
  const links=[['home','בית'],['shop','חנות'],['about','עלינו']];
  return `<header><div class="wrap"><nav class="nav">
    <a class="logo" href="/" data-nav="home"><div class="mark">${esc(d.logoText||'ED')}</div>
      <div class="name">${esc(d.brandName)}<small>${esc(d.brandSub||'')}</small></div></a>
    <div class="nav-links" id="navlinks">${links.map(l=>`<a data-nav="${l[0]}" class="${route.name===l[0]?'active':''}">${l[1]}</a>`).join('')}</div>
    <div class="nav-icons">
      <button class="icon-btn hamburger" id="burger" aria-label="תפריט"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
      <a class="icon-btn" href="/cart" data-nav="cart" aria-label="עגלה"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>${cartCount()?`<span class="cart-count">${cartCount()}</span>`:''}</a>
    </div>
  </nav></div></header>`;
}

/* ---------- home ---------- */
function featuredList(){
  const d=DATA.design, ids=d.featuredIds||[];
  const picked=ids.map(id=>findP(id)).filter(Boolean);
  return picked.length?picked:P().slice(0,3);
}
function heroSection(){
  const d=DATA.design, style=d.heroStyle||'side', feat0=featuredList()[0];
  const inner=`<div class="hero-grid">
    <div>
      <span class="eyebrow">${esc(d.heroEyebrow)}</span>
      <h1>${esc(d.heroTitle)}</h1>
      <div class="sub">${esc(d.heroSubtitle||'')}</div>
      <p class="lead">${esc(d.heroLead)}</p>
      <div class="hero-cta">
        <button class="btn btn-primary" data-nav="shop">לחנות המלאה <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="transform:scaleX(-1)"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
        ${feat0?`<button class="btn btn-ghost" data-prod="${feat0.id}">${esc(feat0.name)} ›</button>`:''}
      </div>
    </div>
    <div class="hero-media"><img src="${d.heroImg}" alt="${esc(d.brandName)}">
      ${d.heroBadge?`<div class="hero-badge"><span class="big">${esc(d.heroBadge)}</span><small>${esc(d.heroBadgeSub||'')}</small></div>`:''}
    </div>
  </div>
  <div class="trust">${(d.trust||[]).map(trustChip).join('')}</div>`;
  if(style==='bg'){
    return `<section class="hero style-bg"><div class="hero-bgimg" style="background-image:url('${d.heroImg}')"></div><div class="hero-overlay"></div><div class="wrap">${inner}</div></section>`;
  }
  if(style==='center'){
    return `<section class="hero style-center"><div class="blob a"></div><div class="blob b"></div><div class="wrap">${inner}</div></section>`;
  }
  return `<section class="hero"><div class="blob a"></div><div class="blob b"></div><div class="wrap">${inner}</div></section>`;
}
function homeSection(id){
  const d=DATA.design;
  if(id==='featured'){
    return `<section class="block"><div class="wrap">
      <div class="sec-head"><span class="eyebrow">הנבחרים שלנו</span><h2>${esc(d.featuredTitle||'מוצרים אהובים במיוחד')}</h2><p>${esc(d.featuredSub||'')}</p></div>
      <div class="grid">${featuredList().map(cardHTML).join('')}</div>
      <div style="text-align:center;margin-top:34px"><button class="btn btn-ghost" data-nav="shop">לכל המוצרים</button></div></div></section>`;
  }
  if(id==='features'){
    return `<section class="block band"><div class="wrap"><div class="feat-grid">${(d.features||[]).map(f=>feat(f.icon,f.title,f.body)).join('')}</div></div></section>`;
  }
  if(id==='about'){
    return `<section class="block"><div class="wrap"><div class="about-grid">
      <div class="about-media"><img src="${d.aboutImg||d.heroImg}" alt="${esc(d.brandName)}"></div>
      <div><span class="eyebrow">הסיפור שלנו</span><h2>${esc(d.aboutTitle)}</h2>${aboutParas(d.aboutText)}
        <button class="btn btn-primary" data-nav="about">קראי עוד עלינו</button></div></div></div></section>`;
  }
  return '';
}
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
  const cats=[{id:'all',name:'הכל'}].concat(DATA.categories);
  const list=activeCat==='all'?P():P().filter(p=>p.cat===activeCat);
  return `<main>
  <div class="page-head"><div class="wrap"><span class="eyebrow">החנות</span><h1>כל המוצרים הדיגיטליים</h1></div></div>
  <section class="block" style="padding-top:26px"><div class="wrap">
    <div class="cats">${cats.map(c=>`<button class="cat-pill ${activeCat===c.id?'active':''}" data-cat="${c.id}">${esc(c.name)}</button>`).join('')}</div>
    <div class="grid">${list.map(cardHTML).join('')||'<p style="color:var(--ink-soft)">אין מוצרים בקטגוריה זו עדיין.</p>'}</div>
  </div></section></main>`;
}

/* ---------- product ---------- */
function productPage(id){
  const p=findP(id);if(!p)return shopPage();
  return `<main><div class="wrap" style="padding-top:26px">
    <div class="crumb"><a data-nav="home">בית</a> › <a data-nav="shop">חנות</a> › ${esc(p.name)}</div>
    <div class="pd">
      <div class="pd-media">${p.img?`<img src="${p.img}" alt="${esc(p.name)}">`:`<div class="gen-cover-wrap">${coverFor(p)}</div>`}</div>
      <div>
        <div style="color:var(--rose);font-weight:700;letter-spacing:1.5px;text-transform:uppercase;font-size:12.5px;margin-bottom:8px">${esc(p.catName||catName(p.cat))}</div>
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
    <div class="promo"><input type="text" placeholder="קוד קופון" id="promo"><button id="applyPromo">החלה</button></div>
    <div class="sum-row total"><span>סה"כ</span><b>${money(sub)}</b></div>
    <button class="btn btn-primary btn-block" style="margin-top:16px" data-nav="${gotoName}">${label}</button>
    <p style="text-align:center;font-size:13px;color:var(--ink-soft);margin:14px 0 0">תשלום מאובטח · הורדה מיידית</p></div>`;
}

/* ---------- checkout ---------- */
function checkoutPage(){
  const items=cartItems();if(!items.length)return cartPage();
  const sub=cartTotal();
  return `<main><div class="page-head"><div class="wrap"><span class="eyebrow">תשלום</span><h1>סיום הזמנה</h1></div></div>
  <div class="wrap"><div class="co-layout"><div>
    <div class="co-card"><h3><span class="step-n">1</span> פרטי הלקוח</h3><p class="co-sub">לכתובת זו יישלחו הקבלה והקובץ הדיגיטלי.</p>
      <div class="field"><label for="coName">שם מלא</label><input type="text" id="coName" autocomplete="name" placeholder="השם שלך" maxlength="120" value="${esc(draft.name)}"></div>
      <div class="field"><label for="coEmail">כתובת אימייל</label><input type="email" id="coEmail" autocomplete="email" placeholder="name@example.com" maxlength="200" value="${esc(draft.email)}"></div>
      <div class="field"><label for="coPhone">טלפון (לא חובה)</label><input type="tel" id="coPhone" autocomplete="tel" placeholder="050-0000000" maxlength="30" value="${esc(draft.phone)}"></div></div>
    <div class="co-card"><h3><span class="step-n">2</span> תשלום ב-PayPal</h3>
      <p class="co-sub">אחרי שליחת ההזמנה תקבלי קישור תשלום מאובטח ב-PayPal. הקובץ נשלח לאימייל ברגע שהתשלום מאושר.</p>
      <div class="pay-lines">${items.map(({p,q})=>`<div class="pay-line"><div class="pl-info"><div class="pi">${esc(p.name)}</div><div class="pd-note">${money(p.price)}${q>1?' × '+q:''}</div></div></div>`).join('')}</div>
    </div>
  </div>
  <div class="summary"><h3>ההזמנה שלך</h3>
    ${items.map(({p,q})=>`<div class="sum-row"><span>${esc(p.name)} ${q>1?'× '+q:''}</span><span>${money(p.price*q)}</span></div>`).join('')}
    <div class="promo" style="margin-top:12px"><input type="text" placeholder="קוד הנחה" id="coCoupon" value="${coupon?esc(coupon.code):''}" dir="ltr"><button class="btn btn-ghost btn-sm" id="applyCoupon">החלה</button></div>
    ${coupon?`<div class="sum-row"><span>הנחה (${esc(coupon.code)})</span><span>−${money(coupon.discount)}</span></div>`:''}
    <div class="sum-row total"><span>סה"כ לתשלום</span><b>${money(coupon?Math.round((sub-coupon.discount)*100)/100:sub)}</b></div>
    <button class="btn btn-primary btn-block" style="margin-top:16px" id="placeOrder">שליחת הזמנה ומעבר לתשלום</button>
    <p style="text-align:center;font-size:13px;color:var(--ink-soft);margin:12px 0 0">🔒 תשלום מאובטח · הורדה מיידית</p></div>
  </div></div></main>`;
}

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
  const rows=o.items.map(i=>`
    <div class="dl-row"><div class="dl-info"><h4>${esc(i.name)}${i.quantity>1?' × '+i.quantity:''}</h4>
      ${i.paypalUrl
        ?`<a class="btn btn-primary btn-sm" href="${esc(i.paypalUrl)}" target="_blank" rel="noopener">תשלום ${money(i.price*i.quantity)} ב-PayPal</a>`
        :`<span class="dl-pending">קישור התשלום יישלח אלייך באימייל</span>`}
    </div></div>`).join('');
  return `<main><div class="wrap"><div class="success">
    <div class="checkwrap">${iconCheck()}</div>
    <h1>ההזמנה התקבלה!</h1><p>מספר הזמנה: <b>#${esc(o.id)}</b> · סה"כ ${money(o.total)}</p>
    <p>כדי להשלים את הרכישה, שלמי דרך PayPal. ברגע שנאשר את התשלום נשלח את הקובץ לאימייל <b>${esc(o.email)}</b>.</p>
    <div class="dl-list">${rows}</div>
    <p style="font-size:13.5px;color:var(--ink-soft);margin-top:18px">בפרטי התשלום ב-PayPal צייני את מספר ההזמנה #${esc(o.id)}.</p>
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
  <section class="block band"><div class="wrap"><div class="feat-grid">${(d.features||[]).map(f=>feat(f.icon,f.title,f.body)).join('')}</div></div></section></main>`;
}

/* ---------- footer ---------- */
function footer(){
  const d=DATA.design;
  return `<footer><div class="wrap"><div class="foot-grid">
    <div><div class="logo" data-nav="home" style="margin-bottom:14px"><div class="mark">${esc(d.logoText||'ED')}</div><div class="name">${esc(d.brandName)}<small>${esc(d.brandSub||'')}</small></div></div>
      <p>${esc(d.footerTagline||'')}</p></div>
    <div><h5>חנות</h5>${DATA.categories.map(c=>`<a data-cat="${c.id}">${esc(c.name)}</a>`).join('')}<a data-nav="shop">כל המוצרים</a></div>
    <div><h5>מידע</h5><a data-nav="about">עלינו</a><a data-nav="shop">איך זה עובד</a><a data-nav="home">שאלות נפוצות</a><a data-nav="home">צור קשר</a></div>
    <div><h5>הישארי מעודכנת</h5><p>טיפים, מבצעים והטבה של 15% להזמנה הראשונה.</p><div class="newsletter"><input type="email" id="subEmail" placeholder="האימייל שלך" autocomplete="email"><button class="btn btn-primary" id="subBtn">הרשמה</button></div>
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;margin-top:10px;cursor:pointer"><input type="checkbox" id="subConsent" style="margin-top:3px"><span>מאשרת קבלת מיילים ועדכונים מ-EcoCraft Digital. אפשר להסיר את עצמי בכל עת.</span></label><p id="subMsg" style="font-size:13.5px;margin-top:8px"></p></div></div>
  </div><div class="foot-bottom"><span>© 2026 ${esc(d.brandName)} · כל הזכויות שמורות</span>
    <div class="fb-links"><span id="themeToggle">🌙 מצב כהה / בהיר</span></div>
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
  app.querySelectorAll('[data-cat]').forEach(el=>{if(el.tagName==='A')el.setAttribute('href','/shop');el.onclick=e=>{e.preventDefault();activeCat=el.dataset.cat;nav('shop');};});
  app.querySelectorAll('[data-inc]').forEach(el=>el.onclick=()=>{setQty(el.dataset.inc,(cart[el.dataset.inc]||0)+1);render();});
  app.querySelectorAll('[data-dec]').forEach(el=>el.onclick=()=>{setQty(el.dataset.dec,(cart[el.dataset.dec]||0)-1);render();});
  app.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{delete cart[el.dataset.remove];saveCart();render();});
  const b=document.getElementById('burger');if(b)b.onclick=()=>document.getElementById('navlinks').classList.toggle('open');
  const ac=document.getElementById('applyCoupon');if(ac)ac.onclick=async()=>{
    const code=document.getElementById('coCoupon').value.trim();
    draft={name:document.getElementById('coName').value,email:document.getElementById('coEmail').value,phone:document.getElementById('coPhone').value};
    if(!code){coupon=null;render();return;}
    try{
      const res=await fetch('/api/coupon',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,items:cartItems().map(({p,q})=>({id:p.id,quantity:q}))})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.success){coupon=null;render();toast(esc(data.error||'קוד ההנחה אינו תקף'),true);return;}
      coupon={code:data.code,discount:data.discount};render();toast('קוד ההנחה הוחל ✓');
    }catch(err){toast('לא ניתן לבדוק את הקוד כרגע',true);}
  };
  const po=document.getElementById('placeOrder');if(po)po.onclick=async()=>{
    if(placing)return;
    const name=document.getElementById('coName').value.trim(), email=document.getElementById('coEmail').value.trim(), phone=document.getElementById('coPhone').value.trim();
    if(!name)return toast('נא למלא שם מלא',true);
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return toast('נא להזין כתובת אימייל תקינה',true);
    placing=true;po.disabled=true;po.textContent='שולחת…';
    try{
      const o=await placeOrder({name,email,phone});
      if(o.approveUrl){location.href=o.approveUrl;return;} /* automatic PayPal: the cart is cleared when the customer returns paid */
      orderResult={...o,email};cart={};saveCart();nav('success');
    }catch(err){toast(esc(err.message),true);po.disabled=false;po.textContent='שליחת הזמנה ומעבר לתשלום';}
    finally{placing=false;}
  };
  const ap=document.getElementById('applyPromo');if(ap)ap.onclick=()=>toast('קוד הנחה מזינים בשלב סיום ההזמנה');
  const sb=document.getElementById('subBtn');if(sb)sb.onclick=async()=>{
    const email=document.getElementById('subEmail').value.trim(),consent=document.getElementById('subConsent').checked,msg=document.getElementById('subMsg');
    msg.style.color='inherit';
    try{
      const res=await fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,consent,source:'footer'})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.success){msg.textContent=data.error||'לא הצלחנו להירשם, נסי שוב';msg.style.color='var(--rose)';return;}
      msg.textContent=data.message+' קוד ההנחה שלך: '+data.code+' (15% להזמנה)';
      sb.disabled=true;
    }catch(err){msg.textContent='לא הצלחנו להירשם, נסי שוב';msg.style.color='var(--rose)';}
  };
  const tt=document.getElementById('themeToggle');if(tt)tt.onclick=toggleTheme;
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
function toggleTheme(){
  const cur=document.documentElement.getAttribute('data-theme');
  let next=cur==='dark'?'light':cur==='light'?'dark':(matchMedia('(prefers-color-scheme: dark)').matches?'light':'dark');
  document.documentElement.setAttribute('data-theme',next);
  try{localStorage.setItem('ec_theme',next);}catch(e){}
}


/* ---------- boot ---------- */
(function(){try{const t=localStorage.getItem('ec_theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}})();
if(DATA.design)applyTheme();
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
render();
if(bootToast)toast(bootToast[0],bootToast[1]);
