#!/usr/bin/env python3
"""Synthetic native identity bootstrap. No browser/user MFA is bypassed."""
import json, os, secrets, subprocess, urllib.request, urllib.parse, urllib.error
from s01_native_transport import bootstrap_service_token, keycloak_opener
from pathlib import Path
ROOT=Path.cwd().resolve()
STATE=json.loads((ROOT/'.local/environment.json').read_text())
assert STATE['root']==str(ROOT) and STATE['syntheticOnly'] is True
PRIVATE=Path(STATE['private']);PROJECT=STATE['project']
subprocess.run(['bash','scripts/worktree-setup.sh','--check'],check=True)
COMPOSE=['docker','compose','--env-file','.local/compose.env','-f','infra/local/compose.yaml']
def run(args):
    result=subprocess.run(args,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    if result.returncode: raise RuntimeError('NATIVE_COMMAND_FAILED_'+str(result.returncode))
def secret(name):
    path=PRIVATE/'kc'/name
    if not path.exists():
        descriptor=os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o400)
        with os.fdopen(descriptor,'w') as target: target.write(secrets.token_hex(32))
    return path.read_text().strip()
def address(service):
    data=json.loads(subprocess.check_output(['docker','inspect','--format','{{json .NetworkSettings.Networks}}',PROJECT+'-'+service+'-1']))
    return data[PROJECT+'_private']['IPAddress']
# Qualified native TLS transport for the read-only privacyIDEA resolver.
# Existing CA/ENCKEY are never regenerated. An incomplete certificate is closed.
tls=PRIVATE/'kc-tls'
if not (tls/'server.crt').exists() or (tls/'server.crt').stat().st_size==0:
    tls.mkdir(mode=0o700,exist_ok=True)
    def openssl(*args): run(['openssl',*map(str,args)])
    if not (tls/'server.key').exists():
        assert not (tls/'server.csr').exists()
        openssl('req','-newkey','rsa:2048','-nodes','-subj','/CN=keycloak','-keyout',tls/'server.key','-out',tls/'server.csr')
    assert (tls/'server.csr').exists()
    (tls/'extensions').write_text('subjectAltName=DNS:keycloak\n')
    next_cert=tls/'server.crt.next'
    assert not next_cert.exists(), 'Incomplete certificate output requires reconciliation'
    openssl('x509','-req','-in',tls/'server.csr','-CA',PRIVATE/'ca/ca.crt','-CAkey',PRIVATE/'ca/ca.key','-set_serial',str(secrets.randbits(128)),'-days','7','-extfile',tls/'extensions','-out',next_cert)
    openssl('verify','-CAfile',PRIVATE/'ca/ca.crt','-verify_hostname','keycloak',next_cert)
    next_cert.chmod(0o400);os.replace(next_cert,tls/'server.crt')
    (tls/'ca.crt').write_bytes((PRIVATE/'ca/ca.crt').read_bytes())
    for file in tls.iterdir(): file.chmod(0o400)
assert (tls/'server.crt').exists() and (tls/'server.key').exists()
configuration=PRIVATE/'kc/keycloak.conf'
values=dict(line.split('=',1) for line in configuration.read_text().splitlines() if line and '=' in line)
if values.get('https-certificate-file')!='/run/s01-kc-tls/server.crt' or values.get('http-management-scheme')!='http':
    values.update({'http-management-scheme':'http','https-certificate-file':'/run/s01-kc-tls/server.crt','https-certificate-key-file':'/run/s01-kc-tls/server.key'})
    replacement=configuration.with_name('keycloak.conf.next')
    descriptor=os.open(replacement,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o400)
    with os.fdopen(descriptor,'w') as target: target.write('\n'.join(k+'='+v for k,v in values.items())+'\n');target.flush();os.fsync(target.fileno())
    os.replace(replacement,configuration)
    run(COMPOSE+['restart','keycloak'])
    run(COMPOSE+['up','-d','--wait','--wait-timeout','120','keycloak'])
