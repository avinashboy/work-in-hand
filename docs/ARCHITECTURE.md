# Code guide

How the app is put together, for anyone changing it. For setup, see the [README](../README.md). For calling the API from another app, see the [API reference](API.md).

## The big picture

One Cloudflare Worker serves everything. All data lives in one SQLite-backed Durable Object, so every change happens in a single, strictly ordered place.

```mermaid
flowchart TD
    A[Browser] --> W
    B[Voice app or dashboard] --> W
    C[AI agent: Claude, ChatGPT, Cursor, VS Code] --> W
    W["src/server.ts<br/>Worker entry"] -->|"/api/tasks*, /api/summary"| API["features/api<br/>API key and rate limit"]
    W -->|"/mcp"| MCP["features/mcp<br/>MCP tools"]
    MCP -->|same key and limit| API
    W -->|everything else| GATE["features/auth<br/>login gate"]
    GATE -->|signed in| START["TanStack Start<br/>pages and server functions"]
    START --> DO
    API --> DO
    GATE -->|login attempts| DO
    DO[("BoardStore Durable Object<br/>SQLite")]
```

`src/server.ts` decides the route in this order:

1. API paths go to `handleTaskApi`, which uses the API key and never the login.
2. `/mcp` goes to `handleMcpRequest`, with the same key and rate limit. Its code loads only when an MCP client calls.
3. `npm run dev` on `localhost` skips the login.
4. `checkRequest` handles login and logout, and turns away anyone without a valid session.
5. Everything else goes to TanStack Start.

The public demo skips all of this: it has no API, no MCP and no login.

## Folders

| Path | What's there |
|---|---|
| `src/server.ts` | Worker entry and top-level routing |
| `src/start.ts` | TanStack middleware: security headers, cross-site checks, request size |
| `src/routes/` | Pages: board (`/`), history (`/history`), login (`/login`) |
| `src/features/board/` | The board: model, reducer, storage, UI |
| `src/features/auth/` | Password login, session cookie, attempt limits |
| `src/features/api/` | The public REST API |
| `src/features/mcp/` | The MCP server for AI agents |
| `src/lib/` | The small SQL interface and its two implementations |

`*.server.ts` files only run on the server. Tests sit next to the file they cover.

## Board changes

Every change to the board is a **command**, such as `move`, `create`, `set-title`, `set-notes`, `delete` or `archive`, defined in `board-model.ts`. Commands are validated with Zod.

The pure function `applyCommand` in `board-reducer.ts` is the only code that decides what a command does, and both sides run it:

- **In the browser**, `useOptimisticBoard` in `board-queries.ts` replays unsaved commands over the last confirmed board, so a change shows instantly.
- **On the server**, `apply` in `board-repository.server.ts` runs the same function inside a transaction and saves the difference.

Saves run one at a time, in order. A failed command stops being pending and drops out of the replay, so rollback needs no snapshots and can't undo a newer change.

The server always replaces the time on a command with its own clock.

### Adding a command

1. Add it to `boardCommandSchema` in `board-model.ts`.
2. Handle it in `applyCommand`. TypeScript flags the switch until you do.
3. Add its failure message to `FAILURE_MESSAGES` in `BoardView.tsx`. TypeScript flags this too.
4. If it changes a stored field, make sure `saveTasks` or `saveChangedNotes` writes that field.

## Storage

`board-repository.server.ts` holds the storage logic and depends only on the `SqlDatabase` interface in `src/lib/sql-database.ts`. In production that interface is `durable-object-sql.server.ts`. In tests it is `node-sql-database.testing.ts`, which uses Node's built-in SQLite, so the real SQL runs without Cloudflare.

| Table | Holds |
|---|---|
| `tasks` | Title, column, position, times, and archive state. History is rows with `archived_at` set |
| `task_notes` | One row per card that has notes. Kept apart so older databases needed no change to `tasks` |
| `task_moves` | Every column a card landed in, for its timeline |
| `task_edits` | Every title and notes change, with the column and time |
| `task_archive_actors` | Who moved a card to History: the board, the API, or an agent and its name. No row means it moved after 24 hours, or before this was recorded |
| `login_attempts` | Failed-login counts per client, and one overall row keyed `*` |

Things to know:

- Durable Object SQL has no `BEGIN` or `SAVEPOINT`. Use `db.transaction`, and don't nest it: code inside a transaction calls `applyChange`, not `apply`.
- Durable Object methods here are synchronous, so calls can't interleave.
- Cards in Done move to History 24 hours after `done_at`. There's no scheduled job. `archiveExpiredTasks` runs before every read and write.
- Use `?` placeholders for values. The only SQL built from input is `ORDER BY`, chosen from the fixed `SORT_COLUMNS` map.
- Missing tables are created at start-up, in `setUpSchema` and `createLoginAttempts`. There's no migration tool.

## The public API

| File | Job |
|---|---|
| `task-api.server.ts` | Rate limit, API key (`checkApiAccess`, shared with MCP), and the catch-all for errors |
| `task-api-routes.server.ts` | Paths, methods and handlers |
| `task-api-format.ts` | The JSON shape of a card and the refusal messages, shared with MCP |
| `task-api-schemas.ts` | Validation, column names, filters |
| `task-api-response.ts` | The `{success, data, error}` envelope |
| `board-task-queries.server.ts` | Filtered lists, single card, summary |
| `board-task-operations.server.ts` | Update, delete, archive |

