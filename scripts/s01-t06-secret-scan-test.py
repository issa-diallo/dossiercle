"""Exercise recursive scanner coverage with synthetic canaries, never real credentials."""
import base64,json,os,secrets,subprocess,uuid
from pathlib import Path
state=json.loads(Path('.local/environment.json').read_text())
assert state['syntheticOnly'] is True and state['root']==str(Path.cwd().resolve()),'SYNTHETIC_REQUIRED'
private=Path(state['private'])
target=Path('docs/agentic/work/74-s01-t06/scanner-canary.fixture')
assert not target.exists(),'SCANNER_FIXTURE_EXISTS'
assert subprocess.run(['git','check-ignore','-q',str(target)]).returncode==1,'SCANNER_FIXTURE_IGNORED'
cases=[]
try:
    for category in ['t06-runtime','t06-migration','t06-provisioner-tls','t06-orchestrator-tls']:
        directory=private/category/('scanner-'+str(uuid.uuid4()))
        directory.mkdir(mode=0o700)
        value=secrets.token_urlsafe(48).encode()
        suffix='.key' if category.endswith('tls') else '.secret'
        path=directory/('canary'+suffix)
        with path.open('xb') as out: out.write(value)
        path.chmod(0o400)
        for encoding,payload in [('raw',value),('hex',value.hex().encode()),('base64',base64.b64encode(value))]:
            fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
            try: os.write(fd,payload)
            finally: os.close(fd)
            try:
                result=subprocess.run(['python3','scripts/s01-secret-scan.py','--worktree'],capture_output=True,text=True)
                report=json.loads(result.stdout)
                assert result.returncode!=0 and report['matches']==[str(target)],'SCANNER_CANARY_NOT_DETECTED'
                cases.append({'category':category,'encoding':encoding,'detected':True})
            finally: target.unlink()
finally:
    if target.exists(): target.unlink()
result=subprocess.run(['python3','scripts/s01-secret-scan.py','--worktree'],capture_output=True,text=True)
assert result.returncode==0,'SCANNER_FINAL_POSITIVE_FAILED'
print(json.dumps({'syntheticOnly':True,'recursiveCanaryCases':len(cases),'allDetected':True,'finalNoMatches':True}))
