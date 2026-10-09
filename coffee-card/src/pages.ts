import { esc } from './logic.ts'
import { qrSvg } from './qr.ts'

const head = (title: string, color = '#537c6d', extra = '') => `<!doctype html><html lang="he" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="${color}">${extra}<title>${esc(title)}</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;background:#f6f1ea;color:#2a2523}
main{max-width:420px;margin:0 auto;padding:20px 16px}h1{margin:.2em 0}
.card{background:${color};color:#fff;border-radius:20px;padding:20px;box-shadow:0 6px 20px #0003}
.qrbox{width:min(100%,340px);margin:0 auto;cursor:zoom-in;border-radius:12px;overflow:hidden}.qrbox svg{display:block;width:100%;height:auto}.qrbox.full{position:fixed;inset:0;z-index:10;width:auto;margin:0;border-radius:0;background:#fff;display:grid;place-items:center;cursor:zoom-out}.qrbox.full svg{width:min(96vw,96vh);height:auto}
.card.c{text-align:center}.logo{display:block;width:max-content;margin:0 auto 14px;background:#fff;border-radius:24px;padding:10px}.logo img{display:block;width:130px;height:auto}
.panel{background:#fff;border-radius:16px;padding:16px;margin-top:16px;box-shadow:0 2px 8px #0001}
label{display:block;margin:12px 0 4px;font-weight:600}
input[type=text],input[type=tel],input[type=password]{width:100%;padding:12px;font-size:18px;border:1px solid #bbb;border-radius:10px}
button{width:100%;padding:14px;font-size:18px;font-weight:700;border:0;border-radius:12px;background:${color};color:#fff;margin-top:12px;cursor:pointer}
button.alt{background:#fff;color:${color};border:2px solid ${color}}button:disabled{opacity:.5}
.stamps{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:16px 0}
.s{aspect-ratio:1;border-radius:50%;border:2px dashed #fff9;display:grid;place-items:center;font-size:22px}
.s.on{background:#fff;border-style:solid;color:${color}}
.msg{margin-top:12px;font-weight:600}.err{color:#b3261e}.ok{color:#1b7a3a}
.consent{display:flex;gap:8px;align-items:flex-start;font-weight:400;margin-top:14px}.consent input{margin-top:4px}
small{color:#666}
</style></head><body><main>`
const foot = `</main></body></html>`

export function joinPage(shop: string, reward: string, needed: number, err = ''): string {
  return `${head(shop)}<h1>${esc(shop)}</h1>
<p>צוברים ${needed} חותמות – ו${esc(reward)}</p>
<form class="panel" method="post" action="/join">
<label for="n">שם</label><input id="n" name="name" type="text" required maxlength="60" autocomplete="name">
<label for="p">טלפון</label><input id="p" name="phone" type="tel" required inputmode="tel" autocomplete="tel" placeholder="050-0000000">
<label>יום הולדת (לא חובה – מתנה קטנה בחודש יום ההולדת)</label>
<div style="display:flex;gap:8px"><select name="bday" aria-label="יום" style="flex:1;padding:12px;font-size:18px"><option value="">יום</option>${Array.from({ length: 31 }, (_, i) => `<option>${i + 1}</option>`).join('')}</select>
<select name="bmonth" aria-label="חודש" style="flex:1;padding:12px;font-size:18px"><option value="">חודש</option>${Array.from({ length: 12 }, (_, i) => `<option>${i + 1}</option>`).join('')}</select></div>
<label class="consent"><input type="checkbox" name="consent" value="1"><span>אני מאשר/ת קבלת הודעות ומבצעים (אפשר להסיר בכל עת)</span></label>
<small>הפרטים נשמרים רק לצורך הכרטיס. <a href="/privacy">מדיניות פרטיות</a></small>
${err ? `<div class="msg err">${esc(err)}</div>` : ''}
<button type="submit">קבלת כרטיס</button></form>
<script>
(async()=>{try{if(location.search.indexOf('new=1')>=0)return;const t=localStorage.getItem('cardToken');
 if(!t||!/^[0-9a-f]{32}$/.test(t))return;
 const r=await fetch('/c/'+t+'/manifest.webmanifest');
 if(r.ok)location.replace('/c/'+t);else localStorage.removeItem('cardToken')}catch(e){}})();
</script>${foot}`
}

