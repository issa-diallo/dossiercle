from __future__ import annotations

import hashlib
import importlib.metadata
import json
import re
import threading
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Iterable, Protocol
from zoneinfo import TZPATH, ZoneInfo, ZoneInfoNotFoundError


UTC = timezone.utc
DEFAULT_SLOTS = (time(8, 45), time(13, 30), time(16, 0))
CLAIM_ACK_CONTENT = "Réception confirmée. Examen à la prochaine ouverture. Retour dans les meilleurs délais."
TERMINAL_PREVENTED = {
    "PREVENTED_CLOSED",
    "PREVENTED_TIME_NONEXISTENT",
    "PREVENTED_TIME_AMBIGUOUS",
    "PREVENTED_RIGHTS",
    "PREVENTED_LATE",
}


class TemporalError(ValueError):
    pass


class NonexistentLocalTime(TemporalError):
    pass


class AmbiguousLocalTime(TemporalError):
    pass


class InvalidSchedule(TemporalError):
    pass


def detect_tzdb_version() -> str:
    """Return the concrete tzdb release used by stdlib zoneinfo."""
    for root in TZPATH:
        metadata_file = Path(root) / "tzdata.zi"
        try:
            with metadata_file.open(encoding="utf-8") as stream:
                first_line = stream.readline().strip()
        except (OSError, UnicodeError):
            continue
        match = re.fullmatch(r"#\s*version\s+(\d{4}[a-z])", first_line)
        if match:
            return match.group(1)
    try:
        package_version = importlib.metadata.version("tzdata")
    except importlib.metadata.PackageNotFoundError as exc:
        raise RuntimeError("unable to determine the active tzdb version") from exc
    match = re.fullmatch(r"(\d{4})\.(\d+)", package_version)
    if match is None:
        raise RuntimeError("tzdata package metadata is not a concrete release")
    release = int(match.group(2))
    if not 1 <= release <= 26:
        raise RuntimeError("tzdata package release is outside the supported tzdb range")
    return f"{match.group(1)}{chr(ord('a') + release - 1)}"


class Status(str, Enum):
    PLANNED = "PLANNED"
    READY_TO_SEND = "READY_TO_SEND"
    PREVENTED_CLOSED = "PREVENTED_CLOSED"
    PREVENTED_TIME_NONEXISTENT = "PREVENTED_TIME_NONEXISTENT"
    PREVENTED_TIME_AMBIGUOUS = "PREVENTED_TIME_AMBIGUOUS"
    PREVENTED_RIGHTS = "PREVENTED_RIGHTS"
    PREVENTED_LATE = "PREVENTED_LATE"
    SUPERSEDED_PLANNING = "SUPERSEDED_PLANNING"
    FAILED_CERTAIN = "FAILED_CERTAIN"
    RESULT_UNKNOWN = "RESULT_UNKNOWN"
    SEQUENCE_ROLLBACK = "SEQUENCE_ROLLBACK"
    SENT_CONFIRMED = "SENT_CONFIRMED"


class TransportOutcome(str, Enum):
    CONFIRMED = "CONFIRMED"
    CERTAIN_FAILURE = "CERTAIN_FAILURE"
    UNKNOWN = "UNKNOWN"


def resolve_local(local_value: datetime, timezone_id: str) -> datetime:
    """Resolve a naive civil time only when it maps to exactly one instant."""
    if local_value.tzinfo is not None:
        raise TemporalError("local_value must be naive")
    try:
        zone = ZoneInfo(timezone_id)
    except ZoneInfoNotFoundError as exc:
        raise TemporalError(f"unknown IANA timezone: {timezone_id}") from exc

    candidates: dict[datetime, datetime] = {}
    for fold in (0, 1):
        aware = local_value.replace(tzinfo=zone, fold=fold)
        instant = aware.astimezone(UTC)
        round_trip = instant.astimezone(zone).replace(tzinfo=None)
        if round_trip == local_value:
            candidates[instant] = instant

    if not candidates:
        raise NonexistentLocalTime(f"nonexistent local time: {local_value} [{timezone_id}]")
    if len(candidates) > 1:
        raise AmbiguousLocalTime(f"ambiguous local time: {local_value} [{timezone_id}]")
    return next(iter(candidates.values()))


