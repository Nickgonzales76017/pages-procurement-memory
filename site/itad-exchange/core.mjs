import { fresh, optimize, toYaff } from "../brief-studio/core.mjs";
import { cents, dollars, boundedInt, safeLines, sourceUrl, money, clean, quoted } from "../journey-kit/room.mjs";

const template=fresh("itad");
const COUNTS={houston35:35,virginia120:120,central8:8};
const grades=["unknown","working","untested","parts"];
export const lots=template.opportunities.map((op,i)=>({
 id:op.id,title:op.title,subject:op.subject,claim:op.assertion,source:op.source,
 reportedCount:COUNTS[op.id],family:["Desktop fleet","Laptop fleet","All-in-one fleet"][i],
 needs:op.needs.map(n=>({...n})),offers:op.offers.map(r=>({...r}))
}));
export function initial(){
 return {selected:lots[0].id,recipient:"Illustrative ITAD buyer",
   budget:14500,mode:"exploratory",buyerRequirements:"Ask which lot, buying number, freight or pickup terms.",
   reviewed:{},prepared:false,
   records:Object.fromEntries(lots.map(l=>[l.id,{
     source:l.source||"",rows:[{id:"seller-count",model:"Exact models still need a manifest",qty:l.reportedCount,grade:"unknown",recovery:null}],
     buyPerUnit:null,testingPerUnit:0,freight:0,reservePct:10,targetMarginPct:15,notes:""
   }]))
 };
}
export const getLot=s=>lots.find(x=>x.id===s.selected)??lots[0];
export const getRecord=s=>s.records[getLot(s).id];
export function verify(s){
 const source=getLot(s),op={...source,needs:source.needs,offers:source.offers};
 return optimize(op,s.budget,s.mode);
}
export function parseManifest(text){
 const data=safeLines(text,["model","qty","grade","recovery_per_unit"],{limit:130});
 const seen=new Set();
 return data.map((r,i)=>{
  const id=r.model.toLowerCase().replace(/\s+/g,"-");
  if(!r.model||r.model.length>100||seen.has(id)||!grades.includes(r.grade))
    throw Error("Row "+(i+2)+": models must be unique, bounded, and have a valid grade.");
  seen.add(id);return {id:"m-"+(i+1),model:r.model,qty:boundedInt(r.qty,{min:1,max:50000}),
    grade:r.grade,recovery:r.recovery_per_unit===""?null:cents(r.recovery_per_unit)};
 });
}
export function assess(s){
 const lot=getLot(s),r=getRecord(s);
 const claimed=lot.reportedCount;
 if(!r.rows.length)return {claimed,units:0,priced:false};
 let units=0,recovery=0,unknown=0;
 for(const line of r.rows){
  units+=boundedInt(line.qty,{min:1,max:50000});if(units>50000)throw Error("Manifest exceeds the bounded 50,000-unit workspace.");
  if(line.recovery==null)unknown+=line.qty;else recovery+=line.qty*line.recovery;
 }
 const buy=r.buyPerUnit;
 const priced=unknown===0&&buy!=null&&units>0;
 if(!priced)return {claimed,units,unknown,priced:false,recovery,variantCount:r.rows.length};
 const buyTotal=buy*units,testing=r.testingPerUnit*units,freight=r.freight,reserve=Math.ceil(recovery*r.reservePct/100);
 const totalCost=buyTotal+testing+freight+reserve,net=recovery-totalCost;
 const margin=recovery?net/recovery*100:null;
 const maxTotal=Math.floor(recovery*(100-r.targetMarginPct-r.reservePct)/100)-testing-freight;
 const maxUnit=Math.max(0,Math.floor(maxTotal/units));
 return {claimed,units,unknown,priced:true,recovery,buyTotal,testing,freight,reserve,totalCost,net,
   margin,maxUnit,meetsTarget:margin!==null&&margin>=r.targetMarginPct};
}
export function workflow(s){
 const lot=getLot(s),r=getRecord(s),math=assess(s),reviews=s.reviewed[lot.id]||{},checks=lot.needs;
 const plan=verify(s);
 return [
  {id:"source",title:"Seller source",done:!!r.source},
  {id:"manifest",title:"Inventory table",done:r.rows.length>0 && r.rows.every(x=>x.grade!=="unknown"&&x.model!=="Exact models still need a manifest")},
  {id:"verification",title:"Proof routing",done:checks.every(x=>reviews[x.id]==="reviewed") && plan.complete},
  {id:"economics",title:"Acquisition math",done:math.priced},
  {id:"buyer",title:"Buyer decision",done:s.prepared}
 ];
}
export function buyerBrief(s){
 const lot=getLot(s),r=getRecord(s),a=assess(s),p=verify(s),review=s.reviewed[lot.id]||{};
 const lines=[
 "# Equipment acquisition — "+clean(lot.title),"",
 "Prepared for: "+clean(s.recipient),"Disposition context: proposed ITAD acquisition, not an accepted purchase.",
 "Source identity: "+clean(lot.subject),"Seller-reported description: "+clean(lot.claim),
 "Seller source: "+(r.source?"Held privately for operator verification; not disclosed in buyer packet.":"NOT YET SOURCED — request exact original record"),"",
 "## Asset manifest — seller claims until inspected",
 ...r.rows.map(x=>"- "+clean(x.model)+" · "+x.qty+" units · "+x.grade+" · modeled recovery "+(x.recovery==null?"unpriced":money(x.recovery))+" per unit"),
 "Seller-reported headline count: "+lot.reportedCount+"; modeled count: "+a.units+
 (a.units!==lot.reportedCount?" (quantity mismatch requires reconciliation)":" (quantity alone is not a serial audit)"),"",
 "## Economics and pickup",
 ...(a.priced?[
 "Modeled gross recovery: "+money(a.recovery),
 "Proposed acquisition spend: "+money(a.buyTotal),
 "Testing/handling: "+money(a.testing)+" · freight: "+money(a.freight)+" · reserve: "+money(a.reserve),
 "Modeled net: "+money(a.net)+" · recovery margin: "+a.margin.toFixed(1)+"%",
 "Maximum buy/unit for "+r.targetMarginPct+"% target: "+money(a.maxUnit)
 ]:["UNPRICED: modeled unit recovery and acquisition offer are required before value conclusions."]),
 "",
 "## Verification plan (candidate, not booked)",
 "Budget: "+money(s.budget)+" · status: "+p.status+" · modeled plan: "+money(p.cost),
 ...p.selected.map(x=>"- "+clean(x.provider)+" · "+x.method+" · "+x.quote+" / "+x.availability),
 ...lot.needs.map(x=>"- "+clean(x.label)+" · "+(review[x.id]||"missing")+" · source: "+clean(x.source)),
 "Unresolved candidate coverage: "+(p.unresolved.map(x=>x.label).join("; ")||"none in candidate optimizer; proof still unconfirmed"),"",
 "## Buyer selection and next conversation",
 clean(s.buyerRequirements),clean(r.notes),
 "No buyer assent, custody transfer, inspection, actual offer, freight reservation, invoice or settlement has occurred."
 ];
 return lines.join("\n")+"\n";
}
export function buyerYaff(s){
 const lot=getLot(s),r=getRecord(s),a=assess(s),base={
  ...fresh("itad"),...s,opportunities:template.opportunities,current:lot.id,
  briefHeading:"Equipment acquisition · "+lot.title,recipient:s.recipient,
  notes:s.buyerRequirements+" "+r.notes,decision:"hold",hidden:[]
 };
 const original=toYaff(base);
 return original+
 "program itad-disposition-candidate\n"+
 "source "+quoted(r.source||"unbound")+"\n"+
 "seller_claim_units "+lot.reportedCount+"\n"+
 "manifest_units "+a.units+"\n"+
 "modeled_recovery_cents "+(a.priced?a.recovery:"unpriced")+"\n"+
 "buy_offer_cents "+(a.priced?a.buyTotal:"unpriced")+"\n"+
 "planned_pickup "+quoted(s.buyerRequirements)+"\n"+
 "rights unreviewed\ncustody none\nbuyer_assent none\n"+
 "cannot_infer source_claim_is_not_stock_verified_or_committed_purchase\n";
}
