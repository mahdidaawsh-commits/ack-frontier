import ast
import hashlib
import itertools
import json
from pathlib import Path
import random
import re
import subprocess
import pytest

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'contracts/ack_frontier.py'
REPO='mahdidaawsh-commits/ack-frontier'
EVENTS=['amber_alarm','amber_ack','blue_alarm','blue_ack']
CASES={'timely':['timely-zero','timely-one','timely-two'],
       'repeated':['repeat-zero','repeat-one','empty-two','late-three'],
       'uncertain':['uncertain-zero','empty-one','empty-two']}
FACTS={'timely-zero':['YES','NO','YES','NO'],'timely-one':['NO','YES','NO','NO'],
       'timely-two':['NO','NO','NO','YES'],'repeat-zero':['YES','NO','NO','NO'],
       'repeat-one':['YES','NO','NO','NO'],'empty-two':['NO']*4,
       'late-three':['NO','YES','NO','NO'],'uncertain-zero':['UNKNOWN','NO','NO','NO'],'empty-one':['NO']*4}
ANCHORS={'timely-zero':[1,2,1,2],'timely-one':[2,1,2,1],'timely-two':[2,1,2,1],
         'repeat-zero':[1,2,1,2],'repeat-one':[1,2,1,2],'empty-two':[1]*4,
         'late-three':[2,1,2,1],'uncertain-zero':[0,2,1,2],'empty-one':[1]*4}

def pure():
    tree=ast.parse(SOURCE.read_text());tree.body=[n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.Assign,ast.Import))]
    ns={};exec(compile(tree,str(SOURCE),'exec'),ns);return ns

def record(name):
    body=(ROOT/'records'/f'{name}.json').read_bytes()
    url=f'https://raw.githubusercontent.com/{REPO}/'+'a'*40+f'/records/{name}.json'
    return url,hashlib.sha256(body).hexdigest(),body

def args(case='timely',deadline=2):
    records=[record(name) for name in CASES[case]]
    return [REPO,'packing-line',deadline,[r[0] for r in records],[r[1] for r in records]]

def rows(name):
    return {'rows':[{'event':event,'value':value,'anchors':[ANCHORS[name][i]]} for i,(event,value) in enumerate(zip(EVENTS,FACTS[name]))]}

def mocks(vm,name,decision=None,audit=None,body=None,status=200):
    vm.clear_mocks();url,_,raw=record(name)
    vm.mock_web(re.escape(url),{'status':status,'body':raw if body is None else body})
    vm.mock_llm(r'.*ACKFRONTIER-EXTRACT.*',json.dumps(rows(name) if decision is None else decision))
    vm.mock_llm(r'.*ACKFRONTIER-AUDIT.*',json.dumps({'decisions_correct':True,'anchors_support':True} if audit is None else audit))

@pytest.mark.parametrize('case,status,frontier',[
    ('timely','CLEAR',[[-1,-1]]),('repeated','VIOLATED',[[2,-1]]),
    ('uncertain','AT_RISK',[[-1,-1],[2,-1]])])
def test_full_timelines_and_append_only_history(direct_deploy,direct_vm,case,status,frontier):
    c=direct_deploy(str(SOURCE),*args(case));previous=c.get_state()
    for i,name in enumerate(CASES[case]):
        mocks(direct_vm,name);c.advance();assert direct_vm.run_validator() is True
        state=c.get_state();assert state['cursor']==i+1
        assert state['history'][:-1]==previous['history']
        h=state['history'][-1];assert h['before']==previous['frontier'] and h['after']==state['frontier']
        assert h['evidence']['source']==json.loads(record(name)[2])
        previous=state
    assert state['summary']['status']==status and state['frontier']==frontier and state['lifecycle']=='EXHAUSTED'
    with direct_vm.expect_revert('Timeline exhausted'):c.advance()
    assert c.get_state()==state

def test_exact_deadline_ack_and_transport_decoy(direct_deploy,direct_vm):
    c=direct_deploy(str(SOURCE),*args());mocks(direct_vm,'timely-zero');c.advance()
    assert c.get_state()['frontier']==[[0,0]]
    mocks(direct_vm,'timely-one');c.advance();assert c.get_state()['frontier']==[[-1,1]]
    mocks(direct_vm,'timely-two');c.advance();assert c.get_state()['summary']['status']=='CLEAR'

def test_repeated_alarm_does_not_restart_oldest_deadline(direct_deploy,direct_vm):
    c=direct_deploy(str(SOURCE),*args('repeated'))
    for name,expected in [('repeat-zero',[[0,-1]]),('repeat-one',[[1,-1]]),('empty-two',[[2,-1]]),('late-three',[[2,-1]])]:
        mocks(direct_vm,name);c.advance();assert c.get_state()['frontier']==expected

