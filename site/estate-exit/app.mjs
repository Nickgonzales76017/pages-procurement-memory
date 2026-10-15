import { initial,selected,EVIDENCE,MODES,parseParcels,calculate,verify,review,fit,brief,toTypedProposal } from "./core.mjs";
import { openDraft,esc,money,cents,dollars,boundedInt,sourceUrl,download,renderProgress } from "../journey-kit/room.mjs";
const $=id=>document.getElementById(id);
let state=initial(),draft=null,revision=0,active="observe";
const notify=(message,bad=false)=>{const e=$("message");e.textContent=message;e.className="message"+(bad?" error":"");};
function guarded(fn){try{fn()}catch(e){notify(e.message,true)}}
function drawProgress(){
 renderProgress($("process"),review(state),active);
 $("process").querySelectorAll("[data-chapter]").forEach(b=>b.addEventListener("click",()=>show(b.dataset.chapter)));
}
function show(id){
 active=id;document.querySelectorAll(".scene").forEach(x=>x.classList.toggle("active",x.dataset.scene===id));
 drawProgress();history.replaceState(null,"","#"+id);
}
function current(){return selected(state);}
function updatePlot(){
 const p=current(),w=p.width,d=p.depth,plot=$("plot");
 if(!w||!d){plot.innerHTML='<div class="noGeometry">NO VERIFIED DIMENSIONS<br><small>Enter observed width and depth. This is not a survey or GIS boundary.</small></div>';return;}
 const scale=Math.min(230/w,145/d),width=Math.max(20,Math.round(w*scale)),depth=Math.max(20,Math.round(d*scale));
 plot.innerHTML='<svg viewBox="0 0 330 210" role="img" aria-label="Illustrative proportional parcel footprint based on entered dimensions"><rect x="'+((330-width)/2)+'" y="'+((210-depth)/2)+'" width="'+width+'" height="'+depth+'" fill="#365b43" stroke="#c6dbad" stroke-width="2"/><text x="165" y="195" fill="#cddcc3" text-anchor="middle" font-size="12">'+w+' ft × '+d+' ft · user-entered only</text></svg>';
}
function renderObserve(){
 const p=current();$("parcelChoices").innerHTML=state.parcels.map(x=>
  '<button type="button" class="choice" data-parcel="'+esc(x.id)+'" aria-pressed="'+(p.id===x.id)+'"><strong>'+esc(x.address||x.parcel||"Unassigned parcel")+'</strong><small>'+esc(x.parcel||"No official parcel ID")+' · '+(x.source?"source candidate":"source missing")+'</small></button>'
 ).join("");
 $("parcelChoices").querySelectorAll("[data-parcel]").forEach(x=>x.addEventListener("click",()=>{state.selected=x.dataset.parcel;state.prepared=false;render();}));
 for(const key of ["parcel","address","source","owner","width","depth","notes"])$(key+"Input").value=p[key]??"";
 $("recordTag").textContent=p.observed||"No native observation receipt in this browser";
 $("sourceLink").href=p.source||"#";$("sourceLink").hidden=!p.source;
 updatePlot();
}
function renderUnderwrite(){
 const f=state.finance;for(const key of Object.keys(f))$(key+"Input").value=key.endsWith("Pct")||key==="months"?String(f[key]):dollars(f[key]);
 $("strategies").innerHTML=MODES.map(([id,title])=>{
  const m=calculate(state,id);
  const summary=!m.priced?"Unpriced — "+esc(m.reason):id==="rental"?
    "NOI "+money(m.noi)+" · indicated capitalized value "+money(m.indicated)+" · "+m.returnPct.toFixed(1)+"%":
    "Modeled net "+money(m.net)+" · max offer "+money(m.maxOffer)+" · "+m.returnPct.toFixed(1)+"% return";
  return '<button class="choice" type="button" data-strategy="'+id+'" aria-pressed="'+(state.strategy===id)+'"><strong>'+esc(title)+'</strong><small>'+summary+'</small></button>';
 }).join("");
 $("strategies").querySelectorAll("[data-strategy]").forEach(x=>x.addEventListener("click",()=>{
   state.strategy=x.dataset.strategy;state.prepared=false;render();
 }));
 const m=calculate(state);
 $("mathResult").innerHTML=m.priced?
  (m.kind==="rental"?
   '<strong>Modeled annual NOI '+money(m.noi)+'</strong><p>Annual rent assumption '+money(m.annualGross)+
   ' · implied value '+money(m.indicated)+' at '+f.capRatePct+'% cap rate · '+m.returnPct.toFixed(1)+'% annual return on modeled basis.</p>':
   '<strong>Net '+money(m.net)+' · '+m.returnPct.toFixed(1)+'% return</strong>'+
   '<p>Buy '+money(f.purchase)+' + acquisition fees '+money(m.purchaseFees)+
   ' + rehab '+money(m.rehab)+' + contingency '+money(m.reserve)+
   ' + holding '+money(m.holding)+' + sale costs '+money(m.saleFees)+
   ' + verification '+money(state.budget)+' = modeled costs '+money(m.total)+'.</p>'+
   '<p class="'+(m.meets?"success":"error")+'">Max offer for '+f.targetProfitPct+
   '% target profit: '+money(m.maxOffer)+'. Exit modeled at '+money(f.exit)+'.</p>'):
  '<strong>Unpriced scenario</strong><p>'+esc(m.reason)+'</p>';
}
function renderVerify(){
 const p=current(),plan=verify(state);
 $("budgetInput").value=dollars(state.budget);$("verificationModeInput").value=state.verificationMode;
 $("proofList").innerHTML=EVIDENCE.map((e,i)=>{
  const proof=p.proof[e.id];
  return '<div class="rowOption"><div class="rowTop"><div><strong>'+String(i+1).padStart(2,"0")+' / '+esc(e.title)+'</strong><p>'+esc(e.owner)+'</p></div><span class="pill '+(proof.status==="missing"?"warn":"")+'">'+esc(proof.status)+'</span></div>'+
   '<div class="fieldGrid"><label>Reviewer state<select data-proof="'+e.id+'" data-key="status">'+[
   ["missing","Not established"],["supplied","Source/document supplied"],["reviewed","Reviewed locally — NOT owner-certified"]].map(([v,t])=>
     '<option value="'+v+'"'+(proof.status===v?" selected":"")+'>'+t+'</option>').join("")+
   '</select></label><label>Exact evidence reference<input data-proof="'+e.id+'" data-key="ref" maxlength="500" placeholder="Source URL, case or owner coordinate" value="'+esc(proof.ref)+'"></label></div></div>';
 }).join("");
 $("verificationResult").innerHTML='<strong>'+esc(plan.status)+' · '+plan.covered.size+
   '/'+EVIDENCE.length+' native-type proof opportunities</strong><p>'+
   'Modeled verification route '+money(plan.cost)+' of '+money(state.budget)+'. '+
   'An admissible method is not a certified finding, actual provider quote, accepted title, or visit reservation.</p>'+
   (plan.unresolved.length?'<p class="error">Uncovered candidate routes: '+esc(plan.unresolved.map(x=>x.label).join("; "))+'</p>':"");
 $("verificationRoutes").innerHTML=plan.selected.map(r=>'<div class="line"><div><strong>'+esc(r.provider)+'</strong><small>'+r.method+' · '+r.quote+' / '+r.availability+'</small></div><b>'+money(r.base+r.labor+r.travel)+'</b></div>').join("")||'<p>No supported routes within this posture. Requirements remain open.</p>';
}
function renderMatch(){
 const i=state.investor,f=fit(state);
 $("investorName").value=i.label;$("investorLimit").value=dollars(i.limit);
 $("investorMinProfit").value=i.minProfit;$("investorNotes").value=i.notes;
 $("fitResult").innerHTML='<strong class="'+(f.ready?"success":"error")+'">'+(f.ready?"Meets entered economic constraints":"Not yet a modeled fit")+'</strong><p>'+esc(f.reason)+'</p>'+
 '<p>Only locally-entered criteria are compared. There is no buyer directory, confirmed liquidity, approved offer, or investor commitment.</p>';
}
function renderOffer(){
 $("recipient").value=state.recipient;
 $("offerState").textContent=state.prepared?"Review packet prepared locally — no offer transmitted.":"No reviewed draft prepared.";
}
function preview(){
 const p=current(),m=calculate(state),v=verify(state),f=fit(state);
 $("paperHeading").textContent=p.address||"Parcel not assigned";
 $("paperAddress").textContent=p.parcel||"Exact ID needed";
 $("paperRecipient").textContent=state.recipient;
 $("paperSource").textContent=p.source||"No official source supplied";
 $("paperOwner").textContent=p.owner||"No ownership facts established";
 $("paperEconomics").textContent=m.priced?m.kind==="rental"?
  "Annual modeled NOI "+money(m.noi)+" · indicated cap valuation "+money(m.indicated):
  "Modeled net "+money(m.net)+" · maximum allowable offer "+money(m.maxOffer):
  "Exit price and acquisition cost unresolved";
 $("paperVerify").textContent=v.covered.size+"/"+freshEvidenceCount()+
   " candidate proof classes · "+money(v.cost)+" modeled verification";
 $("paperFit").textContent=f.reason;
 $("paperAuthority").textContent="No title opinion, signing authority, escrow deposit or binding purchase exists. Local review fields are not legal findings.";
}
function freshEvidenceCount(){return EVIDENCE.length}
function render(){guarded(()=>{renderObserve();renderUnderwrite();renderVerify();renderMatch();renderOffer();preview();drawProgress()});}
function touch(){state.prepared=false;$("savedState").textContent="Unsaved review";preview();drawProgress();}
document.addEventListener("change",e=>{
 const x=e.target,field=x.dataset.field,proof=x.dataset.proof,finance=x.dataset.finance,investor=x.dataset.investor;
 if(!field&&!proof&&!finance&&!investor)return;
 guarded(()=>{
  if(proof){current().proof[proof][x.dataset.key]=x.value.slice(0,500);}
  else if(finance){
   state.finance[finance]=finance.endsWith("Pct")||finance==="months"?
     boundedInt(x.value,{min:0,max:finance==="months"?120:90}):
     cents(x.value,{empty:["purchase","exit","monthlyRent","annualOperating"].includes(finance)});
  } else if(investor){
   state.investor[investor]=investor==="limit"?cents(x.value,{empty:true}):
      investor==="minProfit"?boundedInt(x.value,{min:0,max:90}):x.value.slice(0,850);
  } else if(field==="budget")state.budget=cents(x.value);
  else if(field==="verificationMode")state.verificationMode=x.value;
  else if(field==="recipient")state.recipient=x.value.slice(0,120);
  else if(field==="source")current().source=sourceUrl(x.value.trim());
  else if(["width","depth"].includes(field))current()[field]=x.value?
    boundedInt(x.value,{min:1,max:20000}):null;
  else current()[field]=x.value.slice(0,900);
  touch();render();
 });
});
for(const key of ["parcel","address","owner","width","depth","notes","source"])$(key+"Input").dataset.field=key;
for(const key of Object.keys(state.finance))$(key+"Input").dataset.finance=key;
for(const key of ["label","limit","minProfit","notes"])$("investor"+key[0].toUpperCase()+key.slice(1)).dataset.investor=key;
$("budgetInput").dataset.field="budget";$("verificationModeInput").dataset.field="verificationMode";$("recipient").dataset.field="recipient";
$("parcelImport").addEventListener("change",async e=>{
 const f=e.target.files[0];if(!f)return;
 try{const parsed=parseParcels(await f.text());state.parcels.push(...parsed);state.selected=parsed[0].id;touch();render();
  notify("Added "+parsed.length+" bounded parcel candidates. Nothing was written to official assessor or title records.");}
 catch(error){notify(error.message,true)}finally{e.target.value=""}
});
$("prepareOffer").addEventListener("click",()=>{
 guarded(()=>{if(!state.recipient.trim())throw Error("Select a recipient before preparing a dossier.");
  state.prepared=true;render();notify("Prepared a local decision packet. Title, authority, escrow and signing remain externally unresolved.");});
});
$("saveDraft").addEventListener("click",async()=>{
 if(!draft)return notify("Local draft storage unavailable; export the human-readable packet instead.",true);
 try{revision=await draft.write(revision,state);$("savedState").textContent="Saved locally · revision "+revision;notify("Local revision saved; no remote parcel or investor system updated.");}
 catch(error){notify(error.message,true)}
});
$("exportBrief").addEventListener("click",()=>guarded(()=>{download("fleming-estate-review.md",brief(state),"text/markdown;charset=utf-8");notify("Downloaded the human-readable estate dossier.");}));
$("exportYaff").addEventListener("click",()=>guarded(()=>{download("fleming-proposed-work.yaff",toTypedProposal(state));notify("Exported a typed proposal. No native WorkGraph action was admitted.");}));
(async()=>{
 try{draft=await openDraft("fleming-estate-exit.v1");const old=await draft.read();
  if(old?.value?.parcels?.length){state=old.value;revision=old.revision;notify("Restored a retained local parcel workspace.");}}
 catch(e){notify("Local revision storage is unavailable: "+e.message,true)}
 render();show(["observe","underwrite","verify","match","offer"].includes(location.hash.slice(1))?location.hash.slice(1):"observe");
})();