run(COMPOSE+['up','-d','--wait','--wait-timeout','120','keycloak'])
marker=PRIVATE/'kc/bootstrap-service-applied.json'
assert not marker.exists() or (PRIVATE/'kc/bootstrap-client-secret').exists(), 'Bootstrap credential unavailable; reconcile, never regenerate'
bootstrap_secret=secret('bootstrap-client-secret')
if not marker.exists():
    run(COMPOSE+['stop','keycloak'])
    # Native offline recovery command; same DB config, no secret in argv or logs.
    run(COMPOSE+['run','--no-deps','--name',PROJECT+'-identity-bootstrap','--entrypoint','sh','keycloak','-ec',
        'export S01_BOOTSTRAP_SECRET="$(cat /run/s01-kc/bootstrap-client-secret)"; exec /opt/keycloak/bin/kc.sh --config-file=/run/s01-kc/keycloak.conf bootstrap-admin service --client-id s01-bootstrap --client-secret:env=S01_BOOTSTRAP_SECRET --no-prompt'])
    marker.write_text(json.dumps({'syntheticOnly':True,'clientId':'s01-bootstrap'}));marker.chmod(0o400)
    run(COMPOSE+['up','-d','--wait','--wait-timeout','120','keycloak'])
BASE='https://keycloak:8443'
OPENER=keycloak_opener(address('keycloak'),PRIVATE/'ca/ca.crt')
def request(method,path,body=None,token=None,form=False,timeout=20):
    headers={}
    if token: headers['Authorization']='Bearer '+token
    data=None
    if body is not None:
        headers['Content-Type']='application/x-www-form-urlencoded' if form else 'application/json'
        data=urllib.parse.urlencode(body).encode() if form else json.dumps(body).encode()
    req=urllib.request.Request(BASE+path,data=data,headers=headers,method=method)
    try:
        with OPENER.open(req,timeout=timeout) as result:
            raw=result.read(1048577)
            if len(raw)>1048576: raise RuntimeError('NATIVE_RESPONSE_TOO_LARGE')
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        # Never include response bodies, tokens, passwords or native request URLs.
        print(json.dumps({'nativeStatus':error.code}))
        raise RuntimeError('NATIVE_HTTP_'+str(error.code)) from None
# The management endpoint can be ready before the native token endpoint.
# Only the synthetic technical bootstrap grant retries temporary 503 on a 30s scheduling budget.
# All authorization, TLS and other errors close immediately. No human/BFF retry.
TOKEN=bootstrap_service_token(request,bootstrap_secret)
realm=request('GET','/admin/realms/dossiercle',token=TOKEN)
assert realm['realm']=='dossiercle' and not realm.get('registrationAllowed')
print('SYNTHETIC_NATIVE_IDENTITY_ADMIN_READY; MFA not qualified; business access closed')
providers=request('GET','/admin/realms/dossiercle/authentication/authenticator-providers',token=TOKEN)
actions=request('GET','/admin/realms/dossiercle/authentication/required-actions',token=TOKEN)
print(json.dumps({'authenticators':[p['id'] for p in providers if 'privacy' in p['id'].lower() or 'recovery' in p['id'].lower() or 'loa' in p['id'].lower()], 'recoveryActions':[{k:a.get(k) for k in ['alias','providerId','enabled']} for a in actions if 'RECOVERY' in a.get('alias','')]}))
ORIGIN='https://localhost:'+str(STATE['tlsPort'])
CALLBACK_ORIGIN='https://localhost:'+str(STATE['tlsPort'])
PREFIX='/admin/realms/dossiercle'
# Immutable technical username/contact/root are administrative identity binding,
# never browser-editable attributes. Native user-profile configuration persists them.
profile=request('GET',PREFIX+'/users/profile',token=TOKEN)
for attribute in profile.get('attributes',[]):
    if attribute.get('name') in ['username','email']:
        attribute['permissions']={'view':['admin','user'],'edit':['admin']}