The routes reach storage through the `TaskApiStore` interface, so they can be tested without a Durable Object. `getTaskApiStore` in `board-store.server.ts` supplies the real one.

API changes go through the same commands as the UI, so both follow the same rules.

### Adding an endpoint

1. Write the tests in `task-api-routes.server.test.ts`.
2. Add a query or operation in `board-task-*.server.ts`, with tests that use the real SQL.
3. Expose it as a method on `BoardStore`, in `getTaskApiStore`, and on `TaskApiStore`.
4. Add the route in `routesFor`. If the path is new, also update `isApiPath`, or the request goes to the login gate.
5. Update [API.md](API.md).
6. If agents should use it too, add an MCP tool (see below).

## The MCP server

A stateless [Model Context Protocol](https://modelcontextprotocol.io) server at `/mcp`, over Streamable HTTP, built with `createMcpHandler` from the Cloudflare Agents SDK. Each request gets a fresh server, so nothing is kept between calls. How to connect clients is in [MCP.md](MCP.md).

| File | Job |
|---|---|
| `mcp-path.ts` | The `/mcp` path check, kept apart so `server.ts` doesn't load the MCP libraries |
| `mcp-endpoint.server.ts` | Rate limit and API key (via `checkApiAccess`), body size limit, then the MCP handler |
| `mcp-server.ts` | Registers each tool with its title, description and hints (`readOnlyHint`, `destructiveHint`) |
| `mcp-schemas.ts` | Each tool's input as a plain JSON shape, for agents to read |
| `mcp-tools.ts` | What each tool does. Checks input again with the REST API's schemas, then calls `TaskApiStore` |

Tools return the card as JSON text and as `structuredContent`. Refusals come back as tool errors (`isError`) with the same wording as the REST API. The libraries need the `nodejs_compat` flag in `wrangler.jsonc`.

### Adding a tool

1. Write the tests in `mcp-tools.test.ts`.
2. Add its input in `mcp-schemas.ts` and its handler in `createBoardToolHandlers`.
3. Register it in `createBoardMcpServer`, with clear wording and the right hints.
4. Add it to the tool list in `mcp-endpoint.server.test.ts` and [MCP.md](MCP.md).

## Sign-in

- The password is the `APP_PASSWORD` secret, compared in constant time.
- A session is a signed cookie, `__Host-board-session`, lasting 365 days. It's keyed from the password, so **changing the password signs everyone out**.
- Each client gets 5 login attempts per 15 minutes, and all clients together get 30. An attempt is counted before the password is checked.
- `API_KEY` is a separate secret, so an outside app never holds the password.
- Without `APP_PASSWORD` nobody can sign in. Without `API_KEY` every API call is refused.

## Security headers

`request-security.server.ts` sets the headers for pages, including a per-request script nonce for the Content Security Policy in production. API and login responses set `no-store` and `nosniff` themselves.

## Front end

- `BoardView.tsx` owns the board page. `use-board-drag.ts` holds the drag and drop logic, using dnd-kit.
- `TaskEditor.tsx` is the title and notes dialog.
- `board.css` holds all the styles, with colours as CSS variables for the light and dark themes. `board-theme.ts` remembers the choice.
- `board-clock.ts` is a single shared timer that keeps relative times up to date.
- `HistoryYears.tsx` splits History into one table section per year (`history-years.ts`), by when each card moved there, in the viewer's time zone.
- `HistoryFilters.tsx` is History's search. The filter and page size live in the address (`?q=invoice&range=6m&size=50`, or `range=custom&from=…&to=…` in milliseconds), read by `history-search.ts`. `history-filter.ts` turns it into start and end times, and `readArchivePage` adds it to the SQL as bound parameters. Dates are when the card moved to History. Preset ranges count back from the server's clock; custom ones are read in the viewer's time zone.
- `src/features/dev/` holds the sample History cards for `npm run mock:history`. `server.ts` only reaches it inside `import.meta.env.DEV`, so it isn't in builds, and it answers only on `localhost`.

## Public demo

`npm run deploy:demo` builds with `--mode demo` and deploys a separate Worker, `tanstack-demo-public`, from `env.demo` in `wrangler.jsonc`. It has its own Durable Object, so its data is separate from the private site, and it has no secrets. `npm run deploy` still deploys only the private site.

- `IS_DEMO` in `demo-config.ts` is fixed at build time. The limits are set there too: card lifetime, card cap and daily writes.
- `demo-gate.server.ts` runs instead of the login. It closes `/api/*`, redirects `/login`, and applies the per-visitor and whole-site rate limits.
- `demo-board.server.ts` wraps the normal repository. Cards are deleted a fixed time after creation, on every read and write, and by a Durable Object alarm when nobody is visiting.

Free-plan limits are per account, so heavy demo traffic can also affect the private site.

## Tests

Tests use Vitest. The coverage threshold is 80%, set in `vitest.config.ts`. `board-store.server.ts` and `board-api.ts` are left out of coverage because they only run on Cloudflare and just forward calls.

Because the unit tests don't use the Cloudflare runtime, also try a change that touches `BoardStore` or `server.ts` on a local production build, as the README describes.

After changing `wrangler.jsonc`, run `npm run cf-typegen`.