def test_exhaustion_preserves_pending_obligations(direct_deploy,direct_vm):
    a=args();a[3]=a[3][:1];a[4]=a[4][:1]
    c=direct_deploy(str(SOURCE),*a);mocks(direct_vm,'timely-zero');c.advance()
    s=c.get_state();assert s['lifecycle']=='EXHAUSTED' and s['summary']['status']=='PENDING'

@pytest.mark.parametrize('index',range(4))
def test_independent_validator_checks_every_event(direct_deploy,direct_vm,index):
    c=direct_deploy(str(SOURCE),*args());mocks(direct_vm,'timely-zero');c.advance()
    changed=rows('timely-zero');changed['rows'][index]['value']='NO' if changed['rows'][index]['value']=='YES' else 'YES'
    mocks(direct_vm,'timely-zero',decision=changed);assert direct_vm.run_validator() is False

@pytest.mark.parametrize('replacement',['YES','NO'])
def test_validator_does_not_tolerate_unknown_as_yes_or_no(direct_deploy,direct_vm,replacement):
    c=direct_deploy(str(SOURCE),*args('uncertain'));mocks(direct_vm,'uncertain-zero');c.advance()
    changed=rows('uncertain-zero');changed['rows'][0]['value']=replacement
    mocks(direct_vm,'uncertain-zero',decision=changed);assert direct_vm.run_validator() is False

@pytest.mark.parametrize('verdict',[{'decisions_correct':False,'anchors_support':True},
    {'decisions_correct':True,'anchors_support':False},{'decisions_correct':'true','anchors_support':True},
    {'decisions_correct':True,'anchors_support':True,'extra':True}])
def test_validator_requires_material_full_source_audit(direct_deploy,direct_vm,verdict):
    c=direct_deploy(str(SOURCE),*args());mocks(direct_vm,'timely-zero');c.advance()
    mocks(direct_vm,'timely-zero',audit=verdict);assert direct_vm.run_validator() is False

def test_validator_really_refetches_source_bytes(direct_deploy,direct_vm):
    c=direct_deploy(str(SOURCE),*args());mocks(direct_vm,'timely-zero');c.advance()
    mocks(direct_vm,'timely-zero',body=b'changed source');assert direct_vm.run_validator() is False

@pytest.mark.parametrize('mutation',['bool','lowercase','missing','extra','order','anchor','repeat-anchor','empty-anchor'])
def test_malformed_model_never_advances_cursor(direct_deploy,direct_vm,mutation):
    c=direct_deploy(str(SOURCE),*args());bad=rows('timely-zero')
    if mutation=='bool':bad['rows'][0]['value']=True
    elif mutation=='lowercase':bad['rows'][0]['value']='yes'
    elif mutation=='missing':bad['rows'].pop()
    elif mutation=='extra':bad['rows'][0]['memo']='extra'
    elif mutation=='order':bad['rows'].reverse()
    elif mutation=='anchor':bad['rows'][0]['anchors']=[100]
    elif mutation=='repeat-anchor':bad['rows'][0]['anchors']=[1,1]
    else:bad['rows'][0]['anchors']=[]
    mocks(direct_vm,'timely-zero',decision=bad)
    with direct_vm.expect_revert('Invalid event rows'):c.advance()
    assert c.get_state()['cursor']==0 and c.get_state()['history']==[]

@pytest.mark.parametrize('status,body,error',[(503,None,'Report unavailable'),(404,None,'commitment mismatch'),(200,b'changed','commitment mismatch')])
def test_external_failure_is_atomic(direct_deploy,direct_vm,status,body,error):
    c=direct_deploy(str(SOURCE),*args());before=c.get_state();mocks(direct_vm,'timely-zero',body=body,status=status)
    with direct_vm.expect_revert(error):c.advance()
    assert c.get_state()==before

@pytest.mark.parametrize('body',[b'not json',b'X'*16001,
    b'{"series":"packing-line","checkpoint":0,"checkpoint":0,"clauses":["A sufficiently long report clause."]}',
    b'{"series":"packing-line","checkpoint":false,"clauses":["A sufficiently long report clause."]}',
    b'{"series":"packing-line","checkpoint":1,"clauses":["A sufficiently long report clause."]}',
    b'{"series":"other-series","checkpoint":0,"clauses":["A sufficiently long report clause."]}',
    b'{"series":"packing-line","checkpoint":0,"clauses":[]}'])