root_attribute={'name':'s01.invitation.root','multivalued':False,
    'permissions':{'view':['admin'],'edit':['admin']},
    'validations':{'pattern':{'pattern':'^[a-f0-9-]{36}$'}}}
profile['attributes']=[a for a in profile.get('attributes',[]) if a.get('name')!='s01.invitation.root']+[root_attribute]
request('PUT',PREFIX+'/users/profile',profile,TOKEN)
def ensure_flow(alias,parent=None):
    if parent:
        entries=request('GET',PREFIX+'/authentication/flows/'+urllib.parse.quote(parent,safe='')+'/executions',token=TOKEN)
        existing=next((e for e in entries if e.get('level',0)==0 and e.get('displayName')==alias),None)
    else:
        flows=request('GET',PREFIX+'/authentication/flows',token=TOKEN)
        existing=next((f for f in flows if f['alias']==alias),None)
    if not existing:
        if parent:
            request('POST',PREFIX+'/authentication/flows/'+urllib.parse.quote(parent,safe='')+'/executions/flow',{'alias':alias,'provider':'basic-flow','type':'basic-flow'},TOKEN)
        else:
            request('POST',PREFIX+'/authentication/flows',{'alias':alias,'providerId':'basic-flow','topLevel':True,'builtIn':False},TOKEN)
def execution(flow,provider=None,child=None,requirement='REQUIRED',config=None):
    path=PREFIX+'/authentication/flows/'+urllib.parse.quote(flow,safe='')+'/executions'
    entries=request('GET',path,token=TOKEN)
    entry=next((e for e in entries if e.get('level',0)==0 and (e.get('providerId')==provider if provider else e.get('displayName')==child)),None)
    if not entry and provider:
        request('POST',PREFIX+'/authentication/flows/'+urllib.parse.quote(flow,safe='')+'/executions/execution',{'provider':provider},TOKEN)
        entries=request('GET',path,token=TOKEN)
        entry=next((e for e in entries if e.get('level',0)==0 and e.get('providerId')==provider),None)
    if not entry: raise RuntimeError('NATIVE_FLOW_EXECUTION_NOT_FOUND')
    request('PUT',path,{'id':entry['id'],'requirement':requirement,'priority':entry['priority']},TOKEN)
    if config:
        representation={'alias':flow+'-'+provider,'config':config}
        config_id=entry.get('authenticationConfig')
        if config_id: request('PUT',PREFIX+'/authentication/config/'+config_id,representation,TOKEN)
        else: request('POST',PREFIX+'/authentication/executions/'+entry['id']+'/config',representation,TOKEN)
    return entry['id']
ensure_flow('s01-browser-v2')
execution('s01-browser-v2',provider='auth-username-password-form')
ensure_flow('s01-mfa-v2','s01-browser-v2');execution('s01-browser-v2',child='s01-mfa-v2')
ensure_flow('s01-loa2-v2','s01-mfa-v2');execution('s01-mfa-v2',child='s01-loa2-v2',requirement='CONDITIONAL')
execution('s01-loa2-v2',provider='conditional-level-of-authentication',config={'loa-condition-level':'2','loa-max-age':'0'})
ensure_flow('s01-factor-selector-v2','s01-loa2-v2');execution('s01-loa2-v2',child='s01-factor-selector-v2')
ensure_flow('s01-pi-required-v2','s01-factor-selector-v2');execution('s01-factor-selector-v2',child='s01-pi-required-v2',requirement='ALTERNATIVE')
provider_config=dict(line.split('=',1) for line in (ROOT/'infra/identity/provider.properties').read_text().splitlines() if line and not line.startswith('#'))
execution('s01-pi-required-v2',provider='privacyidea-authenticator',config=provider_config)
execution('s01-factor-selector-v2',provider='auth-recovery-authn-code-form',requirement='ALTERNATIVE')

