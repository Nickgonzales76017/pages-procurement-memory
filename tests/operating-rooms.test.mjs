import test from "node:test";
import assert from "node:assert/strict";
import { initial as itad, lots, parseManifest, assess, verify, workflow, buyerBrief, buyerYaff } from "../site/itad-exchange/core.mjs";
import { initial as estate, EVIDENCE, parseParcels, calculate, review, fit, brief, toTypedProposal, verify as verifyEstate } from "../site/estate-exit/core.mjs";

test("ITAD: all three distinct seller-described lots preserve their unverified source identity",()=>{
 const s=itad();assert.equal(lots.length,3);
 assert.deepEqual(lots.map(x=>x.reportedCount),[35,120,8]);
 assert.equal(s.records[s.selected].rows[0].grade,"unknown");
 assert.equal(assess(s).priced,false);
 assert.match(buyerBrief(s),/UNPRICED/);
 assert.match(buyerBrief(s),/Buyer|buying/i);
 assert.equal(workflow(s).filter(x=>x.done).length,0);
});

test("ITAD: real per-line inventory and cents math drive a reproducible buyer maximum",()=>{
 const s=itad(),r=s.records[s.selected];
 r.rows[0].model="HP series confirmation required";
 r.rows[0].grade="untested";r.rows[0].recovery=13000;
 r.buyPerUnit=6000;r.testingPerUnit=1000;r.freight=25000;
 const x=assess(s);
 assert.equal(x.units,35);assert.equal(x.priced,true);
 assert.equal(x.recovery,455000);
 assert.equal(x.buyTotal,210000);
 assert.equal(x.testing,35000);assert.equal(x.reserve,45500);
 assert.equal(x.net,139500);assert.equal(x.maxUnit,8035);
 assert.equal(x.meetsTarget,true);
 assert.match(buyerBrief(s),/Modeled gross recovery: \$4,550\.00/);
 assert.match(buyerYaff(s),/buyer_assent none/);
 assert.match(buyerYaff(s),/buy_offer_cents 210000/);
});

test("ITAD: native-shared verification solver distinguishes estimated from documented",()=>{
 const s=itad();
 assert.equal(verify(s).status,"candidate_full");
 assert.equal(verify(s).cost,8000);
 assert.deepEqual(verify(s).unresolved,[]);
 s.mode="documented";
 assert.notEqual(verify(s).status,"candidate_full");
 assert.equal(verify(s).selected.length,0);
});

test("ITAD: batch manifest import refuses duplicate models, unsupported grades and invalid currencies",()=>{
 const header="model\tqty\tgrade\trecovery_per_unit\n";
 const records=parseManifest(header+"OptiPlex 7490\t4\tuntested\t200.50\nOptiPlex 7480\t4\tparts\t55\n");
 assert.equal(records.length,2);assert.equal(records[0].recovery,20050);
 assert.throws(()=>parseManifest(header+"Same\t4\tworking\t12\nSame\t3\tworking\t9\n"),/unique/);
 assert.throws(()=>parseManifest(header+"Unit\t3\tunproven\t12\n"),/grade/);
 assert.throws(()=>parseManifest(header+"Unit\t3\tworking\tinfinite\n"),/amount/);
});

test("ITAD: buyer-facing inquiry never leaks the operator's seller source",()=>{
 const s=itad(),source="https://seller.example.invalid/private-sourcing?lot=35";
 s.records[s.selected].source=source;
 const exported=buyerBrief(s);
 assert.ok(exported.includes("Held privately for operator verification"));
 assert.ok(!exported.includes(source));
 assert.ok(buyerYaff(s).includes(source),"the distinct internal YAFF handoff retains the exact source coordinate");
});
test("Fleming: the route solver's four questions stay distinct from six local evidence reviews",()=>{
 const s=estate(),solution=verifyEstate(s);
 assert.equal(solution.requiredCount,4);
 assert.equal(EVIDENCE.length,6);
 assert.equal(review(s).at(-1).done,false);
 s.prepared=true;
 assert.equal(review(s).at(-1).title,"Offer packet");
 assert.equal(review(s).at(-1).done,true);
 assert.match(brief(s),/No binding offer/);
});
test("Fleming: unassigned parcel is never manufactured as a title or priced exit",()=>{
 const s=estate();assert.equal(s.parcels.length,1);
 assert.equal(s.parcels[0].parcel,"");
 assert.equal(calculate(s).priced,false);
 assert.match(brief(s),/No official parcel source supplied/);
 assert.match(toTypedProposal(s),/title_opinion none/);
 assert.match(toTypedProposal(s),/escrow none/);
 assert.equal(review(s).filter(x=>x.done).length,0);
});

test("Fleming: three independent exit strategies compute from user-entered numbers",()=>{
 const s=estate(),f=s.finance;
 f.purchase=2000000;f.exit=5000000;f.rehab=1000000;f.monthlyHold=50000;
 f.months=6;f.monthlyRent=160000;f.annualOperating=600000;
 const rehab=calculate(s,"rehab"),asIs=calculate(s,"as-is"),rental=calculate(s,"rental");
 assert.equal(rehab.priced,true);assert.equal(rehab.net,1155000);
 assert.equal(rehab.meets,true);assert.equal(rehab.maxOffer,2393203);
 assert.equal(asIs.rehab,0);assert.ok(asIs.net>rehab.net);
 assert.equal(rental.noi,1320000);assert.equal(rental.indicated,16500000);
 s.investor.limit=2500000;assert.equal(fit(s).ready,true);
 s.investor.limit=1800000;assert.equal(fit(s).ready,false);
 assert.match(brief(s),/Maximum allowable purchase/);
 assert.match(toTypedProposal(s),/purchase_cents 2000000/);
});

test("Fleming: exact parcel import supports real source coordinates without inventing title",()=>{
 const header="parcel\taddress\tsource\towner\twidth_ft\tdepth_ft\n";
 const source="https://example.org/parcel";
 const one=parseParcels(header+"A-100\tRecorded address\t"+source+"\tSeller named\t40\t70\n");
 assert.equal(one[0].parcel,"A-100");assert.equal(one[0].width,40);
 assert.equal(one[0].proof.title.status,"missing");
 assert.throws(()=>parseParcels(header+"DUP\tA\t"+source+"\tOwner\t\t\nDUP\tB\t"+source+"\tOwner\t\t\n"),/unique/);
 assert.throws(()=>parseParcels(header+"F\tA\thttp://example.org\tOwner\t\t\n"),/HTTPS/);
 assert.equal(EVIDENCE.length,6);
});
