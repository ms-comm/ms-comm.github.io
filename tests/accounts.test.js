/* Phase 2 verification: account perimeter + download gate.
   Runs against a real server on an isolated DATA_DIR. */
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');

const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'mscomm-acct-'));
fs.mkdirSync(path.join(TMP,'db'),{recursive:true});
fs.mkdirSync(path.join(TMP,'storage/originals'),{recursive:true});
const SERVER=path.join(__dirname,'..','photo-server');

/* Seed: one free photo in a public album, and one past order made with the
   same email the test account will register with. */
const PHOTO_ID='photo-1';
fs.writeFileSync(path.join(TMP,'db','albums.json'),JSON.stringify([
  {id:'alb-1',name:'Public',type:'public'}
]));
fs.writeFileSync(path.join(TMP,'db','photos.json'),JSON.stringify([
  {id:PHOTO_ID,title:'Photo 1',albumId:'alb-1',downloadType:'free',ext:'.jpg',flickrOriginalId:null}
]));
fs.writeFileSync(path.join(TMP,'db','orders.json'),JSON.stringify([
  {id:'ord-1',status:'completed',total:42.5,createdAt:'2026-01-05T10:00:00.000Z',
   completedAt:'2026-01-05T10:00:00.000Z',customer:{email:'Lois@Example.com',firstName:'Lois',lastName:'ADAM'},
   photos:[{photoId:PHOTO_ID,title:'Photo 1',downloadToken:'tok-1'}],orderDownloadToken:'otok-1'}
]));
fs.writeFileSync(path.join(TMP,'db','settings.json'),JSON.stringify({adminUsername:'mel',adminPassword:'x'}));

const PORT=3971;
const BASE='http://127.0.0.1:'+PORT;
const child=cp.spawn(process.execPath,['server.js'],{cwd:SERVER,env:Object.assign({},process.env,{
  PORT:String(PORT),DATA_DIR:TMP,NODE_ENV:'development',SESSION_SECRET:'test-secret',
  SESSION_DIR:path.join(TMP,'sessions')}),stdio:['ignore','pipe','pipe']});
let log='';
child.stdout.on('data',d=>{log+=d;});child.stderr.on('data',d=>{log+=d;});

let fails=0,passes=0;
function check(name,cond,extra){ if(cond){passes++;console.log('  PASS '+name);} else {fails++;console.log('  FAIL '+name+(extra?' -> '+extra:''));} }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* Minimal cookie jar. */
function jar(){return{c:{},header(){return Object.entries(this.c).map(([k,v])=>k+'='+v).join('; ');},
  take(res){const sc=res.headers.getSetCookie?res.headers.getSetCookie():[];
    for(const s of sc){const kv=s.split(';')[0];const i=kv.indexOf('=');this.c[kv.slice(0,i)]=kv.slice(i+1);}}};}

async function req(method,url,{body,cookies}={}){
  const headers={};
  if(body) headers['Content-Type']='application/json';
  if(cookies){const h=cookies.header();if(h)headers.Cookie=h;}
  const res=await fetch(BASE+url,{method,headers,body:body?JSON.stringify(body):undefined,redirect:'manual'});
  if(cookies)cookies.take(res);
  let data=null;const ct=res.headers.get('content-type')||'';
  if(ct.includes('json')){try{data=await res.json();}catch{}}else{try{await res.arrayBuffer();}catch{}}
  return {status:res.status,data};
}