def first_execution(flow,provider):
    # Preserve distinct native priorities: omitted PUT priority defaults to zero upstream.
    path=PREFIX+'/authentication/flows/'+urllib.parse.quote(flow,safe='')+'/executions'
    siblings=[e for e in request('GET',path,token=TOKEN) if e.get('level',0)==0]
    ordered=sorted(siblings,key=lambda e:e.get('providerId')!=provider)
    for index,entry in enumerate(ordered):
        request('PUT',path,{'id':entry['id'],'requirement':entry['requirement'],'priority':10*(index+1)},TOKEN)
    observed=[e for e in request('GET',path,token=TOKEN) if e.get('level',0)==0]
    if [e['id'] for e in observed]!=[e['id'] for e in ordered]:raise RuntimeError('NATIVE_EXECUTION_ORDER_NOT_CONVERGED')
first_execution('s01-browser-v2','auth-username-password-form')
first_execution('s01-loa2-v2','conditional-level-of-authentication')


def ensure_client(client_id,roles=(),standard=False):
    clients=request('GET',PREFIX+'/clients?clientId='+urllib.parse.quote(client_id,safe=''),token=TOKEN)
    assert not clients or (PRIVATE/'kc'/('client-'+client_id)).exists(), 'Existing client credential unavailable; no blind rotation'
    credential=secret('client-'+client_id)
    representation={'clientId':client_id,'enabled':True,'protocol':'openid-connect','publicClient':False,'secret':credential,
        'standardFlowEnabled':standard,'implicitFlowEnabled':False,'directAccessGrantsEnabled':False,'serviceAccountsEnabled':bool(roles),
        'redirectUris':[CALLBACK_ORIGIN+'/v1/auth/oidc/callback',CALLBACK_ORIGIN+'/v1/auth/enrollment/complete'] if standard else [],
        'webOrigins':[],'fullScopeAllowed':False,'defaultClientScopes':['roles'] if roles else ['profile'],'optionalClientScopes':[],
        'attributes':{'pkce.code.challenge.method':'S256','minimum.acr.value':'2','default.acr.values':'2','acr.loa.map':'{"2":2}','access.token.lifespan':'300','backchannel.logout.session.required':'true',**({'backchannel.logout.url':'https://identity-coordinator:4001/v1/auth/backchannel'} if standard else {})},
        'protocolMappers':[{'name':'acr','protocol':'openid-connect','protocolMapper':'oidc-acr-mapper','consentRequired':False,'config':{'id.token.claim':'true','access.token.claim':'true'}}] if standard else []}
    if clients: identifier=clients[0]['id'];request('PUT',PREFIX+'/clients/'+identifier,representation,TOKEN)
    else:
        request('POST',PREFIX+'/clients',representation,TOKEN)
        identifier=request('GET',PREFIX+'/clients?clientId='+client_id,token=TOKEN)[0]['id']
    if roles:
        subject=request('GET',PREFIX+'/clients/'+identifier+'/service-account-user',token=TOKEN)['id']
        management=request('GET',PREFIX+'/clients?clientId=realm-management',token=TOKEN)[0]['id']
        mappings=[request('GET',PREFIX+'/clients/'+management+'/roles/'+role,token=TOKEN) for role in roles]
        request('POST',PREFIX+'/users/'+subject+'/role-mappings/clients/'+management,mappings,TOKEN)
        request('POST',PREFIX+'/clients/'+identifier+'/scope-mappings/clients/'+management,mappings,TOKEN)
    return identifier