const cardHeadTags = (shop: string, token: string) =>
  `<link rel="manifest" href="/c/${token}/manifest.webmanifest"><link rel="apple-touch-icon" href="/apple-touch-icon.png">` +
  `<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">` +
  `<meta name="apple-mobile-web-app-title" content="${esc(shop)}">`

export function cardPage(shop: string, reward: string, needed: number, c: { token: string; name: string; stamps: number; rewardReady: boolean; birthdayGift: boolean }): string {
  const cells = Array.from({ length: needed }, (_, i) => `<div class="s${i < c.stamps ? ' on' : ''}">${i < c.stamps ? '☕' : i + 1}</div>`).join('')
  const ready = c.rewardReady
  return `${head(shop, undefined, cardHeadTags(shop, c.token))}<div class="card c"><span class="logo"><img src="/logo.png" alt="${esc(shop)}" width="130" height="129"></span><div>${esc(c.name)}</div>
<div class="stamps">${cells}</div>
<div>${ready ? `🎉 מגיע לך: ${esc(reward)}` : `עוד ${needed - c.stamps} חותמות ל${esc(reward)}`}</div>
${c.birthdayGift ? '<div style="margin-top:8px">🎂 מתנת יום הולדת מחכה לך – הציגי בקופה!</div>' : ''}</div>
<div class="panel" style="text-align:center"><div id="qrbox" class="qrbox" role="button" tabindex="0" aria-label="הגדלת הקוד">${qrSvg(c.token, 'קוד הכרטיס')}</div>
<p><small>מציגים את הקוד בקופה כדי לקבל חותמת. לחיצה על הקוד מגדילה אותו, ועדיף להעלות את בהירות המסך.</small></p>
<button class="alt" id="save">שמירת הכרטיס במסך הבית</button>
<p><small><a href="/join?new=1">הרשמה של לקוח אחר מהמכשיר הזה</a></small></p></div>
<script>
const qb=document.getElementById('qrbox');
const tog=()=>{qb.classList.toggle('full');try{if(qb.classList.contains('full')&&navigator.wakeLock)navigator.wakeLock.request('screen').catch(()=>{})}catch(e){}};
qb.onclick=tog;qb.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tog()}};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)location.reload()});
try{localStorage.setItem('cardToken',${JSON.stringify(c.token)})}catch(e){}
document.getElementById('save').onclick=()=>alert('באייפון: שיתוף ← הוספה למסך הבית. באנדרואיד: תפריט ← התקנת אפליקציה או הוספה למסך הבית. יופיע אייקון של העסק, והכרטיס ייפתח ישר.');
</script>${foot}`
}

export function staffLoginPage(shop: string, err = ''): string {
  return `${head(shop + ' – צוות')}<h1>כניסת צוות</h1>
<form class="panel" method="post" action="/staff/login"><label for="p">קוד כניסה</label>
<input id="p" name="pin" type="password" inputmode="numeric" autocomplete="current-password" required>
${err ? `<div class="msg err">${esc(err)}</div>` : ''}<button type="submit">כניסה</button></form>${foot}`
}

