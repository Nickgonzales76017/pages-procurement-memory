/* Source review at the Brief Studio boundary. Human review != native admission.
 * An incoming ForeignTwin coordinate is a candidate until a reviewer explicitly
 * chooses it. Rejection/defer never become a brief or a made-up source fact.
 */
import {validSource} from "./core.mjs";
const ID=/^[a-zA-Z0-9][a-zA-Z0-9:._-]{1,159}$/,HEX=/^(?:foreign:sha256:|sha256:)?[a-f0-9]{64}$/;
const states=new Set(["pending","approved","rejected","deferred"]);
export const verifyEntry=e=>{
 if(!e||typeof e!=="object"||!ID.test(e.source_ref||"")||!validSource(e.url||"")||
   !Number.isSafeInteger(e.revision)||e.revision<1||e.revision>2147483647||
   typeof e.title!=="string"||!e.title.trim()||e.title.length>160||
   typeof e.assertion!=="string"||e.assertion.length>1200||
   typeof e.profile!=="string"||!["itad","property","supplier","civic"].includes(e.profile)||
   e.digest && !HEX.test(e.digest))
   throw Error("ForeignTwin handoff lacks a bounded, exact source identity, revision or HTTPS original.");
 return {source_ref:e.source_ref,url:e.url,revision:e.revision,title:e.title,
   assertion:e.assertion,profile:e.profile,digest:e.digest||null};
};
export const fingerprint=e=>[e.source_ref,e.url,e.revision,e.digest||"-"].join("\u001f");
export function intake(set,items) {
 const accepted=Array.isArray(set)?set:[];
 if(!Array.isArray(items)||items.length>32)throw Error("Handoff exceeds the bounded 32 source review limit.");
 const map=new Map(accepted.map(x=>[x.source_ref,x]));
 const seen=new Set();
 for(const data of items){
   const entry=verifyEntry(data);
   if(seen.has(entry.source_ref))throw Error("Duplicate source identity in handoff: "+entry.source_ref);
   seen.add(entry.source_ref);
   const old=map.get(entry.source_ref);
   if(old&&entry.revision<old.revision)throw Error("Refusing a stale source revision: "+entry.source_ref);
   if(old&&entry.revision===old.revision&&fingerprint(entry)!==fingerprint(old))
      throw Error("Same source revision carries conflicting provenance: "+entry.source_ref);
   if(!old)map.set(entry.source_ref,{...entry,status:"pending",reason:"",reviewed_at:null});
   else if(entry.revision>old.revision)map.set(entry.source_ref,{...entry,status:"pending",reason:"Source changed; old review not reused",reviewed_at:null});
 }
 return [...map.values()].sort((a,b)=>a.source_ref.localeCompare(b.source_ref));
}
export function decide(rows,ref,status,reason="",expectedRevision=null) {
 if(!states.has(status)||status==="pending")throw Error("Choose approve, reject or defer.");
 const existing=rows.find(x=>x.source_ref===ref);
 if(!existing)throw Error("Review requires an admitted candidate identity.");
 if(expectedRevision!==null&&existing.revision!==expectedRevision)throw Error("Source revision changed; re-inspect before deciding.");
 if(status==="rejected"&&!String(reason).trim())throw Error("A rejected source needs a specific reason.");
 return rows.map(x=>x.source_ref!==ref?x:{...x,status,reason:String(reason).trim().slice(0,300),
   reviewed_at:new Date().toISOString()});
}
export function acceptedOnly(rows,profile) {
 if(!["itad","property","supplier","civic"].includes(profile))throw Error("Unknown recipient domain.");
 return rows.filter(e=>e.status==="approved"&&e.profile===profile);
}
export function makeOpportunity(e,base) {
 if(e.status!=="approved")throw Error("Only explicitly reviewed source candidates may enter a brief.");
 const template=structuredClone(base);
 template.id="source-"+e.source_ref.toLowerCase().replace(/[^a-z0-9-]/g,"-").slice(0,59);
 template.title=e.title;template.subject=e.source_ref;template.source=e.url;
 template.assertion=e.assertion||"No material assertion provided by the source owner. Inspect source before interpretation.";
 template.needs=template.needs.map(n=>({...n,status:"missing",
   source:n.source||e.source_ref}));
 template.offers=template.offers.map(r=>({...r}));
 template.source_review={identity:e.source_ref,revision:e.revision,digest:e.digest,
  decision:"browser_review_only",reviewed_at:e.reviewed_at};
 return template;
}
export function parseTransport(url) {
 const raw=new URL(url).hash.replace(/^#sources=/,"");
 if(!new URL(url).hash.startsWith("#sources="))return [];
 if(raw.length>17500||!/^[A-Za-z0-9_-]+$/.test(raw))throw Error("Invalid bounded source handoff.");
 const binary=atob(raw.replace(/-/g,"+").replace(/_/g,"/"));
 const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 const text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
 const data=JSON.parse(text);
 if(data?.kind!=="aurekai.foreign-source-candidates.v1"||!Array.isArray(data.items))
  throw Error("Not a ForeignTwin source candidate set.");
 return data.items.map(verifyEntry);
}
export function transport(items) {
 if(!Array.isArray(items)||items.length>32)throw Error("Too many source candidates.");
 const payload=JSON.stringify({kind:"aurekai.foreign-source-candidates.v1",
   items:items.map(verifyEntry)});
 const bytes=new TextEncoder().encode(payload);
 if(bytes.length>12000)throw Error("Source handoff too large; split the review batch.");
 let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);
 return "#sources="+btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