@dataclass(frozen=True)
class TimeWindow:
    start: time
    end: time

    def __post_init__(self) -> None:
        if self.end <= self.start:
            raise InvalidSchedule("action window must be non-empty and within one civil day")

    def contains(self, value: time) -> bool:
        return self.start <= value < self.end


@dataclass(frozen=True)
class ScheduleConfig:
    version: str
    timezone_id: str
    action_windows: dict[int, tuple[TimeWindow, ...]]
    fixed_slots: tuple[time, ...] = DEFAULT_SLOTS
    configuration_valid: bool = True

    @classmethod
    def validated(
        cls,
        version: str,
        timezone_id: str,
        action_windows: dict[int, tuple[TimeWindow, ...]],
        fixed_slots: tuple[time, ...] = DEFAULT_SLOTS,
    ) -> "ScheduleConfig":
        schedule = cls(version, timezone_id, action_windows, fixed_slots=fixed_slots)
        schedule._validate()
        return schedule

    @classmethod
    def legacy_unchecked(
        cls,
        version: str,
        timezone_id: str,
        action_windows: dict[int, tuple[TimeWindow, ...]],
    ) -> "ScheduleConfig":
        schedule = cls(version, timezone_id, action_windows, configuration_valid=False)
        try:
            schedule._validate()
        except InvalidSchedule:
            return schedule
        return cls(version, timezone_id, action_windows, configuration_valid=True)

    def _validate(self) -> None:
        try:
            ZoneInfo(self.timezone_id)
        except ZoneInfoNotFoundError as exc:
            raise InvalidSchedule(f"unknown IANA timezone: {self.timezone_id}") from exc
        for weekday in range(5):
            windows = self.action_windows.get(weekday, ())
            for slot in self.fixed_slots:
                if not any(window.contains(slot) for window in windows):
                    raise InvalidSchedule(
                        f"fixed slot {slot.isoformat(timespec='minutes')} is outside action hours for weekday {weekday}"
                    )

    def action_allows(self, weekday: int, slot: time) -> bool:
        return any(window.contains(slot) for window in self.action_windows.get(weekday, ()))


@dataclass(frozen=True)
class Closure:
    start_utc: datetime
    end_utc: datetime
    timezone_id: str
    version: str

    @classmethod
    def from_local(
        cls,
        start_local: datetime,
        end_local: datetime,
        timezone_id: str,
        version: str,
    ) -> "Closure":
        if end_local <= start_local:
            raise TemporalError("closure end must be after start")
        start_utc = resolve_local(start_local, timezone_id)
        end_utc = resolve_local(end_local, timezone_id)
        if end_utc <= start_utc:
            raise TemporalError("resolved closure end must be after start")
        return cls(start_utc, end_utc, timezone_id, version)

    def contains(self, instant: datetime) -> bool:
        return self.start_utc <= instant < self.end_utc


@dataclass
class Authority:
    schedule: ScheduleConfig
    closures: tuple[Closure, ...] = ()
    rights: bool = True
    mandate: bool = True
    agency_active: bool = True
    binding_active: bool = True


@dataclass(frozen=True)
class Event:
    sequence: int
    occurred_at: datetime
    payload: str


class EventLog:
    def __init__(self) -> None:
        self._events: list[Event] = []
        self._visible_sequence: int | None = None

    @property
    def current_sequence(self) -> int:
        if self._visible_sequence is not None:
            return self._visible_sequence
        return self._events[-1].sequence if self._events else 0

    def append(self, occurred_at: datetime, payload: str) -> Event:
        next_sequence = (self._events[-1].sequence if self._events else 0) + 1
        event = Event(next_sequence, occurred_at, payload)
        self._events.append(event)
        self._visible_sequence = None
        return event

    def between(self, from_exclusive: int, to_inclusive: int) -> tuple[Event, ...]:
        return tuple(event for event in self._events if from_exclusive < event.sequence <= to_inclusive)

    def restore_to(self, sequence: int) -> None:
        if sequence < 0:
            raise ValueError("sequence must be non-negative")
        self._visible_sequence = sequence


