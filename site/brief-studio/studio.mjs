import {KINDS,METHODS,SECTIONS,fresh,cents,money,escaped,validSource,eligible,
 optimize,parseTsv,toMarkdown,toYaff,briefContent,routePrice} from "./core.mjs";
const $=id=>document.getElementById(id),h=escaped,profiles=["itad","property","supplier","civic"];
let profile="itad",state=fresh(profile),revision=0,dirty=false,db;
let toastTimer=null;
const value=(id)=>$(id).value;
const option=(v,label,current)=>'<option value="'+h(v)+'"'+(v===current?' selected':'')+'>'+h(label)+'</option>';
const notice=(msg,bad=false)=>{
 const el=$("toast");el.textContent=msg;el.style.background=bad?"#f1cebb":"#d4e8c7";
 el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),4200);
};
const op=()=>state.opportunities.find(x=>x.id===state.current);
const isFull=id=>Boolean(op().needs.find(x=>x.id===id));
function currentId(base){let id=String(base).toLowerCase().replace(/[^a-z0-9-]/g,"-").slice(0,62)||"check";let i=2;const all=new Set(op().needs.map(x=>x.id));const original=id;while(all.has(id))id=original.slice(0,56)+"-"+(i++);return id;}
function openDB(){
 return new Promise((resolve,reject)=>{
 const request=indexedDB.open("bonfyre-brief-studio-structured-drafts",1);
 request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains("workspaces"))request.result.createObjectStore("workspaces");};
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||Error("Local workspace unavailable."));
 });
}
function txGet(key){
 return new Promise((resolve,reject)=>{
 const tr=db.transaction("workspaces","readonly"),r=tr.objectStore("workspaces").get(key);
 r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);
 });
}
async function txSave(key,baseRev,payload){
 return new Promise((resolve,reject)=>{
 const tr=db.transaction("workspaces","readwrite"),store=tr.objectStore("workspaces");
 const r=store.get(key);let savedRev=null;
 r.onsuccess=()=>{
  const prev=r.result;
  if((prev?.revision||0)!==baseRev){tr.abort();return;}
  savedRev=baseRev+1;store.put({revision:savedRev,value:structuredClone(payload)},key);
 };
 tr.oncomplete=()=>resolve(savedRev);
 tr.onabort=()=>reject(Error("Another tab changed this workspace. Reload before overwriting it."));
 tr.onerror=()=>reject(tr.error||Error("Unable to save the workspace."));
 });
}
function markDirty(){dirty=true;$("saveStatus").textContent="Unsaved changes";$("saveStatus").style.color="#efbd94";}
async function save(){
 if(!db)throw Error("Your browser did not make local draft storage available.");
 const next=await txSave(profile,revision,state);revision=next;dirty=false;
 $("saveStatus").textContent="Saved on this browser";$("saveStatus").style.color="#b8d5ac";
 return next;
}
async function switchProfile(next){
 if(!profiles.includes(next))throw Error("Unknown domain.");
 if(dirty)await save();
 profile=next;const stored=db?await txGet(profile):null;
 state=stored?.value||fresh(profile);revision=stored?.revision||0;dirty=false;
 render();$("saveStatus").textContent=stored?"Saved draft opened":"Illustrative example opened";
}
const label=(kind)=>KINDS.find(x=>x[0]===kind)?.[1]||kind;
const method=(name)=>METHODS.find(x=>x[0]===name)?.[1]||name;
function renderNeeds(){
 $("needCount").textContent=op().needs.length+" checks";
 $("needsList").innerHTML=op().needs.map((n,i)=>
  '<div class="need-row"><div class="need-main"><span class="need-no">'+String(i+1).padStart(2,"0")+'</span><div><strong>'+h(n.label)+'</strong><small>'+h(label(n.kind))+' · '+(n.weight===5?"Required":n.weight===3?"Important":"Optional")+
  ' · '+h(n.source||"Source missing")+'</small></div></div><select aria-label="Review state for '+h(n.label)+'" data-need-status="'+h(n.id)+'">'+
  option("missing","Not established",n.status)+option("supplied","Source supplied",n.status)+option("reviewed","Reviewed here",n.status)+'</select><button class="delete" type="button" data-remove-need="'+h(n.id)+'" aria-label="Remove '+h(n.label)+'">×</button></div>'
 ).join("")||'<p class="helper">Add the first decision-critical question.</p>';
}
function renderOffers(){
 $("offerList").innerHTML=op().offers.map(r=>
  '<div class="offer-row"><div class="offer-top"><strong>'+h(r.provider)+'</strong><span class="route-price">'+money(r.base+r.labor+r.travel)+'</span></div>'+
  '<div class="offer-meta">'+h(method(r.method))+' · '+h(r.id)+' · '+(r.group!=="-"?"Shared trip "+h(r.group):"No shared trip")+'</div>'+
  '<div class="offer-proof">Addresses: '+(r.coverage.map(id=>op().needs.find(x=>x.id===id)?.label||id).map(h).join("; ")||"No questions assigned")+'</div>'+
  '<div class="offer-foot"><span class="offer-status">'+h(r.quote)+" / "+h(r.availability)+(r.quoteRef?" · ref on file":"")+'</span>'+
  '<button class="delete" type="button" data-remove-offer="'+h(r.id)+'" aria-label="Remove '+h(r.provider)+'">×</button></div></div>'
 ).join("")||'<p class="helper">No verification methods recorded. Add a route.</p>';
}
function result(){
 try{
 const x=optimize(op(),state.budget,state.mode),full=x.status==="candidate_full";
 const statusText={candidate_full:"FULL COVERAGE WITHIN BUDGET",over_budget:"FULL COVERAGE COSTS MORE THAN BUDGET",incomplete:"IMPORTANT QUESTIONS STILL OPEN",no_candidate:"NO ELIGIBLE ROUTES"}[x.status];
 const routes=x.selected.map(r=>'<li>'+h(r.provider)+' · '+h(method(r.method))+' · '+h(r.quote)+' / '+h(r.availability)+'</li>').join("");
 $("routeResult").innerHTML='<div class="result-status">'+statusText+'</div><div class="result-head"><strong>'+money(x.cost)+'</strong><span class="head-note">'+x.covered.size+' / '+op().needs.length+' questions</span></div>'+
 '<p>'+(full?"All required questions have a proposed method. Check actual supplier evidence before committing.":"No route within the selected scope and budget answers every question.")+'</p>'+
 (x.minimumFull!==null&&!full?'<p class="unresolved">Lowest complete route estimate: '+money(x.minimumFull)+'</p>':'')+
 (routes?'<ul class="result-list">'+routes+'</ul>':'')+
 (x.unresolved.length?'<p class="unresolved">Still unanswered: '+h(x.unresolved.map(n=>n.label).join("; "))+'</p>':'')+
 '<p class="helper">Route prices and availability are entered for comparison; the app has not checked providers, booked visits, or approved spending.</p>';
 return x;
 }catch(error){$("routeResult").replaceChildren(document.createTextNode(error.message));return null;}
}
function preview(){
 let b;try{b=briefContent(state);}catch(error){$("paperBody").textContent=error.message;return;}
 $("paperProfile").textContent=state.profile==="itad"?"IT ASSET ACQUISITION":state.profile==="property"?"PROPERTY ACQUISITION":state.profile==="civic"?"CIVIC SOURCE REVIEW":"SUPPLIER PROCUREMENT";
 $("paperTitle").textContent=b.title;
 const sections=[];
 for(const section of b.sections){
  let content="";
  if(section==="Summary")content='<p>'+h(b.op.assertion||"Source description not supplied.")+'</p>';
  if(section==="Source")content='<div class="paper-kv"><span>Reference</span><span>'+h(b.op.subject)+'</span></div>'+
   '<div class="paper-kv"><span>Original</span><span>'+(b.op.source&&validSource(b.op.source)?'<a href="'+h(b.op.source)+'" target="_blank" rel="noopener noreferrer">Read source ↗</a>':"Not linked / unverified")+'</span></div>'+
   '<div class="paper-kv"><span>Recipient</span><span>'+h(b.recipient)+'</span></div>';
  if(section==="Required checks")content='<ul>'+b.op.needs.map(n=>'<li><strong>'+h(n.label)+'</strong> · '+h(n.status==="reviewed"?"Reviewed locally":n.status==="supplied"?"Source supplied":"Unresolved")+'</li>').join("")+'</ul>';
  if(section==="Verification")content='<p><strong>'+money(b.solution.cost)+'</strong> indicative plan · budget '+money(state.budget)+
   ' · '+b.solution.covered.size+' of '+b.op.needs.length+' questions have eligible routes.</p>'+
   (b.solution.selected.length?'<ul>'+b.solution.selected.map(r=>'<li>'+h(r.provider)+' ('+h(method(r.method))+')</li>').join("")+'</ul>':'<p>No eligible route selected.</p>')+
   (b.solution.unresolved.length?'<p>Still open: '+h(b.solution.unresolved.map(x=>x.label).join("; "))+'</p>':'');
  if(section==="Decision")content='<p><strong>'+h({hold:"Hold pending checks",request:"Request verification quote",review:"Ready for buyer review",decline:"Decline opportunity"}[state.decision])+'</strong></p><p>'+h(state.notes||"No review notes supplied.")+'</p>';
  sections.push('<section><h3>'+h(section)+'</h3>'+content+'</section>');
 }
 $("paperBody").innerHTML=sections.join("");
 $("paperFooter").textContent="Illustrative cost plan · Source and proof review required · No dispatch or transaction authorized";
 $("sectionToggles").innerHTML=state.sections.map((n,i)=>
  '<button class="section-toggle" type="button" data-section="'+h(n)+'" aria-pressed="'+(!state.hidden.includes(n))+'">'+h(n)+'</button>'+
  '<button class="section-toggle section-order" type="button" data-up="'+h(n)+'" '+(i===0?"disabled":"")+' title="Move '+h(n)+' earlier" aria-label="Move '+h(n)+' earlier">↑</button>'
 ).join("");
}
function render(){
 for(const b of document.querySelectorAll("[data-profile]"))b.classList.toggle("active",b.dataset.profile===profile);
 const selected=op();if(!selected){state.current=state.opportunities[0]?.id;return;}
 $("recordPicker").innerHTML=state.opportunities.map(x=>option(x.id,x.title,x.id===state.current?x.id:null)).join("");
 $("title").value=selected.title;$("subject").value=selected.subject;$("source").value=selected.source||"";
 $("assertion").value=selected.assertion||"";$("recipient").value=state.recipient;$("briefHeading").value=state.briefHeading;
 $("decision").value=state.decision;$("budget").value=(state.budget/100).toFixed(2);$("planMode").value=state.mode||"exploratory";$("notes").value=state.notes||"";
 $("openSource").href=selected.source&&validSource(selected.source)?selected.source:"#";
 $("openSource").ariaDisabled=selected.source&&validSource(selected.source)?"false":"true";
 $("identityChip").textContent=selected.source?"Original link supplied":"Illustrative / unbound";
 $("needKind").innerHTML=KINDS.map(x=>option(x[0],x[1])).join("");
 $("offerMethod").innerHTML=METHODS.map(x=>option(x[0],x[1])).join("");
 renderNeeds();renderOffers();result();preview();
}
function download(name,body,type){
 const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement("a");
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function makeOpportunity(name,subject,source,assertion){
 const template=state.opportunities[0],id="draft-"+crypto.randomUUID().slice(0,12);
 return {id,title:name||"New acquisition opportunity",subject:subject||"draft:"+id,source:source||"",
 assertion:assertion||"",needs:structuredClone(template?.needs||[]).map(n=>({...n,status:"missing"})),offers:[]};
}
async function safe(fn){try{await fn();}catch(error){notice(error.message||"Action refused",true);}}
function collectField(id,value){
 const o=op();
 if(["title","subject","source","assertion"].includes(id))o[id]=value;
 if(id==="source"){
  const valid=value&&validSource(value);
  $("openSource").href=valid?value:"#";$("openSource").setAttribute("aria-disabled",valid?"false":"true");
  $("identityChip").textContent=valid?"Original link supplied":"Illustrative / unbound";
 }
 else if(["recipient","briefHeading","notes","decision"].includes(id))state[id]=value;
 else if(id==="budget")state.budget=cents(value);
 else if(id==="planMode")state.mode=value;
 else return;
 markDirty();result();preview();
}
document.addEventListener("input",event=>{
 const id=event.target.id;
 if(["title","subject","source","assertion","recipient","briefHeading","notes","budget"].includes(id)){
  try{collectField(id,event.target.value);}catch(e){notice(e.message,true);}
 }
});
document.addEventListener("change",event=>{
 if(["decision","planMode"].includes(event.target.id))collectField(event.target.id,event.target.value);
 const id=event.target.dataset.needStatus;
 if(id){const n=op().needs.find(x=>x.id===id);if(n){n.status=event.target.value;markDirty();preview();}}
});
$("recordPicker").addEventListener("change",()=>{state.current=value("recordPicker");markDirty();render();});
$("save").addEventListener("click",()=>safe(async()=>{await save();notice("Saved in this browser. Other users do not see this draft.");}));
for(const b of document.querySelectorAll("[data-profile]"))b.addEventListener("click",()=>safe(()=>switchProfile(b.dataset.profile)));
$("addOpportunity").addEventListener("click",()=>safe(async()=>{
 if(state.opportunities.length>=120)throw Error("Keep a maximum of 120 opportunities in one browser workspace.");
 const name=prompt("Name this opportunity","New acquisition opportunity");if(name===null)return;
 const n=makeOpportunity(name.trim().slice(0,160));state.opportunities.push(n);state.current=n.id;markDirty();render();notice("New draft added.");
}));
$("addNeedForm").addEventListener("submit",e=>{e.preventDefault();safe(()=>{
 const form=new FormData(e.target),id=currentId(form.get("label")),kind=form.get("kind"),weight=Number(form.get("weight"));
 if(op().needs.length>=16)throw Error("16 questions maximum; create another opportunity for larger cases.");
 op().needs.push({id,kind,label:String(form.get("label")).slice(0,120),weight,source:"Not yet supplied",status:"missing"});
 e.target.reset();markDirty();renderNeeds();renderOffers();result();preview();notice("Question added.");
});});
$("addOfferForm").addEventListener("submit",e=>{e.preventDefault();safe(()=>{
 const f=new FormData(e.target),id=String(f.get("id")).trim().toLowerCase().replace(/[^a-z0-9-]/g,"-");
 if(!id||op().offers.some(x=>x.id===id)||op().offers.length>=15)throw Error("Use a unique route name; maximum 15 routes.");
 const provider=String(f.get("provider")).trim(),method=String(f.get("method"));
 if(!provider||provider.length>120)throw Error("Name the provider or owner.");
 const coverage=String(f.get("covers")).split(",").map(x=>x.trim()).filter(Boolean);
 if(!coverage.length)throw Error("Assign at least one question ID.");
 for(const needId of coverage){
  const n=op().needs.find(x=>x.id===needId);
  if(!n)throw Error("No question with ID: "+needId);
  if(!eligible(method,n.kind))throw Error(method+" cannot establish "+n.kind+". Choose an eligible specialist.");
 }
 const quote=String(f.get("quote")),availability=String(f.get("availability")),quoteRef=String(f.get("quoteRef")).trim();
 if(quote==="quoted"&&(!quoteRef||availability==="ready"&&!quoteRef))throw Error("Record a quote reference before treating a route as quoted.");
 if(availability==="ready"&&!quoteRef)throw Error("A recorded-ready route needs a confirmation reference.");
 const group=String(f.get("group")).trim()||"-";
 if(group!=="-"&&op().offers.some(x=>x.group===group&&x.provider!==provider))throw Error("Shared travel group must have the same exact provider.");
 op().offers.push({id,provider,method,coverage,base:cents(f.get("base")),labor:cents(f.get("labor")),
 travel:cents(f.get("travel")),group,quote,availability,quoteRef});
 e.target.reset();e.target.closest("details").open=false;markDirty();renderOffers();result();preview();notice("Verification route added.");
});});
document.addEventListener("click",event=>safe(()=>{
 const b=event.target.closest("button");
 if(!b)return;
 if(b.dataset.removeNeed){const id=b.dataset.removeNeed;op().needs=op().needs.filter(n=>n.id!==id);for(const offer of op().offers)offer.coverage=offer.coverage.filter(x=>x!==id);markDirty();renderNeeds();renderOffers();result();preview();}
 if(b.dataset.removeOffer){op().offers=op().offers.filter(x=>x.id!==b.dataset.removeOffer);markDirty();renderOffers();result();preview();}
 if(b.dataset.section){const n=b.dataset.section;state.hidden=state.hidden.includes(n)?state.hidden.filter(x=>x!==n):[...state.hidden,n];markDirty();preview();}
 if(b.dataset.up){const index=state.sections.indexOf(b.dataset.up);if(index>0){[state.sections[index-1],state.sections[index]]=[state.sections[index],state.sections[index-1]];markDirty();preview();}}
}));
$("runPlan").addEventListener("click",()=>{const x=result();if(x)notice(x.status==="candidate_full"?"Full coverage plan found. Confirm quotes separately.":"Unresolved questions remain. Review the coverage result.",x.status!=="candidate_full");});
$("export").addEventListener("click",()=>safe(()=>{download("acquisition-brief.md",toMarkdown(state),"text/markdown");notice("Recipient brief downloaded.");}));
$("exportYaff").addEventListener("click",()=>safe(()=>{download("acquisition-proposal.yaff",toYaff(state),"text/plain");notice("Typed proposal downloaded for operator review.");}));
$("copy").addEventListener("click",()=>safe(async()=>{await navigator.clipboard.writeText(toMarkdown(state));notice("Recipient brief copied.");}));
$("print").addEventListener("click",()=>window.print());
$("openSource").addEventListener("click",event=>{if($("openSource").getAttribute("aria-disabled")==="true")event.preventDefault();});
$("importTsv").addEventListener("change",event=>safe(async()=>{
 const file=event.target.files?.[0];if(!file)return;
 if(file.size>170000)throw Error("TSV exceeds 170 KB.");
 const rows=parseTsv(await file.text());
 if(state.opportunities.length+rows.length>120)throw Error("Import exceeds 120 opportunities in this profile.");
 for(const row of rows)state.opportunities.push(makeOpportunity(row.title,row.subject,row.source,row.assertion));
 state.current=state.opportunities[state.opportunities.length-rows.length].id;markDirty();render();
 notice(rows.length+" opportunities imported as drafts. Save the workspace to retain them.");
 event.target.value="";
}));
async function openIncomingCivicSource(){
 const p=new URL(window.location.href).searchParams;
 if(p.get("handoff")!=="civic")return;
 const file=(p.get("subject")||"").slice(0,160);
 const source=(p.get("source")||"").slice(0,420);
 const title=(p.get("title")||"Dallas Council source record").slice(0,160);
 const assertion=(p.get("assertion")||"A civic source record was selected for review.").slice(0,1200);
 if(!/^\d{2}-\d{4}[A-Z]$/.test(file))throw Error("Council handoff requires an exact official file number.");
 if(!validSource(source)||!["cityofdallas.legistar.com","dallastx.new.swagit.com"].includes(new URL(source).hostname))
  throw Error("Council handoff refused: official source URL required.");
 await switchProfile("civic");
 const id="civic-"+file.toLowerCase();
 let existing=state.opportunities.find(x=>x.id===id);
 if(!existing){
  existing=makeOpportunity(title,file,source,assertion);
  existing.id=id;
  const proof=String(p.get("proof")||"").slice(0,230);
  for(const pair of proof.split(",").filter(Boolean).slice(0,4)){
   const kind=pair.split(":")[0];
   if(!KINDS.some(x=>x[0]===kind)||existing.needs.some(n=>n.kind===kind)||existing.needs.length>=16)continue;
   existing.needs.push({id:"requested-"+kind,kind,label:"Additional "+kind+" review",weight:3,source:"Council Media reviewer request",status:"missing"});
  }
  state.opportunities.push(existing);
 }
 state.current=id;
 if(!state.notes)state.notes="Imported from Dallas Council Media. Compare official sources and review the outcome before publication.";
 markDirty();render();
 notice("Official civic record linked. Save this browser draft to keep your review.");
}
(async()=>{try{db=await openDB();await switchProfile("itad");await openIncomingCivicSource();}catch(error){render();notice(error.message||"Browser-local draft storage is unavailable.",true);}})();
