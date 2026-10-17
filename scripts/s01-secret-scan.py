# Synthetic-only index scan by default; --worktree includes unstaged/untracked files.
# Output never includes secret values or patterns.
import base64,json,subprocess,sys
from pathlib import Path
assert sys.argv[1:] in [[], ['--worktree']], 'SECRET_SCAN_USAGE'
worktree = sys.argv[1:] == ['--worktree']
state=json.loads(Path('.local/environment.json').read_text())
assert state['syntheticOnly'] is True and state['root']==str(Path.cwd().resolve()), 'SYNTHETIC_WORKTREE_REQUIRED'
private=Path(state['private'])
assert json.loads((private/'synthetic.json').read_text())=={'root':state['root'],'project':state['project']}, 'PRIVATE_ENVIRONMENT_MISMATCH'
for required in ['pg/control_coordinator','pi/pi-enckey','coordinator/session-encryption-key','coordinator/session-csrf-key']:
    assert (private/required).is_file(), 'REQUIRED_PRIVATE_KEY_UNAVAILABLE'
values=set()
for directory in ['pg','pi','kc','coordinator','inngest','owner-signing','t06-runtime','t06-migration','t06-provisioner-tls','t06-orchestrator-tls']:
    for path in (private/directory).rglob('*'):
        assert not path.is_symlink(), 'PRIVATE_SYMLINK_REFUSED'
        if not path.is_file(): continue
        name=path.name
        if name.endswith('.secret') or (directory=='pg' and name!='init.sql') or (directory=='owner-signing' and name=='private.pem') or name.startswith('client-s01-') or name.endswith('-password') or name.endswith('.key') or name=='session-csrf-key' or name in {'bootstrap','kc','pi','inngest','control_api','control_migrator','control_audit','control_coordinator','control_dispatcher','provisioner','pi-enckey','pi-pepper','pi-secret','pi-db','session-encryption-key','session-index-key','event-key','signing-key'} or name.startswith('rotation-password-') or name.endswith('-secret'):
            raw_value=path.read_bytes()
            value=raw_value.strip()
            if len(raw_value)>=16: values.add(raw_value)
            if len(value)>=16: values.add(value)
            if name.endswith('.key') or (directory=='owner-signing' and name=='private.pem'):
                values.update(line for line in value.splitlines() if len(line)>=40 and not line.startswith(b'-----'))
        if path.suffix=='.json':
            try: config=json.loads(path.read_text())
            except (ValueError,UnicodeError): continue
            def visit(obj,key=''):
                if isinstance(obj,dict):
                    for k,v in obj.items(): visit(v,k)
                elif isinstance(obj,list):
                    for v in obj: visit(v,key)
                elif isinstance(obj,str) and len(obj)>=16 and any(s in key.lower() for s in ['secret','password','encryptionkey','indexkey']) and not key.lower().endswith('file'):
                    values.add(obj.encode())
            visit(config)
representations=set()
for value in values:
    representations.update([value,value.hex().encode(),base64.b64encode(value)])
files=subprocess.check_output(['git','ls-files','-z',*(['--cached','--others','--exclude-standard'] if worktree else [])]).split(b'\0')
matches=[]; count=0
for raw in files:
    if not raw: continue
    path=Path(raw.decode()); count+=1
    content=path.read_bytes() if worktree else subprocess.check_output(['git','show',':'+str(path)])
    if any(value in content for value in representations): matches.append(str(path))
print(json.dumps({'scope':'worktree-including-untracked' if worktree else 'index','scannedFiles':count,**({'trackedFiles':count} if not worktree else {}),'privateRepresentations':len(representations),'matches':matches}))
assert not matches,'PRIVATE_SECRET_FOUND'
