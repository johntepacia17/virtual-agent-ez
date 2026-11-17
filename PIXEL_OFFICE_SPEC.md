# Pixel Office: build spec

A self-contained brief. Give this file to Claude Code (on any account) and say:
**"Build the project described in PIXEL_OFFICE_SPEC.md."** It describes what to build, how the parts fit, and the
behaviour rules, but contains no copied code, so Claude writes it fresh.

## 1. What it is

A web page in a retro handheld-RPG pixel style (all original art, nothing copied from any game) that shows what
**Claude Code** is doing, live.

- Claude is a pixel character at a workstation, with a speech bubble above its head describing the current action.
- Each **subagent** gets its own character, desk and bubble.
- When idle, Claude does fun free-time activities.
- Three office cats live in the room and can be interacted with.
- A real clock (Singapore time) drives the window sky, room tint and desk lamps.

Scope decisions: Claude Code only (claude.ai chat has no hooks); hooks installed at **user level**
(`~/.claude/settings.json`, so it works in all projects); **plain Node.js, zero dependencies**, vanilla Canvas.

## 2. Architecture

```
Claude Code --hook--> hook.js --POST--> server.js --SSE--> browser (canvas)
```

```
virtual-agent/
  hook.js              stdin JSON -> POST http://127.0.0.1:4321/event
  server.js            state + SSE + static files
  install-hooks.js     merges hooks into ~/.claude/settings.json
  scripts/demo.js      fake events to preview the scene
  public/index.html
  public/style.css
  public/sprites.js    character, desk and prop sprites, background
  public/cats.js       window.Cats: all cat logic and art
  public/game.js       renderer, state sync, idle activities, clock, UI
  README.md
```

### hook.js
- Reads the hook JSON from stdin and POSTs it to `http://127.0.0.1:${PIXEL_OFFICE_PORT||4321}/event`.
- 800 ms timeout, **always exits 0, prints nothing**, so Claude Code is never affected when the server is off.

### install-hooks.js
- Registers `hook.js` for these events: `SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, SubagentStart,
  SubagentStop, PermissionRequest, Notification, Stop, SessionEnd`.
- Tool events (`PreToolUse`, `PostToolUse`, `PermissionRequest`) use matcher `"*"`.
- Command form: `node "C:/absolute/path/hook.js"` (forward slashes).
- **Idempotent** (detect existing entries by command path), writes a timestamped backup `settings.json.bak-*`
  first, and supports `--uninstall`. Preserve all other settings and hooks.

### server.js (Node http, no deps)
- Listens on **127.0.0.1 only**; `PIXEL_OFFICE_PORT` (default 4321).
- `POST /event` takes a hook payload, updates in-memory state, broadcasts it.
- `GET /stream` is Server-Sent Events with two event types: `state` (full snapshot) and `log` (activity line).
- Serves `public/` statically. `DEBUG=1` appends raw payloads to `events.log`.
- State is per **session** (tab per session in the header). Each session has a main agent plus helpers.
  Stale sessions are cleaned up after 10 minutes.
- Each agent has `{ uid, name, status, text, ... }`, where status is one of
  `working | done | waiting | permission | idle`. The snapshot sends a stable `id: uid`.

#### Bubble text rules (important)
- **Playful, fun tone**, varying lines via a `pick([...])` helper.
- Show **folder/file only**, never full paths (`folderFile(p)` returns `parent/file`).
- For shell commands, drop a leading `cd X &&` and replace absolute paths with their last segment.
- **Never echo the user's prompt text** in a bubble. On `UserPromptSubmit` show a rephrased line such as
  "On it, boss!", "Ooh, a new quest!", "Challenge accepted!", "Let me cook…".
- Tool lines (examples): Read → "Peeking at src/login.php", Edit/Write → "Tinkering with…", Bash → "Running git
  status", Grep/Glob → "Hunting for…", WebSearch/WebFetch → "Googling…", Agent/Task → "Summoning a helper!". Keep
  to ~40 chars.
- `SessionStart`: "Ready! Let's go!". `Stop`: a playful done line ("All done! Yay!"), then after 20 s idle
  "Zzz… nap time".

#### Event handling
- `PermissionRequest` → status `permission`, text like "Can I run git status?" / "May I edit src/login.php?".
  `Notification` that is a permission prompt gives the same, unless a PermissionRequest bubble is less than 10 s
  old. Other notifications show a playful "waiting" line. The permission state clears when the tool runs
  (`PostToolUse`).
- `PreToolUse` sets working with a described tool line; `PostToolUse` clears it.
- **Subagents:** `PreToolUse` for `Agent/Task` creates a fallback helper keyed `tu:<tool_use_id>`; `SubagentStart`
  **adopts** that helper (keep the stable client `uid` so no duplicate appears); `SubagentStop` (or the matching
  `PostToolUse` of the fallback) marks it done; the helper is removed 4 s later.
