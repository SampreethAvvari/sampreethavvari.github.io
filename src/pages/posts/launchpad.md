---
title: "Every Hybridge app on one board, every request in one list"
date: "2026-10-23"
layout: ../../layouts/PostLayout.astro
description: "Staff needed one place to open every app, leaders wanted to see what was being built, and change requests got lost in chats. I built one board and one request list six apps share."
img_path: "/launchpad.png"
architecture: "launchpad"
img_alt: "Hybridge Launchpad: one board of every Hybridge app, and one request list the other apps share"
tag: "Architecture"
tone: "blue"
stats:
  - value: "78 minutes"
    label: "from the first commit to a working live board on Oct 22"
    tone: "emerald"
  - value: "19 minutes"
    label: "from our VP of finance's request in the Cowork tab to the live fix on Oct 28"
    tone: "blue"
  - value: "6 apps"
    label: "send their feature requests to one list, each through its own Google ID token"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Staff needed one place to open 38 Hybridge projects, and change requests got lost in chats."
  - label: "What I built"
    value: "One board where anyone at Hybridge opens any app and four leaders see the work, plus one request list."
  - label: "Outcome"
    value: "Six apps file requests into one list; a finance request filed October 28, 2026 was live 19 minutes later."
  - label: "Runs on"
    value: "Cloud Run and Firestore behind IAP, with a second relay service for the other apps."
  - label: "Cost"
    value: "$0.32 for the whole Google Cloud project from October 1 to 28, 2026, measured."
  - label: "Built"
    value: "78 minutes from the first commit to a working live board on October 22, 2026."
---

## The problem

By October the list of Hybridge projects had reached 38: 10 apps people open, 12 services behind them, and the rest in development, upcoming or stalled. Staff needed one place to open any of them.

Four leaders wanted to see what is being built now, what is next and what is stalled. A board I built in June did part of this, with milestone bars and a commit calendar.

Then the asks. People who use the apps want changes, and my design note from October 22 says those asks "arrive in chats and in passing, with no screenshot, no ID and no record of what happened to them."

## What I built

Launchpad is one page behind Google sign in. The Apps tab shows every project as a card, in panes by status, and anyone at Hybridge opens an app from there. The four leaders also get Work (now, next, stalled and shipped, with a 1 to 5 complexity meter) and History. A welcome tour walks first visitors through it.

I am the only editor. I drag a card to another pane, hide it, reword it or add a project, and each save writes the project and a history entry with who, when, and every field's old and new value.

Then a Feature requests tab: paste a screenshot with Ctrl+V, write a line, send. Each request gets an FR number that never changes. The same screen lives inside six other apps, which all send to one relay. [Open the drawing](/architecture/launchpad) for the board, and [the relay's drawing](/architecture/feature-requests) for the apps that call it.

## The sprint

The June board was built over June 16 and 17. Its last commit, at 1:41 AM, fixed its calendar's month labels <span class="egg" tabindex="0" data-egg="Quoted from the commit message. The labels held until the board went dark in October.">once and for all</span>.

Launchpad started at 4:40 PM on October 22. The first revision went live at 5:48 PM and failed every page: my laptop used a JSON store, and the production bundle hid the Firestore class under `default`. The fix was live at 5:58 PM, 78 minutes after the first commit. That evening the June board went dark and its daily sync paused.

The request list came together on the afternoon of October 23, starting at 1:19 PM:

- 2:12 PM: the request tab merged, with storage, the API and Copy.
- 2:48 PM: the screen as one element, and the relay for other apps.
- 3:16 PM: the tab merged into five apps.
- 3:24 PM: the relay live. <span class="egg" tabindex="0" data-egg="It came from the Cowork tab at 3:32 PM and was deleted that afternoon. Deletes are soft and the counter only counts up.">FR-0001</span> arrived eight minutes later.
- 4:19 PM: any app can delete a request.

Chat pings went live on October 27. The Doctor Portal became the sixth caller on October 29.

At 11:44 AM on October 28, our VP of finance filed FR-0004 from the Cowork Dashboard: Rest of month on the cash flow view should include today. The fix merged at 11:58 AM, and the new revision was live at 12:03 PM, 19 minutes after the request.

I deploy by hand from main.

## The hard parts

**Apps cannot get through IAP.** In June, IAP on Cloud Run refused a scripted service account token from the old board's sync job. So the relay is Launchpad's image deployed a second time as `launchpad-requests`, with no IAP. Cloud Run lets in only the six app accounts, and the code checks again before it trusts a name:

```ts
// lib/requests/relay.ts
const caller = await verifyRelayToken(bearer, { audience: env.RELAY_AUDIENCE, keys });
if (!caller) return null;
const app = parseRelays(env.REQUEST_RELAYS).get(caller);
if (!app || h.get("x-relay-app") !== app) return null;
const email = decodeHeader(h.get("x-relay-user-email"))?.trim().toLowerCase();
if (!email || !STAFF_EMAIL.test(email)) return null;
```

The security review before merge added one rule: nobody is an admin through an app. Statuses, headings and Copy stay in Launchpad.

**One screen inside six apps.** Five apps are Next.js and one is Express, so the screen is one custom element in a shadow root that each app copies in. Inside a shadow root the active element is the host, so Tab walked out of dialogs until the focus trap learned to look inside. The editor's stylesheet never reached the shadow root either, and a typed trailing space vanished until its base CSS moved into the element.

**25 MB through three hops.** A screenshot goes from the browser to the app, the relay and a private bucket. Next cuts a body copied into middleware at 10 MB, so a 12 MB upload failed in testing. The request API skips middleware now, each app streams the body through, and the browser sends big files two at a time. Files come back with a sandbox policy.

## What I said no to

**Other editors.** The June board let managers edit, reorder and remove projects. Launchpad has one editor, and the four leaders read the board and its full history.

**Coding sessions that start on their own.** A scheduled cloud session cannot take a follow up into the same session, and requests get follow ups. Copy puts the heading, every message and each attachment's download line in one block, and I paste it into Claude Code myself. Copy never changes a status.

**Public files and patient facing apps.** The bucket is private, with no public or signed links, and I read attachments with my own login. The tab stays out of the patient surveys and public forms.

## Where it landed

The board holds 38 projects, 22 of them live, and its history holds 21 edits. I do not track page views, so I have no visit numbers.

The request counter reached FR-0006 on October 29. Four requests about three apps are on the list: two shipped, one in progress and one queued.

The whole Google Cloud project cost $0.32 from October 1 to 28, most of it the retired June board's secrets and sync job. Request time for Launchpad, the relay and the old board together came to under two cents.

Still open: Doc Coach and NPC Coach do not have the tab yet.

What I would keep: one image deployed twice, so the board and the relay always run the same code.