ensure_client('s01-bff',standard=True)
ensure_client('s01-resolver',roles=('view-users','query-users'))
ensure_client('s01-identity',roles=('manage-users',))
# Native partialImport is needed to preserve the subject reserved before J1.
# This credential belongs only to the isolated identity coordinator, never BFF.
ensure_client('s01-importer',roles=('manage-realm','view-users','query-users'))
# Close inherited realm clients as well as the four explicitly provisioned clients.
# realm-management remains the bearer-only carrier of native administrative roles.
for entry in request('GET',PREFIX+'/clients',token=TOKEN):
    client_id=entry['clientId']
    if entry.get('bearerOnly') is True:
        assert client_id in ['realm-management','broker'], 'Unexpected bearer-only client'
        continue
    if client_id in ['account','account-console','admin-cli','security-admin-console','broker']:
        entry['enabled']=False
    if client_id!='s01-bff': entry['standardFlowEnabled']=False
    entry['directAccessGrantsEnabled']=False;entry['implicitFlowEnabled']=False
    for field in ['defaultClientScopes','optionalClientScopes']:
        entry[field]=[scope for scope in entry.get(field,[]) if scope!='offline_access']
    request('PUT',PREFIX+'/clients/'+entry['id'],entry,TOKEN)
    for kind in ['default-client-scopes','optional-client-scopes']:
        for scope in request('GET',PREFIX+'/clients/'+entry['id']+'/'+kind,token=TOKEN):
            if scope['name']=='offline_access': request('DELETE',PREFIX+'/clients/'+entry['id']+'/'+kind+'/'+scope['id'],token=TOKEN)
# Required action native only; no native Keycloak TOTP credential generation.
for alias in ['CONFIGURE_TOTP','UPDATE_PASSWORD','CONFIGURE_RECOVERY_AUTHN_CODES']:
    action=request('GET',PREFIX+'/authentication/required-actions/'+alias,token=TOKEN)
    action['enabled']=alias!='CONFIGURE_TOTP';action['defaultAction']=False
    request('PUT',PREFIX+'/authentication/required-actions/'+alias,action,TOKEN)
baseline=json.loads((ROOT/'infra/identity/keycloak-realm.json').read_text())
for field in ['bruteForceProtected','permanentLockout','failureFactor','maxFailureWaitSeconds','waitIncrementSeconds','ssoSessionIdleTimeout','ssoSessionMaxLifespan','accessTokenLifespan','accessCodeLifespan','passwordPolicy']:
    realm[field]=baseline[field]
realm.update({'browserFlow':'s01-browser-v2','directGrantFlow':'s01-closed','resetCredentialsFlow':'s01-closed','registrationAllowed':False,'resetPasswordAllowed':False,'loginWithEmailAllowed':False,'rememberMe':False,'duplicateEmailsAllowed':False,'actionTokenGeneratedByAdminLifespan':600,'actionTokenGeneratedByUserLifespan':600,
    'smtpServer':{'host':'mailpit','port':'1025','from':'identity@example.invalid','ssl':'false','starttls':'false','auth':'false'}})
request('PUT',PREFIX,realm,TOKEN)
# Server hostname is configured explicitly; no client input selects issuer/redirect.
configuration=PRIVATE/'kc/keycloak.conf'
values=dict(line.split('=',1) for line in configuration.read_text().splitlines() if line and '=' in line)
if values.get('hostname')!=ORIGIN:
    values['hostname']=ORIGIN;values['proxy-headers']='xforwarded'
    replacement=configuration.with_name('keycloak.conf.next')
    descriptor=os.open(replacement,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o400)
    with os.fdopen(descriptor,'w') as target:
        target.write('\n'.join(k+'='+v for k,v in values.items())+'\n');target.flush();os.fsync(target.fileno())
    os.replace(replacement,configuration)
    run(COMPOSE+['restart','keycloak']);run(COMPOSE+['up','-d','--wait','--wait-timeout','120','keycloak'])
identity_state={'syntheticOnly':True,'issuerOrigin':ORIGIN,'issuer':ORIGIN+'/realms/dossiercle','callbackOrigin':CALLBACK_ORIGIN,'clientId':'s01-bff'}
(ROOT/'.local/identity-state.json').write_text(json.dumps(identity_state,indent=2)+'\n')
print('SYNTHETIC_NATIVE_FLOW_CONFIGURED; MFA not qualified; business access closed')