- `SessionEnd` removes the session.

## 3. Front end (vanilla Canvas, Press Start 2P font)

- Logical world canvas **240×176**, scaled by an **integer scale (min 2)** onto a display canvas, pixelated.
  Use a `ResizeObserver` on the stage so resizing never crops it.
- The world is drawn at logical resolution. **Bubbles, labels and name tags are drawn at display resolution** so
  text stays crisp. Bubble font size scales with room size and must be big and readable.
- Everything is **y-sorted** (desks, characters, cats). Apply the time-of-day tint, then draw windows, clock, lamp
  glows and emotes on top.
- Header: title, session tabs, live clock plus phase pill, connection dot (on/off). Side panel: CATS (tools plus
  roster), then an ACTIVITY log.
- Sprites are built from **palette string maps** (`fromMap`) and rects, using original art. Character 12×16 with
  **front, back and side** views, chosen by walking direction (walking down shows front, up shows back, sideways
  mirrors). Claude has hair `#3b2a26`, shirt/clip `#d97757`. Helpers use 6 palettes with varied skin tones.
- Desk sprite 32×24 (monitor that blinks on permission, lamp, keyboard), plus door, plant, window, rack, shelf,
  wall clock. Floor is a checker from y=40; the wall is y 0–40.

### Layout constants
`MAIN_DESK={x:104,y:48}`; helper desks are a grid with rows y∈[96,140] and x∈[24,104,184]; `DOOR={x:6,y:24}`;
walking speed ≈ 42 px/s; helpers walk in from the door, sit, and walk out when done. Use an aisle y per desk row
to route around desks.

### Status badges on bubbles
working (gear/dots), done (check), waiting, **permission (orange "?", bobbing bubble)**, fun (pink), idle ("z").

### Claude's idle "free time"
After about 5 s idle (and **no helpers present**), Claude gets up and runs a state machine
`seated → wandering → activity → returning`. He walks back the moment work arrives. Activities: exercise
(jumping jacks), clean (sweep), play (ball), meditate, read at the bookshelf, water the plant. Each has a fixed
spot, a playful bubble in the "fun" colour, and a short animation. Also three cat activities: pet a cat,
wave a feather wand, serve food in a bowl (chosen more often when a cat is hungry or begging).

### Clock, sky and lamps (real time)
- Header and wall clock (analog, with hands) show **Singapore time** via `Intl.DateTimeFormat('Asia/Singapore')`.
  Support `?tz=Asia/Tokyo` and `?hour=19.5` (preview, then the clock keeps running).
- Phases: dawn 05–07, morning 07–11, daytime 11–15, afternoon 15–17, sunset 17–19, night 19–05. Show the phase
  name in the header.
- Windows show a sky that follows keyframes interpolated over the hour (colour, moving sun/moon, stars at night,
  clouds), and a room tint over the whole scene.
- **Desk lamps** are off 07:00–17:00, fade on 17:00–18:30, glow warmly all night, and fade off 05:30–07:00. The
  glow is an elliptical light pool on the desk and floor.

## 4. The cats (public/cats.js, exposed as `window.Cats`)

Three cats, original sprites (18×14 frames, auto 1px outline, mirrored copies for facing left):

| Cat | Colour | Personality |
|---|---|---|
| **Bosch** | creamy orange `#f6c27d` | greedy boss: eats, begs, shoves others off the bowl; slow. Petted: purrs, rolls over, then begs |
| **Ingca** | turquoise `#3fc1b5` | zoomie goblin: fast, plays, starts play-fights, extra zoomies 21–02h. Petted: squirms, then bolts |
| **Makita** | grey `#8d939e` | aloof napper: sleeps (lamp glow at night, window sun by day), grooms. Petted twice: "Hmph." and leaves |

Poses: stand, walk ×2, bat, run ×2, sit, sit-eyes-closed, sit-paw, watch, groom ×2, sleep, stretch, pounce,
puff, eat, roll.

### Behaviour rules
- Each cat is its own state machine with random timers and **drifting needs** (energy, hunger, love) that bias a
  **weighted random** choice. Weights are per-cat; sleep is boosted at night (extra deep night); eating needs a
  usable bowl; "follow" only when Claude is moving; an **anti-repeat** penalty on the last state.
