# Tab Hoor hardening specification

## Goal

Tab Hoor is a personal behavior-change tool that has proven effective at
reducing tab hoarding. The next revision should make the repository safe,
maintainable, reproducible, and shareable without changing the core experience
that made it useful.

This is a Firefox-first project. It remains strictly local: no accounts,
cloud sync, telemetry, URL history, or remote services.

## Product contract

### Supported platform

- Firefox 140 and newer.
- Firefox is the only supported browser target.
- Remove Chrome manifests, Chrome packaging, and the broken Chrome installer
  entry point unless a future decision explicitly restores them.

### Core behavior to preserve

- Toolbar tab and window counts.
- The popup cleanup actions: duplicate tabs, idle cleanup, merge
  windows, and Firefox tab grouping.
- Optional automatic idle cleanup and automatic grouping.
- Counts-only history with local samples and action history.
- SQLite-backed history and the ability to export/import user data.
- The current Firefox user experience and visual language.

### Safety behavior

- Active, audible, pinned, discarded, and otherwise protected tabs must not be
  removed by automatic cleanup.
- Cleanup input must be validated in the background handler, not only in the
  popup.
- Invalid, non-finite, non-positive, or missing age values fail closed: no
  tabs are closed or discarded, and the caller receives an explicit error.
- Missing or untrustworthy tab age metadata also fails closed for destructive
  cleanup.
- Automatic actions must be observable in the action log and must not silently
  report success after a partial failure.
- Fix correctness bugs while preserving the intended UX; behavior changes
  should be covered by regression tests.

## Data and migration contract

- Retention applies consistently to samples and action history.
- Backend switching is lossless and repeatable. Repeating a switch must not
  duplicate rows.
- SQLite-to-legacy and legacy-to-SQLite transitions must be serialized with
  sampling and action writes.
- Migration failures must be surfaced to the settings UI and must not leave the
  selected backend claiming success when data was not migrated.
- Import/export is versioned and validated. Reject malformed rows, unsupported
  versions, excessive sizes, invalid timestamps, and invalid settings with a
  clear error.
- Restoring data must be transactional from the user's perspective: validate
  the complete file before replacing current state, and retain the current
  state if validation or persistence fails.
- Exported data must continue to contain no URLs.
- Clear-history actions must have explicit, consistent semantics for samples,
  action history, and all-time-high metadata.

## Installation and development

Provide two separate workflows:

1. **Development:** one command builds a temporary/unpacked Firefox extension
   for local testing. It must not expose a remote debugger by default or
   modify the user's normal Firefox profile.
2. **Release:** one reproducible command creates the Firefox XPI and release
   metadata. Installation documentation must describe normal Firefox
   Add-ons/about:debugging installation without relying on a custom launcher.

The repository must not silently rewrite desktop entries, shell startup files,
or Firefox profile preferences. Any optional developer automation must use an
explicitly named, isolated profile and require an explicit opt-in.

## Quality bar

- Use a formatter and linter with repository-pinned versions.
- Add unit tests for shared helpers and data validation.
- Add migration tests covering both directions, repeated switches, retention,
  interrupted/failed writes, and duplicate prevention.
- Add Firefox browser smoke tests covering popup loading, options persistence,
  history rendering, cleanup dry-runs, and a safe destructive-action path.
- Add manifest/package/build checks to CI.
- Pin or lock all dependencies and document licenses for bundled third-party
  code.
- Keep generated release artifacts out of version control unless explicitly
  published as release assets.
- Add a changelog and an install/update guide.

## Accessibility

Cover the popup, options page, and history page with:

- Keyboard operation and visible focus states.
- Correct labels, names, roles, and status announcements.
- Non-color indicators for tone, state, errors, and disabled actions.
- Reduced-motion support.
- Sufficient text/control contrast.

## Non-goals

- Cloud sync or remote persistence.
- Accounts, social features, monetization, or URL-level browsing analytics.
- Reintroducing Chrome support during this hardening effort.
- Redesigning the core tab-management behavior.

## Prioritized implementation checklist

### P0 — safety and correctness

- [ ] Remove the unsafe default Firefox remote-debugger launcher behavior.
- [ ] Implement isolated, explicit-opt-in development loading.
- [ ] Validate all destructive cleanup messages in the background.
- [ ] Make invalid age and missing age metadata fail closed.
- [ ] Serialize backend migration with history writes.
- [ ] Make action migration idempotent and prevent repeated duplicates.
- [ ] Define and implement transactional, versioned import/restore validation.
- [ ] Add regression tests for all of the above.

### P1 — supported project shape

- [ ] Make Firefox the only packaged target.
- [x] Remove Chrome manifests/build outputs/scripts and stale package commands.
- [ ] Add pinned lint, format, unit-test, and build tooling.
- [ ] Add Firefox browser smoke tests.
- [ ] Add CI for tests, lint/format, manifest validation, and reproducible
      packaging.
- [ ] Add release XPI, SHA-256 checksum, source archive, changelog, and
      installation/update documentation.

### P2 — maintainability and UX

- [ ] Centralize settings/schema validation and error reporting.
- [ ] Add accessibility semantics, focus states, contrast checks, and reduced
      motion to all extension pages.
- [ ] Document the local data model, retention behavior, migration guarantees,
      and recovery procedure.
- [ ] Audit bundled dependencies and record versions/licenses.
- [ ] Remove stale generated artifacts and unrelated historical scaffolding.

## Acceptance criteria

The hardening effort is complete when:

1. A clean checkout can install dependencies, run checks, and build the same
   Firefox release artifact reproducibly.
2. No normal development or installation path exposes a Firefox remote debugger
   or edits a user's normal profile without explicit opt-in.
3. Invalid cleanup requests cannot close or discard a tab.
4. Repeated backend switches preserve the same logical samples/actions without
   duplicates.
5. A malformed or oversized backup cannot replace valid current data.
6. CI covers unit tests, Firefox smoke tests, lint/format, manifest validation,
   and packaging.
7. The popup, options, and history pages remain keyboard and screen-reader
   usable while preserving the existing cleanup workflow.
