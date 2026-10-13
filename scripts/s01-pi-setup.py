#!/usr/bin/env python3
"""Private synthetic provisioning through native privacyIDEA CLI/REST only."""
import http.client,json,os,secrets,socket,ssl,subprocess
from pathlib import Path
ROOT=Path.cwd().resolve();STATE=json.loads((ROOT/'.local/environment.json').read_text())
assert STATE['root']==str(ROOT) and STATE['syntheticOnly'] is True
PRIVATE=Path(STATE['private']);PROJECT=STATE['project']
subprocess.run(['bash','scripts/worktree-setup.sh','--check'],check=True)
ADMIN=PRIVATE/'pi/system-admin-password';MARKER=PRIVATE/'pi/system-admin-created.json'
listing=subprocess.run(['docker','exec',PROJECT+'-privacyidea-1','pi-manage','admin','list'],capture_output=True,text=True)
if listing.returncode: raise RuntimeError('NATIVE_ADMIN_INVENTORY_UNAVAILABLE')
admins={line.split('\t',1)[0].strip() for line in listing.stdout.splitlines() if '\t' in line}
assert not MARKER.exists() or ADMIN.exists(), 'Existing admin secret missing; never regenerate blindly'
assert MARKER.exists() or 's01-system' not in admins, 'Native admin exists without marker; reconcile retained credentials first'
if not ADMIN.exists():
    descriptor=os.open(ADMIN,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o400)
    with os.fdopen(descriptor,'w') as target: target.write(secrets.token_hex(32))
