/* Decision preview aligned with the BonfyreEconomy proof-kind and route contracts.
 * In-memory + IndexedDB structured-clone drafts. No JSON business store.
 * Estimate planning has no authority to book a worker or admit proof.
 */
export const KINDS=[
["model","Hardware model"],["serial","Serial inventory"],["condition","Working condition"],
["ownership","Transfer authority"],["title","Legal title"],["lien","Liens"],["tax","Tax record"],
["location","Location"],["availability","Availability"],["rights","Usage rights"],
["safety","Safety"],["pricing","Pricing"],["freight","Freight"],["identity","Identity"],
["capacity","Capacity"],["geometry","Clearance"],["delivery","Delivery"],
["consent","Consent"],["provenance","Source provenance"],["hardware-boot","Boot test"]
];
export const METHODS=[
["desk","Desk review"],["owner","Owner documents"],["remote-live","Remote walkthrough"],
["partner","Partner check"],["field","On-site inspection"],
["licensed","Qualified specialist"],["lab","Testing laboratory"]
];
export const SECTIONS=["Summary","Source","Required checks","Verification","Decision"];
export function cents(n){
 const value=Number(n);
 if(!Number.isFinite(value)||value<0||value>100000000)throw Error("Enter a nonnegative amount within the allowed limit.");
 return Math.round((value+Number.EPSILON)*100);
}
export const money=c=>(c/100).toLocaleString("en-US",{style:"currency",currency:"USD"});
export const escaped=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const required=(id,kind,label,weight=5,source="",status="missing")=>({id,kind,label,weight,source,status});
const offer=(id,provider,method,coverage,base,labor,travel=0,group="-",quote="estimate",availability="conditional",quoteRef="")=>
 ({id,provider,method,coverage,base:cents(base),labor:cents(labor),travel:cents(travel),group,quote,availability,quoteRef});
const base=profile=>({profile,recipient:"",decision:"hold",notes:"",briefHeading:"",budget:cents(180),mode:"exploratory",
 sections:[...SECTIONS],hidden:[],current:"",opportunities:[]});
