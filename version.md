# Versions

Every change that ships gets a new entry at the top of this file. Newest comes first.

The number at the top must match `"version"` in `package.json`. That number shows in the
bottom-right corner of the board, and a test fails if the two don't match.

How the number goes up (`MAJOR.MINOR.PATCH`):

- **Minor** (0.**x**.0): a new feature or a visible change.
- **Patch** (0.x.**y**): a fix that changes no features.
- **Major**: stays at 0 until the app is called finished (1.0.0).

Versions before 0.15.0 were added later, from the git history. The hash shows the
commit each one matches.

## 0.15.0 (2026-11-13)

- The board shows its version number in the bottom-right corner.
- This file (`version.md`) starts keeping a record of every version.

## 0.14.0 (2026-11-13) `d31c2f6`

- Deleting a card from History asks first, in a pop-up that matches the light and dark themes.

## 0.13.0 (2026-11-12) `cb84d63`

- The API and MCP can list History by year, month or recent days.

## 0.12.0 (2026-11-12) `f8f84f0`

- History can be searched by year or month, with results updating as you type.

## 0.11.0 (2026-11-10) `1b19962`

- History has month headings inside each year.

## 0.10.1 (2026-11-10) `9d976d2`

- Fix: every tab icon link now switches with the theme.

## 0.10.0 (2026-11-10) `7001b81`

- History shows "AI agent: <name>" instead of "By an AI agent".

## 0.9.0 (2026-11-10) `3ef98a2`

- History gets search, pages and year groups.
- Each card records who moved it to History.

## 0.8.0 (2026-11-10) `31c4dc4`

- MCP server, so AI agents can connect to the board.

## 0.7.0 (2026-11-10) `29f2577`

- Browser fingerprinting in the public demo.

## 0.6.0 (2026-11-10) `787cf69`

- Title and notes edits are saved with their column and time, and show in the timeline.

## 0.5.1 (2026-11-09) `92734fd`

- Fix: the board stays within the screen and each column scrolls.

## 0.5.0 (2026-11-09) `f79e363`

- Public demo.
- Light and dark themes.
- Screenshots and more documentation.

## 0.4.0 (2026-11-09) `1556900`

- README, API reference and code guide.
- Removed the outage button.

## 0.3.0 (2026-11-09) `4757d5d`

- Full task API.
- Card titles can be edited.

## 0.2.0 (2026-11-09) `ddad99f`, `9a9dbc3`

- Notes on cards.
- An API call to add cards.
- File cleanup.

## 0.1.0 (2026-11-09) `278c593`

- First version: the board with a password login.
