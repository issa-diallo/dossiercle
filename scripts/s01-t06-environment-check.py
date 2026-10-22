#!/usr/bin/env python3
"""Validate the T06 Compose capability boundary without starting services."""
import json
from pathlib import Path
import subprocess
import sys


def check(config, root, private):
    services = config['services']
    expected = {'t06-provisioner', 't06-orchestrator'}
    assert expected <= services.keys(), 'T06_SERVICES_MISSING'
    provisioner = services['t06-provisioner']
    orchestrator = services['t06-orchestrator']
    coordinator = services['identity-coordinator']
    assert provisioner.get('profiles') == ['t06'] and orchestrator.get('profiles') == ['t06']
    assert provisioner.get('restart') == 'no' and orchestrator.get('restart') == 'no'
    assert provisioner.get('read_only') is True and orchestrator.get('read_only') is True

    def mounts(service):
        declared = service.get('volumes', [])
        assert all(mount.get('type') == 'bind' for mount in declared), 'NON_BIND_MOUNT_REFUSED'
        assert service.get('tmpfs') == ['/tmp'], 'TMPFS_ALLOWLIST_MISMATCH'
        assert not service.get('configs') and not service.get('secrets') and not service.get('devices'), 'EXTRA_MOUNT_CAPABILITY_REFUSED'
        return [(str(Path(mount['source']).resolve()), mount['target'], mount.get('read_only') is True)
                for mount in declared]

    p = mounts(provisioner)
    o = mounts(orchestrator)
    c = mounts(coordinator)
    # Match source, destination and mode exactly: a parent mount would otherwise
    # bypass checks performed only against individually named secret mounts.
    expected_provisioner = {
        (str(root / '.local/node/bin/node'), '/s01-node', True),
        (str(root / 'node_modules'), '/app/node_modules', True),
        (str(root / 'packages'), '/app/packages', True),
        (str(root / 'apps/api'), '/app/apps/api', True),
        (str(private / 't06-runtime'), '/run/s01-t06-runtime', False),
        (str(private / 't06-migration'), '/run/s01-t06-migration', False),
        (str(private / 't06-provisioner-tls'), '/run/s01-t06-tls', True),
        (str(private / 'pg/provisioner'), '/run/s01-pg/provisioner', True),
        (str(private / 'pg/provisioner_ddl'), '/run/s01-pg/ddl', True),
        (str(private / 'ca/ca.crt'), '/run/s01-t06-ca.crt', True),
        (str(root / '.local/journal'), '/var/lib/s01-journal', True),
        (str(root / '.local/fixture-manifests'), '/run/s01-fixtures', True),
    }
    expected_orchestrator = {
        (str(root / '.local/node/bin/node'), '/s01-node', True),
        (str(root / 'node_modules'), '/app/node_modules', True),
        (str(root / 'packages'), '/app/packages', True),
        (str(root / 'apps/api'), '/app/apps/api', True),
        (str(root / '.local/fixture-manifests'), '/run/s01-fixtures', True),
        (str(private / 'pg/control_dispatcher'), '/run/s01-pg/dispatcher', True),
        (str(private / 'inngest/signing-key'), '/run/s01-inngest-signing-key', True),
        (str(private / 'inngest/event-key'), '/run/s01-inngest-event-key', True),
        (str(private / 't06-orchestrator-tls'), '/run/s01-t06-tls', True),
        (str(private / 'ca/ca.crt'), '/run/s01-t06-ca.crt', True),
    }
    expected_coordinator = {
        (str(root / '.local/node/bin/node'), '/s01-node', True),
        (str(root / 'node_modules'), '/app/node_modules', True),
        (str(root / 'packages'), '/app/packages', True),
        (str(root / 'apps/api'), '/app/apps/api', True),
        (str(private / 'coordinator'), '/run/s01-coordinator-config', True),
        (str(private / 'owner-signing/public.pem'), '/run/s01-owner-public.pem', True),
        (str(private / 'coordinator/server.crt'), '/run/s01-coordinator/server.crt', True),
        (str(private / 'coordinator/server.key'), '/run/s01-coordinator/server.key', True),
        (str(private / 'coordinator-tls/client.crt'), '/run/s01-coordinator/client.crt', True),
        (str(private / 'coordinator-tls/client.key'), '/run/s01-coordinator/client.key', True),
        (str(private / 'kc/client-s01-bff'), '/run/s01-coordinator/kc-bff', True),
        (str(private / 'kc/client-s01-identity'), '/run/s01-coordinator/kc-identity', True),
        (str(private / 'kc/client-s01-importer'), '/run/s01-coordinator/kc-importer', True),
        (str(private / 'pi/verifier-password'), '/run/s01-coordinator/pi-verifier-password', True),
        (str(private / 'coordinator/session-encryption-key'), '/run/s01-coordinator/session-encryption-key', True),
        (str(private / 'coordinator/session-csrf-key'), '/run/s01-coordinator/session-csrf-key', True),
        (str(private / 'coordinator/bootstrap-reauth-decoy-key'), '/run/s01-coordinator/bootstrap-reauth-decoy-key', True),
        (str(private / 't06-runtime'), '/run/s01-t06-runtime', True),
        (str(private / 't07-activation-tls'), '/run/s01-t07-activation-tls', True),
        (str(private / 'ca/ca.crt'), '/run/s01-coordinator/ca.crt', True),
        (str(private / 'pg/control_coordinator'), '/run/s01-coordinator/pg-password', True),
        (str(root / '.local/journal'), '/var/lib/s01-journal', False),
    }
    assert len(p) == len(expected_provisioner) and set(p) == expected_provisioner, 'PROVISIONER_MOUNT_ALLOWLIST_MISMATCH'
    assert len(o) == len(expected_orchestrator) and set(o) == expected_orchestrator, 'ORCHESTRATOR_MOUNT_ALLOWLIST_MISMATCH'
    assert len(c) == len(expected_coordinator) and set(c) == expected_coordinator, 'COORDINATOR_MOUNT_ALLOWLIST_MISMATCH'

    protected_sources = {
        private: {},
        private / 'pg': {
            'postgres': {str(private / 'pg/bootstrap'), str(private / 'pg/init.sql')},
            'identity-coordinator': {str(private / 'pg/control_coordinator')},
            't06-provisioner': {str(private / 'pg/provisioner'), str(private / 'pg/provisioner_ddl')},
            't06-orchestrator': {str(private / 'pg/control_dispatcher')},
        },
        private / 'pg/provisioner': {'t06-provisioner': str(private / 'pg/provisioner')},
        private / 'pg/provisioner_ddl': {'t06-provisioner': str(private / 'pg/provisioner_ddl')},
        private / 't06-runtime': {
            't06-provisioner': str(private / 't06-runtime'),
            'identity-coordinator': str(private / 't06-runtime'),
        },
        private / 't06-migration': {'t06-provisioner': str(private / 't06-migration')},
        private / 't06-provisioner-tls': {'t06-provisioner': str(private / 't06-provisioner-tls')},
        private / 't06-orchestrator-tls': {'t06-orchestrator': str(private / 't06-orchestrator-tls')},
        private / 't07-activation-tls': {'identity-coordinator': str(private / 't07-activation-tls')},
        private / 'owner-signing': {
            'identity-coordinator': str(private / 'owner-signing/public.pem'),
        },
        private / 'owner-signing/private.pem': {},
        private / 'ca/ca.key': {},
        private / 't06-api-runtime': {},
    }
    for service_name, service in services.items():
        assert not service.get('secrets'), 'UNREVIEWED_COMPOSE_SECRET_MOUNT'
        for mount in service.get('volumes', []):
            if mount.get('type') != 'bind':
                continue
            source = Path(mount['source']).resolve()
            for protected, allowed in protected_sources.items():
                if protected == private:
                    overlaps = source == protected or protected.is_relative_to(source)
                else:
                    overlaps = source == protected or source.is_relative_to(protected) or protected.is_relative_to(source)
                if overlaps:
                    permitted = allowed.get(service_name, set())
                    if isinstance(permitted, str):
                        permitted = {permitted}
                    assert str(source) in permitted, 'T06_SENSITIVE_MOUNT_SERVICE_REFUSED'
    assert 'docker.sock' not in {Path(m['source']).name for s in services.values()
                                for m in s.get('volumes', [])}, 'DOCKER_SOCKET_MOUNTED'
    for name in expected:
        service = services[name]
        assert not service.get('ports'), 'T06_PUBLIC_PORT_ADDED'
        networks = service.get('networks', [])
        network_names = list(networks) if isinstance(networks, dict) else networks
        assert network_names == ['private'], 'T06_NETWORK_ALLOWLIST_MISMATCH'
    return True


if __name__ == '__main__':
    try:
        path = Path(sys.argv[1]).resolve()
        root = Path.cwd().resolve()
        assert path.is_relative_to(root), 'COMPOSE_PATH_OUTSIDE_WORKTREE'
        state = json.loads((root / '.local/environment.json').read_text())
        private = Path(state['private'])
        compose = json.loads(subprocess.check_output([
            'docker', 'compose', '--profile', '*', '--env-file', str(root / '.local/compose.env'),
            '-f', str(path), 'config', '--format', 'json'], text=True))
        check(compose, root, private)
        print('T06 capability mounts verified (read-only).')
    except (AssertionError, KeyError, OSError, ValueError) as error:
        print(str(error) if isinstance(error, AssertionError) else 'T06_ENVIRONMENT_INVALID', file=sys.stderr)
        sys.exit(1)
