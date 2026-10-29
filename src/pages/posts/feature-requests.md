---
title: "One relay lets six apps file feature requests into one list"
date: "2026-10-23"
layout: ../../layouts/PostLayout.astro
description: "Change requests for our apps arrived in chats and in passing. I built one request screen six apps share, and a relay that trusts each app only to say who is asking."
img_path: "/feature-requests.png"
architecture: "feature-requests"
img_alt: "Feature request relay: six Hybridge apps calling one relay with their own Google ID tokens, one request list in Launchpad"
tag: "Architecture"
tone: "blue"
stats:
  - value: "19 minutes"
    label: "from a request filed in the Cowork Dashboard at 11:44 AM on Oct 28 to the live fix"
    tone: "emerald"
  - value: "6 apps"
    label: "call one relay, each with its own Google ID token, and each may file only about itself"
    tone: "blue"
  - value: "0 admins"
    label: "through an app: an app vouches for who is asking, and only Launchpad sets a status"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Change requests for our apps arrived in chats and in passing, with no record of what happened to them."
  - label: "What I built"
    value: "A relay that lets staff in six Hybridge apps file feature requests into one Launchpad list."
  - label: "Outcome"
    value: "Every request gets a fixed FR number and a Chat ping; one fix shipped 19 minutes after its request."
  - label: "Runs on"
    value: "Cloud Run and Firestore with no IAP; Cloud Run admits only the six app service accounts."
  - label: "Cost"
    value: "Under two cents of request time in October 2026, shared with Launchpad and a retired board."
  - label: "Built"
    value: "Started at 1:19 PM on October 23, 2026; the first request arrived at 3:32 PM."
---

## The problem

People who use my apps want changes. My design note from October 22 says those asks "arrive in chats and in passing, with no screenshot, no ID and no record of what happened to them."

I wanted one list for every app, inside Launchpad, the page staff already use to open them. The catch was the door. Launchpad sits behind IAP, and in June IAP on Cloud Run had refused a scripted service account token from my old leadership board. Six apps needed to file requests server side, each on its own Google Cloud project.

## What I built

A relay. It is Launchpad's own image deployed a second time as its own Cloud Run service, with relay mode on and no IAP. In relay mode it answers only the request API and a health check, and Cloud Run lets in only six app service accounts.

Each app serves the same request screen, one custom element, and forwards every call from its own server with a Google ID token for its own account and the person its own sign in already checked. Requests get an FR number that never changes, land in Launchpad's Firestore, and ping one Google Chat space. [Open the drawing](/architecture/feature-requests), and [Launchpad's drawing](/architecture/launchpad) for the list it fills.

## The sprint

October 23 started at 1:19 PM. The screen as one element and the relay were in by 2:48 PM. By 3:16 PM the tab was merged into the estimator, the capacity planner, the CDF dashboard, Hybridge Forms and the Cowork Dashboard. The relay went live at 3:24 PM, and <span class="egg" tabindex="0" data-egg="It came from the Cowork tab and was deleted that afternoon. The counter only counts up, so FR-0001 stays taken forever.">FR-0001</span> arrived at 3:32 PM. At 4:19 PM every app could delete its own requests.

The Chat ping went live on October 27. The Doctor Portal became the sixth caller on October 29.

At 11:44 AM on October 28 our VP of finance filed FR-0004 from the Cowork Dashboard: Rest of month on the cash flow view should include today. The fix was committed at 11:57 AM and live at 12:03 PM.

## The hard parts

**Trust in layers.** Cloud Run refuses any caller without invoker rights. Then the relay checks the token's issuer and audience, maps the calling account to its app, requires the app header to name that same app, and requires a hybridgeimplants.com person. Every check must pass before it believes a name.

**Each app forwards its own way.** The estimator drops any Authorization, Cookie or X-Relay header a browser sent and passes on only three content headers, with a token from the metadata server. The planner uses plain fetch with no Google client library. The Cowork Dashboard streams an upload of up to 25 MB straight through. The CDF refuses a write from another site, so a page elsewhere cannot post as a signed in coordinator.

**An app reaches only its own requests.** A request filed through an app is about that app, and a delete through an app is checked inside the same transaction that writes it:

```ts
// lib/requests/store/index.ts
if (!live(current) || (actor.app && current.app !== actor.app)) throw notFound();
```

FR numbers come from a counter read inside that transaction, only for a new request, so two requests never share a number and follow ups never wait on each other.

## What I said no to

**Admin through an app.** An app only vouches for who is asking. Statuses, heading edits and Copy stay in Launchpad, so a bug in one app cannot hand them out.

**A second build.** The relay deploy reuses the image the main deploy just built, so the board and the relay always run the same code.

**A shared secret.** Each app proves itself with its own service account's token. There is no key to copy between projects or rotate in six places.

## Where it landed

Six apps file through it: the treatment estimator, the capacity planner, the CDF Patient Dashboard, Hybridge Forms, the Cowork Dashboard and the Doctor Portal. The counter reached FR-0006 on October 29.

The whole Launchpad project cost $0.32 from October 1 to 28. Request time for Launchpad, the relay and the retired June board together came to under two cents. Doc Coach and NPC Coach do not have the tab yet.

What I would keep: let each app check its own people, and let the relay check only the app.
