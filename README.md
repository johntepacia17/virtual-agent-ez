# Pixel Office

A retro handheld-RPG style pixel office that shows what **Claude Code** is doing, live.

- **Claude** is a pixel character at her workstation, with a speech bubble describing the current action.
- Each **subagent** walks in through the door, takes its own desk and gets its own bubble, then leaves when done.
- When idle, Claude takes **free time**: jumping jacks, sweeping, playing ball, meditating, reading, watering
  the plant, or petting, playing with and feeding the cats.
- Three office **cats** (Bosch, Ingca and Makita) live in the room, each with their own personality and needs.
- A real **Singapore-time clock** drives the window sky, the room tint and the desk lamps.

Plain Node.js with **zero dependencies**, vanilla Canvas, and all original art.

```
Claude Code --hook--> hook.js --POST--> server.js --SSE--> browser (canvas)
```

## Run it

Requires Node.js 18 or later.

```bash
node server.js
```

Then open http://localhost:4321.

To preview the scene without Claude Code, run the scripted demo in a second terminal:

```bash
node scripts/demo.js
```

`--loop` repeats it forever and `--fast` halves the delays.

### Connect Claude Code

The installer adds the hook to your **user-level** settings (`~/.claude/settings.json`), so it works in every
project. It writes a timestamped backup (`settings.json.bak-*`) first, keeps all your other settings and hooks,
and is safe to run twice.

```bash
node install-hooks.js
```

Then **restart any running Claude Code sessions**, because hooks are read at session start.

To remove the hooks:

```bash
node install-hooks.js --uninstall
```

The hook is registered for `SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, SubagentStart, SubagentStop,
PermissionRequest, Notification, Stop, SessionEnd` (tool events use matcher `"*"`). It always exits 0, prints
nothing and gives up after 800 ms, so Claude Code runs normally when the server is not running.

## Using the page

- **Session tabs** in the header: one per Claude Code session. The most recently active one is shown unless
  you click a tab.
- **Clock and phase pill**: dawn, morning, daytime, afternoon, sunset or night. The dot on the right turns
  green while the page is connected to the server.
- **Bubbles**: a gear means working, a check means done, dots mean waiting for you, a bobbing orange **?**
  means Claude needs your permission (the monitor blinks too), pink means free time, and **z** means idle.
  Bubbles show only `folder/file`, never full paths, and never repeat your prompt text.
- **CATS panel**
  - **PET** (default): click a cat (or its roster card) to pet it.
  - **FEED**: then click the floor to drop a food bowl (3 servings).
  - **TOY**: then click the floor to toss the ball.
  - The roster shows each cat's current activity and energy, tummy and love bars.
- **ACTIVITY**: a running log of what happened.

### The cats

| Cat | Personality |
|---|---|
| **Bosch** (creamy orange) | Greedy boss: eats, begs by Claude's desk, shoves others off the bowl. Petted: purrs, rolls over, then begs. |
| **Ingca** (turquoise) | Zoomie goblin: fast, plays, starts play-fights, extra zoomies late at night. Petted: squirms, then bolts. |
| **Makita** (grey) | Aloof napper: sleeps in the window sun by day and under the desk lamp at night, grooms. Petted twice: "Hmph." |

## Options

| Setting | Effect |
|---|---|
| `PIXEL_OFFICE_PORT=4399` | Port for the server, hook and demo (default `4321`). The server listens on 127.0.0.1 only. |
| `DEBUG=1` | Server appends every raw hook payload to `events.log`. |
| `?tz=Asia/Tokyo` | Show a different time zone (default `Asia/Singapore`). |
| `?hour=19.5` | Start the clock at 19:30 to preview a time of day; it keeps running from there. |

## Files

```
hook.js              stdin JSON -> POST http://127.0.0.1:4321/event
server.js            per-session state, bubble text rules, SSE (/stream), static files
install-hooks.js     merge hooks into ~/.claude/settings.json (--uninstall, --settings PATH)
scripts/demo.js      fake events to preview the scene
public/index.html    page shell
public/style.css     styles (Press Start 2P font)
public/sprites.js    characters, desks, props and background
public/cats.js       window.Cats: cat art, needs, state machines and interaction
public/game.js       renderer, state sync, free time, clock, sky, lamps, UI
```

## Testing and debugging

- `GET /state` returns the current snapshot as JSON.
- In the browser console, `window.__office` exposes `actors`, `rooms`, `cats` and `ff(seconds)`.
  `__office.ff(1800)` fast-forwards the simulation (and the clock) by 30 minutes, which makes it easy to check
  cat behaviour without waiting.
- Run a spare server for testing so your real one is not disturbed:
  `PIXEL_OFFICE_PORT=4399 node server.js`.

## Troubleshooting

- **Nothing happens when Claude works**: check that the server is running, that you ran `install-hooks.js`,
  and that you restarted Claude Code afterwards.
- **Server changes** need a server restart; **page changes** only need a refresh.
- Background browser tabs throttle animation; the simulation caps each step at 0.5 s so it catches up smoothly.
