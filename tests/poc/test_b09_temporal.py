from __future__ import annotations

import importlib.metadata
import re
import threading
import unittest
from datetime import date, datetime, time, timezone
from pathlib import Path
from unittest.mock import patch
from zoneinfo import TZPATH

from poc.b09_temporal import (
    AmbiguousLocalTime,
    Authority,
    CLAIM_ACK_CONTENT,
    Closure,
    ControlledClock,
    DEFAULT_SLOTS,
    EventLog,
    FakeTransport,
    InvalidSchedule,
    NonexistentLocalTime,
    ScheduleConfig,
    Status,
    TemporalEngine,
    TimeWindow,
    TransportOutcome,
    detect_tzdb_version,
    resolve_local,
)
from poc.b09_temporal.engine import TERMINAL_PREVENTED


PARIS = "Europe/Paris"
UTC = timezone.utc


def monday_schedule(version: str = "v1", timezone_id: str = PARIS) -> ScheduleConfig:
    windows = {weekday: (TimeWindow(time(8, 0), time(17, 0)),) for weekday in range(5)}
    return ScheduleConfig.validated(version, timezone_id, windows)


def open_authority(schedule: ScheduleConfig) -> Authority:
    return Authority(schedule=schedule)


class StrictLocalResolutionTests(unittest.TestCase):
    def test_unique_paris_local_time_resolves_to_one_utc_instant(self):
        resolved = resolve_local(datetime(2026, 2, 2, 8, 45), PARIS)
        self.assertEqual(datetime(2026, 2, 2, 7, 45, tzinfo=UTC), resolved)

    def test_paris_gap_and_overlap_are_rejected_without_implicit_shift(self):
        with self.assertRaises(NonexistentLocalTime):
            resolve_local(datetime(2026, 3, 29, 2, 30), PARIS)
        with self.assertRaises(AmbiguousLocalTime):
            resolve_local(datetime(2026, 10, 25, 2, 30), PARIS)

    def test_new_york_fixture_also_produces_gap_and_overlap_deterministically(self):
        with self.assertRaises(NonexistentLocalTime):
            resolve_local(datetime(2026, 3, 8, 2, 30), "America/New_York")
        with self.assertRaises(AmbiguousLocalTime):
            resolve_local(datetime(2026, 11, 1, 1, 30), "America/New_York")

    def test_ambiguous_closure_boundary_is_refused(self):
        with self.assertRaises(AmbiguousLocalTime):
            Closure.from_local(
                datetime(2026, 10, 25, 2, 30),
                datetime(2026, 10, 25, 4, 0),
                PARIS,
                "closure-v1",
            )

    def test_host_tzdb_version_is_captured_from_zoneinfo_metadata(self):
        expected = None
        for root in TZPATH:
            metadata_file = Path(root) / "tzdata.zi"
            try:
                with metadata_file.open(encoding="utf-8") as stream:
                    first_line = stream.readline().strip()
            except (OSError, UnicodeError):
                continue
            match = re.fullmatch(r"#\s*version\s+(\S+)", first_line)
            if match:
                expected = match.group(1)
                break
        if expected is None:
            package_version = importlib.metadata.version("tzdata")
            year, release = package_version.split(".", maxsplit=1)
            expected = f"{year}{chr(ord('a') + int(release) - 1)}"

        detected = detect_tzdb_version()

        self.assertRegex(detected, r"^\d{4}[a-z]$")
        self.assertEqual(expected, detected)

    def test_tzdata_package_fallback_is_normalized_to_concrete_tzdb_release(self):
        with (
            patch("poc.b09_temporal.engine.TZPATH", ()),
            patch("poc.b09_temporal.engine.importlib.metadata.version", return_value="2026.3"),
        ):
            detected = detect_tzdb_version()

        self.assertEqual("2026c", detected)
        self.assertRegex(detected, r"^\d{4}[a-z]$")


class ScheduleDecisionTests(unittest.TestCase):
    def test_d1_configuration_rejects_fixed_slots_outside_action_hours(self):
        windows = {weekday: (TimeWindow(time(9, 0), time(17, 0)),) for weekday in range(5)}
        with self.assertRaises(InvalidSchedule):
            ScheduleConfig.validated("bad", PARIS, windows)

    def test_d1_historical_inconsistency_prevents_occurrence(self):
        windows = {weekday: (TimeWindow(time(9, 0), time(17, 0)),) for weekday in range(5)}
        schedule = ScheduleConfig.legacy_unchecked("legacy", PARIS, windows)
        engine, binding, log = self.make_engine(schedule)

        occurrence = engine.schedule_day(binding, date(2026, 2, 2), open_authority(schedule))[0]

        self.assertEqual(Status.PREVENTED_RIGHTS, occurrence.status)
        self.assertEqual(0, binding.cursor_sequence)
        self.assertEqual([], engine.transport_journal)

    def test_weekend_creates_no_fixed_occurrence(self):
        schedule = monday_schedule()
        engine, binding, _ = self.make_engine(schedule)
        self.assertEqual([], engine.schedule_day(binding, date(2026, 2, 7), open_authority(schedule)))
        self.assertEqual([], engine.schedule_day(binding, date(2026, 2, 8), open_authority(schedule)))

    def make_engine(self, schedule: ScheduleConfig):
        log = EventLog()
        clock = ControlledClock(datetime(2026, 2, 2, 7, 45, tzinfo=UTC))
        engine = TemporalEngine(clock)
        binding = engine.activate_binding("agency-1", "operations", "recipient@example.test", log)
        return engine, binding, log


