#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 - <<'PY'
import json
from pathlib import Path
state=json.loads(Path('.local/environment.json').read_text())
if state.get('syntheticOnly') is not True or state.get('root') != str(Path.cwd().resolve()):
    raise SystemExit('SYNTHETIC_REQUIRED')
private=Path(state['private'])
target=private/'t07-activation-tls'
ca=private/'ca'
if not (ca/'ca.key').is_file() or not (ca/'ca.crt').is_file():
    raise SystemExit('SYNTHETIC_CA_REQUIRED')
target.mkdir(mode=0o700,exist_ok=True)
required=('client.key','client.csr','client.crt','extensions')
if any((target/name).exists() for name in required):
    if not all((target/name).is_file() for name in required):
        raise SystemExit('T07_IDENTITY_PARTIAL_REFUSED')
else:
    (target/'extensions').write_text('subjectAltName=DNS:t07-activation\nextendedKeyUsage=clientAuth\n')
    (target/'extensions').chmod(0o400)
PY
state=$(python3 -c "import json;print(json.load(open('.local/environment.json'))['private'])")
target="$state/t07-activation-tls"
if [[ -f "$target/client.crt" && ! -s "$target/client.crt" ]]; then
  suffix=preexisting-empty
  [[ -e "$target/client.crt.$suffix" ]] && suffix=empty-signing-attempt
  mv "$target/client.crt" "$target/client.crt.$suffix"
fi
if [[ ! -f "$target/client.key" ]]; then
  openssl req -newkey rsa:2048 -nodes -subj '/CN=t07-activation' \
    -keyout "$target/client.key" -out "$target/client.csr" >/dev/null 2>&1
  openssl x509 -req -in "$target/client.csr" -CA "$state/ca/ca.crt" -CAkey "$state/ca/ca.key" \
    -CAserial "$target/ca.srl" -CAcreateserial -days 7 -extfile "$target/extensions" -out "$target/client.crt" >/dev/null 2>&1
fi
if [[ ! -f "$target/client.crt" ]]; then
  openssl x509 -req -in "$target/client.csr" -CA "$state/ca/ca.crt" -CAkey "$state/ca/ca.key" \
    -CAserial "$target/ca.srl" -CAcreateserial -days 7 -extfile "$target/extensions" -out "$target/client.crt" >/dev/null 2>&1
fi
if [[ ! -f "$target/ca.crt" ]]; then cp "$state/ca/ca.crt" "$target/ca.crt"; fi
chmod 0400 "$target/client.key" "$target/client.csr" "$target/client.crt" "$target/ca.crt" "$target/extensions" "$target/ca.srl"
python3 - <<'PY'
import json, os, stat, subprocess
from pathlib import Path
state=json.loads(Path('.local/environment.json').read_text())
target=Path(state['private'])/'t07-activation-tls'
for name in ('client.key','client.csr','client.crt','ca.crt','extensions','ca.srl'):
    st=(target/name).stat()
    if not stat.S_ISREG(st.st_mode) or stat.S_IMODE(st.st_mode)!=0o400 or st.st_uid!=os.getuid():
        raise SystemExit('T07_IDENTITY_MODE_REFUSED')
subject=subprocess.check_output(['openssl','x509','-in',str(target/'client.crt'),'-noout','-subject'],text=True)
san=subprocess.check_output(['openssl','x509','-in',str(target/'client.crt'),'-noout','-ext','subjectAltName'],text=True)
eku=subprocess.check_output(['openssl','x509','-in',str(target/'client.crt'),'-noout','-ext','extendedKeyUsage'],text=True)
if 'CN = t07-activation' not in subject or 'DNS:t07-activation' not in san or 'TLS Web Client Authentication' not in eku:
    raise SystemExit('T07_IDENTITY_CERTIFICATE_REFUSED')
issuer=subprocess.check_output(['openssl','verify','-CAfile',str(target/'ca.crt'),str(target/'client.crt')],text=True)
if not issuer.strip().endswith(': OK'):
    raise SystemExit('T07_IDENTITY_CA_REFUSED')
key=subprocess.check_output(['openssl','pkey','-in',str(target/'client.key'),'-pubout'],stderr=subprocess.DEVNULL)
cert=subprocess.check_output(['openssl','x509','-in',str(target/'client.crt'),'-pubkey','-noout'])
if key!=cert:
    raise SystemExit('T07_IDENTITY_KEY_MISMATCH')
print(json.dumps({'syntheticOnly':True,'clientIdentity':'t07-activation','caVerified':True,'privateMode':'0400'}))
PY