- States: sit, wander, zoomies, play (ball bat, stalk then pounce), sleep, groom, stretch, eat, watch (window),
  beg (by Claude's desk), follow, fight, roll, pet, wandplay.
- **Not at the same time:** a cat will not choose a state another cat is already in, for the exclusive set
  (sleep, groom, zoomies, stretch, watch, beg, eat, play). At most **one loud** state (zoomies or fight) at once.
  Fights have a 50–100 s cooldown. A cat entering a state goes through a shared `enterFree` check.
- **Play-fight:** approach, puff up, a cartoon dust cloud with stars for ~2 s (cats hidden), then separate.
  Harmless. Ingca usually starts it.
- **Movement:** cats avoid desk footprints (each desk inflated by a margin) and room bounds. Use steering with
  veer offsets (about ±0.6, ±1.2, ±1.9 rad) plus a no-progress watchdog (~2.5 s) that gives up and re-picks.
  Plain "slide along the wall" collision made cats freeze against desks, so avoid it.
- Props: a home food bowl (regenerates a serving every ~45 s, max 3), a temporary bowl the user can drop
  (3 servings), a bouncing ball.
- Emotes (heart, z, anger, star, spark) and **small occasional speech bubbles** with personality lines
  ("FEED ME!", "Zoomies!", "Hmph."). Sleeping cats show "z".
- Minimum durations (eating at least ~4.5 s even if not hungry, sleep 15–40 s, groom 4–8 s).

### Interaction
- **User:** hover a cat for a name tag; click to pet (hearts plus the personality reaction). Tool buttons **PET /
  FEED / TOY**: FEED then click the floor drops a bowl, TOY then click the floor tosses a ball. Use pointer
  events (touch works), convert display to logical coordinates.
- **Claude:** pets a cat, waves a feather wand, or serves food during free time; drops it when work arrives.
- **Roster panel:** per cat a colour dot, name, trait, current activity, and three tiny bars (energy, tummy, love).

### API between cats.js and game.js
`Cats.init({wg, W, H, mainDesk, windows})` (call **before** building the roster DOM),
`Cats.update(dt, now, ctx)` where ctx = `{desks, hour, lamp, wand, claude}`, plus `drawFloor`, `drawables`,
`drawTop`, `bubbles`, `hitTest`, `pet`, `dropFood`, `tossToy`, `planClaude/reserve/claudeBegin/claudeEnd/claudeBusy/wants`.
Add a debug hook `window.__office = { actors, rooms, cats, ff(seconds) }` where `ff` fast-forwards the simulation
(also advancing the clock), which makes testing at real time unnecessary.

## 5. Build order (suggested)

1. `server.js`, `hook.js`, `scripts/demo.js`: get events flowing and a bare page with the SSE connection.
2. Sprites, the desk scene, Claude seated with a bubble; then helpers (walk in, sit, bubble, leave).
3. Playful bubble text rules and the permission state.
4. Idle free-time activities and directional walking sprites.
5. Clock, sky, tint and lamps.
6. Cats: sprites, state machine, exclusivity rules, interactions, roster.
7. `install-hooks.js`, README, then test.

## 6. Verification checklist

- `node --check` every JS file. Run a **spare-port** server (`PIXEL_OFFICE_PORT=4399`) so a running instance is
  not disturbed.
- `node scripts/demo.js` shows the full flow: start, prompt, tool bubbles, helper desks and bubbles, permission
  "?" bubble, stop, idle activities.
- Sprites look right at 10× (all poses, all three cats, both facings).
- Cat rules over fast-forwarded 30-minute runs at hours 12, 23 and 3: **zero** simultaneous exclusive states,
  zero cats inside desks or out of bounds, Makita in the lamp spot at night.
- Petting, FEED and TOY work with real clicks. No console errors. Helpers and cats coexist.
- Hook safety: with the server stopped, Claude Code runs normally (hook exits 0, silent).

## 7. Gotchas learned the hard way

- **Windows paths in JSON:** the Git Bash tool collapses `\\`. Write files that contain Windows backslash paths
  with the Write tool, not heredocs or `echo`.
- A browser pane or background tab **throttles `requestAnimationFrame`**. Cap `dt` (about 0.5 s) and use the
  fast-forward hook for tests.
- Create the stable `uid` for helpers on the server, or a subagent whose id changes shows up twice.
- Build the cat roster only **after** `Cats.init`, or it renders empty.
- Hooks are read at session start: **restart running Claude Code sessions** after installing. Server-side changes
  need a server restart; client-only changes just need a page refresh.
- Install the hooks only with the user's go-ahead, since they edit `~/.claude/settings.json`. Keep the backup.

## 8. Run it

```bash
node server.js            # http://localhost:4321
node scripts/demo.js      # optional: fake events
node install-hooks.js     # add hooks (backup written first); --uninstall to remove
```

Open http://localhost:4321, then restart any running Claude Code sessions.