class ClosureAndCoverageTests(unittest.TestCase):
    def setUp(self):
        self.schedule = monday_schedule()
        self.clock = ControlledClock(datetime(2026, 2, 2, 7, 45, tzinfo=UTC))
        self.engine = TemporalEngine(self.clock)
        self.log = EventLog()
        self.binding = self.engine.activate_binding("agency-1", "operations", "recipient@example.test", self.log)

    def test_three_weekday_slots_send_in_order_without_duplicate_coverage(self):
        # B09-S01, S02, S03
        self.log.append(datetime(2026, 2, 2, 7, 0, tzinfo=UTC), "before-0845")
        obligations = self.engine.schedule_day(self.binding, date(2026, 2, 2), open_authority(self.schedule))
        first = obligations[0]
        self.engine.prepare(first, open_authority(self.schedule), self.log)
        self.assertEqual(Status.SENT_CONFIRMED, self.engine.deliver(first, open_authority(self.schedule), self.log, FakeTransport.confirmed()))
        first_cursor = self.binding.cursor_sequence

        self.log.append(datetime(2026, 2, 2, 10, 0, tzinfo=UTC), "after-0845")
        second = obligations[1]
        self.engine.prepare(second, open_authority(self.schedule), self.log)
        self.assertEqual(first_cursor, second.active_revision.from_sequence)
        self.clock.set(datetime(2026, 2, 2, 12, 30, tzinfo=UTC))
        self.engine.deliver(second, open_authority(self.schedule), self.log, FakeTransport.confirmed())

        third = obligations[2]
        self.engine.prepare(third, open_authority(self.schedule), self.log)
        self.engine.prepare(third, open_authority(self.schedule), self.log)
        self.clock.set(datetime(2026, 2, 2, 15, 0, tzinfo=UTC))
        self.engine.deliver(third, open_authority(self.schedule), self.log, FakeTransport.confirmed())

        self.assertEqual(3, len(self.engine.transport_journal))
        self.assertEqual(3, len({entry.obligation_key for entry in self.engine.transport_journal}))

    def test_monday_report_covers_since_friday_confirmed_including_weekend(self):
        # B09-S05
        friday_log = EventLog()
        friday_log.append(datetime(2026, 1, 30, 14, 0, tzinfo=UTC), "friday")
        binding = self.engine.activate_binding("agency-2", "operations", "monday@example.test", friday_log)
        friday = self.engine.schedule_day(binding, date(2026, 1, 30), open_authority(self.schedule))[-1]
        self.engine.prepare(friday, open_authority(self.schedule), friday_log)
        self.clock.set(datetime(2026, 1, 30, 15, 0, tzinfo=UTC))
        self.engine.deliver(friday, open_authority(self.schedule), friday_log, FakeTransport.confirmed())
        friday_cursor = binding.cursor_sequence
        friday_log.append(datetime(2026, 1, 31, 12, 0, tzinfo=UTC), "saturday")
        friday_log.append(datetime(2026, 2, 1, 12, 0, tzinfo=UTC), "sunday")

        monday = self.engine.schedule_day(binding, date(2026, 2, 2), open_authority(self.schedule))[0]
        self.engine.prepare(monday, open_authority(self.schedule), friday_log)

        self.assertEqual(friday_cursor, monday.active_revision.from_sequence)
        self.assertEqual((2, 3), tuple(event.sequence for event in monday.active_revision.events))

    def test_closed_slot_is_visible_terminal_and_does_not_move_cursor(self):
        # B09-S06, S12, S16
        closure = Closure.from_local(
            datetime(2026, 2, 2, 8, 45), datetime(2026, 2, 2, 9, 0), PARIS, "c1"
        )
        authority = Authority(schedule=self.schedule, closures=(closure,))
        occurrence = self.engine.schedule_day(self.binding, date(2026, 2, 2), authority)[0]

        self.assertEqual(Status.PREVENTED_CLOSED, occurrence.status)
        self.assertEqual(0, self.binding.cursor_sequence)
        authority.closures = ()
        self.assertEqual(Status.PREVENTED_CLOSED, self.engine.prepare(occurrence, authority, self.log))

    def test_half_open_closure_ending_at_slot_does_not_cover_slot(self):
        # B09-S15
        closure = Closure.from_local(
            datetime(2026, 2, 2, 8, 0), datetime(2026, 2, 2, 8, 45), PARIS, "c1"
        )
        occurrence = self.engine.schedule_day(
            self.binding, date(2026, 2, 2), Authority(schedule=self.schedule, closures=(closure,))
        )[0]
        self.assertEqual(Status.PLANNED, occurrence.status)

    def test_overlapping_closures_create_one_prevention_and_one_audit(self):
        # B09-S09
        first = Closure.from_local(datetime(2026, 2, 2, 8, 0), datetime(2026, 2, 2, 9, 0), PARIS, "c1")
        second = Closure.from_local(datetime(2026, 2, 2, 8, 30), datetime(2026, 2, 2, 10, 0), PARIS, "c2")
        occurrence = self.engine.schedule_day(
            self.binding,
            date(2026, 2, 2),
            Authority(schedule=self.schedule, closures=(first, second)),
        )[0]
        self.assertEqual(Status.PREVENTED_CLOSED, occurrence.status)
        self.assertEqual(1, occurrence.audit.count("PREVENTED_CLOSED"))

    def test_full_closed_day_prevents_three_slots_and_next_open_occurrence_covers_since_confirmation(self):
        # B09-S07, S37
        log = EventLog()
        binding = self.engine.activate_binding("agency-full-day", "operations", "full-day@example.test", log)
        log.append(datetime(2026, 1, 29, 14, 0, tzinfo=UTC), "last-confirmed")
        thursday = self.engine.schedule_day(binding, date(2026, 1, 29), open_authority(self.schedule))[-1]
        self.engine.prepare(thursday, open_authority(self.schedule), log)
        self.clock.set(datetime(2026, 1, 29, 15, 0, tzinfo=UTC))
        self.engine.deliver(thursday, open_authority(self.schedule), log, FakeTransport.confirmed())
        confirmed_cursor = binding.cursor_sequence

        friday_event = log.append(datetime(2026, 1, 30, 7, 0, tzinfo=UTC), "friday")
        saturday_event = log.append(datetime(2026, 1, 31, 12, 0, tzinfo=UTC), "saturday")
        sunday_event = log.append(datetime(2026, 2, 1, 12, 0, tzinfo=UTC), "sunday")
        closure = Closure.from_local(
            datetime(2026, 1, 30, 0, 0), datetime(2026, 1, 31, 0, 0), PARIS, "full-day"
        )
        authority = Authority(schedule=self.schedule, closures=(closure,))
        friday = self.engine.schedule_day(binding, date(2026, 1, 30), authority)

        self.assertEqual([Status.PREVENTED_CLOSED] * 3, [occurrence.status for occurrence in friday])
        self.assertEqual(confirmed_cursor, binding.cursor_sequence)
        self.assertEqual([], self.engine.schedule_at_reopening(binding, closure.end_utc, authority))

        monday = self.engine.schedule_day(binding, date(2026, 2, 2), open_authority(self.schedule))[0]
        self.engine.prepare(monday, open_authority(self.schedule), log)
        self.assertEqual(confirmed_cursor, monday.active_revision.from_sequence)
        self.assertEqual(
            (friday_event.sequence, saturday_event.sequence, sunday_event.sequence),
            tuple(event.sequence for event in monday.active_revision.events),
        )

    def test_s08_friday_afternoon_to_monday_noon_closure_has_no_reopening_occurrence(self):
        # B09-S08
        log = EventLog()
        binding = self.engine.activate_binding("agency-s08", "operations", "s08@example.test", log)
        log.append(datetime(2026, 1, 29, 14, 0, tzinfo=UTC), "last-confirmed")
        thursday = self.engine.schedule_day(binding, date(2026, 1, 29), open_authority(self.schedule))[-1]
        self.engine.prepare(thursday, open_authority(self.schedule), log)
        self.clock.set(datetime(2026, 1, 29, 15, 0, tzinfo=UTC))
        self.engine.deliver(thursday, open_authority(self.schedule), log, FakeTransport.confirmed())
        confirmed_cursor = binding.cursor_sequence

        friday_event = log.append(datetime(2026, 1, 30, 11, 30, tzinfo=UTC), "friday")
        weekend_event = log.append(datetime(2026, 2, 1, 12, 0, tzinfo=UTC), "weekend")
        monday_event = log.append(datetime(2026, 2, 2, 10, 30, tzinfo=UTC), "monday-before-reopening")
        closure = Closure.from_local(
            datetime(2026, 1, 30, 12, 0),
            datetime(2026, 2, 2, 12, 0),
            PARIS,
            "friday-afternoon-to-monday-noon",
        )
        closed_authority = Authority(schedule=self.schedule, closures=(closure,))

        friday = self.engine.schedule_day(binding, date(2026, 1, 30), closed_authority)
        monday = self.engine.schedule_day(binding, date(2026, 2, 2), closed_authority)

        self.assertEqual(
            [Status.PLANNED, Status.PREVENTED_CLOSED, Status.PREVENTED_CLOSED],
            [occurrence.status for occurrence in friday],
        )
        self.assertEqual(
            [Status.PREVENTED_CLOSED, Status.PLANNED, Status.PLANNED],
            [occurrence.status for occurrence in monday],
        )
        self.assertEqual([], self.engine.schedule_at_reopening(binding, closure.end_utc, closed_authority))
        self.assertEqual(confirmed_cursor, binding.cursor_sequence)

        first_monday_open = monday[1]
        self.engine.prepare(first_monday_open, closed_authority, log)
        self.assertEqual(confirmed_cursor, first_monday_open.active_revision.from_sequence)
        self.assertEqual(
            (friday_event.sequence, weekend_event.sequence, monday_event.sequence),
            tuple(event.sequence for event in first_monday_open.active_revision.events),
        )

    def test_latest_closure_version_before_start_governs_unstarted_occurrence(self):
        # B09-S10
        old = Closure.from_local(datetime(2026, 2, 2, 8, 0), datetime(2026, 2, 2, 10, 0), PARIS, "v1")
        shortened = Closure.from_local(datetime(2026, 2, 2, 8, 0), datetime(2026, 2, 2, 8, 30), PARIS, "v2")
        key_occurrence = self.engine.materialize(self.binding, date(2026, 2, 2), time(8, 45), self.schedule)
        status = self.engine.evaluate(key_occurrence, Authority(schedule=self.schedule, closures=(shortened,)))
        self.assertEqual(Status.PLANNED, status)
        self.assertNotEqual(old.version, shortened.version)

    def test_closure_added_after_generation_blocks_final_delivery(self):
        # B09-S11
        occurrence = self.engine.schedule_day(self.binding, date(2026, 2, 2), open_authority(self.schedule))[0]
        self.engine.prepare(occurrence, open_authority(self.schedule), self.log)
        closure = Closure.from_local(datetime(2026, 2, 2, 8, 0), datetime(2026, 2, 2, 9, 0), PARIS, "late")
        status = self.engine.deliver(
            occurrence,
            Authority(schedule=self.schedule, closures=(closure,)),
            self.log,
            FakeTransport.confirmed(),
        )
        self.assertEqual(Status.PREVENTED_CLOSED, status)
        self.assertEqual([], self.engine.transport_journal)