export function staffPage(shop: string, needed: number): string {
  return `${head(shop + ' – חתימה')}<h1>חתימה בקופה</h1>
<div class="panel"><video id="v" playsinline muted style="width:100%;border-radius:12px;background:#000"></video>
<button id="scan">סריקת כרטיס</button>
<label for="ph">או חיפוש לפי טלפון</label><input id="ph" type="tel" inputmode="tel">
<button class="alt" id="find">חיפוש</button></div>
<div class="panel" id="res" hidden>
<h2 id="nm"></h2><div id="st"></div><div id="flags" style="font-weight:700;margin-top:6px"></div>
<label for="cnt">כמות קפה</label><input id="cnt" type="text" inputmode="numeric" value="1">
<button id="stamp">חתימה</button><button class="alt" id="redeem">מימוש מתנה</button>
<button class="alt" id="bday" hidden>🎂 מתנת יום הולדת</button>
<a class="alt" id="wa" hidden target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none;padding:14px;border-radius:12px;border:2px solid #537c6d;color:#537c6d;font-weight:700;margin-top:12px">שליחת קישור הכרטיס בוואטסאפ</a></div>
<p>ייצוא (CSV):<br><a href="/staff/export.csv">כל הלקוחות</a> · <a href="/staff/export.csv?marketing=1">רק מי שאישרו שיווק</a> · <a href="/staff/export-events.csv">היסטוריית חתימות</a></p>
<div class="msg" id="msg"></div>
<script src="/jsQR.js"></script>
<script>
const NEEDED=${needed};let cur=null;const $=id=>document.getElementById(id);
const say=(t,ok)=>{$('msg').textContent=t;$('msg').className='msg '+(ok?'ok':'err')};
async function api(path,body){const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 if(r.status===401){location.href='/staff';return {}}return Object.assign({_s:r.status},await r.json())}
function show(c){cur=c;$('res').hidden=false;$('nm').textContent=c.name;
 $('st').textContent=c.stamps+' / '+NEEDED+' חותמות'+(c.stamps>=NEEDED?' – 🎉 מגיעה מתנה':'');$('redeem').disabled=!c.rewardReady;$('bday').hidden=!c.birthdayGift;
 $('wa').hidden=!c.whatsappUrl;if(c.whatsappUrl)$('wa').href=c.whatsappUrl;
 $('flags').textContent=[c.rewardReady?'🎉 מתנה ממתינה למימוש':'',c.birthdayGift?'🎂 מגיעה מתנת יום הולדת':'',c.multiplier>1?'✨ היום חותמת כפולה':''].filter(Boolean).join(' · ')}
async function lookup(b){const r=await api('/api/staff/lookup',b);if(r.card){show(r.card);say('',true)}else say(r.error||'לא נמצא',false)}
$('find').onclick=()=>lookup({phone:$('ph').value});
$('stamp').onclick=async()=>{const r=await api('/api/staff/stamp',{token:cur.token,count:Number($('cnt').value)||1});
 if(r.card){show(r.card);say('נחתם ✔',true)}else say(r.error||'שגיאה',false)};
$('redeem').onclick=async()=>{const r=await api('/api/staff/redeem',{token:cur.token});
 if(r.card){show(r.card);say('מתנה מומשה ✔',true)}else say(r.error||'שגיאה',false)};
$('bday').onclick=async()=>{const r=await api('/api/staff/redeem-birthday',{token:cur.token});
 if(r.card){show(r.card);say('מתנת יום הולדת ניתנה ✔',true)}else say(r.error||'שגיאה',false)};
let scanning=false,stream=null;
const TOKEN=/^[0-9a-f]{32}$/i;
let det=null;try{if('BarcodeDetector' in window)det=new BarcodeDetector({formats:['qr_code']})}catch(e){}
const stopCam=()=>{scanning=false;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}$('v').srcObject=null};
addEventListener('pagehide',stopCam);
$('scan').onclick=async()=>{
 if(scanning)return;
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)return say('הדפדפן לא תומך במצלמה. אפשר לחפש לפי טלפון',false);
 if(!det&&!window.jsQR)return say('הסריקה לא זמינה בדפדפן הזה. אפשר לחפש לפי טלפון',false);
 const v=$('v');
 try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});v.srcObject=stream;await v.play()}
 catch(e){stopCam();return say(e&&e.name==='NotAllowedError'?'אין הרשאה למצלמה. יש לאשר בהגדרות הדפדפן, או לחפש לפי טלפון':'לא נמצאה מצלמה. אפשר לחפש לפי טלפון',false)}
 scanning=true;say('סורקת... קרבי את המצלמה לקוד, ובקשי מהלקוח להעלות את בהירות המסך',true);
 const c=document.createElement('canvas'),x=c.getContext('2d',{willReadFrequently:true});let last=0,hinted=false,n=0;
 (async function tick(t){
  if(!scanning)return;
  if(t-last>=120&&v.readyState===v.HAVE_ENOUGH_DATA&&v.videoWidth){last=t;let val=null;
   try{
    if(det){const r=await det.detect(v);if(r.length)val=r[0].rawValue}
    if(val===null&&window.jsQR){const k=Math.min(1,((n++%2)?640:960)/v.videoWidth);
     c.width=Math.round(v.videoWidth*k);c.height=Math.round(v.videoHeight*k);x.drawImage(v,0,0,c.width,c.height);
     const d=x.getImageData(0,0,c.width,c.height),q=jsQR(d.data,d.width,d.height);if(q)val=q.data}
   }catch(e){}
   if(!scanning)return;
   if(val!==null){if(TOKEN.test(val)){stopCam();return lookup({token:val.toLowerCase()})}
    if(!hinted){hinted=true;say('זה לא קוד של כרטיס לקוח',false)}}}
  requestAnimationFrame(tick)})(0)};
</script>${foot}`
}