const item=(id,title,subject,source,assertion,needs,offers)=>({id,title,subject,source,assertion,needs,offers});
export function fresh(profile){
 if(!["itad","property","supplier"].includes(profile))throw Error("Unknown example profile.");
 const s=base(profile);
 if(profile==="itad"){
  s.recipient="Illustrative ITAD buyer";s.budget=cents(145);s.briefHeading="Equipment acquisition screen";
  s.notes="Prioritize exact models and transfer authority before funding a trip. Inventory availability has not been independently established.";
  s.opportunities=[
   item("houston35","35 HP desktops · Houston","foreign:houston-35","","Seller reports 35 HP desktops in Houston 77041 with mixed memory configurations. Exact models, condition and transfer authority are unconfirmed.",
    [required("model","model","Exact model and configuration",5,"seller manifest"),required("boot","condition","Representative boot and function test",5,"seller statement"),required("serial","serial","Serial inventory and count",3,"seller photos"),required("owner","ownership","Transfer authority and collection access",5,"seller documents")],
    [offer("seller","Seller photos / list","owner",["model","serial"],0,0),offer("remote","Remote demonstration","remote-live",["model","boot","serial"],10,35),offer("field-visual","Houston field inspection team","field",["model","boot"],25,45,65,"houston"),offer("field-serial","Houston field inspection team","field",["serial"],15,20,65,"houston"),offer("ownership","Independent transfer review","desk",["owner"],20,15)]),
   item("virginia120","120 mixed laptops · Virginia","foreign:virginia-laptops","","Seller describes 120 Dell/HP/Lenovo laptops, seventh through eleventh generation, without drives or chargers. BIOS boot and availability remain seller assertions.",
    [required("model","model","Model, generation and quantities",5,"seller list"),required("serial","serial","Asset identities",5,"seller photos"),required("boot","hardware-boot","Repeatable power and BIOS test",5,"seller assertion"),required("owner","ownership","Transfer authorization",5,"seller documents")],
    [offer("seller","Seller inventory + labels","owner",["model","serial"],0,0),offer("remote","Remote BIOS inspection","remote-live",["model","boot"],35,45),offer("field","Field audit","field",["model","serial","boot"],95,180,90,"virginia"),offer("authority","Transfer paperwork review","desk",["owner"],25,30)]),
   item("central8","8 Dell OptiPlex AIOs · Central Texas","foreign:central-texas-aio","","Seller lists four OptiPlex 7490 and four 7480 all-in-one computers, without drives. They have not been tested.",
    [required("model","model","Models and quantities",5,"seller list"),required("boot","hardware-boot","Confirm boot state",5,"seller statement"),required("owner","ownership","Collection and sale authority",5,"seller documents")],
    [offer("seller","Seller label photographs","owner",["model"],0,0),offer("field","Technician function check","field",["model","boot"],50,65,40,"central-tx"),offer("authority","Ownership document check","desk",["owner"],15,20)])
  ];
 }
 if(profile==="property"){
  s.recipient="Illustrative property acquisition team";s.budget=cents(350);s.briefHeading="Dallas property acquisition review";
  s.notes="Public property records do not establish clear title or permission to transact.";
  s.opportunities=[item("dallas-property","Dallas estate / property review","parcel:unassigned","","Illustrative property. The parcel number, owner identity, address, condition and purchase terms still need a source.",
   [required("parcel","identity","Exact parcel and recorded location",5,"official parcel source"),required("tax","tax","Current tax standing",3,"official tax source"),required("title","title","Qualified title and transfer review",5,"independent professional"),required("condition","condition","Property condition and access",3,"current inspection")],
   [offer("parcel-desk","Parcel and tax document review","desk",["parcel","tax"],10,30),offer("owner-docs","Owner-provided documents","owner",["parcel"],0,0),offer("property-tour","Property walkthrough","field",["condition"],40,110,50,"dallas"),offer("legal","Qualified title professional","licensed",["title"],125,75)])];
 }
 if(profile==="supplier"){
  s.recipient="Procurement reviewer";s.budget=cents(300);s.briefHeading="Supplier proposal comparison";
  s.notes="Approval requires a dated quotation, agreed scope, capacity and delivery responsibilities.";
  s.opportunities=[item("supplier-case","Proposed hardware supplier engagement","supplier:unassigned","","Illustrative supplier. Pricing, inventory, capacity, terms and carrier booking have not been confirmed.",
   [required("price","pricing","Dated quantity and unit pricing",5,"supplier offer"),required("capacity","capacity","Reserved stock and fulfillment capacity",5,"supplier confirmation"),required("delivery","delivery","Delivery responsibility and timing",3,"carrier quote"),required("rights","ownership","Right to supply and transfer goods",5,"seller documents")],
   [offer("email","Request complete quotation","owner",["price","rights"],0,0),offer("availability","Partner capacity confirmation","partner",["capacity","delivery"],25,30),offer("desk","Independent freight review","desk",["delivery"],20,35),offer("field","Onsite stock count","field",["capacity"],55,95,60,"supplier")])];
 }
 s.current=s.opportunities[0].id;return s;
}
export function validSource(raw){
 try{const u=new URL(raw);return u.protocol==="https:"&&!u.username&&!u.password&&!u.hash&&u.href.length<=420;}catch{return false;}
}
export function eligible(method,kind){
 if(kind==="title")return method==="licensed";
 if(["rights","consent"].includes(kind))return ["licensed","owner"].includes(method);
 if(kind==="safety")return ["licensed","lab"].includes(method);
 if(kind==="lien")return ["licensed","desk"].includes(method);
 if(["hardware-boot","condition"].includes(kind))return ["field","lab","remote-live"].includes(method);
 if(["serial","model"].includes(kind))return ["owner","field","lab","remote-live"].includes(method);
 if(kind==="ownership")return ["licensed","desk","owner"].includes(method);
 if(kind==="tax")return ["licensed","desk"].includes(method);
 if(kind==="geometry")return ["desk","field","lab"].includes(method);
 if(kind==="provenance")return ["desk","owner","licensed"].includes(method);
 if(kind==="capacity")return ["partner","field","lab","remote-live"].includes(method);
 if(kind==="delivery")return ["partner","field","remote-live"].includes(method);
 return METHODS.some(x=>x[0]===method);
}
export function checkOpportunity(op){
 if(!op||!Array.isArray(op.needs)||!Array.isArray(op.offers)||!String(op.title||"").trim())throw Error("Enter an opportunity and its requirements.");
 if(op.title.length>160||String(op.subject||"").length>160||String(op.assertion||"").length>1200)throw Error("Opportunity field is too long.");
 if(op.source&&!validSource(op.source))throw Error("Use an HTTPS source URL without credentials or fragments.");
 if(op.needs.length>16||op.offers.length>15)throw Error("Maximum 16 checks and 15 routes per opportunity.");
 const names=new Set();for(const n of op.needs){
  if(!/^[a-z0-9-]{1,70}$/i.test(n.id)||names.has(n.id)||!KINDS.some(x=>x[0]===n.kind)||![1,3,5].includes(n.weight))throw Error("Invalid or duplicate requirement.");
  names.add(n.id);
 }
 const rids=new Set();for(const r of op.offers){
  if(!/^[a-z0-9-]{1,70}$/i.test(r.id)||rids.has(r.id)||!METHODS.some(x=>x[0]===r.method)||
   [r.base,r.labor,r.travel].some(n=>!Number.isSafeInteger(n)||n<0)||!Array.isArray(r.coverage))throw Error("Invalid or duplicate verification route.");
  if(r.coverage.some(id=>!names.has(id)))throw Error("Route references a missing requirement.");
  rids.add(r.id);
 }
 return op;
}
export const documented=r=>r.quote==="quoted"&&r.availability==="ready"&&String(r.quoteRef||"").trim().length>0;
export function routePrice(routes){
 let total=0;const groups=new Map();
 for(const r of routes){
  total+=r.base+r.labor;
  if(r.group&&r.group!=="-"){const k=r.provider+"\u0000"+r.group;groups.set(k,Math.max(groups.get(k)||0,r.travel));}
  else total+=r.travel;
 }
 for(const n of groups.values())total+=n;
 return total;
}
export function optimize(op,budget,mode="exploratory"){
 checkOpportunity(op);if(!Number.isSafeInteger(budget)||budget<0)throw Error("Invalid verification budget.");
 if(!["exploratory","documented"].includes(mode))throw Error("Unknown route comparison mode.");
 const routes=op.offers.filter(r=>mode!=="documented"||documented(r)),needIds=op.needs.map(n=>n.id);
 let best=null,partial=null,minFull=Infinity;
 for(let m=0;m<(1<<routes.length);m++){
  const selected=routes.filter((r,i)=>Boolean(m&(1<<i))),cost=routePrice(selected),covered=new Set();
  for(const route of selected)for(const id of route.coverage){const n=op.needs.find(x=>x.id===id);if(n&&eligible(route.method,n.kind))covered.add(id);}
  const complete=needIds.every(id=>covered.has(id)),score=op.needs.reduce((sum,n)=>sum+(covered.has(n.id)?n.weight:0),0);
  if(complete)minFull=Math.min(minFull,cost);
  if(cost>budget)continue;
  const candidate={selected,cost,covered,score,complete};
  if(complete&&(!best||cost<best.cost||(cost===best.cost&&selected.length<best.selected.length)))best=candidate;
  if(!partial||score>partial.score||(score===partial.score&&cost<partial.cost))partial=candidate;
 }
 const chosen=best||partial||{selected:[],cost:0,covered:new Set(),score:0,complete:false};
 return {...chosen,status:best?"candidate_full":Number.isFinite(minFull)?"over_budget":partial?"incomplete":"no_candidate",
  unresolved:op.needs.filter(n=>!chosen.covered.has(n.id)),minimumFull:Number.isFinite(minFull)?minFull:null,mode};
}
export function parseTsv(text){
 if(typeof text!=="string"||text.length>170000)throw Error("Choose a TSV file smaller than 170 KB.");
 const rows=[];let cells=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(c==="\t"&&!quoted){cells.push(cell);cell="";}
  else if((c==="\n"||c==="\r")&&!quoted){
   if(c==="\r"&&text[i+1]==="\n")i++;cells.push(cell);
   if(cells.some(x=>x.trim()))rows.push(cells);cells=[];cell="";
  }else cell+=c;
 }
 if(quoted)throw Error("Unclosed quoted field in TSV.");
 cells.push(cell);if(cells.some(x=>x.trim()))rows.push(cells);
 if(rows.length<2||rows.length>101)throw Error("Import a header and 1 to 100 opportunities.");
 const keys=rows[0].map(x=>x.trim().toLowerCase());
 for(const k of ["title","subject","source","assertion"])if(!keys.includes(k))throw Error("Missing column: "+k);
 return rows.slice(1).map(c=>{
  const get=k=>String(c[keys.indexOf(k)]??"").trim();
  const o={title:get("title"),subject:get("subject"),source:get("source"),assertion:get("assertion")};
  if(!o.title||o.title.length>160||o.subject.length>160||o.assertion.length>1200||(o.source&&!validSource(o.source)))throw Error("Invalid imported row.");
  return o;
 });
}
const norm=s=>String(s??"").replace(/[\t\r\n]+/g," ").trim();
export function briefContent(s){
 const op=s.opportunities.find(x=>x.id===s.current);
 if(!op)throw Error("Select an opportunity.");
 return {op,solution:optimize(op,s.budget,s.mode||"exploratory"),title:s.briefHeading||op.title,
  recipient:s.recipient||"Buyer review",sections:s.sections.filter(x=>!s.hidden.includes(x))};
}
export function toMarkdown(s){
 const {op,solution,title,recipient,sections}=briefContent(s);
 const lines=["# "+norm(title),"","For: "+norm(recipient),"Opportunity: "+norm(op.title),"Subject: "+norm(op.subject),""];
 for(const section of sections){
  lines.push("## "+section);
  if(section==="Summary")lines.push(norm(op.assertion)||"Source description not supplied.");
  if(section==="Source")lines.push(op.source||"Source URL not supplied; do not treat claims as verified.");
  if(section==="Required checks")for(const n of op.needs)lines.push("- "+norm(n.label)+" ("+n.kind+", "+(n.status||"missing")+"). Source: "+norm(n.source||"not supplied"));
  if(section==="Verification"){
   lines.push("Plan: "+solution.status+". "+money(solution.cost)+" against "+money(s.budget)+" verification budget.","Methods:");
   for(const r of solution.selected)lines.push("- "+r.id+" / "+r.provider+": "+r.method+", "+r.quote+", "+r.availability);
   if(solution.unresolved.length)lines.push("Unresolved: "+solution.unresolved.map(n=>n.label).join("; "));
  }
  if(section==="Decision")lines.push("Recommendation: "+s.decision+".",norm(s.notes)||"No reviewer notes supplied.");
  lines.push("");
 }
 lines.push("Planning estimates do not prove availability, authorize inspection, certify title, or complete a transaction.");
 return lines.join("\n");
}
const quote=s=>'"'+norm(s).replaceAll('"',"'")+'"';
export function toYaff(s){
 const {op,solution}=briefContent(s);
 return [
  "program acquisition-brief-proposal",
  "subject "+quote(op.subject),"profile "+s.profile,"opportunity "+quote(op.title),
  "recipient "+quote(s.recipient),"source "+quote(op.source||"unbound"),
  "budget_cents "+s.budget,"proposed_cents "+solution.cost,
  "coverage "+solution.covered.size+"/"+op.needs.length,"plan_status "+solution.status,
  "quote_basis "+solution.mode,"decision "+s.decision,"assertion "+quote(op.assertion),"notes "+quote(s.notes),
  ...op.needs.map(n=>"need "+quote(n.id)+" "+n.kind+" "+n.weight+" "+n.status+" "+quote(n.source||"unbound")),
  ...solution.selected.map(r=>"route "+quote(r.id)+" "+quote(r.provider)+" "+r.method+" "+r.base+" "+r.labor+" "+r.travel+" "+quote(r.group||"-")+" "+r.quote+" "+r.availability+" "+quote(r.quoteRef||"unquoted")),
  "authority none","cannot_infer proposal_is_not_quote_dispatch_proof_title_or_settlement"
 ].join("\n")+"\n";
}