const fs=require('node:fs'),path=require('node:path');
const {root,assert,equal,digest,rpc,read,receiptSummary,save}=require('./transport.cjs');
const {decodeReceipt}=require('./receipt-calldata.cjs');
const {cases,args,check}=require('./scenario.cjs');
const load=name=>JSON.parse(fs.readFileSync(path.join(root,'proofs',name+'.json')));
async function main(){
 const offline=process.argv.includes('--offline'),suite=load('suite'),journal=load('transactions'),code=fs.readFileSync(path.join(root,'contracts/ack_frontier.py'));
 const revision=fs.readFileSync(path.join(root,'config/fixture-revision.txt'),'utf8').trim();
 assert(suite.length===3&&journal.source_sha256===digest(code),'Complete source-bound suite');if(!offline)assert(await rpc('eth_chainId',[])==='0xf22f','StudioNet only');
 const hashes=new Set(),summary={mode:offline?'offline-artifact':'fresh-rpc-and-state',verified_at:new Date().toISOString(),source_sha256:digest(code),instances:[],transactions:[]};
 async function verify(label,hash,d,expected,error){
  const saved=load(label+'-receipt'),r=offline?saved:await rpc('eth_getTransactionByHash',[hash]),s=receiptSummary(r);
  assert(!hashes.has(hash)&&journal.hashes[label]===hash,'Unique journaled transaction');hashes.add(hash);
  assert(s.hash===hash&&s.status==='FINALIZED'&&s.result==='MAJORITY_AGREE'&&s.agree>(s.agree+s.disagree+s.idle)/2,'Finalized strict consensus majority');
  const recordedVoters=Object.keys(r.consensus_data.votes).length;
  assert(recordedVoters===s.agree+s.disagree+s.idle&&recordedVoters===r.consensus_data.validators.length+1,'Complete final vote set: leader plus validator receipts');
  assert((r.to_address||r.recipient).toLowerCase()===d.contract.toLowerCase()&&(r.from_address||r.sender).toLowerCase()===d.sender,'Actual signer and target');
  assert(equal(saved.data,r.data)&&equal(saved.consensus_data.votes,r.consensus_data.votes)&&equal(await decodeReceipt(r),expected),'Actual decoded calldata and preserved votes');
  assert(error?s.execution==='ERROR':['SUCCESS','FINISHED_WITH_RETURN'].includes(s.execution),'Expected execution result');
  if(label.endsWith('-deployment'))assert(code.equals(Buffer.from(r.data.contract_code,'base64')),'Exact deployed source bytes');
  if(error){const raw=Buffer.from(r.consensus_data.leader_receipt[0].result,'base64');assert(raw[0]===1&&raw.subarray(1).toString('utf8')===error,'Exact error bytes');}
  summary.transactions.push({label,...s,recorded_voters:recordedVoters,validator_receipts:r.consensus_data.validators.length,rotation_count:r.rotation_count,round_count:r.num_of_rounds});
 }
 for(let i=0;i<suite.length;i++){
  const d=suite[i],id=Object.keys(cases)[i];assert(d.id===id&&d.chain_id===61999&&d.network==='studionet'&&d.fixture_revision===revision&&d.source_sha256===digest(code)&&equal(d.args,args(id,revision)),'Frozen deployment identity');
  await verify(id+'-deployment',d.deployment,d,{args:d.args});let previous=load(id+'-initial-state');check(id,previous,revision);assert(previous.cursor===0,'Fresh initial state');
  const trace=load(id+'-trace');assert(trace.length===cases[id].length&&d.calls.length===trace.length,'Complete checkpoint timeline');
  for(let j=0;j<trace.length;j++){
   const p=trace[j],call=d.calls[j];assert(equal(call,{label:id+'-advance-'+j,index:j,transaction:p.transaction})&&p.label===call.label&&p.index===j&&equal(p.state_before,previous),'Exact linked trace');
   await verify(p.label,p.transaction,d,{method:'advance',args:[]});check(id,p.state,revision);
   assert(p.state.cursor===j+1&&equal(p.state.history.slice(0,-1),previous.history),'Append-only checkpoint semantics');previous=p.state;
  }
  assert(equal(previous,load(id+'-final-state'))&&previous.lifecycle==='EXHAUSTED','Exact final state');
  if(id==='timely'){assert(d.repeat,'Exhaustion proof exists');await verify(id+'-exhausted',d.repeat,d,{method:'advance',args:[]},'[EXPECTED] Timeline exhausted');}
  else assert(!d.repeat,'No unplanned repeat');
  if(!offline){assert(code.equals(Buffer.from(await rpc('gen_getContractCode',[d.contract]),'base64')),'Fresh live source');assert(equal(previous,await read(id+'-fresh-final',['call',d.contract,'get_state'])),'Fresh full state matches');}
  summary.instances.push({id,contract:d.contract,summary:previous.summary,frontier:previous.frontier});
 }
 assert(hashes.size===14&&Object.keys(journal.hashes).length===14,'Exactly 14 planned receipts');summary.transaction_calldata_checked=true;summary.rejection_bytes_checked=true;
 if(!offline){summary.live_state_match=true;save('verification',summary);}console.log(JSON.stringify(summary,null,2));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
