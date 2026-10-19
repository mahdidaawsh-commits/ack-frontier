const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),repo='mahdidaawsh-commits/ack-frontier';
const events=['amber_alarm','amber_ack','blue_alarm','blue_ack'];
const cases={timely:['timely-zero','timely-one','timely-two'],repeated:['repeat-zero','repeat-one','empty-two','late-three'],uncertain:['uncertain-zero','empty-one','empty-two']};
const facts={'timely-zero':['YES','NO','YES','NO'],'timely-one':['NO','YES','NO','NO'],'timely-two':['NO','NO','NO','YES'],
 'repeat-zero':['YES','NO','NO','NO'],'repeat-one':['YES','NO','NO','NO'],'empty-two':['NO','NO','NO','NO'],
 'late-three':['NO','YES','NO','NO'],'uncertain-zero':['UNKNOWN','NO','NO','NO'],'empty-one':['NO','NO','NO','NO']};
const normal=x=>Array.isArray(x)?x.map(normal):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,normal(x[k])])):x;
const equal=(a,b)=>JSON.stringify(normal(a))===JSON.stringify(normal(b));
function assert(x,m){if(!x)throw Error(m);}
const source=name=>JSON.parse(fs.readFileSync(path.join(root,'records',name+'.json')));
function args(id,revision){const records=cases[id].map(name=>({url:`https://raw.githubusercontent.com/${repo}/${revision}/records/${name}.json`,hash:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'records',name+'.json'))).digest('hex')}));return [repo,'packing-line',2,records.map(r=>r.url),records.map(r=>r.hash)];}
function configuration(a){return {repository:a[0],series:a[1],deadline:a[2],reports:a[3].map((url,i)=>({checkpoint:i,url,sha256:a[4][i]}))};}
function oracle(trace,deadline){
 // Enumerate complete concrete histories, then inspect each alarm's entire response window.
 let histories=[[]];
 for(const step of trace)for(const value of step){const options=value==='UNKNOWN'?[false,true]:[value==='YES'];histories=histories.flatMap(h=>options.map(v=>[...h,v]));}
 const result=new Map(),last=trace.length-1;
 for(const history of histories){
  const world=[];
  for(let channel=0;channel<2;channel++){
   const alarms=[],acks=[];
   for(let t=0;t<trace.length;t++){if(history[4*t+2*channel])alarms.push(t);if(history[4*t+2*channel+1])acks.push(t);}
   const failed=alarms.some(t=>t+deadline<=last&&!acks.some(a=>a>=t&&a<=t+deadline));
   const latest=acks.length?Math.max(...acks):-1,unanswered=alarms.filter(t=>t>latest);
   world.push(failed?deadline:unanswered.length?last-Math.min(...unanswered):-1);
  }
  result.set(JSON.stringify(world),world);
 }
 return [...result.values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
}
function summary(frontier,deadline){
 function status(worlds){const n=worlds.filter(w=>w.includes(deadline)).length;return n===worlds.length?'VIOLATED':n?'AT_RISK':worlds.some(w=>w.some(a=>a>=0))?'PENDING':'CLEAR';}
 return {status:status(frontier),channels:[0,1].map(i=>status(frontier.map(w=>[w[i]]))),world_count:frontier.length};
}
function check(id,state,revision){
 const expectedConfig=configuration(args(id,revision));assert(equal(state.configuration,expectedConfig),'Frozen configuration');
 assert(Number.isInteger(state.cursor)&&state.cursor>=0&&state.cursor<=cases[id].length&&state.history.length===state.cursor,'Exact checkpoint cursor');
 const trace=[];let before=[[-1,-1]];
 state.history.forEach((entry,i)=>{
  const name=cases[id][i],src=source(name),e=entry.evidence;
  assert(entry.checkpoint===i&&equal(e.source,src),'Full exact acquired report '+name);
  assert(Object.keys(e).sort().join(',')==='checkpoint,rows,sha256,source,url'&&e.checkpoint===i&&e.url===expectedConfig.reports[i].url&&e.sha256===expectedConfig.reports[i].sha256,'Evidence commitment');
  assert(Array.isArray(e.rows)&&e.rows.length===4,'Four independently agreed atoms');
  e.rows.forEach((r,j)=>{
   assert(Object.keys(r).sort().join(',')==='anchors,event,value'&&r.event===events[j]&&r.value===facts[name][j],'Expected semantic atom '+events[j]);
   assert(Array.isArray(r.anchors)&&r.anchors.length>=1&&r.anchors.length<=3&&r.anchors.every(a=>Number.isInteger(a)&&a>=0&&a<src.clauses.length)&&equal(r.anchors,[...new Set(r.anchors)].sort((a,b)=>a-b)),'Material anchor index bounds');
  });
  trace.push(facts[name]);const after=oracle(trace,expectedConfig.deadline);
  assert(equal(entry.before,before)&&equal(entry.after,after)&&equal(entry.summary,summary(after,expectedConfig.deadline)),'Whole-history response-window oracle');
  before=after;
 });
 assert(equal(state.frontier,before)&&equal(state.summary,summary(before,expectedConfig.deadline)),'Exact current frontier and classifications');
 assert(state.lifecycle===(state.cursor===cases[id].length?'EXHAUSTED':'ACTIVE'),'No implicit closing of outstanding obligations');
 assert(Object.keys(state).sort().join(',')==='configuration,cursor,frontier,history,lifecycle,summary','Exact state schema');
}
module.exports={root,repo,events,cases,facts,args,configuration,oracle,summary,check,equal,assert};
