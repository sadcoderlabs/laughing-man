# Resend Segments Migration

Migrate from Resend's deprecated Audiences API to the new Contacts + Segments model.

## Background

Resend moved from an Audiences model (contacts belong to an audience) to a global Contacts model (contacts exist independently, segments group them for broadcasts). The old `/audiences/{id}/contacts` endpoint still works but is deprecated. The broadcast API now uses `segment_id` instead of `audience_id`.

## Changes

### 1. Subscribe function (`functions/api/subscribe.ts`)

- Change from `POST /audiences/{audienceId}/contacts` to `POST /contacts`
- Remove `RESEND_AUDIENCE_ID` from the `Env` interface
- The function only needs `RESEND_API_KEY`

### 2. Resend provider (`src/providers/resend.ts`)

- Remove `audienceId` from `CreateBroadcastParams`
- Add `segmentId` to `CreateBroadcastParams`
- Pass `segmentId` to `client.broadcasts.create()`
- Add `listSegments()` method that calls `GET /segments` and returns segment ID + name

### 3. Send command (`src/commands/send.ts`)

- Remove reading `resend_audience_id` from config
- After initializing the Resend client, call `provider.listSegments()`
  - 0 segments: error with message to create one in Resend dashboard
  - 1 segment: use it automatically
  - Multiple segments: prompt user to pick one
- Pass the resolved `segmentId` to `provider.createBroadcast()`
- Update confirmation prompt to show segment name instead of audience ID

### 4. Config and types

**`src/types.ts`**: Remove `resend_audience_id` from `SiteConfig.env`.

**`src/pipeline/config.ts`**: Remove `RESEND_AUDIENCE_ID` loading from env/dotenv/yaml. Remove from zod schema.

**`laughing-man.example.yaml`**: Remove `resend_audience_id` if present.

### 5. Tests

**`tests/functions/subscribe.test.ts`**:
- Remove `RESEND_AUDIENCE_ID` from `mockEnv`
- Update URL assertion to `https://api.resend.com/contacts`

**`tests/providers/resend.test.ts`**:
- Update `createBroadcast` test to use `segmentId` instead of `audienceId`
- Add test for `listSegments()`

### 6. Skill and docs

**`skills/laughing-man/SKILL.md`**:
- Remove step for setting `RESEND_AUDIENCE_ID` in `.env`
- Remove `RESEND_AUDIENCE_ID` from Pages secrets setup (only `RESEND_API_KEY` needed)
- Remove "Create an audience" step (segments are managed in Resend dashboard, and the default "General" segment works out of the box)

## What gets simpler

- `.env` only needs `RESEND_API_KEY` for Resend (down from two vars)
- Pages secrets: only `RESEND_API_KEY` (down from two)
- No `RESEND_AUDIENCE_ID` / `RESEND_SEGMENT_ID` to configure anywhere
- Subscribe function has one fewer dependency
- Fewer setup steps in the skill

## Out of scope

- Topics (user-facing unsubscribe preferences). The current unsubscribe link (`{{{RESEND_UNSUBSCRIBE_URL}}}`) still works. Topics can be added later if needed.
