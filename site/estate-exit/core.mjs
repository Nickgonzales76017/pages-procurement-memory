import {fresh,optimize,toYaff} from "../brief-studio/core.mjs";
import {cents,boundedInt,money,safeLines,sourceUrl,clean,quoted} from "../journey-kit/room.mjs";
export const EVIDENCE=[
 {id:"parcel",title:"Exact assessor parcel and geometry",owner:"Public parcel source"},
 {id:"owner",title:"Current owner / estate relationship",owner:"Official recording / counsel"},
 {id:"tax",title:"Tax account and delinquencies",owner:"Tax collection authority"},
 {id:"title",title:"Title, liens and transferability",owner:"Qualified title professional"},
 {id:"condition",title:"Interior condition and authorized access",owner:"Current inspection"},
 {id:"signing",title:"Legal signing / estate authority",owner:"Qualified counsel / owner documents"}
];
export const MODES=[["as-is","As-is disposition"],["rehab","Renovation & resale"],["rental","Stabilize & hold"]];
export function initial(){
 return {selected:"candidate-1",recipient:"Illustrative Fleming acquisition team",
  parcels:[{id:"candidate-1",parcel:"",address:"",source:"",observed:"",owner:"",
    width:null,depth:null,notes:"",proof:Object.fromEntries(EVIDENCE.map(e=>[e.id,{status:"missing",ref:""}]))}],
  budget:35000,verificationMode:"exploratory",
  finance:{purchase:null,exit:null,rehab:0,monthlyHold:0,months:6,closingPct:3,
    salesPct:6,contingencyPct:15,targetProfitPct:15,monthlyRent:null,annualOperating:null,capRatePct:8},
  investor:{label:"Recipient-selected buyer or builder",limit:null,minProfit:0,notes:""},
  strategy:"rehab",prepared:false};
}
export const selected=s=>s.parcels.find(p=>p.id===s.selected)??s.parcels[0];
export function parseParcels(text){
 const rows=safeLines(text,["parcel","address","source","owner","width_ft","depth_ft"],{limit:100});
 const ids=new Set();
 return rows.map((r,i)=>{
  if(!r.parcel||r.parcel.length>90||!r.address||r.address.length>200||ids.has(r.parcel))
    throw Error("A unique bounded parcel identity and address are required on row "+(i+2));
  ids.add(r.parcel);
  return {id:"import-"+(i+1),parcel:r.parcel,address:r.address,
   source:sourceUrl(r.source),observed:"user-imported candidate; not native receipt",owner:r.owner.slice(0,160),
   width:r.width_ft?boundedInt(r.width_ft,{min:1,max:20000}):null,
   depth:r.depth_ft?boundedInt(r.depth_ft,{min:1,max:20000}):null,
   notes:"",proof:Object.fromEntries(EVIDENCE.map(e=>[e.id,{status:"missing",ref:""}]))};
 });
}
export function numericFinance(s){
 const x=s.finance;
 for(const field of ["purchase","exit","rehab","monthlyHold","monthlyRent","annualOperating"])
  if(x[field]!==null&&(!Number.isSafeInteger(x[field])||x[field]<0||x[field]>1e12))
    throw Error("Invalid finance field: "+field);
 for(const field of ["months","closingPct","salesPct","contingencyPct","targetProfitPct","capRatePct"])
  boundedInt(x[field],{min:field==="months"?0:0,max:field==="months"?120:90});
}
export function calculate(s,kind=s.strategy){
 numericFinance(s);const x=s.finance;
 const fixed=x.purchase!=null&&x.exit!=null;
 if(kind==="rental"){
  if(x.purchase==null||x.monthlyRent==null||x.annualOperating==null||x.capRatePct<=0)
   return {priced:false,kind,reason:"Enter purchase, monthly rent, annual operating cost and capitalization assumption."};
  const annualGross=x.monthlyRent*12,noi=annualGross-x.annualOperating,
    indicated=Math.floor(noi*100/x.capRatePct),
    initial=x.purchase+x.rehab+Math.ceil(x.purchase*x.closingPct/100),
    returnPct=initial?noi/initial*100:0;
  return {priced:true,kind,annualGross,noi,indicated,initial,returnPct,
    meets:noi>=0&&returnPct>=s.investor.minProfit,
    cannotInfer:"Rents, tenancy, cap rate, property condition and financeability are unverified."};
 }
 if(!fixed)return {priced:false,kind,reason:"Enter a proposed purchase and an independent modeled exit price."};
 const rehab=kind==="rehab"?x.rehab:0;
 const reserve=Math.ceil(rehab*x.contingencyPct/100);
 const holding=x.monthlyHold*(kind==="as-is"?1:x.months);
 const saleFees=Math.ceil(x.exit*x.salesPct/100);
 const purchaseFees=Math.ceil(x.purchase*x.closingPct/100);
 const total=x.purchase+purchaseFees+rehab+reserve+holding+saleFees+s.budget;
 const net=x.exit-total;
 const returnPct=total?net/total*100:0;
 const target=Math.ceil(x.exit*x.targetProfitPct/100);
 const maxOffer=Math.max(0,Math.floor((x.exit-saleFees-rehab-reserve-holding-s.budget-target)/(1+x.closingPct/100)));
 return {priced:true,kind,rehab,reserve,holding,saleFees,purchaseFees,total,net,
   returnPct,maxOffer,meets:net>=target,requiredProfit:target,
   cannotInfer:"Exit value, title, condition, timelines, lending and costs remain modeled assumptions."};
}
export function verify(s){
 const template=fresh("property"),base=template.opportunities[0];
 return {...optimize(base,s.budget,s.verificationMode),requiredCount:base.needs.length};
}
export function review(s){
 const p=selected(s),math=calculate(s);
 const title=p.proof.title.status==="reviewed",authority=p.proof.signing.status==="reviewed";
 const source=!!(p.parcel&&p.source);
 return [
 {id:"observe",title:"Parcel lineage",done:source},
 {id:"underwrite",title:"Compare exits",done:math.priced},
 {id:"verify",title:"Resolve exceptions",done:EVIDENCE.every(e=>p.proof[e.id].status==="reviewed")},
 {id:"match",title:"Investor fit",done:math.priced&&s.investor.limit!=null},
 {id:"offer",title:"Offer packet",done:s.prepared}
 ];
}
export function fit(s){
 const model=calculate(s),max=s.investor.limit;
 if(!model.priced||max===null)return {ready:false,reason:"Need modeled economics and a recipient's buying limit."};
 const buy=s.finance.purchase;
 return {ready:buy<=max&&model.meets,
  reason:buy>max?"Proposed purchase exceeds the recipient limit":
  !model.meets?"Modeled return misses the requested threshold":"Meets locally entered economic constraints; no investor assent or qualification verified."};
}
export function brief(s){
 const p=selected(s),m=calculate(s),v=verify(s),f=fit(s),x=s.finance;
 return [
 "# Fleming Estate-to-Exit · "+(p.address||"Parcel identity unresolved"),"",
 "For: "+clean(s.recipient),"Recipient / investor: "+clean(s.investor.label),
 "Subject: "+clean(p.parcel||"UNASSIGNED"),
 "Source: "+(p.source||"No official parcel source supplied"),
 "Observation state: "+clean(p.observed||"Locally entered; no native receipt"),"",
 "## Parcel and relationship",
 "Address claim: "+clean(p.address||"Unassigned"),
 "Owner / estate claim: "+clean(p.owner||"Not established"),
 "Dimensions: "+(p.width&&p.depth?p.width+" × "+p.depth+" feet (entered, not surveyed)":"Not measured"),
 clean(p.notes),"",
 "## Exits and modeled economics",
 "Selected strategy: "+s.strategy,
 ...(m.priced?m.kind==="rental"?
 ["Annual rent assumption: "+money(m.annualGross),"Annual NOI: "+money(m.noi),
  "Capitalized value at "+x.capRatePct+"%: "+money(m.indicated),
  "Modeled annual return: "+m.returnPct.toFixed(1)+"%"]:
 ["Modeled sale exit: "+money(x.exit),"Proposed purchase: "+money(x.purchase),
  "Rehab "+money(m.rehab)+", contingency "+money(m.reserve)+", holding "+money(m.holding),
  "Closing "+money(m.purchaseFees)+", sale costs "+money(m.saleFees)+", verification "+money(s.budget),
  "Modeled net "+money(m.net)+" and return on costs "+m.returnPct.toFixed(1)+"%",
  "Maximum allowable purchase for target: "+money(m.maxOffer)]
 :[m.reason]),"",
 "## Independent verification (candidate routes, never ordered)",
 "Review ceiling: "+money(s.budget)+" · "+v.status+" · route estimate "+money(v.cost),
 ...v.selected.map(r=>"- "+clean(r.provider)+" / "+r.method+" / "+r.quote+" / "+r.availability),
 ...EVIDENCE.map(e=>"- "+e.title+": "+p.proof[e.id].status+" / ref "+clean(p.proof[e.id].ref||"not supplied")),
 "## Investor / builder fit",
 "Modeled fit: "+f.reason,
 clean(s.investor.notes),"",
 "## Authority and disposition",
 "Title: only a qualified title opinion can establish legal transferability.",
 "Seller authority: not established by the entered owner name.",
 "No binding offer, investor acceptance, public record change, escrow deposit, recorded conveyance or closed sale."
 ].join("\n")+"\n";
}
export function toTypedProposal(s){
 const p=selected(s),m=calculate(s),f=fit(s),
 base={...fresh("property"),recipient:s.recipient,notes:"Fleming parcel research. "+p.notes,
   decision:"hold",briefHeading:"Fleming Estate-to-Exit",hidden:[]};
 return toYaff(base)+
 "program fleming-estate-exit-candidate\n"+
 "parcel "+quoted(p.parcel||"unbound")+"\n"+
 "address "+quoted(p.address||"unbound")+"\n"+
 "source "+quoted(p.source||"unbound")+"\n"+
 "observed "+quoted(p.observed||"unread")+"\n"+
 "strategy "+s.strategy+"\n"+
 "purchase_cents "+(s.finance.purchase??"unpriced")+"\n"+
 "modeled_exit_cents "+(s.finance.exit??"unpriced")+"\n"+
 "modeled_net_cents "+(m.priced?(m.net??m.noi):"unpriced")+"\n"+
 "recipient_fit "+(f.ready?"economic_candidate":"pending")+"\n"+
 EVIDENCE.map(e=>"predicate "+e.id+" "+p.proof[e.id].status+" "+quoted(p.proof[e.id].ref||"unbound")+"\n").join("")+
 "title_opinion none\nseller_signature_authority none\nescrow none\n"+
 "cannot_infer parcel_observation_is_not_title_or_closed_sale\n";
}