export function privacyPage(shop: string, contact: string, retentionMonths: number): string {
  const c = esc(contact)
  return `${head('מדיניות פרטיות')}<h1>מדיניות פרטיות</h1>
<p>${esc(shop)} מפעילה כרטיס נאמנות דיגיטלי. להלן מה נשמר עליך, למה, ומה הזכויות שלך.</p>
<div class="panel"><h2>איזה מידע נשמר</h2><ul>
<li>שם וטלפון, כפי שהזנת בהצטרפות.</li>
<li>יום וחודש הולדת (בלי שנה), רק אם בחרת למלא.</li>
<li>מספר החותמות, מימוש מתנות ותאריכי הפעולות.</li>
<li>האם אישרת קבלת הודעות שיווקיות.</li></ul>
<p>איננו אוספים כתובת, תעודת זהות, מיקום או פרטי תשלום.</p></div>
<div class="panel"><h2>למה</h2>
<p>לנהל את הכרטיס שלך, להוסיף חותמות, לתת מתנה כשמגיעה, ולזהות אותך אם איבדת את הקישור. מתנת יום הולדת ניתנת רק אם מילאת תאריך.</p>
<p>הודעות שיווקיות יישלחו רק אם סימנת הסכמה, ואפשר לבטל אותה בכל עת בפנייה אלינו. נכון להיום איננו שולחים הודעות אוטומטיות.</p></div>
<div class="panel"><h2>עם מי המידע משותף</h2>
<p>איננו מוכרים או מעבירים את המידע לצדדים שלישיים לצורכי שיווק. המידע מאוחסן אצל Cloudflare, ספק האחסון שלנו, ועשוי להישמר בשרתים מחוץ לישראל.</p></div>
<div class="panel"><h2>כמה זמן נשמר</h2>
<p>כרטיס שלא נעשה בו שימוש ${retentionMonths} חודשים נמחק אוטומטית יחד עם הפרטים שלו. אפשר לבקש מחיקה מוקדם יותר בכל עת.</p></div>
<div class="panel"><h2>הזכויות שלך</h2>
<p>את/ה רשאי/ת לבקש לראות את המידע שנשמר עליך, לתקן אותו או למחוק אותו. פנו אלינו בטלפון: <a href="tel:${c}" dir="ltr">${c}</a>. נטפל בפנייה בהקדם.</p></div>
<div class="panel"><h2>אבטחה</h2>
<p>הגישה לנתונים מוגבלת לבעלת העסק בלבד, עם קוד כניסה אישי. השימוש באתר מוצפן (HTTPS). הכרטיס שלך מזוהה בקישור אישי וארוך שקשה לנחש, ולכן אל תשתפו אותו עם אחרים.</p>
<p><small>מה נשמר בדפדפן שלך: קישור הכרטיס, כדי שתוכלו לחזור אליו. אין עוגיות מעקב או פרסום.</small></p></div>${foot}`
}
