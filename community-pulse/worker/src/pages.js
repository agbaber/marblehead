// Serve verify.html and branches.html as full pages from the worker.
// Pulls CSS and fonts from the production site so the pages look real.
// Used for staging/preview — in production these are served by GitHub Pages.

const SITE = 'https://marbleheaddata.org';

function shell(title, bodyClass, content, origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<script>(function(){var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t)})()</script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>${title} - Marblehead Budget Data</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${SITE}/assets/site.css">
<link rel="icon" href="${SITE}/favicon.svg" type="image/svg+xml">
<style>
.addr-row{display:flex;gap:.5rem;align-items:flex-start}
.addr-num{width:4.5rem;flex:0 0 4.5rem}
.addr-num input{width:100%;box-sizing:border-box}
.addr-street-wrap{flex:1 1 auto;position:relative;min-width:0}
.addr-street-wrap input{width:100%;box-sizing:border-box}
.ta-list{position:absolute;top:100%;left:0;right:0;max-height:200px;overflow-y:auto;background:var(--bg,#fff);border:1px solid var(--c-text-faint,#ccc);border-top:none;border-radius:0 0 var(--radius-sm,4px) var(--radius-sm,4px);z-index:100;display:none;margin:0;padding:0;list-style:none}
.ta-list.open{display:block}
.ta-item{padding:.4rem .8rem;cursor:pointer;font-size:.9rem;color:var(--c-text,#1a1a1a)}
.ta-item:hover,.ta-item.active{background:var(--surface,#f0f0f0)}
</style>
<script>
// Typeahead for Marblehead street names.
(function(){
  var streets=null;
  function loadStreets(cb){if(streets)return cb(streets);fetch(location.origin+'/api/streets').then(function(r){return r.json()}).then(function(s){streets=s;cb(s)}).catch(function(){cb([])})}
  window.initTypeahead=function(inputId,listId){
    var input=document.getElementById(inputId);var list=document.getElementById(listId);if(!input||!list)return;
    var items=[];var activeIdx=-1;
    input.addEventListener('input',function(){
      var v=input.value.trim().toLowerCase();if(v.length<1){list.classList.remove('open');return}
      loadStreets(function(ss){
        var matches=ss.filter(function(s){return s.toLowerCase().indexOf(v)===0}).slice(0,10);
        list.innerHTML='';items=[];activeIdx=-1;
        matches.forEach(function(m){var li=document.createElement('li');li.className='ta-item';li.textContent=m;li.addEventListener('mousedown',function(e){e.preventDefault();input.value=m;list.classList.remove('open')});list.appendChild(li);items.push(li)});
        list.classList.toggle('open',matches.length>0);
      });
    });
    input.addEventListener('keydown',function(e){
      if(!list.classList.contains('open'))return;
      if(e.key==='ArrowDown'){e.preventDefault();activeIdx=Math.min(activeIdx+1,items.length-1);upd()}
      else if(e.key==='ArrowUp'){e.preventDefault();activeIdx=Math.max(activeIdx-1,0);upd()}
      else if(e.key==='Enter'&&activeIdx>=0){e.preventDefault();input.value=items[activeIdx].textContent;list.classList.remove('open')}
      else if(e.key==='Escape'){list.classList.remove('open')}
    });
    input.addEventListener('blur',function(){setTimeout(function(){list.classList.remove('open')},150)});
    function upd(){items.forEach(function(li,i){li.classList.toggle('active',i===activeIdx)})}
  };
})();
</script>
</head>
<body class="${bodyClass}">
<nav class="site-nav"><div class="nav-inner">
<a class="nav-brand" href="${SITE}/"><img class="nav-logo" src="${SITE}/favicon.svg" alt="" width="22" height="22"> MHD Data</a>
<a href="${origin}/verify">Verify</a>
<a href="${origin}/branches">Branches</a>
<button class="theme-toggle" aria-label="Toggle light/dark mode" title="Toggle light/dark mode">
<svg class="theme-icon theme-icon--sun" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><circle cx="10" cy="10" r="4"/><path d="M10 1v2M10 17v2M1 10h2M17 10h2M3.5 3.5l1.4 1.4M15.1 15.1l1.4 1.4M3.5 16.5l1.4-1.4M15.1 4.9l1.4-1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>
<svg class="theme-icon theme-icon--moon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M17.3 13.4A7.5 7.5 0 016.6 2.7a8 8 0 1010.7 10.7z"/></svg>
</button>
</div></nav>
<script>(function(){var b=document.querySelector('.theme-toggle');if(b)b.addEventListener('click',function(){var c=document.documentElement.getAttribute('data-theme'),n=c==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',n);localStorage.setItem('theme',n)})})()</script>
${content}
<footer class="footer">
<nav class="footer-links" aria-label="Site footer">
<a href="${SITE}/about.html">About</a>
<a href="${SITE}/privacy.html">Privacy</a>
<a href="https://github.com/agbaber/marblehead">Source</a>
</nav>
<p class="footer-meta">Built by a Marblehead resident</p>
</footer>
</body></html>`;
}

export function serveVerifyPage(origin) {
  const API = origin;
  const content = `
<style>
body.verify-page .page{max-width:var(--page-max,760px);margin:0 auto;padding:4.5rem var(--gutter,16px) 2rem}
body.verify-page .verify-section{margin:2rem 0}
body.verify-page .verify-card{background:var(--surface,#f8f8f8);border-radius:var(--radius-lg,12px);padding:1.5rem;margin:1rem 0}
body.verify-page label{display:block;margin-top:.75rem;margin-bottom:.25rem}
body.verify-page input[type="text"],body.verify-page input[type="search"]{display:block;width:100%;padding:.6rem .8rem;font-size:1rem;border:1px solid var(--c-text-faint,#ccc);border-radius:var(--radius-sm,4px);margin:.4rem 0;box-sizing:border-box;background:var(--bg,#fff);color:var(--c-text,#1a1a1a);-webkit-appearance:none;appearance:none}
body.verify-page .btn{display:inline-block;padding:.7rem 1.4rem;font-size:1rem;font-weight:600;border:none;border-radius:var(--radius-md,8px);cursor:pointer;margin:.5rem .5rem .5rem 0}
body.verify-page .btn-primary{background:var(--c-navy,#1b3a5c);color:#fff}
body.verify-page .btn-secondary{background:var(--surface,#f0f0f0);color:var(--c-text,#1a1a1a);border:1px solid var(--c-text-faint,#ccc)}
body.verify-page .btn:hover{filter:brightness(1.1)}
body.verify-page .btn:focus-visible{outline:2px solid var(--c-teal,#2a9d8f);outline-offset:2px}
body.verify-page .btn:disabled{opacity:.5;cursor:not-allowed}
body.verify-page input:focus-visible{outline:2px solid var(--c-teal,#2a9d8f);outline-offset:1px}
body.verify-page .status{padding:1rem;border-radius:var(--radius-sm,4px);margin:1rem 0;font-size:.9rem}
body.verify-page .status-ok{background:color-mix(in srgb,var(--c-teal,#2a9d8f) 15%,var(--bg,#fff));color:var(--c-teal,#2a9d8f)}
body.verify-page .status-err{background:color-mix(in srgb,#c62828 15%,var(--bg,#fff));color:#e57373}
body.verify-page .status-info{background:color-mix(in srgb,var(--c-navy,#1b3a5c) 15%,var(--bg,#fff));color:var(--c-link,#5ba3d9)}
body.verify-page .recovery-key{font-family:var(--font-mono,monospace);font-size:1.1rem;font-weight:700;letter-spacing:.05em;padding:1rem;background:color-mix(in srgb,var(--c-brass,#d4a843) 15%,var(--bg,#fff));border:2px dashed var(--c-brass,#d4a843);border-radius:var(--radius-sm,4px);text-align:center;margin:1rem 0;color:var(--c-brass,#d4a843)}
body.verify-page .invite-link{font-family:var(--font-mono,monospace);font-size:.85rem;word-break:break-all;padding:.8rem;background:var(--surface,#f5f5f5);border-radius:var(--radius-sm,4px);margin:.5rem 0}
body.verify-page .invite-item{margin:1rem 0;padding:1rem;background:var(--surface);border-radius:var(--radius-sm,4px)}
body.verify-page .hidden{display:none}
body.verify-page .branch-badge{display:inline-block;padding:.2rem .6rem;font-size:.85rem;background:var(--c-teal,#2a9d8f);color:#fff;border-radius:var(--radius-sm,4px)}
body.verify-page .vote-topic{margin:.75rem 0;padding:.75rem;background:var(--bg,#fff);border:1px solid var(--c-text-faint,rgba(0,0,0,.1));border-radius:var(--radius-sm,4px)}
body.verify-page .vote-topic-title{font-weight:600;font-size:.9rem;margin-bottom:.5rem}
body.verify-page .vote-bar-row{display:flex;align-items:center;gap:.5rem;margin:.3rem 0;font-size:.85rem}
body.verify-page .vote-bar-label{width:5rem;text-align:right;color:var(--c-text-muted,#666)}
body.verify-page .vote-bar-track{flex:1;height:1.2rem;background:var(--surface,#f0f0f0);border-radius:var(--radius-sm,4px);overflow:hidden}
body.verify-page .vote-bar-fill{height:100%;border-radius:var(--radius-sm,4px);min-width:2px}
body.verify-page .vote-bar-fill-a{background:var(--c-teal,#2a9d8f)}
body.verify-page .vote-bar-fill-b{background:var(--c-brass,#d4a843)}
body.verify-page .vote-bar-fill-c{background:var(--c-plum,#8e6b99)}
body.verify-page .vote-bar-fill-u{background:var(--c-text-faint,#999)}
body.verify-page .vote-bar-count{width:2rem;font-size:.8rem;color:var(--c-text-muted,#666)}
body.verify-page .invitees-list{margin:.5rem 0}
body.verify-page .invitee-row{display:flex;align-items:center;gap:.75rem;padding:.4rem 0;font-size:.9rem}
body.verify-page .invitee-downstream{font-size:.8rem;color:var(--c-text-muted,#666)}
</style>
<div class="page">
<div id="state-loading"><h1>Verify</h1><p>Loading...</p></div>

<div id="state-landing" class="hidden">
<h1>Verified Residents</h1>
<p>The neighbor verification network lets Marblehead residents cast deduplicated, verified votes on ballot questions and site sections. Each verified resident was personally invited by someone who already verified.</p>
<div class="verify-card"><h2>Know someone who's verified?</h2><p>Ask them for an invite link. They enter your name and address when creating the invite, and you enter the same info when redeeming it. Both sides have to match.</p></div>
<div class="verify-card"><h2>Want to start a new branch?</h2><p>If nobody in your neighborhood is verified yet, you can request a seed invite to start your own branch.</p><a class="btn btn-secondary" href="https://github.com/agbaber/marblehead/issues/new?template=branch-request.md&title=Branch+request">Request a branch invite</a><p class="notes">Requests are vetted against the Marblehead assessor database and voter rolls.</p></div>
</div>

<div id="state-invite" class="hidden">
<h1>You've been invited</h1>
<p>Someone invited you to join the Marblehead neighbor verification network. Enter your name and street address exactly as your inviter knows them.</p>
<div class="verify-card">
<label for="reg-name"><strong>Your name</strong></label><input type="search" id="reg-name" placeholder="First and last name" autocomplete="off" data-1p-ignore data-lpignore="true">
<label><strong>Your street address</strong></label>
<div class="addr-row"><div class="addr-num"><input type="search" id="reg-num" placeholder="#" autocomplete="off" data-1p-ignore data-lpignore="true"></div><div class="addr-street-wrap"><input type="search" id="reg-street" placeholder="Street name" autocomplete="off" data-1p-ignore data-lpignore="true"><ul class="ta-list" id="reg-street-ta"></ul></div></div>
<button class="btn btn-primary" id="btn-register">Verify my identity</button>
</div>
<div id="reg-status" class="hidden"></div>
</div>

<div id="state-registered" class="hidden">
<h1>You're verified</h1>
<div class="status status-ok" id="reg-success-msg"></div>
<div class="verify-card"><h2>Your backup code</h2><p>This is your spare key. Screenshot it or write it down. If you ever lose access to your devices, this code lets you get back in.</p><div class="recovery-key" id="recovery-key-display"></div><p class="notes">Shown once. Save it now.</p></div>
<button class="btn btn-primary" id="btn-go-dashboard">Continue to dashboard</button>
</div>

<div id="state-dashboard" class="hidden">
<h1>Verified Resident</h1>
<div class="verify-card" id="profile-card">
<p><strong>Branch:</strong> <span id="dash-branch-name">&mdash;</span> <span class="branch-badge" id="dash-branch-size"></span> <a href="/branches" style="font-size:.85rem;margin-left:.5rem">All branches</a></p>
<p><strong>Invites remaining:</strong> <span id="dash-invites">&mdash;</span></p>
</div>


<div class="verify-section hidden" id="branch-votes-section">
<h2>Your branch's picks</h2>
<p style="font-size:.85rem;color:var(--c-text-muted,#666)">Shows after you pick. Same questions as the homepage.</p>
<div id="branch-votes-list"></div>
</div>

<div class="verify-section hidden" id="invitees-section">
<h2>Your invites</h2>
<div id="invitees-list" class="invitees-list"></div>
</div>

<div class="verify-section"><h2>Invite a neighbor</h2><p>Enter their name and address. They'll need to enter the same info to redeem the invite.</p>
<label for="inv-name"><strong>Neighbor's name</strong></label><input type="search" id="inv-name" placeholder="First and last name" autocomplete="off" data-1p-ignore data-lpignore="true">
<label><strong>Neighbor's address</strong></label>
<div class="addr-row"><div class="addr-num"><input type="search" id="inv-num" placeholder="#" autocomplete="off" data-1p-ignore data-lpignore="true"></div><div class="addr-street-wrap"><input type="search" id="inv-street" placeholder="Street name" autocomplete="off" data-1p-ignore data-lpignore="true"><ul class="ta-list" id="inv-street-ta"></ul></div></div>
<button class="btn btn-primary" id="btn-invite">Create invite</button>
<div id="inv-status" class="hidden"></div></div>


<div class="verify-section"><h2>Add another device</h2><p>Register a passkey on this device so you can authenticate here too.</p><button class="btn btn-secondary" id="btn-add-device">Add this device</button><div id="device-status" class="hidden"></div></div>

<div class="verify-section"><button class="btn btn-secondary" id="btn-signout">Sign out</button></div>
</div>
</div>

<script type="module">
import{client}from'https://cdn.jsdelivr.net/npm/@passwordless-id/webauthn@2.3.5/dist/esm/index.js';
const API='${API}';
let jwt=sessionStorage.getItem('verify_jwt')||null;
let currentProfile=null;

function show(id){document.getElementById(id).classList.remove('hidden')}
function hide(id){document.getElementById(id).classList.add('hidden')}
function showStatus(id,msg,type){const el=document.getElementById(id);el.className='status status-'+type;el.textContent=msg;show(id)}
function headers(){const h={'Content-Type':'application/json'};if(jwt)h['Authorization']='Bearer '+jwt;return h}
async function computeHash(n,a){const i=n.toLowerCase().trim()+':'+a.toLowerCase().trim()+':marblehead-verify-salt';const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(i));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function api(m,p,b){const o={method:m,headers:headers()};if(b)o.body=JSON.stringify(b);return(await fetch(API+p,o)).json()}

async function init(){
  const h=location.hash;
  // Parse hash: #invite=TOKEN&n=16&i=A
  var tok=null,hintNum='',hintInitial='';
  if(h.startsWith('#invite=')){
    var parts=h.slice(1).split('&');
    for(var p of parts){
      var kv=p.split('=');
      if(kv[0]==='invite')tok=decodeURIComponent(kv[1]);
      else if(kv[0]==='n')hintNum=decodeURIComponent(kv[1]);
      else if(kv[0]==='i')hintInitial=decodeURIComponent(kv[1]);
    }
  }
  if(tok){
    hide('state-loading');show('state-invite');
    document.getElementById('btn-register').dataset.token=tok;
    if(hintNum)document.getElementById('reg-num').value=hintNum;
    if(hintInitial){document.getElementById('reg-name').value=hintInitial;document.getElementById('reg-name').placeholder=hintInitial+'...'}
    return;
  }
  if(jwt){try{const p=await api('GET','/api/verify/me');if(p.identity_hash){currentProfile=p;showDashboard(p);return}else{console.log('/me response:',JSON.stringify(p))}}catch(e){console.error('/me failed:',e)}jwt=null;sessionStorage.removeItem('verify_jwt')}
  hide('state-loading');show('state-landing');
}

// Pending registration data — stored between the two button taps.
var pendingReg=null;

document.getElementById('btn-register').addEventListener('click',async()=>{
  const name=document.getElementById('reg-name').value.trim();
  const address=(document.getElementById('reg-num').value.trim()+' '+document.getElementById('reg-street').value.trim()).trim();
  const token=document.getElementById('btn-register').dataset.token;
  if(!name||!address){showStatus('reg-status','Please enter your name and address.','err');return}
  var regBtn=document.getElementById('btn-register');
  regBtn.disabled=true;regBtn.textContent='Verifying...';
  try{
    showStatus('reg-status','Checking your invite...','info');
    const id=await computeHash(name,address);
    const reg=await api('POST','/api/verify/register',{identity_hash:id,invite_token:token});
    if(!reg.ok){showStatus('reg-status',reg.error||'Registration failed.','err');return}
    // Store for passkey step and show the passkey button.
    pendingReg={id,reg,invite_token:token};
    const el=document.getElementById('reg-status');
    el.className='status status-ok';
    el.innerHTML='Confirmed! Now save a passkey so you can sign in later.<br><button class="btn btn-primary" id="btn-passkey" style="margin-top:.75rem">Save passkey (Touch ID / Face ID)</button>';
    show('reg-status');
    document.getElementById('btn-passkey').addEventListener('click',finishPasskey);
  }catch(e){showStatus('reg-status','Error: '+e.message,'err');regBtn.disabled=false;regBtn.textContent='Verify my identity'}
});

async function finishPasskey(){
  if(!pendingReg)return;
  const{id,reg,invite_token}=pendingReg;
  try{
    const bc=reg.challenge.split('.')[0];
    const registration=await client.register({user:id,challenge:bc});
    showStatus('reg-status','Completing registration...','info');
    const pk=await api('POST','/api/verify/passkey/register',{registration,challenge:reg.challenge,identity_hash:id,invite_token:invite_token});
    if(!pk.ok){showStatus('reg-status',pk.error||'Passkey registration failed.','err');return}
    jwt=pk.token;sessionStorage.setItem('verify_jwt',jwt);
    pendingReg=null;
    // Clear invite hash so back button doesn't re-show the invite form.
    if(history.replaceState)history.replaceState(null,'',location.pathname);
    hide('state-invite');hide('reg-status');show('state-registered');
    document.getElementById('recovery-key-display').textContent=pk.recovery_key;
    document.getElementById('reg-success-msg').textContent='Welcome! You are now a verified Marblehead resident.';
  }catch(e){showStatus('reg-status','Error: '+e.message,'err')}
}

document.getElementById('btn-go-dashboard').addEventListener('click',async()=>{const p=await api('GET','/api/verify/me');if(p.identity_hash){currentProfile=p;showDashboard(p)}});

async function loadBranchVotes(branchRoot){
  const container=document.getElementById('branch-votes-list');
  if(!container)return;
  const topics=['override','voteno','schools','levy','taxrank','mycost','size','again','alternatives','trash'];
  const labels={
    override:'Is this override necessary?',
    voteno:'What happens if it fails?',
    schools:'Are the schools the priority?',
    levy:'Is the levy sustainable?',
    taxrank:'How does our tax rank compare?',
    mycost:'What does it cost me?',
    size:'Is the override the right size?',
    again:'Will they come back for more?',
    alternatives:'Are there alternatives?',
    trash:'Trash: levy or fee?'
  };
  const answerLabels={a:'Answer A',b:'Answer B',c:'Answer C',u:'Not sure yet'};
  var hasAny=false;
  for(const topic of topics){
    try{
      const data=await api('GET','/api/verify/branches/'+encodeURIComponent(branchRoot)+'/votes?topic='+topic);
      if(data.breakdown){
        hasAny=true;
        const div=document.createElement('div');div.className='vote-topic';
        var total=Object.values(data.breakdown).reduce(function(s,v){return s+v},0);
        var html='<div class="vote-topic-title">'+(labels[topic]||topic)+' ('+total+' votes)</div>';
        ['a','b','c','u'].forEach(function(key){
          var count=data.breakdown[key]||0;
          var pct=total>0?Math.round(count/total*100):0;
          html+='<div class="vote-bar-row"><span class="vote-bar-label">'+(answerLabels[key]||key)+'</span><div class="vote-bar-track"><div class="vote-bar-fill vote-bar-fill-'+key+'" style="width:'+pct+'%"></div></div><span class="vote-bar-count">'+count+'</span></div>';
        });
        div.innerHTML=html;
        container.appendChild(div);
      }
    }catch(e){}
  }
  if(hasAny)show('branch-votes-section');
}

function showDashboard(p){
  hide('state-loading');hide('state-landing');hide('state-invite');hide('state-registered');show('state-dashboard');
  console.log('Dashboard data:',JSON.stringify(p,null,2));
  document.getElementById('dash-branch-name').textContent=p.branch_name||'(unnamed)';
  document.getElementById('dash-branch-size').textContent=p.branch_size+' resident'+(p.branch_size!==1?'s':'');
  document.getElementById('dash-invites').textContent=p.invites_remaining;

  // Load branch vote breakdown
  loadBranchVotes(p.branch_root);

  // Show invites (merged: pending + joined)
  const invList=document.getElementById('invitees-list');
  invList.innerHTML='';
  if(p.invites&&p.invites.length>0){
    show('invitees-section');
    for(const inv of p.invites){
      const row=document.createElement('div');row.className='invitee-row';
      const name=inv.label||'Someone';
      if(inv.status==='joined'){
        const growth=inv.downstream>0?' and invited '+inv.downstream+' more':'';
        row.innerHTML='<span style="color:var(--c-teal,#2a9d8f)">&#10003;</span> <span>'+name+'</span><span class="invitee-downstream"> joined'+growth+'</span>';
      }else{
        row.innerHTML='<span style="color:var(--c-brass,#d4a843)">&#9203;</span> <span>'+name+'</span><span class="invitee-downstream"> pending</span>';
        const sb=document.createElement('button');sb.className='btn btn-secondary';sb.style.cssText='padding:.2rem .6rem;font-size:.75rem;margin-left:.5rem';sb.textContent='Resend';sb.addEventListener('click',function(){shareInvite(inv.invite_url)});row.appendChild(sb);
      }
      invList.appendChild(row);
    }
  }
}

document.getElementById('btn-invite').addEventListener('click',async()=>{
  const name=document.getElementById('inv-name').value.trim();const address=(document.getElementById('inv-num').value.trim()+' '+document.getElementById('inv-street').value.trim()).trim();
  if(!name||!address){showStatus('inv-status','Enter your neighbor'+String.fromCharCode(39)+'s name and address.','err');return}
  try{
    showStatus('inv-status','Creating invite...','info');
    // Build a short display label: "J. Smith" style.
    var parts=name.split(/\s+/);
    var label=parts.length>1?parts[0].charAt(0)+'. '+parts[parts.length-1]:name;
    const rh=await computeHash(name,address);const data=await api('POST','/api/verify/invite',{recipient_hash:rh,recipient_label:label});
    if(!data.ok){showStatus('inv-status',data.error||'Failed.','err');return}
    // Append hints to the invite URL: house number + first letter of name.
    var num=document.getElementById('inv-num').value.trim();
    var initial=name.charAt(0).toUpperCase();
    var hintUrl=data.invite_url+'&n='+encodeURIComponent(num)+'&i='+encodeURIComponent(initial);
    showInviteLink(hintUrl);
    if(navigator.share){try{await navigator.share({title:'Marblehead Verification Invite',text:"I am a verified Marblehead resident. Here is your invite",url:hintUrl})}catch{}}
    document.getElementById('inv-name').value='';document.getElementById('inv-num').value='';document.getElementById('inv-street').value='';
    const p=await api('GET','/api/verify/me');if(p.identity_hash)showDashboard(p);
  }catch(e){showStatus('inv-status','Error: '+e.message,'err')}
});

function showInviteLink(url){const el=document.getElementById('inv-status');el.className='status status-ok';el.innerHTML='Invite created!<div class="invite-link" style="margin-top:.5rem">'+url+'</div>';const cb=document.createElement('button');cb.className='btn btn-secondary';cb.style.marginTop='.5rem';cb.textContent='Copy link';cb.addEventListener('click',()=>copyText(url));el.appendChild(cb);show('inv-status')}

document.getElementById('btn-add-device').addEventListener('click',async()=>{
  try{showStatus('device-status','Requesting challenge...','info');
  const c=await api('POST','/api/verify/passkey/auth-challenge');const bc=c.challenge.split('.')[0];
  showStatus('device-status','Creating passkey...','info');
  const reg=await client.register({user:currentProfile.identity_hash,challenge:bc});
  const d=await api('POST','/api/verify/passkey/add-device',{registration:reg,challenge:c.challenge});
  showStatus('device-status',d.ok?'Passkey added!':d.error||'Failed.',d.ok?'ok':'err');
  }catch(e){showStatus('device-status','Error: '+e.message,'err')}
});

window.signIn=async function(){
  var signInBtn=document.querySelector('[onclick="signIn()"]');
  if(signInBtn){signInBtn.disabled=true;signInBtn.textContent='Signing in...'}
  try{
    const c=await api('POST','/api/verify/passkey/auth-challenge');const bc=c.challenge.split('.')[0];
    if(!c.credentialIds||c.credentialIds.length===0){
      if(signInBtn){signInBtn.disabled=false;signInBtn.textContent='Sign in'}
      alert('No verified residents found yet. Get an invite link to register.');return;
    }
    const auth=await client.authenticate({challenge:bc,allowCredentials:c.credentialIds});
    const r=await api('POST','/api/verify/passkey/auth',{authentication:auth,challenge:c.challenge});
    if(r.ok&&r.token){jwt=r.token;sessionStorage.setItem('verify_jwt',jwt);const p=await api('GET','/api/verify/me');if(p.identity_hash){currentProfile=p;showDashboard(p)}}
  }catch(e){
    if(signInBtn){signInBtn.disabled=false;signInBtn.textContent='Sign in'}
    if(e.name!=='NotAllowedError')console.error('Auth failed:',e);
  }
};

document.getElementById('btn-signout').addEventListener('click',()=>{jwt=null;currentProfile=null;sessionStorage.removeItem('verify_jwt');hide('state-dashboard');hide('state-registered');hide('state-invite');hide('state-loading');show('state-landing');['reg-status','inv-status','device-status'].forEach(id=>hide(id))});
window.shareInvite=async function(u){if(navigator.share){try{await navigator.share({title:'Marblehead Verification Invite',text:"Here's your invite",url:u})}catch{}}else{copyText(u)}};
window.copyText=function(t){navigator.clipboard.writeText(t).then(()=>{const el=document.activeElement;if(el&&el.tagName==='BUTTON'){const o=el.textContent;el.textContent='Copied!';setTimeout(()=>{el.textContent=o},1500)}})};

const landing=document.getElementById('state-landing');
if(landing){const c=document.createElement('div');c.className='verify-card';c.innerHTML='<h2>Already verified?</h2><p>Sign in with your passkey (Touch ID, Face ID, or device PIN).</p><button class="btn btn-primary" onclick="signIn()">Sign in</button>';landing.appendChild(c)}
initTypeahead('reg-street','reg-street-ta');
initTypeahead('inv-street','inv-street-ta');
init();
</script>`;

  return new Response(shell('Verify', 'verify-page', content, origin), {
    status: 200, headers: { 'Content-Type': 'text/html' }
  });
}

export function serveBranchesPage(origin) {
  const API = origin;
  const content = `
<style>
body.branches-page .page{max-width:var(--page-max,760px);margin:0 auto;padding:4.5rem var(--gutter,16px) 2rem}
body.branches-page .branch-list{list-style:none;padding:0;margin:1.5rem 0}
body.branches-page .branch-card{background:var(--surface,#f8f8f8);border-radius:var(--radius-lg,12px);padding:1.2rem 1.5rem;margin:.75rem 0}
body.branches-page .branch-header{display:flex;align-items:baseline;gap:.75rem;flex-wrap:wrap}
body.branches-page .branch-name{font-family:var(--font-heading,'Libre Franklin',sans-serif);font-size:1.1rem;font-weight:700;color:var(--c-text,#1a1a1a)}
body.branches-page .branch-size{font-size:.85rem;color:var(--c-text-muted,#666)}
body.branches-page .summary-bar{display:flex;gap:1.5rem;flex-wrap:wrap;margin:1rem 0;font-size:.95rem;color:var(--c-text-muted,#666)}
body.branches-page .summary-num{font-weight:700;color:var(--c-text,#1a1a1a)}
body.branches-page .empty-state{text-align:center;padding:3rem 1rem;color:var(--c-text-muted,#666)}
body.branches-page .hidden{display:none}
body.branches-page .branch-naming{margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--c-text-faint,rgba(0,0,0,.1))}
body.branches-page .branch-naming h3{font-size:.85rem;color:var(--c-text-muted,#666);margin:0 0 .5rem;font-weight:600}
body.branches-page .propose-row{display:flex;gap:.5rem;margin-top:.5rem}
body.branches-page .propose-input{flex:1;padding:.3rem .6rem;font-size:.85rem;border:1px solid var(--c-text-faint,#ccc);border-radius:var(--radius-sm,4px);background:var(--bg,#fff);color:var(--c-text,#1a1a1a)}
body.branches-page .btn{display:inline-block;padding:.5rem 1rem;font-size:.9rem;font-weight:600;border:none;border-radius:var(--radius-md,8px);cursor:pointer}
body.branches-page .btn-sm{padding:.3rem .7rem;font-size:.8rem}
body.branches-page .btn-primary{background:var(--c-navy,#1b3a5c);color:#fff}
</style>
<div class="page">
<h1>Verification Branches</h1>
<p>Each branch is a cluster of verified Marblehead residents connected through the neighbor invitation network. Each branch gets a random Marblehead Revolutionary War name when it's created.</p>
<div class="summary-bar"><span><span class="summary-num" id="total-residents">--</span> verified residents</span><span><span class="summary-num" id="total-branches">--</span> branches</span></div>
<div id="branch-list-container"><p id="loading-msg">Loading branches...</p></div>
<div id="empty-state" class="empty-state hidden"><p>No branches yet. Be the first to <a href="/verify">get verified</a>.</p></div>
</div>
<script type="module">
const API='${API}';
let jwt=sessionStorage.getItem('verify_jwt')||null;
let myProfile=null;
function headers(){const h={'Content-Type':'application/json'};if(jwt)h['Authorization']='Bearer '+jwt;return h}
async function api(m,p,b){const o={method:m,headers:headers()};if(b)o.body=JSON.stringify(b);return(await fetch(API+p,o)).json()}
function show(id){document.getElementById(id).classList.remove('hidden')}
function hide(id){document.getElementById(id).classList.add('hidden')}

async function init(){
  if(jwt){try{myProfile=await api('GET','/api/verify/me');if(!myProfile||!myProfile.identity_hash)myProfile=null}catch{myProfile=null}}
  let data;try{data=await api('GET','/api/verify/branches')}catch{document.getElementById('loading-msg').textContent='Failed to load.';return}
  const branches=data.branches||[];
  if(!branches.length){hide('loading-msg');show('empty-state');document.getElementById('total-residents').textContent='0';document.getElementById('total-branches').textContent='0';return}
  document.getElementById('total-residents').textContent=branches.reduce((s,b)=>s+b.size,0);
  document.getElementById('total-branches').textContent=branches.length;
  branches.sort((a,b)=>b.size-a.size);
  const container=document.getElementById('branch-list-container');container.innerHTML='';
  const list=document.createElement('ul');list.className='branch-list';
  for(const branch of branches){
    const li=document.createElement('li');li.className='branch-card';
    const hdr=document.createElement('div');hdr.className='branch-header';
    const nm=document.createElement('span');nm.className='branch-name';nm.textContent=branch.name||'(unnamed)';
    const sz=document.createElement('span');sz.className='branch-size';sz.textContent=branch.size+' resident'+(branch.size!==1?'s':'');
    hdr.appendChild(nm);hdr.appendChild(sz);li.appendChild(hdr);
    if(myProfile&&myProfile.branch_root===branch.branch_root){
      const badge=document.createElement('span');badge.style.cssText='font-size:.8rem;color:var(--c-teal,#2a9d8f);margin-left:.5rem';badge.textContent='(your branch)';hdr.appendChild(badge);
      // Rename UI
      const renameDiv=document.createElement('div');
      renameDiv.style.cssText='margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--c-text-faint,rgba(0,0,0,.1))';
      renameDiv.innerHTML='<div style="font-size:.85rem;color:var(--c-text-muted,#666);font-weight:600;margin-bottom:.5rem">Vote to rename</div><div style="display:flex;gap:.5rem;align-items:center"><select id="rename-select" style="flex:1;padding:.4rem .6rem;font-size:.9rem;border:1px solid var(--c-text-faint,#ccc);border-radius:var(--radius-sm,4px);background:var(--bg,#fff);color:var(--c-text,#1a1a1a)"><option value="">Loading names...</option></select><button class="btn btn-sm btn-primary" id="btn-rename">Vote</button></div><div id="rename-status" style="font-size:.85rem;margin-top:.4rem"></div>';
      li.appendChild(renameDiv);
      // Load available names
      loadAvailableNames(branch.branch_root);
    }
    list.appendChild(li);
  }
  container.appendChild(list);
}

async function loadAvailableNames(branchRoot){
  try{
    const data=await api('GET','/api/verify/branch-name/available');
    const sel=document.getElementById('rename-select');
    if(!sel)return;
    sel.innerHTML='';
    const current=document.createElement('option');current.value='';current.textContent='Keep: '+(data.current_name||'(unnamed)');sel.appendChild(current);
    for(const n of (data.available||[])){
      const opt=document.createElement('option');opt.value=n;opt.textContent=n;sel.appendChild(opt);
    }
    document.getElementById('btn-rename').addEventListener('click',async function(){
      const name=sel.value;
      if(!name){document.getElementById('rename-status').textContent='Select a new name first.';return}
      const r=await api('POST','/api/verify/branch-name/vote',{name});
      if(r.ok){
        var msg='Voted for '+name+'. '+r.votes_for+'/'+r.majority_needed+' needed.';
        if(r.current_name===name)msg+=' Name changed!';
        document.getElementById('rename-status').textContent=msg;
      }else{
        document.getElementById('rename-status').textContent=r.error||'Vote failed.';
      }
    });
  }catch(e){console.error(e)}
}

init();
</script>`;

  return new Response(shell('Branches', 'branches-page', content, origin), {
    status: 200, headers: { 'Content-Type': 'text/html' }
  });
}
