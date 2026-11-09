# API reference

Lets another application read and change the board: a voice assistant, a script, or a dashboard.

**Base URL:** `https://tanstack-demo.ask1846.workers.dev`

| Method | Path | Purpose |
|---|---|---|
| `GET` | [`/api/tasks`](#list-cards) | List cards, with filters |
| `POST` | [`/api/tasks`](#create-a-card) | Create a card |
| `GET` | [`/api/tasks/:id`](#get-a-card) | Get one card and its timeline |
| `PATCH` | [`/api/tasks/:id`](#update-a-card) | Change a card's title, notes, column or position |
| `DELETE` | [`/api/tasks/:id`](#delete-a-card) | Permanently delete a card |
| `POST` | [`/api/tasks/:id/archive`](#move-a-card-to-history) | Move a Done card to History |
| `GET` | [`/api/summary`](#get-the-summary) | Card counts for a dashboard |

The examples are written for a Bash shell. On Windows, run them in Git Bash.

## Authentication

Send the API key in the `Authorization` header of every request:

```
Authorization: Bearer YOUR_KEY
```

The key is the `API_KEY` secret set on Cloudflare, at least 32 characters long. It is separate from the website's login password, and it gives full read, change and delete access to the board.

Keep the key on a server or in a trusted app. Browser code can't call this API directly, because it sends no CORS headers, and putting the key in a web page would expose it.

To replace the key, run `npx wrangler secret put API_KEY`. The old key stops working straight away.

## Conventions

**Responses** are JSON with the same shape every time. `meta` appears only on lists.

```json
{ "success": true, "data": {}, "error": null }
```

```json
{ "success": false, "data": null, "error": "Missing or invalid API key" }
```

**Times** are UTC, in ISO 8601 format, such as `2026-11-09T13:48:25.875Z`.

**Request bodies** must be JSON, sent with `Content-Type: application/json`, and at most 16 KB.

**Card ids** are opaque strings. Store them as given and don't parse them.

**Changes take effect immediately** for API calls: a read after a successful write sees that write. A board already open in a browser catches up within 60 seconds, or when its window regains focus.

**The API has no version number.** Fields may be added to responses, so ignore any you don't recognise.

### Columns

Responses always use the id. Requests accept any of the names below. Capitals don't matter, and spaces, hyphens and underscores are treated alike.

| Id | Shown as | Also accepted |
|---|---|---|
| `backlog` | Backlog | |
| `doing` | In progress | `in progress`, `progress` |
| `review` | In review | `in review` |
| `done` | Done | |

### The card object

| Field | Type | Meaning |
|---|---|---|
| `id` | string | The card's id |
| `title` | string | 1 to 120 characters |
| `notes` | string | Up to 5,000 characters, empty if there are none |
| `column` | string | A column id. Cards in History stay `done` |
| `status` | string | `ongoing`, or `completed` once the card has reached Done |
| `archived` | boolean | `true` when the card is in History |
| `archiveReason` | string or null | `confirmed` if someone filed it, `expired` if it was filed automatically |
| `createdAt` | string | When it was created |
| `movedAt` | string | When it reached its current column |
| `doneAt` | string or null | When it reached Done |
| `archivedAt` | string or null | When it went to History |

### How cards finish

1. A card moved to `done` gets a `doneAt` time and counts as `completed`.
2. Moving it out of `done` clears `doneAt`, and it becomes `ongoing` again.
3. 24 hours after `doneAt`, a card goes to History on its own with the reason `expired`. It can go sooner through [Move a card to History](#move-a-card-to-history), with the reason `confirmed`.
4. A card in History can be read or deleted, but not changed.

The board holds at most 200 cards outside History. History has no limit.

## List cards

```
GET /api/tasks
```

| Filter | Values | Default |
|---|---|---|
| `status` | `ongoing`, `completed` (Done and History), `all` | `all` |
| `column` | One or more column names, separated by commas | every column |
| `archived` | `true` for History only, `false` for the board only | both |
| `search` | 1 to 200 characters to find in the title or notes. Plain A to Z letters ignore case. `%` and `_` are ordinary characters | none |
| `createdAfter` | Created at or after this time | none |
| `createdBefore` | Created before this time | none |
| `doneAfter` | Reached Done at or after this time | none |
| `doneBefore` | Reached Done before this time | none |
| `sort` | `createdAt`, `movedAt`, `doneAt`, `title` | `createdAt` |
| `order` | `desc`, `asc` | `desc` |
| `page` | Page number, from 1 | `1` |
| `limit` | Cards per page, 1 to 200 | `50` |

Times look like `2026-11-09` (midnight UTC), `2026-11-09T14:30:00Z`, or a time with an offset. In a URL, write a `+` offset as `%2B`.

Filters combine, so a card must match all of them. An unknown or misspelt filter returns `400`. If a filter is repeated, the last one counts.

When sorting by `doneAt`, cards that aren't done come last with `desc` and first with `asc`.

Lists leave out each card's timeline. Use [Get a card](#get-a-card) for that.

```bash
curl "https://tanstack-demo.ask1846.workers.dev/api/tasks?status=ongoing&column=backlog,in%20progress&search=invoice&order=asc&limit=2" \
  -H "Authorization: Bearer YOUR_KEY"
```

`200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "206f9e9ba800fa46f4cae01f500d2256",
      "title": "Pay the invoice",
      "notes": "Due on Friday",
      "column": "doing",
      "status": "ongoing",
      "archived": false,
      "archiveReason": null,
      "createdAt": "2026-11-09T12:59:35.330Z",
      "movedAt": "2026-11-09T14:10:02.114Z",
      "doneAt": null,
      "archivedAt": null
    }
  ],
  "error": null,
  "meta": { "total": 1, "page": 1, "limit": 2, "pageCount": 1 }
}
```

To read everything, request pages until `page` reaches `meta.pageCount`. A page past the end returns `200` with an empty list. `pageCount` is at least 1, even with no results.

## Create a card

```
POST /api/tasks
```

| Field | Required | Value |
|---|---|---|
| `title` | Yes | 1 to 120 characters |
| `column` | No | `backlog` (default), `in progress` or `in review`. `done` is refused |
| `notes` | No | Up to 5,000 characters |

Spaces around the title and notes are removed. Other fields are ignored. New cards go to the bottom of their column.

**Retrying creates a duplicate.** Each successful call makes a new card, so after a timeout, check with [List cards](#list-cards) before sending it again.

```bash
curl -X POST "https://tanstack-demo.ask1846.workers.dev/api/tasks" \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Call the supplier","column":"In Progress","notes":"Ask about the March invoice"}'
```

`201 Created`, with the [card object](#the-card-object) in `data`. If the board is full, the response is `409`.

## Get a card

```
GET /api/tasks/:id
```

Finds cards on the board and in History. The response is the [card object](#the-card-object) plus `moves`, oldest first, with every column the card has landed in.

```json
{
  "success": true,
  "data": {
    "id": "def04aa5d5ade5c26fb8662e007cca21",
    "title": "Renamed by API",
    "notes": "banana",
    "column": "done",
    "status": "completed",
    "archived": false,
    "archiveReason": null,
    "createdAt": "2026-11-09T13:48:25.875Z",
    "movedAt": "2026-11-09T13:48:26.989Z",
    "doneAt": "2026-11-09T13:48:26.989Z",
    "archivedAt": null,
    "moves": [
      { "column": "review", "at": "2026-11-09T13:48:25.875Z" },
      { "column": "done", "at": "2026-11-09T13:48:26.989Z" }
    ]
  },
  "error": null
}
```

## Update a card

```
PATCH /api/tasks/:id
```

Send only what should change, and at least one field. All the changes apply together, or none do.

| Field | Value |
|---|---|
| `title` | 1 to 120 characters |
| `notes` | Up to 5,000 characters. `""` clears them |
| `column` | Any column name, including `done` |
| `position` | Place in the column, where `0` is the top. A number past the end means last. Maximum 200 |

- With a new `column` and no `position`, the card goes to the bottom of that column.
- With `position` alone, the card moves within its current column.
- Unknown fields return `400`.
- Repeating the same request is safe: the second one leaves the card as it was.

```bash
curl -X PATCH "https://tanstack-demo.ask1846.workers.dev/api/tasks/CARD_ID" \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"New name","column":"Done"}'
```

`200 OK`, with the updated card and its `moves`. A card in History returns `409`.

## Delete a card

```
DELETE /api/tasks/:id
```

Permanently removes a card from the board or from History, along with its notes and timeline. It can't be undone.

```bash
curl -X DELETE "https://tanstack-demo.ask1846.workers.dev/api/tasks/CARD_ID" \
  -H "Authorization: Bearer YOUR_KEY"
```

`200 OK`

```json
{ "success": true, "data": { "id": "CARD_ID", "deleted": true }, "error": null }
```

Deleting a card that is already gone returns `404`. A client retrying after a timeout can treat that as success.

## Move a card to History

```
POST /api/tasks/:id/archive
```

Takes no body. The card must be in Done. `200 OK` returns the card with `archived: true`, `archiveReason: "confirmed"` and its `moves`. A card outside Done, or already in History, returns `409`.

```bash
curl -X POST "https://tanstack-demo.ask1846.workers.dev/api/tasks/CARD_ID/archive" \
  -H "Authorization: Bearer YOUR_KEY"
```

## Get the summary

```
GET /api/summary
```

`completed` covers Done and History. `columns` counts only cards still on the board.

```json
{
  "success": true,
  "data": {
    "columns": [
      { "id": "backlog", "title": "Backlog", "count": 2 },
      { "id": "doing", "title": "In progress", "count": 1 },
      { "id": "review", "title": "In review", "count": 1 },
      { "id": "done", "title": "Done", "count": 0 }
    ],
    "ongoing": 4,
    "completed": 12,
    "archived": 12,
    "total": 16
  },
  "error": null
}
```

## Rate limit

Each client gets 30 requests per 60 seconds across all endpoints, counted by IP address (or IPv6 /64 network). Failed calls count too. The count is approximate, because Cloudflare tracks it per location.

Over the limit, the response is `429` with a `Retry-After: 60` header. A dashboard should refresh no more than every few seconds, and `/api/summary` is the cheapest call to poll.

## Errors

| Status | When | Retry? |
|---|---|---|
| `400` | A field or filter is invalid. `error` names the problem | No, fix the request |
| `401` | The key is missing or wrong | No |
| `404` | No such card or endpoint | No |
| `405` | That method isn't allowed on this path. The `Allow` header lists those that are | No |
| `409` | The board is full, the card is in History, or only cards in Done can do this | No, the card or board must change first |
| `413` | The body is over 16 KB | No |
| `415` | The body isn't sent as `application/json` | No |
| `429` | Too many requests | Yes, after `Retry-After` seconds |
| `500` | Something failed on the server | Yes, with a delay. For `POST /api/tasks`, check first, as a retry may duplicate |
| `503` | The API key isn't set up, or the rate limiter is unavailable | Yes, later |

Examples:

```json
{ "success": false, "data": null, "error": "column must be Backlog, In progress or In review" }
```

```json
{ "success": false, "data": null, "error": "That card is in History and can't be changed" }
```

```json
{ "success": false, "data": null, "error": "Only cards in Done can be moved to History" }
```

Requests are checked in this order: rate limit, key, path and method, then body or filters. So a call without a valid key gets `401` even on a path under `/api/tasks/` that doesn't exist.
