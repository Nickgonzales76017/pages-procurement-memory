import { initial,lots,getLot,getRecord,assess,verify,workflow,parseManifest,buyerBrief,buyerYaff } from "./core.mjs";
import { openDraft,esc,money,dollars,cents,boundedInt,sourceUrl,download,renderProgress } from "../journey-kit/room.mjs";
const $=id=>document.getElementById(id);
let state=initial(),draft=null,revision=0,active="source",busy=false;
const status=(message,bad=false)=>{const el=$("message");el.textContent=message;el.className="message"+(bad?" error":"");};
const safe=f=>{try{return f()}catch(e){status(e.message,true);return null;}};
const current=()=>getRecord(state);
const numeric=(v,nullable=true)=>cents(v,{empty:nullable});
const update=(key,value)=>{current()[key]=value;state.prepared=false;};
function progress(){
 const stages=workflow(state);renderProgress($("process"),stages,active);
 $("process").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>show(b.dataset.chapter)));
}
function show(name){active=name;document.querySelectorAll(".scene").forEach(p=>p.classList.toggle("active",p.dataset.scene===name));progress();window.history.replaceState(null,"","#"+name);}
function renderLotChoices(){
 $("lots").innerHTML=lots.map(l=>'<button class="choice" type="button" data-lot="'+esc(l.id)+'" aria-pressed="'+(getLot(state).id===l.id)+'"><strong>'+esc(l.title)+'</strong><small>'+esc(l.family)+' · '+l.reportedCount+' seller-reported units</small></button>').join("");
 $("lots").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
  state.selected=b.dataset.lot;state.prepared=false;render();status("Changed candidate lot. Seller identity and quantities remain unverified.");
 }));
}
function renderSource(){
 const lot=getLot(state),r=current();
 renderLotChoices();
 $("lotAssertion").textContent=lot.claim;
 $("lotIdentity").textContent=lot.subject;
 $("sourceInput").value=r.source;
 $("sourceLink").hidden=!r.source;
 $("sourceLink").href=r.source||"#";
 $("sellerCount").textContent=String(lot.reportedCount);
}
function renderManifest(){
 const r=current();
 $("manifestRows").innerHTML=r.rows.map((x,i)=>
 '<div class="rowOption"><div class="rowTop"><strong>Line '+String(i+1).padStart(2,"0")+'</strong><button type="button" data-remove="'+esc(x.id)+'">Remove ×</button></div><div class="fieldGrid triple">'+
 '<label>Model or family<input maxlength="100" data-line="'+esc(x.id)+'" data-prop="model" value="'+esc(x.model)+'"></label>'+
 '<label>Seller quantity<input type="number" min="1" max="50000" data-line="'+esc(x.id)+'" data-prop="qty" value="'+x.qty+'"></label>'+
 '<label>Seller condition<select data-line="'+esc(x.id)+'" data-prop="grade">'+["unknown","working","untested","parts"].map(g=>'<option value="'+g+'"'+(g===x.grade?" selected":"")+'>'+g+'</option>').join("")+'</select></label>'+
 '<label>Modeled resale / unit ($)<input inputmode="decimal" data-line="'+esc(x.id)+'" data-prop="recovery" value="'+dollars(x.recovery)+'" placeholder="Unpriced until estimated"></label></div></div>'
 ).join("");
 $("manifestRows").querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>{r.rows=r.rows.filter(x=>x.id!==b.dataset.remove);touch();render();}));
 const a=assess(state);
 $("manifestResult").textContent=a.units+" modeled units vs "+a.claimed+" seller-reported. "+
 (a.units!==a.claimed?"Quantity discrepancy requires review.":"Count matches claim; serial identity still unverified.");
}
function renderProof(){
 const lot=getLot(state),p=verify(state),review=state.reviewed[lot.id]||{};
 $("budgetInput").value=dollars(state.budget);
 $("modeInput").value=state.mode;
 $("needRows").innerHTML=lot.needs.map((n,i)=>
 '<div class="line"><div><strong>'+String(i+1).padStart(2,"0")+' / '+esc(n.label)+'</strong><small>'+esc(n.kind)+' · '+esc(n.source)+' · proof weight '+n.weight+'</small></div>'+
 '<label>Local review<select data-need="'+esc(n.id)+'">'+[["missing","Not established"],["supplied","Source supplied"],["reviewed","Reviewed here (not verified)"]].map(([v,t])=>'<option value="'+v+'"'+((review[n.id]||"missing")===v?" selected":"")+'>'+t+'</option>').join("")+'</select></label></div>'
 ).join("");
 $("proofRoutes").innerHTML=p.selected.map(x=>'<div class="line"><div><strong>'+esc(x.provider)+'</strong><small>'+esc(x.method)+' · '+esc(x.quote)+' · '+esc(x.availability)+'</small></div><b>'+money(x.base+x.labor+x.travel)+'</b></div>').join("")||'<p>No eligible route selected at this budget. The need remains open.</p>';
 $("coverage").innerHTML='<strong>'+p.covered.size+" of "+lot.needs.length+' proof kinds covered by candidate methods</strong>'+
 '<p>Modeled verification cost: '+money(p.cost)+' · '+esc(p.status)+
 '. No quote, visit, seller statement or reviewed flag establishes verified stock or ownership.</p>'+
 (p.unresolved.length?'<p class="error">Open: '+esc(p.unresolved.map(x=>x.label).join("; "))+'</p>':"");
}
function renderEconomics(){
 const r=current();
 for(const k of ["buyPerUnit","testingPerUnit","freight"])
  $(k).value=dollars(r[k]);
 $("reservePct").value=r.reservePct;$("targetMarginPct").value=r.targetMarginPct;
 const a=assess(state);
 $("economicReadout").innerHTML=a.priced?
 '<strong>Modeled gross recovery '+money(a.recovery)+'</strong><p>Proposed purchase '+money(a.buyTotal)+' + handling '+money(a.testing)+' + freight '+money(a.freight)+' + reserve '+money(a.reserve)+' = '+money(a.totalCost)+'</p>'+
 '<p class="'+(a.meetsTarget?"success":"error")+'">Modeled net '+money(a.net)+' · '+a.margin.toFixed(1)+'% recovery margin. Maximum buy per unit at '+r.targetMarginPct+'% target: '+money(a.maxUnit)+'.</p>':
 '<strong>Not priced</strong><p>Enter modeled recovery for every manifest line and a proposed buy-per-unit amount. A blank estimate is never silently treated as a zero-dollar offer.</p>';
}
function renderBuyer(){
 $("recipient").value=state.recipient;$("buyerRequirements").value=state.buyerRequirements;
 $("buyerNotes").value=current().notes;
 $("packetState").textContent=state.prepared?"Local buyer inquiry prepared — not sent.":"No buyer inquiry prepared yet.";
}
function paper(){
 const lot=getLot(state),a=assess(state),p=verify(state),r=current();
 $("paperTitle").textContent=lot.title;
 $("paperAudience").textContent=state.recipient;
 $("paperMaterial").textContent=lot.claim;
 $("paperSource").textContent=r.source||"Original source URL not supplied";
 $("paperNumbers").textContent=a.priced?
 money(a.recovery)+" modeled recovery · "+money(a.net)+" net after proposed acquisition, costs and reserve · "+a.margin.toFixed(1)+"%":
 "Economics unpriced — buyer number and recovery assumptions required";
 $("paperProof").textContent=p.covered.size+"/"+lot.needs.length+" candidate method coverage · "+money(p.cost)+" indicative verification · "+p.status;
 $("paperOpen").textContent=p.unresolved.map(x=>x.label).join("; ")||"No uncovered candidate methods. Evidence is still not independently verified.";
 $("paperProposal").textContent=state.prepared?"Buyer-facing inquiry prepared locally; no offer accepted.":"Draft needs buyer review; no supplier contacted.";
}
function render(){
 safe(()=>{renderSource();renderManifest();renderProof();renderEconomics();renderBuyer();paper();progress();});
}
function touch(){state.prepared=false;$("savedState").textContent="Unsaved local changes";paper();progress();}
function downloadReview(kind){
 safe(()=>{
  const content=kind==="md"?buyerBrief(state):buyerYaff(state);
  download("itad-"+getLot(state).id+(kind==="md"?".md":".yaff"),content,
    kind==="md"?"text/markdown;charset=utf-8":"text/plain;charset=utf-8");
  status(kind==="md"?"Downloaded a human acquisition brief.":"Downloaded a typed proposal; no WorkGraph or authority was created.");
 });
}
function fieldChanged(e){
 const el=e.target,field=el.dataset.field,line=el.dataset.line;
 if(!field&&!line)return;
 safe(()=>{
  if(line){
    const item=current().rows.find(x=>x.id===line);if(!item)return;
    const k=el.dataset.prop;
    if(k==="qty")item[k]=boundedInt(el.value,{min:1,max:50000});
    else if(k==="recovery")item[k]=numeric(el.value);
    else item[k]=el.value;
  } else if(field==="source"){
    update("source",sourceUrl(el.value.trim()));
  } else if(field==="budget")state.budget=numeric(el.value,false);
  else if(field==="mode")state.mode=el.value;
  else if(field==="recipient")state.recipient=el.value.slice(0,100);
  else if(field==="buyerRequirements")state.buyerRequirements=el.value.slice(0,950);
  else if(field==="notes")update("notes",el.value.slice(0,950));
  else if(["buyPerUnit","testingPerUnit","freight"].includes(field))update(field,numeric(el.value,field==="buyPerUnit"));
  else if(["reservePct","targetMarginPct"].includes(field))update(field,boundedInt(el.value,{min:0,max:85}));
  touch();render();
 });
}
$("sourceInput").dataset.field="source";$("budgetInput").dataset.field="budget";$("modeInput").dataset.field="mode";
$("recipient").dataset.field="recipient";$("buyerRequirements").dataset.field="buyerRequirements";$("buyerNotes").dataset.field="notes";
for(const id of ["buyPerUnit","testingPerUnit","freight","reservePct","targetMarginPct"])$(id).dataset.field=id;
document.addEventListener("change",e=>{
 if(e.target.dataset.need){
  const lot=getLot(state),review=state.reviewed[lot.id]||{};
  review[e.target.dataset.need]=e.target.value;state.reviewed[lot.id]=review;touch();paper();progress();return;
 }
 fieldChanged(e);
});
$("addManifest").addEventListener("click",()=>{const rows=current().rows;
 rows.push({id:"row-"+Date.now()+"-"+rows.length,model:"",qty:1,grade:"unknown",recovery:null});touch();render();show("manifest");});
