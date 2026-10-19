const fs=require('node:fs'),path=require('node:path');
const {root,assert,equal,digest,sourceHash,save,invoke,read,rpc,receipt}=require('./transport.cjs');
const {cases,args,check}=require('./scenario.cjs');
async function main(){
 assert(await rpc('eth_chainId',[])==='0xf22f','Gasless StudioNet only');
 const revision=fs.readFileSync(path.join(root,'config/fixture-revision.txt'),'utf8').trim();assert(/^[a-f0-9]{40}$/.test(revision),'Pinned fixture revision');
 const suite=[];
 for(const id of Object.keys(cases)){
  const a=args(id,revision);
  for(let i=0;i<a[3].length;i++){const web=await fetch(a[3][i],{signal:AbortSignal.timeout(45000)});assert(web.ok&&digest(Buffer.from(await web.arrayBuffer()))===a[4][i],'Exact public report');}
  const deployment=await invoke(id+'-deployment',['deploy','--contract','contracts/ack_frontier.py','--args',...a.map(v=>typeof v==='string'?v:JSON.stringify(v))]);
  const r=await receipt(id+'-deployment',deployment,true),contract=r.to_address||r.recipient;
  const d={id,args:a,contract,deployment,sender:(r.from_address||r.sender).toLowerCase(),fixture_revision:revision,source_sha256:sourceHash,network:'studionet',chain_id:61999,calls:[]};
  suite.push(d);save('suite',suite);
  assert(fs.readFileSync(path.join(root,'contracts/ack_frontier.py')).equals(Buffer.from(await rpc('gen_getContractCode',[contract]),'base64')),'Exact live source');
  let state=await read(id+'-initial',['call',contract,'get_state']);check(id,state,revision);assert(state.cursor===0,'Fresh timeline');save(id+'-initial-state',state);
  const trace=[];
  for(let i=0;i<cases[id].length;i++){
   const label=id+'-advance-'+i,before=state,transaction=await invoke(label,['write',contract,'advance']);
   await receipt(label,transaction,true);state=await read(label+'-state',['call',contract,'get_state']);check(id,state,revision);
   assert(state.cursor===i+1&&equal(state.history.slice(0,-1),before.history),'Exact append-only advancement');
   d.calls.push({label,index:i,transaction});trace.push({label,index:i,transaction,state_before:before,state});save(id+'-trace',trace);save('suite',suite);
   console.log('VERIFIED',label,JSON.stringify(state.summary),JSON.stringify(state.frontier));
  }
  save(id+'-final-state',state);
  if(id==='timely'){
   d.repeat=await invoke(id+'-exhausted',['write',contract,'advance']);const rr=await receipt(id+'-exhausted',d.repeat,false);
   const raw=Buffer.from(rr.consensus_data.leader_receipt[0].result,'base64');assert(raw[0]===1&&raw.subarray(1).toString('utf8')==='[EXPECTED] Timeline exhausted','Exact exhaustion rejection');
   assert(equal(state,await read(id+'-exhausted-state',['call',contract,'get_state'])),'Rejected advance is atomic');save('suite',suite);
  }
 }
}
main().catch(e=>{console.error(e.stack,e.cause?.message||'');process.exitCode=1;});
