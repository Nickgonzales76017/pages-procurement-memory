import test from "node:test";
import assert from "node:assert/strict";
import {fresh,cents,money,eligible,routePrice,optimize,parseTsv,validSource,toMarkdown,toYaff} from "../site/brief-studio/core.mjs";

test("working domain scenarios remain distinct and bounded",()=>{
 const itad=fresh("itad"),estate=fresh("property"),supplier=fresh("supplier"),civic=fresh("civic");
 assert.equal(itad.opportunities.length,3);
 assert.equal(estate.opportunities.length,1);
 assert.equal(supplier.opportunities.length,1);
 assert.equal(civic.opportunities.length,1);
 assert.equal(civic.opportunities[0].needs.find(x=>x.id==="rights").kind,"rights");
 assert.match(itad.opportunities[0].assertion,/35 HP desktops/);
 assert.equal(estate.opportunities[0].needs.find(x=>x.id==="title").kind,"title");
 assert.equal(supplier.opportunities[0].needs.find(x=>x.id==="capacity").kind,"capacity");
 assert.throws(()=>fresh("unknown"));
});
test("only a qualified specialist route can propose title coverage",()=>{
 assert.equal(eligible("owner","title"),false);
 assert.equal(eligible("desk","title"),false);
 assert.equal(eligible("field","title"),false);
 assert.equal(eligible("licensed","title"),true);
 assert.equal(eligible("desk","rights"),false);
 assert.equal(eligible("owner","rights"),true);
 assert.equal(eligible("owner","condition"),false);
 assert.equal(eligible("field","condition"),true);
 assert.equal(eligible("owner","model"),true);
});
test("shared travel charges once for exact provider and visit group",()=>{
 const op=fresh("itad").opportunities[0];
 const routes=op.offers.filter(x=>x.group==="houston");
 assert.equal(routes.length,2);
 assert.equal(new Set(routes.map(x=>x.provider)).size,1);
 assert.equal(routePrice(routes),cents(170));
 assert.equal(routePrice([{...routes[0]},{...routes[1],provider:"second provider"}]),cents(235));
});
test("Houston example has a bounded complete exploratory route",()=>{
 const s=fresh("itad"),plan=optimize(s.opportunities[0],s.budget,"exploratory");
 assert.equal(plan.status,"candidate_full");
 assert.equal(plan.cost,cents(80));
 assert.equal(plan.unresolved.length,0);
 assert.equal(plan.covered.size,4);
 assert.ok(plan.selected.some(x=>x.id==="ownership"));
});
test("documented mode refuses estimated supplier availability",()=>{
 const s=fresh("itad"),p=optimize(s.opportunities[0],s.budget,"documented");
 assert.notEqual(p.status,"candidate_full");
 assert.equal(p.selected.length,0);
 assert.equal(p.unresolved.length,4);
});
test("budget collapse retains unresolved proof rather than claiming success",()=>{
 const s=fresh("itad"),p=optimize(s.opportunities[0],0,"exploratory");
 assert.equal(p.status,"over_budget");
 assert.ok(p.unresolved.some(n=>n.id==="owner"));
 assert.equal(p.cost,0);
});
test("property title and condition cannot be replaced by a free seller statement",()=>{
 const s=fresh("property"),p=optimize(s.opportunities[0],s.budget,"exploratory");
 assert.equal(p.status,"over_budget");
 assert.ok(p.unresolved.length>0);
 const larger=optimize(s.opportunities[0],cents(500),"exploratory");
 assert.equal(larger.status,"candidate_full");
 assert.ok(larger.selected.some(r=>r.method==="licensed"));
});
test("TSV parser preserves allowed source identity, bounded rows, and quoted fields",()=>{
 const content="title\tsubject\tsource\tassertion\n\"A\tB\"\tcase:1\thttps://example.org/record\t\"Seller lists two\nunits\"\n";
 const rows=parseTsv(content);
 assert.equal(rows.length,1);
 assert.equal(rows[0].title,"A\tB");
 assert.match(rows[0].assertion,/two\nunits/);
 assert.throws(()=>parseTsv("title\tsubject\tsource\tassertion\nx\ty\tjavascript:alert(1)\tz"));
 assert.throws(()=>parseTsv("title\tsubject\nbad\trow"));
 assert.equal(validSource("https://example.org/a"),true);
 assert.equal(validSource("http://example.org/a"),false);
 assert.equal(validSource("https://u:p@example.org/a"),false);
});
test("exports are source-labeled buyer deliverables and typed handoffs",()=>{
 const s=fresh("itad"),md=toMarkdown(s),yaff=toYaff(s);
 assert.match(md,/35 HP desktops/);
 assert.match(md,/For: Illustrative ITAD buyer/);
 assert.match(md,/Planning estimates do not prove availability/);
 assert.match(yaff,/program acquisition-brief-proposal/);
 assert.match(yaff,/authority none/);
 assert.match(yaff,/plan_status candidate_full/);
 s.hidden=["Source"];assert.doesNotMatch(toMarkdown(s),/## Source/);
});
test("money never silently treats invalid amounts as zero",()=>{
 assert.equal(cents("1.25"),125);
 assert.match(money(17000),/\$170\.00/);
 assert.throws(()=>cents(-1));
 assert.throws(()=>cents("bad"));
});