$("manifestFile").addEventListener("change",async e=>{
 const file=e.target.files[0];if(!file)return;
 try{const data=parseManifest(await file.text());current().rows=data;touch();render();
  status("Imported "+data.length+" distinct manifest lines locally; stock and identities still need verification.");}
 catch(error){status(error.message,true);}finally{e.target.value="";}
});
$("prepareBuyer").addEventListener("click",()=>{safe(()=>{
 if(!state.recipient.trim()||!state.buyerRequirements.trim())throw Error("Recipient and intended buyer decision must be specified.");
 state.prepared=true;touch();state.prepared=true;render();status("Buyer inquiry prepared locally. No communication, offer or custody operation occurred.");
});});
$("saveDraft").addEventListener("click",async()=>{
 if(!draft)return status("Local storage unavailable; use the human-readable exports.",true);
 try{revision=await draft.write(revision,state);$("savedState").textContent="Saved on this browser · revision "+revision;status("Local workspace saved, without contacting a buyer or vendor.");}
 catch(e){status(e.message,true);}
});
$("exportBrief").addEventListener("click",()=>downloadReview("md"));
$("exportYaff").addEventListener("click",()=>downloadReview("yaff"));
(async()=>{
 try{draft=await openDraft("itad-exchange.v1");const stored=await draft.read();
  if(stored?.value?.records&&lots.some(x=>x.id===stored.value.selected)){state=stored.value;revision=stored.revision;status("Restored a locally retained equipment decision.");}}
 catch(e){status("Local drafts unavailable: "+e.message,true);}
 render();show(["source","manifest","verification","economics","buyer"].includes(location.hash.slice(1))?location.hash.slice(1):"source");
})();