@dataclass
class RecipientBinding:
    id: str
    agency_id: str
    report_type: str
    recipient: str
    activation_sequence: int
    cursor_sequence: int
    active: bool = True
    last_confirmed_logical_key: tuple | None = None


@dataclass
class Revision:
    number: int
    schedule_version: str
    timezone_id: str
    tzdb_version: str
    action_windows: tuple[tuple[int, tuple[TimeWindow, ...]], ...]
    fixed_slots: tuple[time, ...]
    configuration_valid: bool
    scheduled_at_utc: datetime | None
    status: Status
    active: bool = True
    from_sequence: int | None = None
    to_sequence: int | None = None
    events: tuple[Event, ...] = ()
    content_hash: str | None = None
    network_started: bool = False


@dataclass
class Obligation:
    key: tuple
    binding: RecipientBinding
    local_date: date
    local_slot: time
    revisions: list[Revision]
    audit: list[str] = field(default_factory=list)

    @property
    def active_revision(self) -> Revision:
        active = [revision for revision in self.revisions if revision.active]
        if len(active) != 1:
            raise RuntimeError("an obligation must have exactly one active revision")
        return active[0]

    @property
    def status(self) -> Status:
        return self.active_revision.status


@dataclass(frozen=True)
class TransportRecord:
    obligation_key: tuple
    content_hash: str
    outcome: TransportOutcome


@dataclass(frozen=True)
class ClaimAckRecord:
    binding_id: str
    agency_id: str
    claim_id: str
    content: str


class Transport(Protocol):
    def send(self, obligation_key: tuple, content_hash: str) -> object: ...


class FakeTransport:
    def __init__(self, outcomes: Iterable[TransportOutcome]) -> None:
        self._outcomes = list(outcomes)
        self.call_count = 0

    @classmethod
    def confirmed(cls) -> "FakeTransport":
        return cls((TransportOutcome.CONFIRMED,))

    @classmethod
    def certain_failure(cls) -> "FakeTransport":
        return cls((TransportOutcome.CERTAIN_FAILURE,))

    @classmethod
    def unknown(cls) -> "FakeTransport":
        return cls((TransportOutcome.UNKNOWN,))

    def send(self, obligation_key: tuple, content_hash: str) -> TransportOutcome:
        self.call_count += 1
        if self._outcomes:
            return self._outcomes.pop(0)
        return TransportOutcome.CONFIRMED


class ControlledClock:
    def __init__(self, current: datetime) -> None:
        if current.tzinfo is None:
            raise ValueError("controlled clock requires an aware instant")
        self._current = current.astimezone(UTC)

    def now(self) -> datetime:
        return self._current

    def set(self, current: datetime) -> None:
        if current.tzinfo is None:
            raise ValueError("controlled clock requires an aware instant")
        self._current = current.astimezone(UTC)


