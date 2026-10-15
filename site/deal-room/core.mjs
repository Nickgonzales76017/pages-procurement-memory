/* Procurement obligations, negotiation and three-way receiving match.
 * Browser-local typed decision graph; no external PO, vendor contact or payment.
 */
export const STATUS=["draft","quoted","reviewed","shortlisted","rejected"];
export const METHODS=["email","portal","phone","document"];
const cents=n=>{
 const number=Number(n);if(!Number.isFinite(number)||number<0||number>100000000)throw Error("Amount outside permitted bounds.");
 return Math.round((number+Number.EPSILON)*100);
};
export {cents};
export const money=n=>(n/100).toLocaleString("en-US",{style:"currency",currency:"USD"});
export const sourceOk=s=>{
 if(/^fixture:[a-z0-9:/._-]+$/i.test(s))return true;
 try{const u=new URL(s);return u.protocol==="https:"&&!u.username&&!u.password&&!u.hash&&u.href.length<=700;}catch{return false;}
};
const ref=s=>typeof s==="string"&&/^[a-z][a-z0-9-]{2,79}$/.test(s);
const line=(id,item,quantity,unit,source)=>({id,item,quantity,unit:cents(unit),source});
const supplier=(id,name,leadDays,freight,terms,lines,quoteRef,conditional=true)=>({
 id,name,leadDays,freight:cents(freight),terms,lines,quoteRef,
 status:"quoted",review:"unreviewed",reviewedBy:"",conditional,
 negotiation:[],selected:false,invoice:null,receipt:null
});
export function example(){
 return {id:"community-media-infrastructure",truth:"fictional_quote_workshop",
  title:"Community center media equipment refresh",
  buyer:"Illustrative North District Community Operations",
  subject:"facility:media-upgrade-1",source:"fixture://ops/community-center",
  purpose:"Replace six meeting-room displays and their mounts with safer, serviceable hardware. Confirm supplier availability and exact shipping before any purchasing request.",
  budget:cents(16500),needByDays:45,approvalLimit:cents(16500),
  requisitioner:"mara",buyerReviewer:"devon",financeReviewer:"quinn",receivingActor:"sam",
  actor:"mara",revision:0,proposal:"draft",selectedSupplier:"",
  lines:[
   line("display","Six commercial displays",6,1600,"fixture://spec/display"),
   line("mount","Six compatible wall mounts",6,190,"fixture://spec/mount"),
   line("install","Install and configuration",1,2100,"fixture://spec/services")
  ],
  offers:[
   supplier("cedar-tech","Cedar Technology Supply (fictional)",24,380,"Net 30",
    [line("display","Six commercial displays",6,1560,"fixture://vendor/cedar"),
     line("mount","Six compatible wall mounts",6,180,"fixture://vendor/cedar"),
     line("install","Install and configuration",1,2200,"fixture://vendor/cedar")],
    "fixture://vendor/cedar-quote"),
   supplier("blue-cypress","Blue Cypress AV (fictional)",38,150,"Net 45",
    [line("display","Six commercial displays",6,1490,"fixture://vendor/cypress"),
     line("mount","Six compatible wall mounts",6,225,"fixture://vendor/cypress"),
     line("install","Install and configuration",1,2800,"fixture://vendor/cypress")],
    "fixture://vendor/cypress-quote"),
   supplier("juniper","Juniper Equipment Services (fictional)",18,800,"50% deposit",
    [line("display","Six commercial displays",6,1800,"fixture://vendor/juniper"),
     line("mount","Six compatible wall mounts",6,165,"fixture://vendor/juniper"),
     line("install","Install and configuration",1,1750,"fixture://vendor/juniper")],
    "fixture://vendor/juniper-quote")
  ],
  budgetReview:false,techReview:false,financeReview:false,
  order:null,audit:[]
 };
}
const total=lines=>lines.reduce((n,x)=>n+x.quantity*x.unit,0);
export const offerTotal=o=>total(o.lines)+o.freight;
export function judge(w,o){
 const reasons=[];
 if(!o||!sourceOk(o.quoteRef)||!o.lines.length)reasons.push("Source-backed quotation is missing.");
 if(o.leadDays>w.needByDays)reasons.push("Vendor lead time exceeds request.");
 if(offerTotal(o)>w.budget)reasons.push("Quoted total exceeds budget.");
 for(const line of w.lines){
  const offered=o.lines.find(x=>x.id===line.id);
  if(!offered||offered.quantity<line.quantity)reasons.push(line.id+": minimum count/specification shortfall");
 }
 if(o.conditional)reasons.push("Quote availability remains conditional; provider acceptance unconfirmed.");
 if(o.review!=="reviewed")reasons.push("Independent procurement review not recorded.");
 return {total:offerTotal(o),eligible:!reasons.length,reasons};
}
export function evaluate(w){
 validate(w);
 const candidates=w.offers.map(o=>({id:o.id,name:o.name,...judge(w,o)}));
 const chosen=w.offers.find(o=>o.id===w.selectedSupplier);
 const gaps=[];
 if(!chosen)gaps.push("Supplier selection missing.");
 if(chosen&&!judge(w,chosen).eligible)gaps.push(...judge(w,chosen).reasons);
 if(!w.techReview)gaps.push("Technical acceptance not reviewed.");
 if(!w.financeReview)gaps.push("Finance approval not recorded.");
 if(w.order?.state==="draft"&&!w.order.source)gaps.push("Order proposal has no original quotation.");
 return {candidates,chosen,cost:chosen?offerTotal(chosen):0,
  headroom:chosen?w.budget-offerTotal(chosen):w.budget,gaps,
  orderReady:!!chosen&&!gaps.length,orderState:w.order?.state||"not_prepared",
  matched:w.order?match(w):null};
}
export function validate(w){
 if(!w||!ref(w.id)||w.truth!=="fictional_quote_workshop"&&w.truth!=="local_requisition"||
   !sourceOk(w.source)||!Array.isArray(w.lines)||!w.lines.length||w.lines.length>30||
   !Array.isArray(w.offers)||w.offers.length>20||
   !Number.isSafeInteger(w.budget)||w.budget<0||!Number.isSafeInteger(w.revision)||w.revision<0||
   !Number.isSafeInteger(w.needByDays)||w.needByDays<1||w.needByDays>365)
   throw Error("Requisition identity, budget or limit invalid.");
 const ids=new Set();for(const item of w.lines){
  if(!ref(item.id)||ids.has(item.id)||!sourceOk(item.source)||!Number.isSafeInteger(item.quantity)||
     item.quantity<1||item.quantity>10000||!Number.isSafeInteger(item.unit)||item.unit<0)
     throw Error("Requisition item source or quantity invalid.");
  ids.add(item.id);
 }
 ids.clear();
 for(const o of w.offers){
  if(!ref(o.id)||ids.has(o.id)||!sourceOk(o.quoteRef)||!STATUS.includes(o.status)||
     !Number.isSafeInteger(o.leadDays)||o.leadDays<1||
     !Number.isSafeInteger(o.freight)||o.freight<0||!Array.isArray(o.lines)||
     !Array.isArray(o.negotiation)||o.negotiation.length>30)
     throw Error("Supplier quotation missing source or price basis.");
  ids.add(o.id);
  for(const line of o.lines)
   if(!ref(line.id)||!Number.isSafeInteger(line.quantity)||line.quantity<1||
      !Number.isSafeInteger(line.unit)||line.unit<0)throw Error("Invalid sourced supplier line.");
 }
 return w;
}
const append=(w,actor,action,id,note="")=>{
 w.revision++;w.audit.push({revision:w.revision,at:new Date().toISOString(),actor,action,id,note:String(note).slice(0,180)});
 if(w.audit.length>600)w.audit.shift();return w;
};
export function move(prior,actor,action,data={}){
 const w=structuredClone(validate(prior));
 const roles=[w.requisitioner,w.buyerReviewer,w.financeReviewer,w.receivingActor];
 if(!roles.includes(actor))throw Error("Unknown purchasing role.");
 const offer=w.offers.find(o=>o.id===data.offerId);
 if(action==="counter"){
  if(actor!==w.requisitioner||!offer||w.order)throw Error("Negotiation must occur before award and by requisition owner.");
  const n=cents(data.total),note=String(data.note||"").trim();
  if(n===0||note.length<6||n>10000000000)throw Error("Counterproposal needs sourced reasoning and a valid amount.");
  offer.negotiation.push({actor,at:new Date().toISOString(),cents:n,note,kind:"proposed"});
  return append(w,actor,action,offer.id,"Internal counterproposal, not sent to supplier.");
 }
 if(action==="review-offer"){
  if(actor!==w.buyerReviewer||!offer||!sourceOk(offer.quoteRef))throw Error("Independent buyer review and original quote needed.");
  offer.review="reviewed";offer.reviewedBy=actor;
  return append(w,actor,action,offer.id,"Locally checked against quote ref, not independently provider-confirmed.");
 }
 if(action==="confirm-availability"){
  if(actor!==w.buyerReviewer||!offer||!sourceOk(String(data.source||"")))
   throw Error("Provider availability needs separate source and reviewer.");
  offer.conditional=false;offer.confirmationRef=data.source;
  return append(w,actor,action,offer.id,"Availability source recorded by local reviewer.");
 }
 if(action==="set-cost"){
  if(actor!==w.requisitioner||w.order||!offer)throw Error("Only requisitioner can stage quote amendments before award.");
  const line=offer.lines.find(l=>l.id===data.lineId);
  if(!line||!sourceOk(data.source))throw Error("Exact quoted line and new source required.");
  line.unit=cents(data.unit);line.source=data.source;
  offer.review="unreviewed";offer.conditional=true;
  return append(w,actor,action,offer.id,"Quote amendment resets source and availability checks.");
 }
 if(action==="select"){
  if(actor!==w.requisitioner||!offer||w.order)throw Error("Only requisitioner can select a draft quote.");
  w.selectedSupplier=offer.id;
  return append(w,actor,action,offer.id,"Candidate choice; not accepted provider or issued order.");
 }
 if(action==="tech-review"){
  if(actor!==w.buyerReviewer||!w.selectedSupplier)throw Error("Technical review by independent buyer required.");
  w.techReview=true;return append(w,actor,action,w.selectedSupplier);
 }
 if(action==="finance-review"){
  if(actor!==w.financeReviewer||!w.selectedSupplier||!w.techReview)throw Error("Finance approval needs independent technical review.");
  const selected=w.offers.find(o=>o.id===w.selectedSupplier);
  if(!judge(w,selected).eligible)throw Error("Supplier has unresolved quote or policy constraints.");
  w.financeReview=true;return append(w,actor,action,w.selectedSupplier);
 }
 if(action==="prepare-order"){
  if(actor!==w.requisitioner)throw Error("Only requisitioner can prepare the purchase proposal.");
  const score=evaluate(w);
  if(!score.orderReady)throw Error("Order still has unresolved restrictions: "+score.gaps.join("; "));
  w.order={state:"draft",supplier:w.selectedSupplier,source:score.chosen.quoteRef,
   lineQuantities:Object.fromEntries(score.chosen.lines.map(l=>[l.id,l.quantity])),
   lineUnit:Object.fromEntries(score.chosen.lines.map(l=>[l.id,l.unit])),
   approvedCents:score.cost,createdAt:new Date().toISOString(),received:null,invoice:null};
  return append(w,actor,action,w.selectedSupplier,"Internal PO draft; no vendor contact or money.");
 }
 if(action==="receive"){
  if(actor!==w.receivingActor||!w.order||w.order.received)throw Error("Receiving operator and draft order needed.");
  if(!sourceOk(data.source))throw Error("Packing slip or receiving record source required.");
  const counts=data.counts;
  if(!counts||typeof counts!=="object")throw Error("Received quantities must be recorded.");
  for(const [id,quantity] of Object.entries(w.order.lineQuantities)){
   if(!Number.isSafeInteger(counts[id])||counts[id]<0||counts[id]>quantity)
     throw Error("Receiving count exceeds approved line "+id);
  }
  w.order.received={counts:structuredClone(counts),source:data.source,at:new Date().toISOString()};
  return append(w,actor,action,w.selectedSupplier,"Receiving source stored; no physical delivery is asserted.");
 }
 if(action==="invoice"){
  if(actor!==w.financeReviewer||!w.order||!w.order.received)throw Error("Finance invoice review requires receiving record.");
  if(!sourceOk(data.source))throw Error("Invoice requires original supplier source.");
  const amount=cents(data.amount);
  w.order.invoice={amount,source:data.source,at:new Date().toISOString()};
  return append(w,actor,action,w.selectedSupplier,"Invoice supplied for three-way local comparison; payment not authorized.");
 }
 if(action==="close-match"){
  if(actor!==w.financeReviewer||!w.order||!match(w).matched)
   throw Error("Three-way match incomplete or non-finance actor.");
  w.order.state="matched_locally";
  return append(w,actor,action,w.selectedSupplier,"Draft matched locally; no payment, settlement or supplier agreement.");
 }
 throw Error("Unsupported purchasing action.");
}
export function match(w){
 const p=w.order;if(!p)return {matched:false,issues:["No approved draft order."]};
 const issues=[];
 if(!p.received)issues.push("Receiving document missing.");
 if(!p.invoice)issues.push("Original invoice missing.");
 if(p.received){
  for(const [id,needed] of Object.entries(p.lineQuantities)){
   if(p.received.counts[id]!==needed)issues.push(id+": delivered quantity differs from approved purchase order.");
  }
 }
 if(p.invoice&&p.invoice.amount!==p.approvedCents)
  issues.push("Invoice total "+money(p.invoice.amount)+" differs from approved "+money(p.approvedCents)+".");
 return {matched:issues.length===0,issues,approved:p.approvedCents,invoice:p.invoice?.amount??null};
}
const atom=s=>'"'+String(s??"").replace(/[\r\n\t"]/g," ").slice(0,500)+'"';
export function buyerBrief(w){
 const p=evaluate(w),rows=["# "+w.title,"","Buyer: "+w.buyer,"Source: "+w.source,
  "Budget: "+money(w.budget),"Decision: "+p.orderState,"","## Supplier comparison"];
 for(const c of p.candidates)rows.push("- "+c.name+": "+money(c.total)+" — "+(c.eligible?"eligible for further review":c.reasons.join("; ")));
 rows.push("","## Decision gaps",...(p.gaps.length?p.gaps:["No outstanding local constraints."]));
 if(w.order)rows.push("","## Three-way receiving match",...match(w).issues,match(w).matched?"Local match complete; not paid.":"Payment remains blocked.");
 rows.push("","No vendor contacted, purchase order transmitted or cash paid by this browser.");
 return rows.join("\n");
}
export function typedProposal(w){
 const p=evaluate(w),rows=["program procurement-review-proposal","requisition "+w.id,
  "buyer "+atom(w.buyer),"budget_cents "+w.budget,"supplier "+(w.selectedSupplier||"unselected"),
  "order_state "+p.orderState,"revision "+w.revision];
 for(const offer of w.offers)
  rows.push("quote "+offer.id+" "+offerTotal(offer)+" "+offer.review+" "+atom(offer.quoteRef));
 if(w.order)rows.push("order "+w.order.supplier+" "+w.order.approvedCents+" "+(match(w).matched?"matched_locally":"unmatched"));
 rows.push("authority local-preview-only","cannot_infer candidate_selection_is_not_vendor_acceptance_dispatch_invoicing_or_payment");
 return rows.join("\n")+"\n";
}
