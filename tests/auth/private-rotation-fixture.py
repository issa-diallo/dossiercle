"""Offline supplier rotation on a separate synthetic PI database; secret I/O only via stdin/RAM."""
import base64,json,logging,os,re,resource,secrets,subprocess,sys,tempfile
from pathlib import Path
os.umask(0o077);resource.setrlimit(resource.RLIMIT_CORE,(0,0));logging.disable(logging.CRITICAL)
value=json.load(sys.stdin)
assert value['database'].startswith('s01_rotation_') and value['role'].startswith('s01_rotation_')
assert Path('/sys/fs/cgroup/memory.swap.max').read_text().strip()=='0','SYNTHETIC_RAM_REQUIRED'
if len(sys.argv)>1:
    from privacyidea.app import create_docker_app
    from privacyidea.lib.token import get_tokens
    from privacyidea.lib.config import get_from_config,set_privacyidea_config
    from privacyidea.lib.crypto import encryptPassword
    from privacyidea.lib.resolver import get_resolver_config,save_resolver
    from privacyidea.lib.user import User
    from privacyidea.models import db
    with create_docker_app().app_context():
        tokens=get_tokens(userid=value['subject'],resolver='s01-keycloak',tokentype='totp')
        assert len(tokens)==1,'ROTATION_TOKEN_COUNT'
        token=tokens[0]
        if sys.argv[1]=='resave':
            config=get_resolver_config('s01-keycloak')
            config.update({'resolver':'s01-keycloak','type':'keycloakresolver','password':value['resolverSecret']})
            save_resolver(config)
            set_privacyidea_config('__enckey_canary_v1',encryptPassword('PRIVACYIDEA_ENCKEY_CANARY_V1'))
            db.session.commit()
        else:
            assert token.token.rollout_state=='enrolled' and token.token.active and not token.token.revoked and not token.token.locked
            key=token.token.get_otpkey().getKey()
            if isinstance(key,str):key=key.encode()
            assert key in (base64.b32decode(value['seed']),base64.b32decode(value['seed']).hex().encode()),'ROTATION_SEED_MISMATCH'
            assert get_from_config('AutoResync',False,return_bool=True) is False,'ROTATION_AUTOSYNC_ENABLED'
            expected=User(login=value['subject'],realm='dossiercle',resolver='s01-keycloak').get_user_identifiers()
            assert expected[0]==value['subject'],'ROTATION_RESOLVER_IDENTITY'
            state={'count':token.token.count,'failcount':token.token.failcount,'type':token.token.tokentype,'rollout':token.token.rollout_state,'active':token.token.active,'user':token.get_user_id(),'ciphertext':token.token.key_enc,'serial':token.token.serial}
            if sys.argv[1]=='validate':
                assert token.check_otp(value['usedOtp'])==-1,'ROTATION_CONSUMED_OTP_REOPENED'
                assert token.check_otp(value['freshOtp'])!=-1,'ROTATION_FRESH_OTP_FAILED'
                db.session.commit()
            print(json.dumps(state))
    sys.exit(0)

# Keep key versions/checkpoint references. Only generated plaintext exports are removed.
directory=Path(tempfile.mkdtemp(prefix='s01-rotation-',dir='/dev/shm'))
old=directory/'enckey-v1';old.write_bytes(Path('/run/s01-secrets/pi-enckey').read_bytes());old.chmod(0o400)
new=directory/'enckey-v2';new.write_bytes(secrets.token_bytes(96));new.chmod(0o400)
base="from pathlib import Path\ns=Path('/run/s01-secrets')\nSQLALCHEMY_DATABASE_URI="+repr('postgresql+psycopg2://'+value['role']+':'+value['password']+'@postgres/'+value['database'])+"\nSQLALCHEMY_ENGINE_OPTIONS={'pool_size':2,'max_overflow':0,'pool_timeout':2}\nSECRET_KEY=(s/'pi-secret').read_text().strip()\nPI_PEPPER=(s/'pi-pepper').read_text().strip()\nPI_AUDIT_KEY_PRIVATE=str(s/'pi-audit.key')\nPI_AUDIT_KEY_PUBLIC=str(s/'pi-audit.pub')\nPI_AUDIT_SQL_URI=SQLALCHEMY_DATABASE_URI\nPI_LOGLEVEL=50\nPI_LOGFILE='/dev/null'\nDEBUG=False\nTESTING=False\n"
configs={}
for name,key in [('old',old),('new',new),('absent',directory/'absent')]:
    path=directory/(name+'.cfg');path.write_text(base+'PI_ENCFILE='+repr(str(key))+'\n');path.chmod(0o400);configs[name]=path