class TemporalEngine:
    def __init__(self, clock: ControlledClock, tzdb_version: str | None = None) -> None:
        self.clock = clock
        self.tzdb_version = tzdb_version or detect_tzdb_version()
        self._lock = threading.RLock()
        self._obligations: dict[tuple, Obligation] = {}
        self._unknown_bindings: set[str] = set()
        self._claim_acks: set[tuple[str, str]] = set()
        self.transport_journal: list[TransportRecord] = []
        self.reconciliation_journal: list[tuple[tuple, TransportOutcome]] = []
        self.claim_ack_journal: list[ClaimAckRecord] = []

    @property
    def obligation_count(self) -> int:
        return len(self._obligations)

    def activate_binding(
        self,
        agency_id: str,
        report_type: str,
        recipient: str,
        event_log: EventLog,
    ) -> RecipientBinding:
        activation = event_log.current_sequence
        return RecipientBinding(
            id=str(uuid.uuid4()),
            agency_id=agency_id,
            report_type=report_type,
            recipient=recipient,
            activation_sequence=activation,
            cursor_sequence=activation,
        )

    def revoke_binding(self, binding: RecipientBinding) -> None:
        binding.active = False

    def reauthorize_binding(
        self,
        prior: RecipientBinding,
        recipient: str,
        event_log: EventLog,
    ) -> RecipientBinding:
        prior.active = False
        return self.activate_binding(prior.agency_id, prior.report_type, recipient, event_log)

    def materialize(
        self,
        binding: RecipientBinding,
        local_date: date,
        local_slot: time,
        schedule: ScheduleConfig,
    ) -> Obligation:
        key = (binding.agency_id, binding.report_type, local_date, local_slot, binding.id)
        with self._lock:
            existing = self._obligations.get(key)
            if existing is not None:
                return existing
            scheduled_at, status = self._resolve_schedule(schedule, local_date, local_slot)
            revision = Revision(
                number=1,
                schedule_version=schedule.version,
                timezone_id=schedule.timezone_id,
                tzdb_version=self.tzdb_version,
                action_windows=tuple(sorted(schedule.action_windows.items())),
                fixed_slots=tuple(schedule.fixed_slots),
                configuration_valid=schedule.configuration_valid,
                scheduled_at_utc=scheduled_at,
                status=status,
            )
            obligation = Obligation(key, binding, local_date, local_slot, [revision])
            if status is not Status.PLANNED:
                obligation.audit.append(status.value)
            self._obligations[key] = obligation
            return obligation

    @staticmethod
    def _resolve_schedule(
        schedule: ScheduleConfig,
        local_date: date,
        local_slot: time,
    ) -> tuple[datetime | None, Status]:
        try:
            return resolve_local(datetime.combine(local_date, local_slot), schedule.timezone_id), Status.PLANNED
        except NonexistentLocalTime:
            return None, Status.PREVENTED_TIME_NONEXISTENT
        except AmbiguousLocalTime:
            return None, Status.PREVENTED_TIME_AMBIGUOUS

    def _schedule_fingerprint(
        self,
        schedule: ScheduleConfig,
        local_date: date,
        local_slot: time,
    ) -> tuple:
        scheduled_at, _ = self._resolve_schedule(schedule, local_date, local_slot)
        return (
            schedule.version,
            schedule.timezone_id,
            self.tzdb_version,
            tuple(sorted(schedule.action_windows.items())),
            tuple(schedule.fixed_slots),
            schedule.configuration_valid,
            scheduled_at,
        )

    @staticmethod
    def _revision_fingerprint(revision: Revision) -> tuple:
        return (
            revision.schedule_version,
            revision.timezone_id,
            revision.tzdb_version,
            revision.action_windows,
            revision.fixed_slots,
            revision.configuration_valid,
            revision.scheduled_at_utc,
        )

    def _revision_matches_authority(self, obligation: Obligation, authority: Authority) -> bool:
        return self._revision_fingerprint(obligation.active_revision) == self._schedule_fingerprint(
            authority.schedule,
            obligation.local_date,
            obligation.local_slot,
        )

    def materialize_candidate(
        self,
        binding: RecipientBinding,
        local_date: date,
        local_slot: time,
        candidate_schedule: ScheduleConfig,
        current_authority: Authority,
        candidate_tzdb_version: str,
    ) -> Obligation:
        """Materialize under the current authority, never a stale scheduler view."""
        with self._lock:
            obligation = self.materialize(binding, local_date, local_slot, current_authority.schedule)
            if candidate_schedule != current_authority.schedule or candidate_tzdb_version != self.tzdb_version:
                audit = (
                    "STALE_SCHEDULER_VIEW_IGNORED:"
                    f"{candidate_schedule.version}/{candidate_tzdb_version}->"
                    f"{current_authority.schedule.version}/{self.tzdb_version}"
                )
                if audit not in obligation.audit:
                    obligation.audit.append(audit)
            self.apply_schedule_change(obligation, current_authority.schedule, current_authority)
            return obligation

    def schedule_day(
        self,
        binding: RecipientBinding,
        local_date: date,
        authority: Authority,
    ) -> list[Obligation]:
        if local_date.weekday() >= 5:
            return []
        obligations = [
            self.materialize(binding, local_date, slot, authority.schedule)
            for slot in authority.schedule.fixed_slots
        ]
        for obligation in obligations:
            self.evaluate(obligation, authority)
        return obligations

    def schedule_at_reopening(
        self,
        binding: RecipientBinding,
        reopened_at: datetime,
        authority: Authority,
    ) -> list[Obligation]:
        del binding, reopened_at, authority
        return []

    def _record_prevention(self, obligation: Obligation, status: Status) -> Status:
        revision = obligation.active_revision
        revision.status = status
        if status.value not in obligation.audit:
            obligation.audit.append(status.value)
        return status

    def _record_sequence_rollback(self, obligation: Obligation) -> Status:
        obligation.active_revision.status = Status.SEQUENCE_ROLLBACK
        if "SEQUENCE_ROLLBACK_DETECTED" not in obligation.audit:
            obligation.audit.append("SEQUENCE_ROLLBACK_DETECTED")
        return Status.SEQUENCE_ROLLBACK

    def _authority_status(self, obligation: Obligation, authority: Authority) -> Status | None:
        revision = obligation.active_revision
        if (
            not obligation.binding.active
            or not authority.binding_active
            or not authority.rights
            or not authority.mandate
            or not authority.agency_active
        ):
            return Status.PREVENTED_RIGHTS
        if not self._revision_matches_authority(obligation, authority):
            return Status.PREVENTED_RIGHTS
        if not authority.schedule.configuration_valid or not authority.schedule.action_allows(
            obligation.local_date.weekday(), obligation.local_slot
        ):
            return Status.PREVENTED_RIGHTS
        if revision.scheduled_at_utc is not None and any(
            closure.contains(revision.scheduled_at_utc) for closure in authority.closures
        ):
            return Status.PREVENTED_CLOSED
        return None

    def _synchronize_authority(self, obligation: Obligation, authority: Authority) -> None:
        if not self._revision_matches_authority(obligation, authority):
            self.apply_schedule_change(obligation, authority.schedule, authority)

    def evaluate(self, obligation: Obligation, authority: Authority) -> Status:
        with self._lock:
            status = obligation.status
            if status.value in TERMINAL_PREVENTED or status in {
                Status.SENT_CONFIRMED,
                Status.RESULT_UNKNOWN,
                Status.SEQUENCE_ROLLBACK,
                Status.SUPERSEDED_PLANNING,
            }:
                return status
            self._synchronize_authority(obligation, authority)
            failure = self._authority_status(obligation, authority)
            if failure is not None:
                return self._record_prevention(obligation, failure)
            return obligation.status

    def prepare(self, obligation: Obligation, authority: Authority, event_log: EventLog) -> Status:
        with self._lock:
            if obligation.status.value in TERMINAL_PREVENTED or obligation.status in {
                Status.SENT_CONFIRMED,
                Status.RESULT_UNKNOWN,
                Status.SEQUENCE_ROLLBACK,
            }:
                return obligation.status
            self._synchronize_authority(obligation, authority)
            failure = self._authority_status(obligation, authority)
            if failure is not None:
                return self._record_prevention(obligation, failure)
            if event_log.current_sequence < obligation.binding.cursor_sequence:
                return self._record_sequence_rollback(obligation)
            revision = obligation.active_revision
            if revision.status is Status.READY_TO_SEND:
                return revision.status
            revision.from_sequence = obligation.binding.cursor_sequence
            revision.to_sequence = event_log.current_sequence
            revision.events = event_log.between(revision.from_sequence, revision.to_sequence)
            payload = {
                "key": [str(part) for part in obligation.key],
                "from": revision.from_sequence,
                "to": revision.to_sequence,
                "events": [event.sequence for event in revision.events],
            }
            revision.content_hash = hashlib.sha256(
                json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
            ).hexdigest()
            revision.status = Status.READY_TO_SEND
            return revision.status

    def _next_fixed_instant(self, obligation: Obligation) -> datetime:
        schedule_slots = obligation.active_revision.fixed_slots
        for slot in schedule_slots:
            if slot > obligation.local_slot:
                return resolve_local(
                    datetime.combine(obligation.local_date, slot),
                    obligation.active_revision.timezone_id,
                )
        next_date = obligation.local_date + timedelta(days=1)
        while next_date.weekday() >= 5:
            next_date += timedelta(days=1)
        return resolve_local(
            datetime.combine(next_date, schedule_slots[0]),
            obligation.active_revision.timezone_id,
        )

    def deliver(
        self,
        obligation: Obligation,
        authority: Authority,
        event_log: EventLog,
        transport: Transport,
    ) -> Status:
        with self._lock:
            if obligation.status is Status.SENT_CONFIRMED:
                return obligation.status
            if obligation.status is Status.RESULT_UNKNOWN or obligation.binding.id in self._unknown_bindings:
                return Status.RESULT_UNKNOWN
            if obligation.status is Status.SEQUENCE_ROLLBACK:
                return obligation.status
            if obligation.status.value in TERMINAL_PREVENTED:
                return obligation.status
            self._synchronize_authority(obligation, authority)
            revision = obligation.active_revision
            now = self.clock.now()
            if revision.scheduled_at_utc is not None and now < revision.scheduled_at_utc:
                return revision.status
            if now >= self._next_fixed_instant(obligation):
                return self._record_prevention(obligation, Status.PREVENTED_LATE)
            failure = self._authority_status(obligation, authority)
            if failure is not None:
                return self._record_prevention(obligation, failure)
            if event_log.current_sequence < obligation.binding.cursor_sequence:
                return self._record_sequence_rollback(obligation)
            if obligation.status not in {Status.READY_TO_SEND, Status.FAILED_CERTAIN}:
                prepared = self.prepare(obligation, authority, event_log)
                if prepared is not Status.READY_TO_SEND:
                    return prepared
            revision = obligation.active_revision
            if revision.from_sequence != obligation.binding.cursor_sequence:
                return self._record_prevention(obligation, Status.PREVENTED_RIGHTS)
            if revision.content_hash is None or revision.to_sequence is None:
                raise RuntimeError("prepared revision lacks content evidence")
            revision.network_started = True
            try:
                outcome = transport.send(obligation.key, revision.content_hash)
            except Exception:
                outcome = TransportOutcome.UNKNOWN
            if type(outcome) is not TransportOutcome:
                outcome = TransportOutcome.UNKNOWN
                if "TRANSPORT_OUTCOME_INVALID" not in obligation.audit:
                    obligation.audit.append("TRANSPORT_OUTCOME_INVALID")
            self.transport_journal.append(TransportRecord(obligation.key, revision.content_hash, outcome))
            if outcome is TransportOutcome.UNKNOWN:
                revision.status = Status.RESULT_UNKNOWN
                self._unknown_bindings.add(obligation.binding.id)
            elif outcome is TransportOutcome.CERTAIN_FAILURE:
                revision.network_started = False
                revision.status = Status.FAILED_CERTAIN
            elif outcome is TransportOutcome.CONFIRMED:
                revision.status = Status.SENT_CONFIRMED
                obligation.binding.cursor_sequence = revision.to_sequence
                obligation.binding.last_confirmed_logical_key = obligation.key
            else:
                raise RuntimeError("unhandled validated transport outcome")
            return revision.status

    def reconcile_unknown(self, obligation: Obligation, outcome: object) -> Status:
        with self._lock:
            revision = obligation.active_revision
            if revision.status is not Status.RESULT_UNKNOWN:
                return revision.status
            if type(outcome) is not TransportOutcome:
                outcome = TransportOutcome.UNKNOWN
                if "RECONCILIATION_OUTCOME_INVALID" not in obligation.audit:
                    obligation.audit.append("RECONCILIATION_OUTCOME_INVALID")
            self.reconciliation_journal.append((obligation.key, outcome))
            if outcome is TransportOutcome.UNKNOWN:
                return revision.status
            if outcome is TransportOutcome.CERTAIN_FAILURE:
                revision.network_started = False
                revision.status = Status.FAILED_CERTAIN
                self._unknown_bindings.discard(obligation.binding.id)
                obligation.audit.append("RESULT_UNKNOWN_RECONCILED_CERTAIN_FAILURE")
                return revision.status
            if outcome is TransportOutcome.CONFIRMED:
                if revision.to_sequence is None:
                    raise RuntimeError("unknown result lacks frozen watermark")
                revision.status = Status.SENT_CONFIRMED
                obligation.binding.cursor_sequence = revision.to_sequence
                obligation.binding.last_confirmed_logical_key = obligation.key
                self._unknown_bindings.discard(obligation.binding.id)
                obligation.audit.append("RESULT_UNKNOWN_RECONCILED_CONFIRMED")
                return revision.status
            raise RuntimeError("unhandled validated reconciliation outcome")

    def reconcile_sequence_rollback(self, obligation: Obligation, event_log: EventLog) -> Status:
        with self._lock:
            revision = obligation.active_revision
            if revision.status is not Status.SEQUENCE_ROLLBACK:
                return revision.status
            if event_log.current_sequence < obligation.binding.cursor_sequence:
                return revision.status
            revision.status = Status.PLANNED
            obligation.audit.append("SEQUENCE_ROLLBACK_RECONCILED")
            return revision.status

    def apply_schedule_change(
        self,
        obligation: Obligation,
        new_schedule: ScheduleConfig,
        authority: Authority,
    ) -> Obligation:
        with self._lock:
            current = obligation.active_revision
            if current.status.value in TERMINAL_PREVENTED or current.status in {
                Status.RESULT_UNKNOWN,
                Status.SEQUENCE_ROLLBACK,
                Status.SENT_CONFIRMED,
            } or current.network_started:
                return obligation

            authoritative_schedule = authority.schedule
            if new_schedule != authoritative_schedule:
                stale_audit = (
                    "STALE_SCHEDULER_VIEW_IGNORED:"
                    f"{new_schedule.version}/{self.tzdb_version}->"
                    f"{authoritative_schedule.version}/{self.tzdb_version}"
                )
                if stale_audit not in obligation.audit:
                    obligation.audit.append(stale_audit)

            tzdb_changed = current.tzdb_version != self.tzdb_version
            prior_tzdb_version = current.tzdb_version
            scheduled_at, new_status = self._resolve_schedule(
                authoritative_schedule,
                obligation.local_date,
                obligation.local_slot,
            )

            if self._revision_fingerprint(current) == self._schedule_fingerprint(
                authoritative_schedule,
                obligation.local_date,
                obligation.local_slot,
            ):
                return obligation

            current.active = False
            current.status = Status.SUPERSEDED_PLANNING
            obligation.revisions.append(
                Revision(
                    number=current.number + 1,
                    schedule_version=authoritative_schedule.version,
                    timezone_id=authoritative_schedule.timezone_id,
                    tzdb_version=self.tzdb_version,
                    action_windows=tuple(sorted(authoritative_schedule.action_windows.items())),
                    fixed_slots=tuple(authoritative_schedule.fixed_slots),
                    configuration_valid=authoritative_schedule.configuration_valid,
                    scheduled_at_utc=scheduled_at,
                    status=new_status,
                )
            )
            if tzdb_changed:
                obligation.audit.append(f"TZDB_VERSION_CHANGED:{prior_tzdb_version}->{self.tzdb_version}")
            if new_status in {
                Status.PREVENTED_TIME_NONEXISTENT,
                Status.PREVENTED_TIME_AMBIGUOUS,
            } and new_status.value not in obligation.audit:
                obligation.audit.append(new_status.value)
            return obligation

    def acknowledge_claim(
        self,
        binding: RecipientBinding,
        claim_id: str,
        authority: Authority,
    ) -> bool:
        with self._lock:
            if (
                not binding.active
                or not authority.rights
                or not authority.mandate
                or not authority.agency_active
                or not authority.binding_active
            ):
                return False
            key = (binding.agency_id, claim_id)
            if key in self._claim_acks:
                return False
            self._claim_acks.add(key)
            self.claim_ack_journal.append(
                ClaimAckRecord(binding.id, binding.agency_id, claim_id, CLAIM_ACK_CONTENT)
            )
            return True