def test_committed_invalid_report_cannot_skip_checkpoint(direct_deploy,direct_vm,body):
    a=args();a[4][0]=hashlib.sha256(body).hexdigest();c=direct_deploy(str(SOURCE),*a)
    mocks(direct_vm,'timely-zero',body=body)
    with direct_vm.expect_revert():c.advance()
    assert c.get_state()['cursor']==0

@pytest.mark.parametrize('index,value',[(0,'bad'),(1,'bad series'),(2,0),(2,4),(2,True),(3,[]),
    (3,['https://example.com/report']), (4,['x'*64])])
def test_configuration_rejected(direct_deploy,direct_vm,index,value):
    a=args();a[index]=value
    with direct_vm.expect_revert():direct_deploy(str(SOURCE),*a)

@pytest.mark.parametrize('count',[16,17])
def test_bounded_timeline_capacity(direct_deploy,direct_vm,count):
    a=args();a[3]=[f'https://raw.githubusercontent.com/{REPO}/'+ 'a'*40 + f'/records/report-{i}.json' for i in range(count)];a[4]=['0'*64]*count
    if count==17:
        with direct_vm.expect_revert():direct_deploy(str(SOURCE),*a)
    else:
        c=direct_deploy(str(SOURCE),*a)
        assert len(c.get_state()['configuration']['reports'])==16

def test_duplicate_report_cannot_be_replayed_as_new_checkpoint(direct_deploy,direct_vm):
    a=args();a[3][1]=a[3][0]
    with direct_vm.expect_revert():direct_deploy(str(SOURCE),*a)

def independent_frontier(trace,deadline):
    # Enumerate COMPLETE possible event histories, then evaluate response windows directly.
    choices=[[False,True] if v=='UNKNOWN' else [v=='YES'] for step in trace for v in step]
    result=set();last=len(trace)-1
    for bits in itertools.product(*choices):
        world=[]
        for channel in range(2):
            alarms=[t for t in range(len(trace)) if bits[4*t+2*channel]]
            acks=[t for t in range(len(trace)) if bits[4*t+2*channel+1]]
            failed=any(t+deadline<=last and not any(t<=ack<=t+deadline for ack in acks) for t in alarms)
            if failed:world.append(deadline);continue
            latest=max(acks,default=-1);open_alarms=[t for t in alarms if t>latest]
            world.append(last-min(open_alarms) if open_alarms else -1)
        result.add(tuple(world))
    return [list(x) for x in sorted(result)]

@pytest.mark.parametrize('deadline',[1,2,3])
def test_all_729_single_channel_three_checkpoint_abstractions(deadline):
    f=pure()['advance_frontier']
    for ternary in itertools.product(['YES','NO','UNKNOWN'],repeat=6):
        trace=[[ternary[2*t],ternary[2*t+1],'NO','NO'] for t in range(3)]
        frontier=[[-1,-1]]
        for step in trace:frontier=f(frontier,step,deadline)
        assert frontier==independent_frontier(trace,deadline)

@pytest.mark.parametrize('seed',range(12))
def test_generated_two_channel_histories_against_window_oracle(seed):
    rng=random.Random(seed);f=pure()['advance_frontier']
    for _ in range(10):
        deadline=rng.randrange(1,4)
        trace=[[rng.choice(['YES','NO','NO','NO','UNKNOWN']) for _ in range(4)] for _ in range(rng.randrange(1,7))]
        frontier=[[-1,-1]]
        for step in trace:frontier=f(frontier,step,deadline)
        assert frontier==independent_frontier(trace,deadline)
        assert len(frontier)<=(deadline+2)**2

@pytest.mark.parametrize('deadline',[1,2,3])
def test_unknown_frontier_is_bounded_and_breaches_absorb(deadline):
    f=pure()['advance_frontier'];frontier=[[-1,-1]]
    for _ in range(6):frontier=f(frontier,['UNKNOWN']*4,deadline)
    assert len(frontier)==(deadline+2)**2
    assert f([[deadline,deadline]],['NO','YES','NO','YES'],deadline)==[[deadline,deadline]]

@pytest.mark.parametrize('case',list(CASES))
def test_js_full_history_oracle_matches_direct_states(direct_deploy,direct_vm,tmp_path,case):
    c=direct_deploy(str(SOURCE),*args(case));states=[c.get_state()]
    for name in CASES[case]:mocks(direct_vm,name);c.advance();states.append(c.get_state())
    file=tmp_path/'states.json';file.write_text(json.dumps({'case':case,'states':states}))
    subprocess.run(['node',str(ROOT/'scripts/check-snapshots.cjs'),str(file)],check=True)
