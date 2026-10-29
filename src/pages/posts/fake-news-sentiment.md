---
title: "Labeling 2020 election tweets with a 4 bit Llama 3 on one GPU"
date: "2024-05-12"
layout: ../../layouts/PostLayout.astro
description: "A three person NYU project on the 2020 election: a fine tuned Llama 3 labels tweets true, false or opinion, RoBERTa reads their mood, and I turned the results into state maps."
img_path: "/fake-news.png"
architecture: "fake-news-sentiment"
img_alt: "One model flagging fake news, another reading the mood of millions of tweets"
tag: "Research"
tone: "violet"
stats:
  - value: "76%"
    label: "accuracy on LIAR test claims, true or false, as the report states"
    tone: "violet"
  - value: "1.7M"
    label: "election tweets under #JoeBiden and #DonaldTrump, Oct 15 to Nov 8, 2020"
    tone: "blue"
  - value: "315,020"
    label: "cleaned tweets found under both hashtags, removed from both"
    tone: "emerald"
facts:
  - label: "Problem"
    value: "A three person NYU course project asking how much 2020 election talk on Twitter was false."
  - label: "What I built"
    value: "Teammates tuned a 4 bit Llama 3 to label tweets; I built the RoBERTa mood pass and state maps."
  - label: "Outcome"
    value: "76 percent accuracy on LIAR test claims; the model labeled about 32 percent of tweets false."
  - label: "Runs on"
    value: "One 32 GB V100 on NYU's Greene cluster, with QLoRA training 83.9 million adapter parameters."
  - label: "Built"
    value: "May 8 to 12, 2024, from the first commit to the final report."
  - label: "Status"
    value: "School project, not running."
---

## The problem

Our NLP course project took on a question people argued about all through 2020: how much of the election talk on Twitter was false, and how did people feel about each candidate? The data was a public set of about 1.7 million tweets tagged #JoeBiden or #DonaldTrump, from October 15 to November 8, 2020.

"Detect fake news" hides two jobs. One asks whether a claim is true. The other asks how a crowd feels. They need different models and different data.

## What I built

We were a team of three. Teammates fine tuned the claim model: Llama 3 8B in 4 bit with a QLoRA adapter, trained on LIAR, a benchmark of political claims rated by PolitiFact editors. It labels each tweet True, False or Personal. My part was the mood side and the results: a RoBERTa sentiment pass, the state maps and swing state charts in Power BI, and the write up. [Open the drawing](/architecture/fake-news-sentiment).

## The sprint

The first commit went in at 9:45 PM on May 8, 2024, and the claim model notebooks followed at 12:13 AM. Most of my work landed on May 11. The final report went up at 10:36 PM on May 12.

## The hard parts

**Six labels down to two.** LIAR rates claims on six steps from true to <span class="egg" tabindex="0" data-egg="A real PolitiFact rating. Here it was folded into false without ceremony.">pants on fire</span>. We collapsed them: true and mostly true became true; false, barely true and pants on fire became false; half true was split at random between the two. Training ended with 5,545 false and 4,695 true claims. QLoRA froze the 4 bit base and trained 83.9 million adapter parameters, which fit on one 32 GB V100. Accuracy on LIAR's test claims was 76 percent.

**A one token answer.** The classifier generates exactly <span class="egg" tabindex="0" data-egg="max_new_tokens = 1. The shortest possible opinion, delivered 156,123 times on one run alone.">one token</span> per tweet. That is cheap, and it is also all you get. One prompt version used markdown headings with four hash marks, and on that run 2,945 answers came back as "####". A plain text version of the same examples left 5 stray answers in 156,123. My read is that the model copied the prompt's own formatting.

**The same tweet under both hashtags.** After cleaning, 315,020 tweets in the #DonaldTrump file also appeared in the #JoeBiden file. Kept, each would count once for each candidate, so they were dropped from both:

```python
# Fake_News_Detection/fake_news_detection_inference.ipynb
common_texts = trump_final[trump_final['tweet'].isin(joe_final['tweet'])]['tweet']
trump_final_cleaned = trump_final[~trump_final['tweet'].isin(common_texts)]
joe_final_cleaned = joe_final[~joe_final['tweet'].isin(common_texts)]
```

## What I learned

**Constrain the output, then count the misses.** With one free token, anything can come back. Next time I would restrict decoding to the allowed labels and report how many answers fell outside them.

**A benchmark score is not a score on your data.** The 76 percent is on LIAR claims. The tweets have no answer key, and our report says so: the tweet labels are the model's judgment, not checked facts.

**Mood is not stance.** RoBERTa says whether a tweet is positive or negative, not whom it supports. Our report read a positive #JoeBiden tweet as pro Biden and named that as an assumption. A negative tweet under #JoeBiden can just as easily be an attack on the other candidate.

## Where it landed

A class project, not running. My share is in the repo: the sentiment notebook, the Power BI file with the state and swing state views, and the report. The model labeled about 32 percent of tweets false overall, 36 percent of negative tweets and 18 percent of positive ones. Those are model labels, not verified claims.

What I would keep: split a fuzzy goal into the jobs inside it, give each job its own model, and say plainly which numbers were measured and which were inferred.

Full project: [Fake News and Sentiment Analysis](https://github.com/SampreethAvvari/us2020electionanalysis).
