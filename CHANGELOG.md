# Changelog

## 0.9.6

- Defined Firefox-only reproducible release packaging.
- Added pinned lint, formatting, syntax, manifest, and build checks.
- Added CI coverage for project checks and release artifacts.
- Documented development and normal Firefox installation/update workflows.
- Hardened action history with write-ahead journaling, startup replay, stable event IDs,
  duplicate protection, and SQLite save-queue recovery.
- Serialized idle timestamp updates and made SQLite initialization retryable after
  transient runtime or WASM loading failures.
- Added a bounded SQLite diagnostics log with settings controls to view and clear
  locally recorded extension errors.
