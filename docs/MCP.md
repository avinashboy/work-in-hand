# Connecting AI agents (MCP)

Your board has a [Model Context Protocol](https://modelcontextprotocol.io) server, so AI agents and apps can read and change cards for you. You could say "move the supplier call to Done" to Claude, and the change lands on the board and in the card's timeline, just like a drag in the browser.

| | |
|---|---|
| Address | `https://YOUR-SITE.workers.dev/mcp` |
| Transport | Streamable HTTP |
| Sign-in | `Authorization: Bearer YOUR_KEY`, using the same `API_KEY` as the [REST API](API.md) |
| Rate limit | Shared with the REST API: 30 requests a minute per client |

It runs only on your own deployment. The public demo has no MCP server.

> [!WARNING]
> Anyone with the key can read, change and delete every card. Keep it out of shared files, chats and screenshots. To revoke it, set a new one with `npx wrangler secret put API_KEY`. That cuts off the REST API and every connected agent until they get the new key.

## Tools

| Tool | What it does | Changes the board |
|---|---|---|
| `list_tasks` | Find cards by status, column, words or dates, in pages | No |
| `get_task` | One card with its notes and timeline of moves and edits | No |
| `get_board_summary` | Card counts per column, ongoing, completed and in History | No |
| `create_task` | Add a card to Backlog, In progress or In review | Yes |
| `update_task` | Change the title or notes, or move the card to another column or position | Yes |
| `archive_task` | Move a card from Done to History now | Yes |
| `delete_task` | Delete a card for good | Yes, and can't be undone |

Each tool tells the agent whether it only reads, changes or deletes, so a client can ask you before a change. Agents meet the same rules as the board and the REST API, such as title length and which columns a new card can go in.

> [!TIP]
> Set your client to ask before it runs `delete_task` and `update_task`. Card text is written by people, and a card could contain text meant to trick an agent. The server tells agents to treat card text as data only, but asking before changes is the real safeguard.

Each tool call is its own request, so one agent conversation can use several of the 30 requests a minute. If an agent sees "Too many requests", it should wait a minute.

## Connecting a client

Replace `YOUR-SITE` with your Worker's address and `YOUR_KEY` with your API key.

### Claude Code

```bash
claude mcp add --scope user --transport http work-in-hand https://YOUR-SITE.workers.dev/mcp --header "Authorization: Bearer YOUR_KEY"
```

`--scope user` keeps the key in your own settings, not in a project file. The command also lands in your shell history, so clear that line afterwards if others use the computer.

### Cursor

Set the key as an environment variable named `WORK_IN_HAND_KEY`, then in `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "work-in-hand": {
      "url": "https://YOUR-SITE.workers.dev/mcp",
      "headers": { "Authorization": "Bearer ${env:WORK_IN_HAND_KEY}" }
    }
  }
}
```

If you use a project's `.cursor/mcp.json` instead, never paste the key itself into it, since that file is easy to commit.

### VS Code (GitHub Copilot agent mode)

In `.vscode/mcp.json`. VS Code asks for the key once and stores it securely, so it isn't saved in the file:

```json
{
  "inputs": [
    { "type": "promptString", "id": "work-in-hand-key", "description": "Work in Hand API key", "password": true }
  ],
  "servers": {
    "work-in-hand": {
      "type": "http",
      "url": "https://YOUR-SITE.workers.dev/mcp",
      "headers": { "Authorization": "Bearer ${input:work-in-hand-key}" }
    }
  }
}
```

### Claude Desktop

Claude Desktop's connectors don't take a custom key yet, so go through the small open-source `mcp-remote` bridge. Its config file keeps the key in plain text on your computer, and `npx` downloads the bridge when Claude starts, so replace `mcp-remote` with a version you've checked, such as `mcp-remote@1.2.3`. In `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "work-in-hand": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://YOUR-SITE.workers.dev/mcp", "--header", "Authorization:${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "Bearer YOUR_KEY" }
    }
  }
}
```

### Your own agent

Any MCP client library can connect with Streamable HTTP and the `Authorization` header. This includes the Claude Agent SDK, the OpenAI Agents SDK, LangChain and the official MCP SDKs.

### Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

Choose **Streamable HTTP**, enter the address, and add the `Authorization` header.

## Clients that need OAuth

Claude on the web and ChatGPT connectors sign in with OAuth, not a fixed key, so they can't connect yet. Adding OAuth sign-in to the Worker would let them in.

## Trying it locally

1. Put `API_KEY=` and at least 32 characters in `.dev.vars`.
2. Run `npm run dev`.
3. Connect any client above to `http://localhost:3000/mcp`.

## Errors

| HTTP status | Meaning |
|---|---|
| 401 | Missing or wrong key |
| 403 | A call from a web page other than `localhost`. Desktop and command-line clients aren't affected |
| 413 | Request over 16 KB |
| 429 | Over the rate limit. Wait a minute |
| 503 | No `API_KEY` is set on the Worker |

A refused tool call, such as an unknown card or a full board, comes back as a tool error with a plain message the agent can read and act on.