if not MARKER.exists():
    result=subprocess.run(['docker','exec','-i',PROJECT+'-privacyidea-1','pi-manage','admin','add','s01-system','--email','identity@example.invalid'],input=((ADMIN.read_text()+'\n')*2).encode(),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    if result.returncode: raise RuntimeError('NATIVE_PI_ADMIN_FAILED')
    descriptor=os.open(MARKER,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o400)
    with os.fdopen(descriptor,'w') as target: target.write(json.dumps({'syntheticOnly':True,'admin':'s01-system'}))
VERIFIER=PRIVATE/'pi/verifier-password';VERIFIER_MARKER=PRIVATE/'pi/verifier-created.json'
assert not VERIFIER_MARKER.exists() or VERIFIER.exists(), 'Existing verifier secret missing; never regenerate blindly'
assert VERIFIER_MARKER.exists() or 's01-verifier' not in admins, 'Native verifier exists without marker; reconcile retained credentials first'
if not VERIFIER.exists():
    descriptor=os.open(VERIFIER,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o400)
    with os.fdopen(descriptor,'w') as target: target.write(secrets.token_hex(32))
if not VERIFIER_MARKER.exists():
    result=subprocess.run(['docker','exec','-i',PROJECT+'-privacyidea-1','pi-manage','admin','add','s01-verifier','--email','identity@example.invalid'],input=((VERIFIER.read_text()+'\n')*2).encode(),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    if result.returncode: raise RuntimeError('NATIVE_PI_VERIFIER_FAILED')
    descriptor=os.open(VERIFIER_MARKER,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o400)
    with os.fdopen(descriptor,'w') as target: target.write(json.dumps({'syntheticOnly':True,'admin':'s01-verifier'}))
data=json.loads(subprocess.check_output(['docker','inspect','--format','{{json .NetworkSettings.Networks}}',PROJECT+'-privacyidea-1']))
ADDRESS=data[PROJECT+'_private']['IPAddress']
class PrivateTLS(http.client.HTTPSConnection):
    def connect(self):
        self.sock=self._context.wrap_socket(socket.create_connection((ADDRESS,8443),timeout=20),server_hostname='privacyidea')
def request(method,path,body=None,token=None):
    connection=PrivateTLS('privacyidea',8443,context=ssl.create_default_context(cafile=PRIVATE/'ca/ca.crt'),timeout=20)
    headers={'Content-Type':'application/json'} if body is not None else {}
    if token: headers['PI-Authorization']=token
    try:
        connection.request(method,path,json.dumps(body) if body is not None else None,headers)
        response=connection.getresponse();payload=json.loads(response.read())
        if response.status!=200 or not payload.get('result',{}).get('status'):
            error=payload.get('result',{}).get('error',{})
            message=str(error.get('message',''))[:400]
            for file in PRIVATE.rglob('*'):
                if file.is_file():
                    try: value=file.read_text().strip()
                    except UnicodeError: continue
                    if len(value)>=16: message=message.replace(value,'[REDACTED]')
            if token: message=message.replace(token,'[REDACTED]')
            print(json.dumps({'nativeStatus':response.status,'code':error.get('code'),'safeMessage':message}))
            raise RuntimeError('NATIVE_PI_REST_FAILED_'+str(response.status))
        return payload['result']['value']
    finally: connection.close()
TOKEN=request('POST','/auth',{'username':'s01-system','password':ADMIN.read_text().strip()})['token']
AUTH={'method':'POST','endpoint':'/realms/{realm}/protocol/openid-connect/token','headers':'{"Content-Type":"application/x-www-form-urlencoded"}','requestMapping':'grant_type=client_credentials&client_id={username}&client_secret={password}','responseMapping':'{"Authorization":"Bearer {access_token}"}'}
resolver={'type':'keycloakresolver','realm':'dossiercle','base_url':'https://keycloak:8443','username':'s01-resolver','password':(PRIVATE/'kc/client-s01-resolver').read_text().strip(),'config_authorization':AUTH,'config_user_auth':'{}','Editable':False,'verify_tls':True,'tls_ca_path':'/run/s01-tls/ca.crt','timeout':5}
request('POST','/resolver/s01-keycloak',resolver,TOKEN)
request('POST','/realm/dossiercle',{'resolvers':['s01-keycloak']},TOKEN)
policies=[('s01-user','user','enrollTOTP,totp_otplen=6,totp_timestep=30,totp_hashlib=sha1'),('s01-enrollment','enrollment','verify_enrollment=totp'),('s01-webui','webui','remote_user=force,login_mode=disable,jwt_validity=600,default_tokentype=totp'),('s01-auth','authentication','otppin=none')]
for name,scope,action in policies:
    request('POST','/policy/'+name,{'scope':scope,'action':action,'realm':'dossiercle','resolver':'s01-keycloak','active':True,'priority':1},TOKEN)
# Admin scope becomes deny by default; each native DB admin has an explicit capability.
request('POST','/policy/s01-system-admin',{'scope':'admin','action':'resolverread,resolverwrite,policyread,policywrite,configwrite,configread','adminuser':'s01-system','active':True},TOKEN)
request('POST','/policy/s01-verifier-admin',{'scope':'admin','action':'tokenlist','adminuser':'s01-verifier','realm':'dossiercle','active':True},TOKEN)
webui=request('GET','/policy/s01-webui',token=TOKEN)
assert isinstance(webui,list) and len(webui)==1 and webui[0].get('action',{}).get('default_tokentype')=='totp', 'Native enrollment UI must default to TOTP'
request('POST','/system/setConfig',{'totp.timeStep':30,'totp.timeWindow':60,'totp.hashlib':'sha1'},TOKEN)
current=request('GET','/resolver/s01-keycloak',token=TOKEN)['s01-keycloak']
assert current['type']=='keycloakresolver'
assert current['data']['config_authorization']['requestMapping']==AUTH['requestMapping']
assert current['data']['config_user_auth'] in [{},'{}']
assert current['data']['base_url']=='https://keycloak:8443'
assert current['data']['Editable'] is False or str(current['data']['Editable']).lower()=='false'
print('SYNTHETIC_PI_RESOLVER_POLICIES_CONFIGURED; MFA NOT QUALIFIED; BUSINESS CLOSED')
