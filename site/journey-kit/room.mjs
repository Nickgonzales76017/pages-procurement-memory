/* Aurekai operating-room primitives.
 * Browser-local draft identity only. No substitute for native owner state.
 * Human-facing deliverables are Markdown and typed YAFF, never JSON exports.
 */
export const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const money=c=>(c/100).toLocaleString("en-US",{style:"currency",currency:"USD"});
export function cents(value,{empty=false}={}){
 if(empty&&(value===""||value==null))return null;
 if(typeof value==="string"&&!/^\d{1,9}(?:\.\d{1,2})?$/.test(value.trim()))throw Error("Enter a nonnegative amount with no more than two decimals.");
 const n=Number(value);if(!Number.isFinite(n)||n<0||n>10000000)throw Error("Amount is outside the supported range.");
 return Math.round(n*100);
}
export const dollars=v=>v==null?"":String((v/100).toFixed(2));
export function boundedInt(value,{min=0,max=100000}={}){
 const x=Number(value);if(!Number.isSafeInteger(x)||x<min||x>max)throw Error("Enter a whole number from "+min+" to "+max);
 return x;
}
export function sourceUrl(raw){
 if(!raw)return "";
 try{const u=new URL(raw);if(u.protocol!=="https:"||u.username||u.password||u.hash||u.href.length>700)throw 0;return u.href;}
 catch{throw Error("Use an HTTPS source without embedded credentials or fragments.");}
}
export function safeLines(text,required,{limit=150}={}){
 if(typeof text!=="string"||text.length>140000)throw Error("Input exceeds the 140KB local import limit.");
 const rows=text.replace(/^\uFEFF/,"").replace(/\r/g,"").split("\n").filter(s=>s.trim()&&!s.startsWith("#"));
 if(rows.length<2||rows.length>limit+1)throw Error("Import a header and 1–"+limit+" rows.");
 const names=rows.shift().split("\t").map(x=>x.trim().toLowerCase());
 if(new Set(names).size!==names.length||required.some(x=>!names.includes(x)))throw Error("Required columns: "+required.join(", "));
 return rows.map((line,i)=>{
  const cells=line.split("\t");if(cells.length!==names.length)throw Error("Row "+(i+2)+" has the wrong number of fields.");
  return Object.fromEntries(names.map((n,j)=>[n,cells[j].trim()]));
 });
}
const DATABASE="aurekai-native-proposals",STORE="revisions";
export async function openDraft(key){
 if(!("indexedDB" in globalThis))throw Error("This browser does not support retained local drafts.");
 const db=await new Promise((yes,no)=>{
  const r=indexedDB.open(DATABASE,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE);};
  r.onerror=()=>no(r.error);r.onsuccess=()=>yes(r.result);
 });
 const read=()=>new Promise((yes,no)=>{
  const tx=db.transaction(STORE,"readonly"),r=tx.objectStore(STORE).get(key);
  r.onsuccess=()=>yes(r.result??null);r.onerror=()=>no(r.error);
 });
 const write=(revision,value)=>new Promise((yes,no)=>{
  const tx=db.transaction(STORE,"readwrite"),table=tx.objectStore(STORE);let next;
  const r=table.get(key);
  r.onsuccess=()=>{const prev=r.result; if((prev?.revision??0)!==revision){tx.abort();return;}
    next=revision+1;table.put({revision:next,value:structuredClone(value)},key);};
  tx.oncomplete=()=>yes(next);
  tx.onabort=()=>no(Error("A newer local revision exists in another tab; reload before saving."));
  tx.onerror=()=>no(tx.error||Error("Local save refused."));
 });
 return {read,write,close:()=>db.close()};
}
export function download(name,content,type="text/plain;charset=utf-8"){
 const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
export const clean=s=>String(s??"").replace(/[\u0000-\u001f\t\n\r]+/g," ").trim().slice(0,900);
export const quoted=s=>'"'+clean(s).replaceAll('"',"'")+'"';
export const mark=(v)=>v?"Complete locally":"Needs review";
export function requireEvidence(list){
 return list.filter(x=>x.state!=="reviewed").map(x=>x.label);
}
export function renderProgress(root,stages,current){
 root.replaceChildren(...stages.map((s,i)=>{
  const a=document.createElement("button");a.type="button";a.className="chapter"+(s.done?" done":"")+(current===s.id?" chosen":"");
  a.setAttribute("aria-current",current===s.id?"step":"false");a.dataset.chapter=s.id;
  const n=document.createElement("b");n.textContent=String(i+1).padStart(2,"0");
  const label=document.createElement("span");label.textContent=s.title;
  const state=document.createElement("em");state.textContent=s.done?"Prepared":"Open";
  a.append(n,label,state);return a;
 }));
}
export function copyHuman(text){
 return navigator.clipboard?.writeText(text).then(()=>true).catch(()=>false)??Promise.resolve(false);
}