class DeliveryAndAuthorityTests(unittest.TestCase):
    def setUp(self):
        self.schedule = monday_schedule()
        self.clock = ControlledClock(datetime(2026, 2, 2, 7, 45, tzinfo=UTC))
        self.engine = TemporalEngine(self.clock)
        self.log = EventLog()
        self.binding = self.engine.activate_binding("agency-1", "operations", "recipient@example.test", self.log)
        self.log.append(datetime(2026, 2, 2, 7, 0, tzinfo=UTC), "event")

    def occurrence(self, index: int = 0):
        return self.engine.schedule_day(self.binding, date(2026, 2, 2), open_authority(self.schedule))[index]

    def test_confirmed_delivery_is_the_only_result_that_advances_cursor(self):
        occurrence = self.occurrence()
        self.engine.prepare(occurrence, open_authority(self.schedule), self.log)
        before = self.binding.cursor_sequence
        self.engine.deliver(occurrence, open_authority(self.schedule), self.log, FakeTransport.certain_failure())
        self.assertEqual(before, self.binding.cursor_sequence)
        self.assertEqual(Status.FAILED_CERTAIN, occurrence.status)

        self.engine.deliver(occurrence, open_authority(self.schedule), self.log, FakeTransport.confirmed())
        self.assertEqual(self.log.current_sequence, self.binding.cursor_sequence)
        self.assertEqual(Status.SENT_CONFIRMED, occurrence.status)

    def test_invalid_transport_results_fail_closed_without_cursor_advance_or_retry(self):
        for invalid_outcome in (None, "CONFIRMED", object()):
            with self.subTest(invalid_outcome=invalid_outcome):
                schedule = monday_schedule()
                clock = ControlledClock(datetime(2026, 2, 2, 7, 45, tzinfo=UTC))
                engine = TemporalEngine(clock)
                log = EventLog()
                binding = engine.activate_binding("agency-invalid", "operations", "invalid@example.test", log)
                log.append(datetime(2026, 2, 2, 7, 0, tzinfo=UTC), "event")
                occurrence = engine.schedule_day(binding, date(2026, 2, 2), open_authority(schedule))[0]
                engine.prepare(occurrence, open_authority(schedule), log)

                class InvalidTransport:
                    def __init__(self, outcome):
                        self.outcome = outcome
                        self.call_count = 0

                    def send(self, obligation_key, content_hash):
                        del obligation_key, content_hash
                        self.call_count += 1
                        return self.outcome

                transport = InvalidTransport(invalid_outcome)
                before = binding.cursor_sequence

                self.assertEqual(
                    Status.RESULT_UNKNOWN,
                    engine.deliver(occurrence, open_authority(schedule), log, transport),
                )
                self.assertEqual(before, binding.cursor_sequence)
                self.assertEqual(TransportOutcome.UNKNOWN, engine.transport_journal[-1].outcome)
                self.assertIn("TRANSPORT_OUTCOME_INVALID", occurrence.audit)
                self.assertEqual(
                    Status.RESULT_UNKNOWN,
                    engine.deliver(occurrence, open_authority(schedule), log, transport),
                )
                self.assertEqual(1, transport.call_count)

    def test_future_slots_cannot_send_before_their_scheduled_instants(self):
        obligations = self.engine.schedule_day(self.binding, date(2026, 2, 2), open_authority(self.schedule))
        for occurrence in obligations[1:]:
            self.engine.prepare(occurrence, open_authority(self.schedule), self.log)
            transport = FakeTransport.confirmed()
            self.assertEqual(
                Status.READY_TO_SEND,
                self.engine.deliver(occurrence, open_authority(self.schedule), self.log, transport),
            )
            self.assertEqual(0, transport.call_count)
        self.assertEqual([], self.engine.transport_journal)

    def test_unattempted_occurrence_becomes_late_exactly_at_next_fixed_slot(self):
        occurrence = self.occurrence()
        self.engine.prepare(occurrence, open_authority(self.schedule), self.log)
        self.clock.set(datetime(2026, 2, 2, 12, 30, tzinfo=UTC))
        transport = FakeTransport.confirmed()
        self.assertEqual(
            Status.PREVENTED_LATE,
            self.engine.deliver(occurrence, open_authority(self.schedule), self.log, transport),
        )
        self.assertEqual(0, transport.call_count)

    def test_attempt_is_allowed_from_scheduled_instant_until_next_slot(self):
        occurrence = self.occurrence(1)
        self.engine.prepare(occurrence, open_authority(self.schedule), self.log)
        self.clock.set(datetime(2026, 2, 2, 12, 30, tzinfo=UTC))
        self.assertEqual(
            Status.SENT_CONFIRMED,
            self.engine.deliver(occurrence, open_authority(self.schedule), self.log, FakeTransport.confirmed()),
        )

    def test_d2_failed_certain_is_retryable_only_before_next_fixed_slot(self):
        occurrence = self.occurrence()
        self.engine.prepare(occurrence, open_authority(self.schedule), self.log)
        self.engine.deliver(occurrence, open_authority(self.schedule), self.log, FakeTransport.certain_failure())
        self.clock.set(datetime(2026, 2, 2, 12, 29, 59, tzinfo=UTC))
        self.assertEqual(
            Status.SENT_CONFIRMED,
            self.engine.deliver(occurrence, open_authority(self.schedule), self.log, FakeTransport.confirmed()),
        )

        late_binding = self.engine.activate_binding("agency-1", "late", "late@example.test", self.log)
        late = self.engine.schedule_day(late_binding, date(2026, 2, 2), open_authority(self.schedule))[0]
        self.engine.prepare(late, open_authority(self.schedule), self.log)
        self.engine.deliver(late, open_authority(self.schedule), self.log, FakeTransport.certain_failure())
        self.clock.set(datetime(2026, 2, 2, 12, 30, tzinfo=UTC))
        self.assertEqual(
            Status.PREVENTED_LATE,
            self.engine.deliver(late, open_authority(self.schedule), self.log, FakeTransport.confirmed()),
        )

    def test_d2_uses_materialized_revision_slots_for_late_boundary(self):
        windows = {weekday: (TimeWindow(time(2, 0), time(4, 0)),) for weekday in range(5)}
        synthetic = ScheduleConfig.validated(
            "synthetic-slots",
            PARIS,
            windows,
            fixed_slots=(time(2, 30), time(3, 30)),
        )
        binding = self.engine.activate_binding("agency-d2", "synthetic", "d2@example.test", self.log)
        occurrence = self.engine.materialize(binding, date(2026, 2, 2), time(2, 30), synthetic)
        self.engine.prepare(occurrence, Authority(schedule=synthetic), self.log)
        self.clock.set(datetime(2026, 2, 2, 2, 30, tzinfo=UTC))
        transport = FakeTransport.confirmed()

        self.assertEqual((time(2, 30), time(3, 30)), occurrence.active_revision.fixed_slots)
        self.assertEqual(
            Status.PREVENTED_LATE,
            self.engine.deliver(occurrence, Authority(schedule=synthetic), self.log, transport),
        )
        self.assertEqual(0, transport.call_count)

    def test_unknown_result_blocks_retry_and_next_occurrence_until_reconciled(self):
        # B09-S26, S27, S36
        first = self.occurrence()
        self.engine.prepare(first, open_authority(self.schedule), self.log)
        self.engine.deliver(first, open_authority(self.schedule), self.log, FakeTransport.unknown())
        self.assertEqual(Status.RESULT_UNKNOWN, first.status)
        self.assertEqual(0, self.binding.cursor_sequence)
        calls = len(self.engine.transport_journal)
        self.assertEqual(Status.RESULT_UNKNOWN, self.engine.deliver(first, open_authority(self.schedule), self.log, FakeTransport.confirmed()))

        second = self.occurrence(1)
        self.engine.prepare(second, open_authority(self.schedule), self.log)
        self.assertEqual(Status.RESULT_UNKNOWN, self.engine.deliver(second, open_authority(self.schedule), self.log, FakeTransport.confirmed()))
        self.assertEqual(calls, len(self.engine.transport_journal))

    def test_transport_exception_after_network_start_is_unknown_and_never_retried(self):
        class RaisingTransport:
            def __init__(self):
                self.call_count = 0

            def send(self, obligation_key, content_hash):
                del obligation_key, content_hash
                self.call_count += 1
                raise RuntimeError("connection dropped after request write")

        occurrence = self.occurrence()
        self.engine.prepare(occurrence, open_authority(self.schedule), self.log)
        transport = RaisingTransport()

        self.assertEqual(
            Status.RESULT_UNKNOWN,
            self.engine.deliver(occurrence, open_authority(self.schedule), self.log, transport),
        )
        self.assertTrue(occurrence.active_revision.network_started)
        self.assertEqual(1, transport.call_count)
        self.assertEqual(TransportOutcome.UNKNOWN, self.engine.transport_journal[-1].outcome)

        self.assertEqual(
            Status.RESULT_UNKNOWN,
            self.engine.deliver(occurrence, open_authority(self.schedule), self.log, transport),
        )
        self.assertEqual(1, transport.call_count)

    def test_unknown_reconciliation_confirmed_advances_frozen_watermark_and_unblocks(self):
        occurrence = self.occurrence()
        self.engine.prepare(occurrence, open_authority(self.schedule), self.log)
        frozen = occurrence.active_revision.to_sequence
        self.engine.deliver(occurrence, open_authority(self.schedule), self.log, FakeTransport.unknown())

        self.assertEqual(Status.SENT_CONFIRMED, self.engine.reconcile_unknown(occurrence, TransportOutcome.CONFIRMED))
        self.assertEqual(frozen, self.binding.cursor_sequence)
        self.assertEqual((occurrence.key, TransportOutcome.CONFIRMED), self.engine.reconciliation_journal[-1])
        self.assertEqual(occurrence.key, self.binding.last_confirmed_logical_key)

        next_occurrence = self.occurrence(1)
        self.engine.prepare(next_occurrence, open_authority(self.schedule), self.log)
        self.clock.set(datetime(2026, 2, 2, 12, 30, tzinfo=UTC))
        self.assertEqual(
            Status.SENT_CONFIRMED,
            self.engine.deliver(next_occurrence, open_authority(self.schedule), self.log, FakeTransport.confirmed()),
        )

    def test_unknown_reconciliation_certain_failure_unblocks_retry_only_inside_d2(self):
        occurrence = self.occurrence()
        self.engine.prepare(occurrence, open_authority(self.schedule), self.log)
        self.engine.deliver(occurrence, open_authority(self.schedule), self.log, FakeTransport.unknown())

        self.assertEqual(
            Status.FAILED_CERTAIN,
            self.engine.reconcile_unknown(occurrence, TransportOutcome.CERTAIN_FAILURE),
        )
        self.assertEqual(0, self.binding.cursor_sequence)
        self.clock.set(datetime(2026, 2, 2, 12, 29, 59, tzinfo=UTC))
        self.assertEqual(
            Status.SENT_CONFIRMED,
            self.engine.deliver(occurrence, open_authority(self.schedule), self.log, FakeTransport.confirmed()),
        )

        late_binding = self.engine.activate_binding("agency-1", "unknown-late", "late@example.test", self.log)
        late = self.engine.schedule_day(late_binding, date(2026, 2, 2), open_authority(self.schedule))[0]
        self.clock.set(datetime(2026, 2, 2, 7, 45, tzinfo=UTC))
        self.engine.prepare(late, open_authority(self.schedule), self.log)
        self.engine.deliver(late, open_authority(self.schedule), self.log, FakeTransport.unknown())
        self.engine.reconcile_unknown(late, TransportOutcome.CERTAIN_FAILURE)
        self.clock.set(datetime(2026, 2, 2, 12, 30, tzinfo=UTC))
        transport = FakeTransport.confirmed()
        self.assertEqual(Status.PREVENTED_LATE, self.engine.deliver(late, open_authority(self.schedule), self.log, transport))
        self.assertEqual(0, transport.call_count)

    def test_unknown_reconciliation_unknown_remains_blocked(self):
        occurrence = self.occurrence()
        self.engine.prepare(occurrence, open_authority(self.schedule), self.log)
        self.engine.deliver(occurrence, open_authority(self.schedule), self.log, FakeTransport.unknown())

        self.assertEqual(Status.RESULT_UNKNOWN, self.engine.reconcile_unknown(occurrence, TransportOutcome.UNKNOWN))
        transport = FakeTransport.confirmed()
        self.assertEqual(Status.RESULT_UNKNOWN, self.engine.deliver(occurrence, open_authority(self.schedule), self.log, transport))
        self.assertEqual(0, transport.call_count)

    def test_invalid_unknown_reconciliation_outcomes_remain_blocked_without_mutation(self):
        for invalid_outcome in (None, "CONFIRMED", object()):
            with self.subTest(invalid_outcome=invalid_outcome):
                schedule = monday_schedule()
                clock = ControlledClock(datetime(2026, 2, 2, 7, 45, tzinfo=UTC))
                engine = TemporalEngine(clock)
                log = EventLog()
                binding = engine.activate_binding("agency-reconcile", "operations", "reconcile@example.test", log)
                log.append(datetime(2026, 2, 2, 7, 0, tzinfo=UTC), "event")
                occurrence = engine.schedule_day(binding, date(2026, 2, 2), open_authority(schedule))[0]
                engine.prepare(occurrence, open_authority(schedule), log)
                engine.deliver(occurrence, open_authority(schedule), log, FakeTransport.unknown())
                before_cursor = binding.cursor_sequence
                before_key = binding.last_confirmed_logical_key

                self.assertEqual(Status.RESULT_UNKNOWN, engine.reconcile_unknown(occurrence, invalid_outcome))
                self.assertEqual(before_cursor, binding.cursor_sequence)
                self.assertEqual(before_key, binding.last_confirmed_logical_key)
                self.assertEqual((occurrence.key, TransportOutcome.UNKNOWN), engine.reconciliation_journal[-1])
                self.assertIn("RECONCILIATION_OUTCOME_INVALID", occurrence.audit)
                transport = FakeTransport.confirmed()
                self.assertEqual(
                    Status.RESULT_UNKNOWN,
                    engine.deliver(occurrence, open_authority(schedule), log, transport),
                )
                self.assertEqual(0, transport.call_count)

    def test_rights_mandate_agency_binding_closure_and_schedule_are_rechecked(self):
        # B09-S28, S29
        variants = (
            Authority(schedule=self.schedule, rights=False),
            Authority(schedule=self.schedule, mandate=False),
            Authority(schedule=self.schedule, agency_active=False),
            Authority(schedule=self.schedule, binding_active=False),
        )
        for index, authority in enumerate(variants):
            binding = self.engine.activate_binding("agency-x", f"type-{index}", f"r{index}@example.test", self.log)
            occurrence = self.engine.schedule_day(binding, date(2026, 2, 2), open_authority(self.schedule))[0]
            self.engine.prepare(occurrence, open_authority(self.schedule), self.log)
            self.assertEqual(
                Status.PREVENTED_RIGHTS,
                self.engine.deliver(occurrence, authority, self.log, FakeTransport.confirmed()),
            )
        self.assertEqual([], self.engine.transport_journal)

    def test_event_after_frozen_watermark_waits_for_next_report(self):
        # B09-S33
        first = self.occurrence()
        self.engine.prepare(first, open_authority(self.schedule), self.log)
        late_sequence = self.log.append(datetime(2026, 2, 2, 7, 30, tzinfo=UTC), "after-freeze").sequence
        self.assertNotIn(late_sequence, [event.sequence for event in first.active_revision.events])
        self.engine.deliver(first, open_authority(self.schedule), self.log, FakeTransport.confirmed())
        second = self.occurrence(1)
        self.engine.prepare(second, open_authority(self.schedule), self.log)
        self.assertIn(late_sequence, [event.sequence for event in second.active_revision.events])

    def test_late_discovered_event_uses_sequence_and_is_not_silently_lost(self):
        # B09-S34
        first = self.occurrence()
        self.engine.prepare(first, open_authority(self.schedule), self.log)
        self.engine.deliver(first, open_authority(self.schedule), self.log, FakeTransport.confirmed())
        late = self.log.append(datetime(2026, 1, 31, 12, 0, tzinfo=UTC), "late-discovery")
        second = self.occurrence(1)
        self.engine.prepare(second, open_authority(self.schedule), self.log)
        self.assertEqual((late.sequence,), tuple(e.sequence for e in second.active_revision.events))

    def test_sequence_rollback_blocks_delivery_for_reconciliation(self):
        # B09-S35
        first = self.occurrence()
        self.engine.prepare(first, open_authority(self.schedule), self.log)
        self.engine.deliver(first, open_authority(self.schedule), self.log, FakeTransport.confirmed())
        self.log.restore_to(0)
        second = self.occurrence(1)
        self.assertEqual(Status.SEQUENCE_ROLLBACK, self.engine.prepare(second, open_authority(self.schedule), self.log))
        self.assertEqual(["SEQUENCE_ROLLBACK_DETECTED"], second.audit)

        self.log.restore_to(self.binding.cursor_sequence)
        self.assertEqual(Status.SEQUENCE_ROLLBACK, self.engine.prepare(second, open_authority(self.schedule), self.log))
        self.assertEqual(Status.PLANNED, self.engine.reconcile_sequence_rollback(second, self.log))
        self.assertEqual(
            ["SEQUENCE_ROLLBACK_DETECTED", "SEQUENCE_ROLLBACK_RECONCILED"],
            second.audit,
        )
        self.engine.prepare(second, open_authority(self.schedule), self.log)
        self.clock.set(datetime(2026, 2, 2, 12, 30, tzinfo=UTC))
        self.assertEqual(
            Status.SENT_CONFIRMED,
            self.engine.deliver(second, open_authority(self.schedule), self.log, FakeTransport.confirmed()),
        )