input_bytes=json.dumps(value).encode()
def call(config,command):
    replacement=Path('/etc/privacyidea/next.cfg')
    replacement.write_text(configs[config].read_text());replacement.chmod(0o400)
    os.replace(replacement,'/etc/privacyidea/pi.cfg')
    env={**os.environ,'PRIVACYIDEA_CONFIGFILE':str(configs[config]),'PI_CONFIG_NAME':'docker','PI_ENCFILE':str(new if config=='new' else old)}
    result=subprocess.run(command,input=input_bytes,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,timeout=45)
    return result
here=sys.argv[0]
before=call('old',[sys.executable,here,'state'])
if before.returncode!=0:
    details=re.findall(rb'AssertionError: ([A-Z_]{1,70})',before.stderr)
    kinds=re.findall(rb'\n([A-Za-z]+Error):',before.stderr)
    detail=details[-1].decode() if details else kinds[-1].decode().upper() if kinds else 'CLOSED'
    raise AssertionError('ROTATION_BEFORE_'+detail)
state=json.loads(before.stdout)
export=call('old',['privacyidea-token-janitor','find','--serial','^'+state['serial']+'$','--action','export','--yaml'])
assert export.returncode==0 and export.stdout,'ROTATION_EXPORT_FAILED'
yaml=directory/'tokens.yaml';yaml.write_bytes(export.stdout);yaml.chmod(0o600)
try:
    update=call('new',['privacyidea-token-janitor','update',str(yaml)])
    assert update.returncode==0,'ROTATION_UPDATE_FAILED'
finally:
    # ARCHITECTURE_OTP explicitly requires disposal of these generated plaintext exports.
    yaml.unlink(missing_ok=True)
resaved=call('new',[sys.executable,here,'resave']);assert resaved.returncode==0,'ROTATION_RESOLVER_RESAVE_FAILED'
after=call('new',[sys.executable,here,'state']);assert after.returncode==0,'ROTATION_AFTER_CLOSED'
current=json.loads(after.stdout)
assert state['ciphertext']!=current['ciphertext'],'ROTATION_CIPHERTEXT_UNCHANGED'
assert {k:v for k,v in state.items() if k!='ciphertext'}=={k:v for k,v in current.items() if k!='ciphertext'},'ROTATION_METADATA_CHANGED'
for config in ['old','absent']:
    canary=call(config,[sys.executable,'/opt/pi-canary.py','verify']);assert canary.returncode!=0,'ROTATION_INVALID_KEY_ACCEPTED'
canary=call('new',[sys.executable,'/opt/pi-canary.py','verify']);assert canary.returncode==0,'ROTATION_NEW_KEY_CANARY_FAILED'
validated=call('new',[sys.executable,here,'validate']);assert validated.returncode==0,'ROTATION_NATIVE_VALIDATION_FAILED'
assert not yaml.exists(),'ROTATION_PLAINTEXT_EXPORT_RETAINED'
(directory/'manifest.json').write_text(json.dumps({'syntheticOnly':True,'version':2,'checkpoint':'ciphertext-only','oldKeyRetained':True,'plaintextExportAbsent':True}))
print(json.dumps({'rotation':True,'nativeValidation':True,'resolver':True,'metadataPreserved':True,'ciphertextChanged':True,'usedOtpClosed':True,'missingAndOldKeyClosed':True,'plaintextExportAbsent':True}))