(async()=>{
  for(let i=0;i<60;i++){try{const r=await fetch(BASE+'/api/health');if(r.ok)break;}catch{}await sleep(300);}

  console.log('\n1. Anonymous browsing stays open');
  let r=await req('GET','/api/public/albums');
  check('GET /albums 200 anonymous', r.status===200, r.status);
  r=await req('GET','/api/public/photos');
  check('GET /photos 200 anonymous', r.status===200, r.status);

  console.log('\n2. Anonymous downloads are refused on every exit point');
  r=await req('GET','/api/public/photos/'+PHOTO_ID+'/download?resolution=original');
  check('photo download 401', r.status===401 && r.data && r.data.code==='ACCOUNT_REQUIRED', r.status+' '+JSON.stringify(r.data));
  r=await req('POST','/api/public/albums/alb-1/download',{body:{mode:'watermark'}});
  check('album ZIP 401', r.status===401 && r.data.code==='ACCOUNT_REQUIRED', r.status);
  r=await req('POST','/api/public/albums/alb-1/download-check',{body:{mode:'watermark'}});
  check('download-check 401', r.status===401 && r.data.code==='ACCOUNT_REQUIRED', r.status);
  r=await req('GET','/api/public/albums/alb-1/download-urls?mode=watermark');
  check('download-urls 401', r.status===401 && r.data.code==='ACCOUNT_REQUIRED', r.status);

  console.log('\n3. Registration attaches the pre-existing order (email key, case-insensitive)');
  const client=jar();
  r=await req('POST','/api/account/register',{cookies:client,body:{email:'lois@example.com',password:'motdepasse123',firstName:'Lois',lastName:'ADAM'}});
  check('register 201', r.status===201, r.status+' '+JSON.stringify(r.data));
  check('no passwordHash leaked', r.data && r.data.account && r.data.account.passwordHash===undefined);
  check('past order attached', r.data && r.data.counts && r.data.counts.orders===1, JSON.stringify(r.data&&r.data.counts));
  check('total spent computed', r.data && r.data.counts.totalSpent===42.5, JSON.stringify(r.data&&r.data.counts));
  const ticket=r.data && r.data.dlTicket;
  check('download ticket issued', typeof ticket==='string' && ticket.length>20);
  const orders=JSON.parse(fs.readFileSync(path.join(TMP,'db','orders.json'),'utf8'));
  check('orders.json carries accountId', !!orders[0].accountId);

  console.log('\n4. Duplicate email is refused');
  r=await req('POST','/api/account/register',{body:{email:'LOIS@example.com',password:'motdepasse123'}});
  check('duplicate 409', r.status===409, r.status);

  console.log('\n5. Weak password is refused');
  r=await req('POST','/api/account/register',{body:{email:'other@example.com',password:'court'}});
  check('short password 400', r.status===400, r.status);

  console.log('\n6. A signed-in client can download');
  r=await req('GET','/api/public/photos/'+PHOTO_ID+'/download?resolution=original',{cookies:client});
  check('session download not 401', r.status!==401, r.status);
  r=await req('GET','/api/public/photos/'+PHOTO_ID+'/download?resolution=original&dlTicket='+encodeURIComponent(ticket));
  check('ticket download not 401 (no cookie)', r.status!==401, r.status);
  r=await req('GET','/api/public/photos/'+PHOTO_ID+'/download?resolution=original&dlTicket=forged.signature');
  check('forged ticket 401', r.status===401, r.status);

  console.log('\n7. Purchase token still works without any account');
  r=await req('GET','/api/orders/ord-1/download-urls?token=otok-1');
  check('order download-urls not 401', r.status!==401, r.status);

  console.log('\n8. Client session cannot reach the admin perimeter');
  r=await req('GET','/api/admin/overview?range=30d',{cookies:client});
  check('admin overview 401 for client', r.status===401, r.status);
  r=await req('GET','/api/admin/clients',{cookies:client});
  check('admin clients 401 for client', r.status===401, r.status);

  console.log('\n9. Favorites round trip');
  r=await req('POST','/api/account/favorites',{cookies:client,body:{photoId:PHOTO_ID}});
  check('add favorite ok', r.status===200 && r.data.added===true, r.status+JSON.stringify(r.data));
  r=await req('POST','/api/account/favorites',{cookies:client,body:{photoId:PHOTO_ID}});
  check('add favorite idempotent', r.status===200 && r.data.added===false);
  r=await req('GET','/api/account/favorites',{cookies:client});
  check('favorites list has 1', r.status===200 && r.data.photos.length===1, JSON.stringify(r.data));
  r=await req('POST','/api/account/favorites',{body:{photoId:PHOTO_ID}});
  check('favorites need account', r.status===401 && r.data.code==='ACCOUNT_REQUIRED', r.status);
  r=await req('DELETE','/api/account/favorites/'+PHOTO_ID,{cookies:client});
  check('remove favorite', r.status===200 && r.data.removed===true);

  console.log('\n10. Login / logout / me');
  r=await req('POST','/api/account/logout',{cookies:client});
  check('logout ok', r.status===200);
  r=await req('GET','/api/account/me',{cookies:client});
  check('me anonymous returns null (not 401)', r.status===200 && r.data.account===null, r.status+JSON.stringify(r.data));
  const c2=jar();
  r=await req('POST','/api/account/login',{cookies:c2,body:{email:'LOIS@Example.com',password:'motdepasse123'}});
  check('login case-insensitive', r.status===200 && r.data.account.email, r.status+JSON.stringify(r.data));
  r=await req('POST','/api/account/login',{body:{email:'lois@example.com',password:'wrongpassword'}});
  check('bad password 401', r.status===401, r.status);
  r=await req('GET','/api/account/orders',{cookies:c2});
  check('orders visible after login', r.status===200 && r.data.orders.length===1, JSON.stringify(r.data));
  r=await req('GET','/api/account/me',{cookies:c2});
  check('lastLoginAt set', r.status===200 && !!r.data.account.lastLoginAt, JSON.stringify(r.data.account));

  console.log('\n11. insights.js now sees a real account');
  delete require.cache[require.resolve(path.join(SERVER,'services','insights.js'))];
  process.env.DATA_DIR=TMP;
  const insights=require(path.join(SERVER,'services','insights.js'));
  const cl=insights.getClients({});
  check('one client, type account', cl.clients.length===1 && cl.clients[0].type==='account', JSON.stringify(cl.clients));
  check('summary accountsEnabled', cl.summary.accountsEnabled===true && cl.summary.totalAccounts===1, JSON.stringify(cl.summary));
  const detail=insights.getClientDetail(cl.clients[0].id);
  check('detail has the order', detail && detail.orders.length===1, JSON.stringify(detail&&detail.orders));
  check('detail timeline has download event', detail && detail.timeline.some(e=>e.type==='download'), JSON.stringify(detail&&detail.timeline));

  console.log('\n'+passes+' passed, '+fails+' failed');
  child.kill();
  if(fails){console.log('\n--- server log ---\n'+log.slice(-3000));}
  process.exit(fails?1:0);
})().catch(e=>{console.error(e);console.log(log.slice(-3000));child.kill();process.exit(1);});