class BindingAndConcurrencyTests(unittest.TestCase):
    def setUp(self):
        self.schedule = monday_schedule()
        self.clock = ControlledClock(datetime(2026, 2, 2, 7, 45, tzinfo=UTC))
        self.engine = TemporalEngine(self.clock)
        self.log = EventLog()
        self.log.append(datetime(2026, 1, 30, 12, 0, tzinfo=UTC), "history")

    def test_d3_new_and_reauthorized_bindings_start_at_activation_without_history(self):
        # B09-S30, S31, S32
        first = self.engine.activate_binding("agency-1", "operations", "old@example.test", self.log)
        self.assertEqual(1, first.cursor_sequence)
        self.log.append(datetime(2026, 2, 2, 7, 0, tzinfo=UTC), "after activation")
        occurrence = self.engine.schedule_day(first, date(2026, 2, 2), open_authority(self.schedule))[0]
        self.engine.prepare(occurrence, open_authority(self.schedule), self.log)
        self.assertEqual((2,), tuple(e.sequence for e in occurrence.active_revision.events))

        self.engine.revoke_binding(first)
        replacement = self.engine.reauthorize_binding(first, "new@example.test", self.log)
        self.assertNotEqual(first.id, replacement.id)
        self.assertEqual(self.log.current_sequence, replacement.cursor_sequence)
        self.assertIsNone(replacement.last_confirmed_logical_key)

    def test_two_schedulers_create_one_obligation_with_schedule_independent_key(self):
        # B09-S22
        binding = self.engine.activate_binding("agency-1", "operations", "r@example.test", self.log)
        results = []
        barrier = threading.Barrier(2)

        def run_scheduler():
            barrier.wait()
            results.append(self.engine.materialize(binding, date(2026, 2, 2), time(8, 45), self.schedule))

        threads = [threading.Thread(target=run_scheduler) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertIs(results[0], results[1])
        self.assertEqual(1, self.engine.obligation_count)
        self.assertNotIn(self.schedule.version, results[0].key)

    def test_materialize_candidates_racing_use_current_schedule_and_tzdb_once(self):
        self.engine.tzdb_version = "2026c"
        binding = self.engine.activate_binding("agency-materialize-race", "operations", "materialize@example.test", self.log)
        old_schedule = self.schedule
        current_schedule = monday_schedule("v2", "Europe/London")
        current_authority = Authority(schedule=current_schedule)
        results = []
        barrier = threading.Barrier(2)

        def run_scheduler(candidate, candidate_tzdb_version):
            barrier.wait()
            results.append(
                self.engine.materialize_candidate(
                    binding,
                    date(2026, 2, 2),
                    time(8, 45),
                    candidate,
                    current_authority,
                    candidate_tzdb_version,
                )
            )

        threads = [
            threading.Thread(target=run_scheduler, args=(old_schedule, "2026b")),
            threading.Thread(target=run_scheduler, args=(current_schedule, "2026c")),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(2, len(results))
        self.assertIs(results[0], results[1])
        self.assertEqual("v2", results[0].active_revision.schedule_version)
        self.assertEqual("2026c", results[0].active_revision.tzdb_version)
        self.assertIn("STALE_SCHEDULER_VIEW_IGNORED:v1/2026b->v2/2026c", results[0].audit)
        self.assertEqual(1, len([revision for revision in results[0].revisions if revision.active]))
        self.assertEqual(1, self.engine.obligation_count)

    def test_materialize_candidate_audits_same_version_different_schedule_as_stale(self):
        self.engine.tzdb_version = "2026c"
        binding = self.engine.activate_binding("agency-candidate", "operations", "candidate@example.test", self.log)
        candidate = monday_schedule("v3", "Europe/London")
        current = monday_schedule("v3", "UTC")

        obligation = self.engine.materialize_candidate(
            binding,
            date(2026, 2, 2),
            time(8, 45),
            candidate,
            Authority(schedule=current),
            "2026c",
        )

        self.assertEqual("v3", obligation.active_revision.schedule_version)
        self.assertEqual("UTC", obligation.active_revision.timezone_id)
        self.assertIn("STALE_SCHEDULER_VIEW_IGNORED:v3/2026c->v3/2026c", obligation.audit)

    def test_delivery_synchronizes_same_version_paris_revision_to_utc_authority_before_effect(self):
        binding = self.engine.activate_binding("agency-authority-sync", "operations", "sync@example.test", self.log)
        paris = monday_schedule("v1", PARIS)
        utc = monday_schedule("v1", "UTC")
        obligation = self.engine.materialize(binding, date(2026, 2, 2), time(8, 45), paris)
        old_revision = obligation.active_revision
        transport = FakeTransport.confirmed()
        self.clock.set(datetime(2026, 2, 2, 8, 45, tzinfo=UTC))

        status = self.engine.deliver(obligation, Authority(schedule=utc), self.log, transport)

        self.assertEqual(Status.SENT_CONFIRMED, status)
        self.assertEqual(2, len(obligation.revisions))
        self.assertEqual(Status.SUPERSEDED_PLANNING, old_revision.status)
        self.assertFalse(old_revision.active)
        self.assertIsNone(old_revision.content_hash)
        self.assertEqual(PARIS, old_revision.timezone_id)
        self.assertEqual("UTC", obligation.active_revision.timezone_id)
        self.assertEqual(datetime(2026, 2, 2, 8, 45, tzinfo=UTC), obligation.active_revision.scheduled_at_utc)
        self.assertIsNotNone(obligation.active_revision.content_hash)
        self.assertNotIn("PREVENTED_RIGHTS", obligation.audit)
        self.assertEqual(1, transport.call_count)
        self.assertEqual(1, len(self.engine.transport_journal))

    def test_failed_certain_revision_synchronizes_to_current_authority_before_retry(self):
        binding = self.engine.activate_binding("agency-failed-sync", "operations", "failed-sync@example.test", self.log)
        paris = monday_schedule("v1", PARIS)
        utc = monday_schedule("v1", "UTC")
        obligation = self.engine.materialize(binding, date(2026, 2, 2), time(8, 45), paris)
        self.engine.prepare(obligation, Authority(schedule=paris), self.log)
        self.assertEqual(
            Status.FAILED_CERTAIN,
            self.engine.deliver(obligation, Authority(schedule=paris), self.log, FakeTransport.certain_failure()),
        )
        failed_revision = obligation.active_revision
        self.clock.set(datetime(2026, 2, 2, 8, 45, tzinfo=UTC))
        transport = FakeTransport.confirmed()

        status = self.engine.deliver(obligation, Authority(schedule=utc), self.log, transport)

        self.assertEqual(Status.SENT_CONFIRMED, status)
        self.assertEqual(Status.SUPERSEDED_PLANNING, failed_revision.status)
        self.assertEqual("UTC", obligation.active_revision.timezone_id)
        self.assertEqual(2, len(obligation.revisions))
        self.assertEqual(1, transport.call_count)

    def test_prepare_and_evaluate_synchronize_all_authoritative_schedule_attributes(self):
        variants = []

        changed_windows = {weekday: (TimeWindow(time(7, 0), time(17, 0)),) for weekday in range(5)}
        variants.append(("windows", monday_schedule("v1", PARIS), ScheduleConfig.validated("v1", PARIS, changed_windows)))

        wide_windows = {weekday: (TimeWindow(time(8, 0), time(18, 0)),) for weekday in range(5)}
        variants.append(
            (
                "slots",
                monday_schedule("v1", PARIS),
                ScheduleConfig.validated("v1", PARIS, wide_windows, fixed_slots=(time(8, 45), time(14, 0), time(17, 0))),
            )
        )

        for label, old_schedule, authority_schedule in variants:
            with self.subTest(label=label):
                binding = self.engine.activate_binding("agency-full-sync", label, f"{label}@example.test", self.log)
                obligation = self.engine.materialize(binding, date(2026, 2, 2), time(8, 45), old_schedule)
                old_revision = obligation.active_revision

                self.assertEqual(Status.PLANNED, self.engine.evaluate(obligation, Authority(schedule=authority_schedule)))
                self.assertEqual(Status.SUPERSEDED_PLANNING, old_revision.status)
                self.assertEqual(tuple(sorted(authority_schedule.action_windows.items())), obligation.active_revision.action_windows)
                self.assertEqual(authority_schedule.fixed_slots, obligation.active_revision.fixed_slots)
                self.assertEqual(Status.READY_TO_SEND, self.engine.prepare(obligation, Authority(schedule=authority_schedule), self.log))
                self.assertEqual(2, len(obligation.revisions))

        tzdb_binding = self.engine.activate_binding("agency-full-sync", "tzdb", "tzdb-sync@example.test", self.log)
        self.engine.tzdb_version = "2026b"
        tzdb_obligation = self.engine.materialize(tzdb_binding, date(2026, 2, 2), time(8, 45), self.schedule)
        old_tzdb_revision = tzdb_obligation.active_revision
        self.engine.tzdb_version = "2026c"

        self.assertEqual(Status.READY_TO_SEND, self.engine.prepare(tzdb_obligation, open_authority(self.schedule), self.log))
        self.assertEqual(Status.SUPERSEDED_PLANNING, old_tzdb_revision.status)
        self.assertEqual("2026c", tzdb_obligation.active_revision.tzdb_version)
        self.assertIn("TZDB_VERSION_CHANGED:2026b->2026c", tzdb_obligation.audit)

    def test_authority_status_rejects_every_stale_revision_fingerprint_component(self):
        binding = self.engine.activate_binding("agency-fingerprint", "operations", "fingerprint@example.test", self.log)
        obligation = self.engine.materialize(binding, date(2026, 2, 2), time(8, 45), self.schedule)
        revision = obligation.active_revision
        authority = open_authority(self.schedule)
        mutations = (
            ("schedule_version", "stale"),
            ("timezone_id", "UTC"),
            ("tzdb_version", "1900a"),
            ("action_windows", ()),
            ("fixed_slots", (time(8, 45),)),
            ("configuration_valid", False),
            ("scheduled_at_utc", datetime(2026, 2, 2, 8, 45, tzinfo=UTC)),
        )

        for attribute, stale_value in mutations:
            with self.subTest(attribute=attribute):
                original = getattr(revision, attribute)
                setattr(revision, attribute, stale_value)
                self.assertEqual(Status.PREVENTED_RIGHTS, self.engine._authority_status(obligation, authority))
                setattr(revision, attribute, original)
        self.assertIsNone(self.engine._authority_status(obligation, authority))

    def test_materialize_candidate_updates_preexisting_obligation_and_audits_distinct_stale_candidate(self):
        self.engine.tzdb_version = "2026c"
        binding = self.engine.activate_binding("agency-existing", "operations", "existing@example.test", self.log)
        old = monday_schedule("v1", PARIS)
        current = monday_schedule("v2", "UTC")
        stale_candidate = monday_schedule("candidate-v9", "Europe/London")
        obligation = self.engine.materialize(binding, date(2026, 2, 2), time(8, 45), old)
        old_revision = obligation.active_revision

        same = self.engine.materialize_candidate(
            binding,
            date(2026, 2, 2),
            time(8, 45),
            current,
            Authority(schedule=current),
            "2026c",
        )

        self.assertIs(obligation, same)
        self.assertEqual(Status.SUPERSEDED_PLANNING, old_revision.status)
        self.assertEqual("v1", old_revision.schedule_version)
        self.assertEqual(PARIS, old_revision.timezone_id)
        self.assertEqual("v2", obligation.active_revision.schedule_version)
        self.assertEqual("UTC", obligation.active_revision.timezone_id)
        self.assertEqual("2026c", obligation.active_revision.tzdb_version)
        self.assertEqual(2, len(obligation.revisions))
        self.assertEqual(1, len([revision for revision in obligation.revisions if revision.active]))

        same_from_stale_candidate = self.engine.materialize_candidate(
            binding,
            date(2026, 2, 2),
            time(8, 45),
            stale_candidate,
            Authority(schedule=current),
            "2026b",
        )
        self.assertIs(obligation, same_from_stale_candidate)
        self.assertEqual(2, len(obligation.revisions))
        self.assertIn("STALE_SCHEDULER_VIEW_IGNORED:candidate-v9/2026b->v2/2026c", obligation.audit)

        self.clock.set(datetime(2026, 2, 2, 8, 45, tzinfo=UTC))
        transport = FakeTransport.confirmed()
        self.assertEqual(Status.SENT_CONFIRMED, self.engine.deliver(obligation, Authority(schedule=current), self.log, transport))
        self.assertEqual(1, transport.call_count)

    def test_racing_materialize_candidates_update_one_preexisting_obligation_once(self):
        self.engine.tzdb_version = "2026c"
        binding = self.engine.activate_binding("agency-existing-race", "operations", "race-existing@example.test", self.log)
        old = monday_schedule("v1", PARIS)
        current = monday_schedule("v2", "UTC")
        authority = Authority(schedule=current)
        obligation = self.engine.materialize(binding, date(2026, 2, 2), time(8, 45), old)
        results = []
        barrier = threading.Barrier(2)

        def run(candidate, candidate_tzdb):
            barrier.wait()
            results.append(
                self.engine.materialize_candidate(
                    binding,
                    date(2026, 2, 2),
                    time(8, 45),
                    candidate,
                    authority,
                    candidate_tzdb,
                )
            )

        threads = (
            threading.Thread(target=run, args=(current, "2026c")),
            threading.Thread(target=run, args=(monday_schedule("candidate-old", "Europe/London"), "2026b")),
        )
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(2, len(results))
        self.assertIs(obligation, results[0])
        self.assertIs(results[0], results[1])
        self.assertEqual(2, len(obligation.revisions))
        self.assertEqual(Status.SUPERSEDED_PLANNING, obligation.revisions[0].status)
        self.assertEqual("v2", obligation.active_revision.schedule_version)
        self.assertEqual("UTC", obligation.active_revision.timezone_id)
        self.assertEqual(1, len([revision for revision in obligation.revisions if revision.active]))

        self.clock.set(datetime(2026, 2, 2, 8, 45, tzinfo=UTC))
        transport = FakeTransport.confirmed()
        self.engine.deliver(results[0], authority, self.log, transport)
        self.engine.deliver(results[1], authority, self.log, transport)
        self.assertEqual(1, transport.call_count)

    def test_materialize_candidate_never_resurrects_terminal_or_reconciliation_blocked_obligation(self):
        binding = self.engine.activate_binding("agency-materialize-terminal", "operations", "terminal@example.test", self.log)
        closure = Closure.from_local(
            datetime(2026, 2, 2, 8, 0), datetime(2026, 2, 2, 9, 0), PARIS, "terminal"
        )
        obligation = self.engine.schedule_day(
            binding,
            date(2026, 2, 2),
            Authority(schedule=self.schedule, closures=(closure,)),
        )[0]
        revision = obligation.active_revision
        original_audit = tuple(obligation.audit)
        replacement = monday_schedule("v2", "UTC")

        same = self.engine.materialize_candidate(
            binding,
            date(2026, 2, 2),
            time(8, 45),
            replacement,
            Authority(schedule=replacement),
            self.engine.tzdb_version,
        )

        self.assertIs(obligation, same)
        self.assertIs(revision, obligation.active_revision)
        self.assertEqual(Status.PREVENTED_CLOSED, obligation.status)
        self.assertEqual(1, len(obligation.revisions))
        self.assertEqual(original_audit, tuple(obligation.audit))

        unknown_binding = self.engine.activate_binding(
            "agency-materialize-blocked", "unknown", "unknown-materialize@example.test", self.log
        )
        unknown = self.engine.materialize(unknown_binding, date(2026, 2, 2), time(8, 45), self.schedule)
        self.engine.prepare(unknown, open_authority(self.schedule), self.log)
        self.engine.deliver(unknown, open_authority(self.schedule), self.log, FakeTransport.unknown())
        unknown_revision = unknown.active_revision

        self.engine.materialize_candidate(
            unknown_binding,
            date(2026, 2, 2),
            time(8, 45),
            replacement,
            Authority(schedule=replacement),
            self.engine.tzdb_version,
        )

        self.assertIs(unknown_revision, unknown.active_revision)
        self.assertEqual(Status.RESULT_UNKNOWN, unknown.status)
        self.assertEqual(1, len(unknown.revisions))

        rollback_binding = self.engine.activate_binding(
            "agency-materialize-blocked", "rollback", "rollback-materialize@example.test", self.log
        )
        rollback_binding.cursor_sequence = 1
        rollback = self.engine.materialize(rollback_binding, date(2026, 2, 2), time(8, 45), self.schedule)
        restored_sequence = self.log.current_sequence
        self.log.restore_to(0)
        self.engine.prepare(rollback, open_authority(self.schedule), self.log)
        rollback_revision = rollback.active_revision

        self.engine.materialize_candidate(
            rollback_binding,
            date(2026, 2, 2),
            time(8, 45),
            replacement,
            Authority(schedule=replacement),
            self.engine.tzdb_version,
        )

        self.assertIs(rollback_revision, rollback.active_revision)
        self.assertEqual(Status.SEQUENCE_ROLLBACK, rollback.status)
        self.assertEqual(1, len(rollback.revisions))
        self.log.restore_to(restored_sequence)

    def test_old_and_new_schedulers_racing_apply_current_authority_once(self):
        # B09-S20, S21
        self.engine.tzdb_version = "2026c"
        binding = self.engine.activate_binding("agency-1", "operations", "race@example.test", self.log)
        obligation = self.engine.materialize(binding, date(2026, 2, 2), time(8, 45), self.schedule)
        old_schedule = self.schedule
        candidate_schedule = monday_schedule("v2", "Europe/London")
        current_schedule = monday_schedule("v3", "UTC")
        current_authority = Authority(schedule=current_schedule)
        results = []
        barrier = threading.Barrier(2)

        def run_scheduler(candidate):
            barrier.wait()
            results.append(self.engine.apply_schedule_change(obligation, candidate, current_authority))

        threads = [
            threading.Thread(target=run_scheduler, args=(old_schedule,)),
            threading.Thread(target=run_scheduler, args=(candidate_schedule,)),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(2, len(results))
        self.assertIs(results[0], results[1])
        self.assertEqual("v3", results[0].active_revision.schedule_version)
        self.assertEqual("UTC", results[0].active_revision.timezone_id)
        self.assertEqual("2026c", results[0].active_revision.tzdb_version)
        self.assertIn("STALE_SCHEDULER_VIEW_IGNORED:v1/2026c->v3/2026c", results[0].audit)
        self.assertIn("STALE_SCHEDULER_VIEW_IGNORED:v2/2026c->v3/2026c", results[0].audit)
        self.assertEqual(1, len([revision for revision in results[0].revisions if revision.active]))
        self.assertEqual(2, len(results[0].revisions))
        self.assertEqual(Status.SUPERSEDED_PLANNING, results[0].revisions[0].status)
        self.assertEqual(1, self.engine.obligation_count)
        self.engine.prepare(results[0], current_authority, self.log)
        self.clock.set(datetime(2026, 2, 2, 8, 45, tzinfo=UTC))
        transport = FakeTransport.confirmed()
        self.engine.deliver(results[0], current_authority, self.log, transport)
        self.engine.deliver(results[1], current_authority, self.log, transport)
        self.assertEqual(1, transport.call_count)

    def test_schedule_change_ignores_stale_candidate_and_uses_current_authority(self):
        binding = self.engine.activate_binding("agency-authority", "operations", "authority@example.test", self.log)
        obligation = self.engine.materialize(binding, date(2026, 2, 2), time(8, 45), self.schedule)
        candidate = monday_schedule("v2", "Europe/London")
        current = monday_schedule("v3", "UTC")
        authority = Authority(schedule=current)

        changed = self.engine.apply_schedule_change(obligation, candidate, authority)

        self.assertIs(obligation, changed)
        self.assertEqual(2, len(obligation.revisions))
        self.assertEqual(Status.SUPERSEDED_PLANNING, obligation.revisions[0].status)
        self.assertEqual("v1", obligation.revisions[0].schedule_version)
        self.assertEqual(PARIS, obligation.revisions[0].timezone_id)
        self.assertEqual("v3", obligation.active_revision.schedule_version)
        self.assertEqual("UTC", obligation.active_revision.timezone_id)
        self.assertEqual(self.engine.tzdb_version, obligation.active_revision.tzdb_version)
        self.assertIn(
            f"STALE_SCHEDULER_VIEW_IGNORED:v2/{self.engine.tzdb_version}->v3/{self.engine.tzdb_version}",
            obligation.audit,
        )

        self.assertEqual(Status.READY_TO_SEND, self.engine.prepare(obligation, authority, self.log))
        self.clock.set(datetime(2026, 2, 2, 8, 45, tzinfo=UTC))
        transport = FakeTransport.confirmed()
        self.assertEqual(Status.SENT_CONFIRMED, self.engine.deliver(obligation, authority, self.log, transport))
        self.assertNotIn("PREVENTED_RIGHTS", obligation.audit)
        self.assertEqual(1, transport.call_count)

    def test_planned_schedule_change_preserves_history_and_audits_dst_terminal_revision(self):
        windows = {weekday: (TimeWindow(time(0, 0), time(4, 0)),) for weekday in range(7)}
        utc_schedule = ScheduleConfig.validated("utc-v1", "UTC", windows, fixed_slots=(time(2, 30),))
        paris_schedule = ScheduleConfig.validated("paris-v2", PARIS, windows, fixed_slots=(time(2, 30),))
        cases = (
            ("gap", date(2026, 3, 29), Status.PREVENTED_TIME_NONEXISTENT),
            ("overlap", date(2026, 10, 25), Status.PREVENTED_TIME_AMBIGUOUS),
        )
        for label, local_date, expected_status in cases:
            with self.subTest(label=label):
                binding = self.engine.activate_binding("agency-history", label, f"{label}@example.test", self.log)
                obligation = self.engine.materialize(binding, local_date, time(2, 30), utc_schedule)
                old_revision = obligation.active_revision
                old_instant = old_revision.scheduled_at_utc
                old_slots = old_revision.fixed_slots

                self.engine.apply_schedule_change(obligation, paris_schedule, Authority(schedule=paris_schedule))

                self.assertEqual(2, len(obligation.revisions))
                self.assertIs(old_revision, obligation.revisions[0])
                self.assertFalse(old_revision.active)
                self.assertEqual(Status.SUPERSEDED_PLANNING, old_revision.status)
                self.assertEqual("utc-v1", old_revision.schedule_version)
                self.assertEqual("UTC", old_revision.timezone_id)
                self.assertEqual(old_instant, old_revision.scheduled_at_utc)
                self.assertEqual(old_slots, old_revision.fixed_slots)
                self.assertEqual(expected_status, obligation.status)
                self.assertEqual(1, len([revision for revision in obligation.revisions if revision.active]))
                self.assertIn(expected_status.value, obligation.audit)

                terminal_revision = obligation.active_revision
                original_audit = tuple(obligation.audit)
                replacement = ScheduleConfig.validated(
                    "utc-v3",
                    "UTC",
                    windows,
                    fixed_slots=(time(2, 30),),
                )
                self.engine.apply_schedule_change(obligation, replacement, Authority(schedule=replacement))
                transport = FakeTransport.confirmed()
                self.engine.prepare(obligation, Authority(schedule=replacement), self.log)
                self.engine.deliver(obligation, Authority(schedule=replacement), self.log, transport)

                self.assertEqual(2, len(obligation.revisions))
                self.assertIs(terminal_revision, obligation.active_revision)
                self.assertEqual(expected_status, obligation.status)
                self.assertEqual(original_audit, tuple(obligation.audit))
                self.assertEqual(0, transport.call_count)

    def test_schedule_change_with_same_version_but_changed_windows_creates_revision(self):
        binding = self.engine.activate_binding("agency-window", "operations", "window@example.test", self.log)
        obligation = self.engine.materialize(binding, date(2026, 2, 2), time(8, 45), self.schedule)
        old_revision = obligation.active_revision
        windows = {weekday: (TimeWindow(time(7, 0), time(17, 0)),) for weekday in range(5)}
        changed_schedule = ScheduleConfig.validated("v1", PARIS, windows)

        self.engine.apply_schedule_change(obligation, changed_schedule, Authority(schedule=changed_schedule))

        self.assertEqual(2, len(obligation.revisions))
        self.assertEqual(Status.SUPERSEDED_PLANNING, old_revision.status)
        self.assertNotEqual(old_revision.action_windows, obligation.active_revision.action_windows)

    def test_schedule_change_with_no_effective_attribute_change_creates_no_revision(self):
        binding = self.engine.activate_binding("agency-noop", "operations", "noop@example.test", self.log)
        obligation = self.engine.materialize(binding, date(2026, 2, 2), time(8, 45), self.schedule)
        original = obligation.active_revision

        self.engine.apply_schedule_change(obligation, self.schedule, Authority(schedule=self.schedule))

        self.assertEqual(1, len(obligation.revisions))
        self.assertIs(original, obligation.active_revision)
        self.assertEqual([], obligation.audit)

    def test_dst_gap_and_overlap_materialize_terminal_obligations_without_transport(self):
        windows = {weekday: (TimeWindow(time(0, 0), time(4, 0)),) for weekday in range(5)}
        synthetic = ScheduleConfig.validated("dst", PARIS, windows, fixed_slots=(time(2, 30),))
        cases = (
            ("gap", date(2026, 3, 29), date(2026, 3, 30), Status.PREVENTED_TIME_NONEXISTENT),
            ("overlap", date(2026, 10, 25), date(2026, 10, 26), Status.PREVENTED_TIME_AMBIGUOUS),
        )
        for label, invalid_date, next_valid_date, expected_status in cases:
            with self.subTest(label=label):
                binding = self.engine.activate_binding("agency-1", f"dst-{label}", f"{label}@example.test", self.log)
                event = self.log.append(datetime(2026, 2, 2, 7, 0, tzinfo=UTC), label)
                before = binding.cursor_sequence
                prevented = self.engine.materialize(binding, invalid_date, time(2, 30), synthetic)

                self.assertEqual(expected_status, prevented.status)
                self.assertEqual(before, binding.cursor_sequence)

                next_valid = self.engine.materialize(binding, next_valid_date, time(2, 30), synthetic)
                self.engine.prepare(next_valid, Authority(schedule=synthetic), self.log)
                self.assertIn(event.sequence, tuple(item.sequence for item in next_valid.active_revision.events))
        self.assertEqual([], self.engine.transport_journal)

    def test_duplicate_prepare_and_callback_do_not_duplicate_generation_or_send(self):
        # B09-S23
        binding = self.engine.activate_binding("agency-1", "operations", "r@example.test", self.log)
        occurrence = self.engine.schedule_day(binding, date(2026, 2, 2), open_authority(self.schedule))[0]
        self.engine.prepare(occurrence, open_authority(self.schedule), self.log)
        content_hash = occurrence.active_revision.content_hash
        self.engine.prepare(occurrence, open_authority(self.schedule), self.log)
        self.assertEqual(content_hash, occurrence.active_revision.content_hash)
        transport = FakeTransport.confirmed()
        self.engine.deliver(occurrence, open_authority(self.schedule), self.log, transport)
        self.engine.deliver(occurrence, open_authority(self.schedule), self.log, transport)
        self.assertEqual(1, transport.call_count)

    def test_prepared_revision_in_memory_store_resumes_same_hash_and_sends_once(self):
        # B09-S24
        binding = self.engine.activate_binding("agency-1", "crash", "r@example.test", self.log)
        occurrence = self.engine.schedule_day(binding, date(2026, 2, 2), open_authority(self.schedule))[0]
        self.engine.prepare(occurrence, open_authority(self.schedule), self.log)
        prepared_hash = occurrence.active_revision.content_hash
        self.assertEqual(Status.READY_TO_SEND, occurrence.status)
        self.assertFalse(occurrence.active_revision.network_started)

        transport = FakeTransport.confirmed()
        self.engine.prepare(occurrence, open_authority(self.schedule), self.log)
        self.assertEqual(prepared_hash, occurrence.active_revision.content_hash)
        self.assertEqual(0, transport.call_count)
        self.engine.deliver(occurrence, open_authority(self.schedule), self.log, transport)
        self.engine.deliver(occurrence, open_authority(self.schedule), self.log, transport)
        self.assertEqual(1, transport.call_count)

    def test_planning_change_keeps_one_active_revision_and_never_double_sends(self):
        # B09-S20, S21
        binding = self.engine.activate_binding("agency-1", "operations", "r@example.test", self.log)
        old = self.engine.materialize(binding, date(2026, 2, 2), time(8, 45), self.schedule)
        self.engine.prepare(old, open_authority(self.schedule), self.log)
        new_schedule = monday_schedule("v2", "Europe/London")
        changed = self.engine.apply_schedule_change(old, new_schedule, Authority(schedule=new_schedule))

        self.assertIs(old, changed)
        self.assertEqual(1, len([r for r in old.revisions if r.active]))
        self.assertEqual(Status.SUPERSEDED_PLANNING, old.revisions[0].status)
        self.assertEqual("v2", old.active_revision.schedule_version)
        self.engine.prepare(old, Authority(schedule=new_schedule), self.log)
        self.clock.set(datetime(2026, 2, 2, 8, 45, tzinfo=UTC))
        self.engine.deliver(old, Authority(schedule=new_schedule), self.log, FakeTransport.confirmed())
        self.assertEqual(1, len(self.engine.transport_journal))

    def test_tzdb_version_change_is_audited_on_same_obligation_without_double_send(self):
        engine = TemporalEngine(self.clock, tzdb_version="2026b")
        binding = engine.activate_binding("agency-1", "tzdb", "r@example.test", self.log)
        occurrence = engine.materialize(binding, date(2026, 2, 2), time(8, 45), self.schedule)
        engine.prepare(occurrence, open_authority(self.schedule), self.log)
        engine.tzdb_version = "2026c"
        new_schedule = monday_schedule("v2")

        engine.apply_schedule_change(occurrence, new_schedule, Authority(schedule=new_schedule))

        self.assertEqual(1, engine.obligation_count)
        self.assertEqual(("2026b", "2026c"), (occurrence.revisions[0].tzdb_version, occurrence.active_revision.tzdb_version))
        self.assertIn("TZDB_VERSION_CHANGED:2026b->2026c", occurrence.audit)
        transport = FakeTransport.confirmed()
        engine.prepare(occurrence, Authority(schedule=new_schedule), self.log)
        engine.deliver(occurrence, Authority(schedule=new_schedule), self.log, transport)
        engine.deliver(occurrence, Authority(schedule=new_schedule), self.log, transport)
        self.assertEqual(1, transport.call_count)

    def test_schedule_change_after_unknown_result_cannot_create_new_active_revision(self):
        binding = self.engine.activate_binding("agency-1", "operations", "r@example.test", self.log)
        occurrence = self.engine.schedule_day(binding, date(2026, 2, 2), open_authority(self.schedule))[0]
        self.engine.prepare(occurrence, open_authority(self.schedule), self.log)
        self.engine.deliver(occurrence, open_authority(self.schedule), self.log, FakeTransport.unknown())
        new_schedule = monday_schedule("v2", "Europe/London")
        self.engine.apply_schedule_change(occurrence, new_schedule, Authority(schedule=new_schedule))
        self.assertEqual(1, len(occurrence.revisions))
        self.assertEqual(Status.RESULT_UNKNOWN, occurrence.status)

    def test_schedule_change_never_resurrects_any_terminal_prevention(self):
        cases = []

        closed_binding = self.engine.activate_binding("agency-terminal", "closed", "closed@example.test", self.log)
        closure = Closure.from_local(
            datetime(2026, 2, 2, 8, 0), datetime(2026, 2, 2, 9, 0), PARIS, "closed-v1"
        )
        closed = self.engine.schedule_day(
            closed_binding,
            date(2026, 2, 2),
            Authority(schedule=self.schedule, closures=(closure,)),
        )[0]
        cases.append(("closure removed", closed, closed_binding))

        rights_binding = self.engine.activate_binding("agency-terminal", "rights", "rights@example.test", self.log)
        rights = self.engine.schedule_day(rights_binding, date(2026, 2, 2), Authority(schedule=self.schedule, rights=False))[0]
        cases.append(("rights restored", rights, rights_binding))

        late_binding = self.engine.activate_binding("agency-terminal", "late", "late@example.test", self.log)
        late = self.engine.schedule_day(late_binding, date(2026, 2, 2), open_authority(self.schedule))[0]
        self.clock.set(datetime(2026, 2, 2, 12, 30, tzinfo=UTC))
        self.engine.deliver(late, open_authority(self.schedule), self.log, FakeTransport.confirmed())
        cases.append(("late occurrence", late, late_binding))

        dst_windows = {weekday: (TimeWindow(time(0, 0), time(4, 0)),) for weekday in range(5)}
        dst_schedule = ScheduleConfig.validated("dst-v1", PARIS, dst_windows, fixed_slots=(time(2, 30),))
        gap_binding = self.engine.activate_binding("agency-terminal", "gap", "gap@example.test", self.log)
        gap = self.engine.materialize(gap_binding, date(2026, 3, 29), time(2, 30), dst_schedule)
        cases.append(("DST gap moved to new zone", gap, gap_binding))

        overlap_binding = self.engine.activate_binding("agency-terminal", "overlap", "overlap@example.test", self.log)
        overlap = self.engine.materialize(overlap_binding, date(2026, 10, 25), time(2, 30), dst_schedule)
        cases.append(("DST overlap moved to new zone", overlap, overlap_binding))

        self.assertEqual(TERMINAL_PREVENTED, {occurrence.status.value for _, occurrence, _ in cases})

        replacement = monday_schedule("v2", "Europe/London")
        self.engine.tzdb_version = "2026d"
        for label, occurrence, binding in cases:
            with self.subTest(label=label, status=occurrence.status):
                revision = occurrence.active_revision
                original_status = occurrence.status
                original_audit = tuple(occurrence.audit)
                original_cursor = binding.cursor_sequence

                changed = self.engine.apply_schedule_change(occurrence, replacement, Authority(schedule=replacement))
                transport = FakeTransport.confirmed()
                self.engine.prepare(changed, Authority(schedule=replacement), self.log)
                self.engine.deliver(changed, Authority(schedule=replacement), self.log, transport)

                self.assertIs(occurrence, changed)
                self.assertEqual(1, len(occurrence.revisions))
                self.assertIs(revision, occurrence.active_revision)
                self.assertEqual(original_status, occurrence.status)
                self.assertEqual(original_audit, tuple(occurrence.audit))
                self.assertEqual(original_cursor, binding.cursor_sequence)
                self.assertEqual(0, transport.call_count)
        self.assertEqual([], self.engine.transport_journal)

    def test_schedule_change_cannot_replace_reconciliation_blocked_states(self):
        unknown_binding = self.engine.activate_binding("agency-blocked", "unknown", "unknown@example.test", self.log)
        unknown = self.engine.schedule_day(unknown_binding, date(2026, 2, 2), open_authority(self.schedule))[0]
        self.clock.set(datetime(2026, 2, 2, 7, 45, tzinfo=UTC))
        self.engine.prepare(unknown, open_authority(self.schedule), self.log)
        self.engine.deliver(unknown, open_authority(self.schedule), self.log, FakeTransport.unknown())

        rollback_binding = self.engine.activate_binding("agency-blocked", "rollback", "rollback@example.test", self.log)
        rollback_binding.cursor_sequence = 1
        rollback = self.engine.schedule_day(rollback_binding, date(2026, 2, 2), open_authority(self.schedule))[0]
        self.log.restore_to(0)
        self.engine.prepare(rollback, open_authority(self.schedule), self.log)

        replacement = monday_schedule("v2", "Europe/London")
        for label, occurrence in (("result unknown", unknown), ("sequence rollback", rollback)):
            with self.subTest(label=label):
                revision = occurrence.active_revision
                original_status = occurrence.status
                original_audit = tuple(occurrence.audit)

                self.engine.apply_schedule_change(occurrence, replacement, Authority(schedule=replacement))

                self.assertEqual(1, len(occurrence.revisions))
                self.assertIs(revision, occurrence.active_revision)
                self.assertEqual(original_status, occurrence.status)
                self.assertEqual(original_audit, tuple(occurrence.audit))


class DistinctIntentTests(unittest.TestCase):
    def test_closed_report_and_sinistres_ack_are_distinct_and_deduplicated(self):
        # B09-S14, S38
        schedule = monday_schedule()
        clock = ControlledClock(datetime(2026, 2, 2, 7, 45, tzinfo=UTC))
        engine = TemporalEngine(clock)
        log = EventLog()
        binding = engine.activate_binding("agency-1", "operations", "r@example.test", log)
        closure = Closure.from_local(datetime(2026, 2, 2, 8, 0), datetime(2026, 2, 2, 9, 0), PARIS, "closed")
        authority = Authority(schedule=schedule, closures=(closure,))
        report = engine.schedule_day(binding, date(2026, 2, 2), authority)[0]

        first_ack = engine.acknowledge_claim(binding, "claim-1", authority)
        second_ack = engine.acknowledge_claim(binding, "claim-1", authority)

        self.assertEqual(Status.PREVENTED_CLOSED, report.status)
        self.assertTrue(first_ack)
        self.assertFalse(second_ack)
        self.assertEqual([], engine.transport_journal)
        self.assertEqual(1, len(engine.claim_ack_journal))
        record = engine.claim_ack_journal[0]
        self.assertEqual(binding.id, record.binding_id)
        self.assertEqual(binding.agency_id, record.agency_id)
        self.assertEqual("claim-1", record.claim_id)
        self.assertEqual(CLAIM_ACK_CONTENT, record.content)
        self.assertEqual(
            "Réception confirmée. Examen à la prochaine ouverture. Retour dans les meilleurs délais.",
            record.content,
        )
        lowered = record.content.lower()
        for forbidden in ("début d’intervention", "demain", "astreinte", "urgence"):
            self.assertNotIn(forbidden, lowered)

    def test_default_slots_are_a_module_constant(self):
        self.assertEqual((time(8, 45), time(13, 30), time(16, 0)), DEFAULT_SLOTS)
        self.assertNotIn("DEFAULT_SLOTS", ScheduleConfig.__dict__)

    def test_claim_ack_refuses_revoked_real_binding_even_when_authority_snapshot_is_active(self):
        schedule = monday_schedule()
        engine = TemporalEngine(ControlledClock(datetime(2026, 2, 2, 7, 45, tzinfo=UTC)))
        log = EventLog()
        binding = engine.activate_binding("agency-1", "claims", "claims@example.test", log)
        engine.revoke_binding(binding)

        self.assertFalse(
            engine.acknowledge_claim(
                binding,
                "claim-inactive-binding",
                Authority(schedule=schedule, binding_active=True),
            )
        )
        self.assertEqual([], engine.claim_ack_journal)

    def test_claim_ack_rechecks_authority_and_deduplicates_by_agency_and_claim(self):
        schedule = monday_schedule()
        engine = TemporalEngine(ControlledClock(datetime(2026, 2, 2, 7, 45, tzinfo=UTC)))
        log = EventLog()
        binding = engine.activate_binding("agency-1", "claims", "first@example.test", log)

        rejected_authorities = (
            Authority(schedule=schedule, rights=False),
            Authority(schedule=schedule, mandate=False),
            Authority(schedule=schedule, agency_active=False),
            Authority(schedule=schedule, binding_active=False),
        )
        for authority in rejected_authorities:
            with self.subTest(authority=authority):
                self.assertFalse(engine.acknowledge_claim(binding, "claim-authority", authority))
        self.assertEqual([], engine.claim_ack_journal)

        authority = open_authority(schedule)
        self.assertTrue(engine.acknowledge_claim(binding, "claim-deduplicated", authority))
        alternate = engine.activate_binding("agency-1", "claims", "second@example.test", log)
        self.assertFalse(engine.acknowledge_claim(alternate, "claim-deduplicated", authority))

        self.assertEqual(1, len(engine.claim_ack_journal))
        record = engine.claim_ack_journal[0]
        self.assertEqual(binding.id, record.binding_id)
        self.assertEqual("agency-1", record.agency_id)
        self.assertEqual("claim-deduplicated", record.claim_id)
        self.assertEqual(CLAIM_ACK_CONTENT, record.content)


if __name__ == "__main__":
    unittest.main()
