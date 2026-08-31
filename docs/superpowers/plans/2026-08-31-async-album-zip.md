# Async Album ZIP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare complete private/public album ZIP files asynchronously with resumable Flickr downloads, visible progress, bounded retention, and Fly.io storage/CPU sizing.

**Architecture:** A persistent JSON-backed job store tracks one photo per state and resumes after 429 or process restart. A single background worker downloads one source at a time into `storage/tmp/zip-jobs/<jobId>`, creates the ZIP only after every photo is present, and exposes status plus a one-hour download token. The existing synchronous route remains as a compatibility fallback but the gallery uses the job flow.

**Tech Stack:** Node.js, Express, JSON atomic DB helpers, Axios streams, Archiver, vanilla browser JavaScript, Fly.io volume.

**Spec:** Approved design in the conversation on 2026-08-31.

## Global Constraints

- Private album codes never appear in URLs.
- `private-watermark` may use only watermark sources and never original fallbacks.
- Flickr requests are sequential; a 429 pauses the job and uses `Retry-After` or bounded exponential backoff.
- ZIPs expire after 1 hour; abandoned jobs/files are cleaned automatically.
- The 5 GB volume must reserve safety headroom and reject jobs that exceed the configured temporary-storage budget.
- Fly VM uses one shared CPU and 512 MB RAM plus existing swap.
- Update `AGENTS.md` and relevant docs after code changes.

### Task 1: Job model and cleanup service

**Files:** Create `photo-server/services/albumZipJobs.js`; modify `photo-server/services/db.js`, `photo-server/server.js`; test `tests/album-zip-jobs.test.js`.

- [ ] Write failing tests for job creation, photo checkpoint transitions, 429 pause metadata, ready expiration, and cleanup.
- [ ] Run the focused test and confirm it fails because the job service is absent.
- [ ] Implement atomic JSON persistence and filesystem cleanup with a 4 GB job-budget guard.
- [ ] Run the focused test and confirm it passes.

### Task 2: Flickr resumable worker

**Files:** Create `photo-server/services/albumZipWorker.js`; modify `photo-server/services/flickrService.js` only if a stream helper is required; test `tests/album-zip-worker.test.js`.

- [ ] Write failing tests for sequential ordering, successful checkpointing, retry-after handling, pause on repeated 429, and no ZIP before all photos are complete.
- [ ] Run the focused test and confirm the expected failures.
- [ ] Implement one active worker loop, stream each selected source to a temporary file, fsync/rename it, and resume from the first incomplete photo.
- [ ] Create the ZIP only when all files exist; record ready path, byte size, and expiration.
- [ ] Run worker tests and confirm pass.

### Task 3: Public job endpoints and authorization

**Files:** Create `photo-server/routes/albumZipJobs.js`; modify `photo-server/server.js`, `photo-server/routes/publicApi.js`; test `tests/album-zip-routes.test.js`.

- [ ] Write failing route tests for private code validation, strict watermark source selection, create/status/download, expired token, and paused-429 response.
- [ ] Run tests and confirm red.
- [ ] Add `POST /api/public/albums/:id/zip-jobs`, `GET /api/public/zip-jobs/:jobId`, and `GET /api/public/zip-jobs/:jobId/download` with opaque job tokens and no private code in URLs.
- [ ] Start jobs only after the same album/photo authorization matrix used by current ZIP routes.
- [ ] Run route tests and confirm pass.

### Task 4: Gallery preparation UI

**Files:** Modify `photos.html`, `docs/website.md`, `AGENTS.md`.

- [ ] Add a progress modal/button state showing processed count, estimated time, pause message, and ready download.
- [ ] Poll status with bounded backoff and resume polling after page refresh using a non-sensitive job reference.
- [ ] Replace the current precheck/form-submit flow for album ZIP with job creation while preserving individual downloads and selection limits.
- [ ] Run HTML/JavaScript syntax checks and browser smoke checks.

### Task 5: Fly sizing and retention verification

**Files:** Modify `photo-server/fly.toml`, `photo-server/README.md`, `docs/server.md`, `docs/fixes_and_issues.md`, `docs/guidelines.md`.

- [ ] Set `cpus = 1` and document the 5 GB volume command/retention budget.
- [ ] Verify the existing volume before resizing; resize only the named `ms_comm_data` volume, never recreate it destructively.
- [ ] Run all focused tests, syntax checks, and `git diff --check`.
- [ ] Deploy backend, verify `/healthz`, inspect startup logs, and run a real private-album job when a test album is available.

