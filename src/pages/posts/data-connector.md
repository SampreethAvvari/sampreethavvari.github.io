---
title: "A Claude connector for our marketing data, live in three hours"
date: "2026-10-27"
layout: ../../layouts/PostLayout.astro
description: "Asking Claude about our marketing data took the Google Cloud SDK and a fresh login most days. I built a connector: sign in with Google once, see only the data an owner ticked."
img_path: "/data-connector.png"
architecture: "data-connector"
img_alt: "Hybridge Data connector: one question from Claude passing through a single gate into each person's own set of marketing data"
tag: "Architecture"
tone: "blue"
stats:
  - value: "3 hours"
    label: "from the first connector code to the live service on Oct 23"
    tone: "emerald"
  - value: "39 of 40"
    label: "golden questions passed asking Claude through the connector on main, with all 40 answers correct"
    tone: "blue"
  - value: "469 calls"
    label: "from 3 people in the first seven days, Oct 23 to 29"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Asking Claude about our marketing data took the Google Cloud SDK and a fresh login most days."
  - label: "What I built"
    value: "A remote MCP connector for Claude: sign in with Google once and see only the data an owner ticked."
  - label: "Who uses it"
    value: "Our marketing lead, a marketing teammate and me: 469 tool calls from October 23 to 29."
  - label: "Outcome"
    value: "Each question runs as one SELECT on that person's own BigQuery views, and every answer names its source."
  - label: "Runs on"
    value: "Cloud Run with FastMCP, Google sign in over OAuth, and sessions kept encrypted in Firestore."
  - label: "Built"
    value: "3 hours from the first connector code to the live service on October 23, 2026."
---

## The problem

Our marketing lead asks Claude questions about our [marketing warehouse](/posts/marketing-warehouse). In October that took the Google Cloud SDK, two command line sign ins, a database tool on their laptop, a hand edited Claude config, and a fresh Google Cloud login most days, because our Workspace makes those logins expire. Every new person would repeat all of it. Someone outside the company could not do it at all.

What I wanted was simple to say. Add a person by typing an email and ticking which data they can see. They connect Claude once, sign in with Google once, and stop thinking about logins.

The first four days of real use showed a second problem. Of 227 queries, 15 failed, and 10 of those named a column that does not exist. The call log could show me SQL that failed. It could not show me a number that was wrong.

## What I built

A remote MCP server on Cloud Run that Claude adds as a custom connector, on the web, the desktop app or a phone. An owner page lists the people and 13 boxes, one per data source plus patient names and the family practice and lab. Each set of boxes gets its own BigQuery dataset of views. Claude writes SQL against the warehouse's own table names, and a guard points every table at that person's dataset before anything runs. The connector's instructions carry the business rules, including a Source section on every answer and a TapClicks flag on any number from the agency feed.

Then an accuracy layer that moves the math to the server, and an eval that asks Claude 40 questions through the connector. [Open the drawing](/architecture/data-connector) to see what is live and what waits on main.

## The sprint

- **Oct 22, 2:35 PM:** the design. The build plan at 4:33 PM.
- **Oct 23, 12:06 PM:** first code, the boxes and access sets. Then the SQL guard at 12:39 PM, the MCP server at 1:38 PM, the owner page at 2:37 PM, the deploy at 3:02 PM.
- **3:06 PM:** the service is live, three hours after the first code. The call log has its first real question at 3:38 PM.
- **Oct 27:** one box per data source at 3:48 PM, the accuracy layer at 6:02 PM, the eval results at 6:07 PM.
- **Oct 28, 11:59 AM:** the accuracy layer goes live. I rolled it back the same day.
- **Oct 29:** CPU billed per request at 1:04 PM, Business Profile straight from Google at 1:34 PM, and a 6:20 AM job that builds everyone's views after the morning pulls.

The ask that started it, the marketing lead's setup, went from design to a live connector in a little over 24 hours.

## The hard parts

**Access that holds when Claude writes its own SQL.** Claude can write any query it likes, so the boxes cannot depend on instructions. Each set of boxes names its own dataset:

```python
# src/data_connector/boxes.py
letters = "".join(b.letter for b in BOXES if b.key in self)
return f"access_{letters}" if letters else None
```

That dataset holds views authorized to read marts and staging. Without the patient box the contact columns are gone; without the family practice box those rows are filtered out. Queries run as one of two identities that can read only these datasets. The guard parses each query with sqlglot, refuses anything but one SELECT, and rewrites every table name. A warehouse table with no rule in the catalog stays hidden.

**Sign in once.** Claude connects over OAuth. FastMCP's proxy sends the person to Google asking only for openid and email, so our Workspace's Google Cloud reauthentication rule never applies. The connector issues its own tokens, 7 days for access and <span class="egg" tabindex="0" data-egg="Google never says when its refresh tokens expire, and the library would otherwise end every session after one year. Ten years is a polite way of saying ask Google.">10 years for refresh</span>, and keeps the sessions encrypted in Firestore so a redeploy signs nobody out.

**Numbers you can trust.** The connector does the SQL and the math, and Claude phrases the result. `get_metric` answers from 58 fixed metrics over 10 tables of facts. It turns "last month" into exact dates and says them back, takes totals from the same query with GROUPING SETS, and works out ratios from summed parts. Every result carries Source lines, missing days and the TapClicks flag. `find_values` shows what a column really holds.

The eval asks the 40 golden questions through the Claude CLI, which can see only the connector. Each answer has to be right and grounded: every number in it must appear in a tool result. Run 1 passed 38 of 40, with all 40 answers correct; twice Claude <span class="egg" tabindex="0" data-egg="Adding up rows by hand. The server now sends column totals, so there is nothing left to add.">added rows itself</span>. I added column totals. Run 2 passed 39 of 40. The three trick questions, about an office that is not ours, radio spend and Meta in January 2026, all came back "not in the warehouse" with no number.

## What I said no to

**Hard stops for quality.** Security is a hard block. Every quality check is a note next to the result and never stops a query.

**Office limits.** I left office level limits out of the design. Access goes by data source.

**Materializing the heavy marts.** The lead and funnel marts scan about 2 GB a query. A scheduled table would make them faster and add a refresh that can fail, so they stay views.

## Where it landed

Three people are on the list: our marketing lead, a marketing teammate and me. From October 23 to 29 they made 469 tool calls on six days, 364 of them queries.

The live service runs the October 27 code plus direct Business Profile data, on one warm instance with CPU billed only while a request runs. Main is ahead of what is live: it has the accuracy layer.

Cost is not measured yet. The billing export for this project switched on October 28, 2026, so there is no measured month. Time saved is not measured either.

What I would keep: the server does the math and carries the caveats, and Claude says it in plain English.
