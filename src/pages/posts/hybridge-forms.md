---
title: "Lead forms off Tally and Zapier, into our own Google Cloud"
date: "2026-10-14"
layout: ../../layouts/PostLayout.astro
description: "Every patient inquiry on our websites went through Tally, then Zapier, before it reached Monday. I built the forms service that replaces both, around one rule: no inquiry is ever lost."
img_path: "/hybridge-forms.png"
architecture: "hybridge-forms"
img_alt: "Hybridge Forms: a glowing glass form with its fields and Send button, wired down to two storage cubes for the database and the fallback copy"
tag: "Architecture"
tone: "emerald"
stats:
  - value: "32 forms"
    label: "found on Tally by reading all 539 pages of our four websites, all handled by one tested importer"
    tone: "emerald"
  - value: "0 answers"
    label: "in any log line. The logger drops patient fields by name and by shape"
    tone: "blue"
  - value: "67 leads"
    label: "already on the Monday board got all six tracking fields on Oct 26, the day the digital team saw the gap"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Every patient inquiry on our four websites passed through Tally, then Zapier, before reaching Monday."
  - label: "What I built"
    value: "A forms service in our own Google Cloud that saves each inquiry first, then puts it on Monday."
  - label: "Who uses it"
    value: "Patients on the Elmwood and Hybridge Implants sites; our digital experience director builds and publishes forms."
  - label: "Outcome"
    value: "Inquiries reach the Monday board with no Zapier in between, and no log line carries an answer."
  - label: "Runs on"
    value: "Cloud Run and Firestore, with Cloud Tasks waking a private worker and a bucket as fallback."
  - label: "Cost"
    value: "$9 in October 2026, measured, a partial month; one warm public instance is $7.14 of it."
---

## The problem

Every form on our four websites ran on Tally. Tally handed each answer to Zapier, and Zapier put it on our Monday lead board. So every patient inquiry passed through two outside companies before anyone at the practice saw it.

Our VP of finance asked to move it inside our own Google Cloud, with one rule: no submission is ever lost. Our digital experience director added the rest. Patient privacy, good on a phone, pushes to Monday, conditional questions, spam protection, and the power to edit and add forms without waiting on me.

Before writing code I fetched all 539 pages in the four sitemaps and read every Tally embed. There were 32 live forms.

## What I built

A forms service in our own Google Cloud project. A public app serves each form in an iframe on the practice websites and saves what patients send. A private worker puts each lead on Monday and emails the copies. Staff build forms and read inquiries in a dashboard behind Google sign in, and a job tests everything at <span class="egg" tabindex="0" data-egg="On the first 2 AM run, Cloudflare challenged 71 pages of our own website as a suspected bot. The checker now sends one exact user agent that Cloudflare lets through.">2 AM</span>.

The public app holds no dashboard code at all, so a bug there has no admin page to reach. [Open the drawing](/architecture/hybridge-forms) to see every part.

## The sprint

The first commit went in on September 30 at 11:58 AM: the design, the plan and the 32 Tally forms as fetched. By 4:36 PM the importer read all 32. That night I worked until 5:36 AM. On October 6 a change went in at 3:55 AM, and the first deploy ran that evening.

On October 14 Monday delivery, email copies and the Hybridge look all went live. That afternoon our digital experience director swapped Elmwood's contact page from Tally to ours. On October 15, in 79 minutes, a step by step quiz, Delete, an email back to the sender, and wildcard hosts for the Webflow designer went live.

On October 26 the digital team saw only UTM Source reaching Monday. The forms had saved all six tracking fields, but only one had a column mapped. The fix merged that afternoon as v2.6.1, and a script filled the missing columns on the 67 leads already on the board. Then a marketing colleague asked for a Skip button on the quiz. It went live on October 28 as v2.7.0.

## The hard parts

**Nothing lost, even with the database down.** The page makes a random id before it sends, and the server saves with a create only write, so a double click never makes two leads. If Firestore does not answer in time, the record goes to a private bucket, the patient still sees "sent", and the nightly job moves it in. If both fail, the browser retries for about 15 seconds with the same id, then keeps the answers on the device with a Try again button.

**Fast, and only once.** At first a lead waited for the minute sweep. Now the public app adds a Cloud Tasks wake right after the save, giving the queue 1.5 seconds before answering the patient anyway. The sweep stays as the backup. Overlapping sweeps claim each delivery in its own transaction, and before any retry the worker looks for a lead with the same email made since the first try, so a crash after Monday made the item never makes a second one.

**Where the answers can go.** I listed every place a patient's answers could reach, then closed the rest. The form is an iframe from our own address, so ad pixels on the websites cannot read it. reCAPTCHA gets only a token. Firestore rules deny every browser, and the address is kept only as a salted hash. Cloud Run's request logs for both apps are excluded, since they would hold query strings and addresses. And the logger is a filter:

```ts
// packages/core/src/log.ts
for (const key of Object.keys(fields)) {
  if (DROPPED_FIELD_NAMES.has(key.toLowerCase())) continue;
  const value = sanitizeValue(fields[key]);
  if (value === undefined) continue;
  record[key] = value;
}
```

It drops <span class="egg" tabindex="0" data-egg="answers, email, phone, name and ip, plus thirteen cousins from firstname to password. Selective hearing, on purpose.">18 field names</span> outright, and any value that is not plain text, a number or a boolean, so a nested object cannot smuggle an email through. Only two places outside the project get an inquiry: the Monday board and each form's email copies. The public app can reach neither. Only the private worker holds the Monday token and the right to send mail.

## What I said no to

**Patient file uploads.** There is no upload question and no upload endpoint. A send is JSON only, 32 KB at most. The only files in the system are ones staff attach to the email back to a patient, in a private bucket with no public or signed links.

**A theme per website.** Tally matched each site's colours. Every form now wears one Hybridge look, and I removed the theme editor. One look to test on every phone.

**A new setting for Skip.** The quiz request could have become another checkbox. Instead Skip shows on any step whose visible questions are all optional, so the director just turns Required off. A skipped step sends nothing: Monday leaves the column empty and the PDF leaves the row out.

## Where it landed

Elmwood's contact form has run on it since October 14. The Email Us and consultation forms on the Hybridge Implants site feed the same Monday board, with no Zapier in between. The director builds and publishes forms, one site at a time. The nightly job has run 29 times.

It cost $9 in October, measured from the billing export, a partial month since the first cost landed on October 6. One warm public instance is $7.14 of it.

Not measured: how many inquiries came through, or how much sooner a patient gets a call. Still open: how long real inquiries are kept, and whether new sign ins should wait for approval. Today every Hybridge account starts as a viewer who can read inquiries, as asked. It is one switch to change.

What I would keep: save first, deliver from the saved copy, and treat the logger as a filter.
