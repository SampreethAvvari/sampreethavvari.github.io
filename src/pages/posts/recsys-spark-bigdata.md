---
title: "Movie twins for 330,975 users after Spark kept losing nodes"
date: "2024-05-18"
layout: ../../layouts/PostLayout.astro
description: "A three person NYU capstone on 33.8 million MovieLens ratings: Spark ALS for recommendations, and my MinHash notebook that found movie twins after Spark's similarity join kept losing workers."
img_path: "/customer-segmentation.png"
architecture: "recsys-spark-bigdata"
img_alt: "A big pile of data narrowed down to a short, ranked list of recommendations"
tag: "MLOps"
tone: "violet"
stats:
  - value: "33.8M"
    label: "MovieLens ratings from 330,975 users"
    tone: "cyan"
  - value: "37 s"
    label: "to index and query every user in LSH, in one Python process"
    tone: "blue"
  - value: "0.73 vs 0.03"
    label: "average rating correlation, top 100 twins against 100 random pairs"
    tone: "emerald"
facts:
  - label: "Problem"
    value: "Find the 100 most similar pairs among 330,975 MovieLens users, about 55 billion possible pairs."
  - label: "What I built"
    value: "My part of a three person NYU capstone: a MinHash and LSH search for movie twins."
  - label: "Outcome"
    value: "The top 100 twins averaged a 0.73 rating correlation, against 0.03 for 100 random pairs."
  - label: "Runs on"
    value: "One Python process on NYU's Greene cluster with datasketch, after Spark on Dataproc kept losing workers."
  - label: "Built"
    value: "37 seconds to index and query every user, in May 2024."
  - label: "Status"
    value: "School project, not running."
---

## The problem

The Big Data capstone at NYU gave every team the same two asks on MovieLens. First, find the 100 pairs of users with the most similar taste, judged only by which movies they rated, and show the pairs are real. Second, build a recommender with Spark's ALS, compare it with a popularity baseline, and score both on the top 100 movies per user.

The full set was 33,832,162 ratings from 330,975 users across 86,537 movies. Comparing every user with every other user means <span class="egg" tabindex="0" data-egg="330,975 choose 2 is exactly 54,772,059,825. Counting them is instant. Comparing them is not.">about 55 billion pairs</span>. That rules out the obvious loop.

## What I built

We were a team of three. Teammates built the Spark side: a per user time split written to Parquet on HDFS, the popularity baseline, ALS and the ranking metrics. My part was the movie twins.

Each user becomes the set of movies they rated. datasketch turns that set into <span class="egg" tabindex="0" data-egg="A whole viewing history squeezed into 30 integers. Taste, as a barcode.">30 MinHash numbers</span>, and an LSH index with 6 bands drops users whose numbers agree into the same buckets, so a query only compares a user with likely matches. A correlation check then tests whether the twins really rate alike. [Open the drawing](/architecture/recsys-spark-bigdata).

## The sprint

The twins search started in Spark and stalled there. A teammate's commit titled "segmentation last try" went in at 1:21 AM on May 12, 2024. My notebook landed at 8:05 PM on May 14 and was merged two minutes later. The report followed at 11:43 PM the next night.

## The hard parts

**Spark kept losing its workers.** Spark's MinHashLSH with an approximate similarity join worked on the small dataset. On the full one, Dataproc reported lost nodes and killed workers. Dropping users with fewer than 20 ratings did not help, and neither did smaller hash settings. Even a tenth of the data still lost nodes. So I moved the search to one Python process on NYU's Greene cluster with datasketch and pandas, and it finished: 10 seconds to insert every user and 27 seconds to query them all.

```python
# Capstone Proj/Customer-Segmentation/pandas-greene/large.ipynb
lsh = MinHashLSH(threshold=threshold, num_perm=num_perm,
                 params=(num_bands, num_perm // num_bands))
for user, mi in tqdm(minhashes.items()):
    lsh.insert(user, mi)
```

**Picking the knobs by the result.** We tried 15 to 500 permutations and 2 to 8 bands. More permutations were slower and not better. 500 took 33 minutes to build signatures and gave the top 100 an average correlation of 0.33 at best. 30 took 6 minutes 19 seconds and scored 0.73. That setting returned 22,215,721 candidate pairs, and the top 100 are the pairs with the most movies in common.

**Proving the twins are real.** A hash match says nothing about taste. For each pair I took the movies both users rated and computed the Pearson correlation of their ratings. The top 100 averaged 0.7348. One hundred random pairs averaged 0.0323.

## What I learned

**Measure the shape of the work.** The data was 33.8 million rows, but the job was 330,975 sets of movie ids, and those fit in one machine's memory. A cluster is a cost you pay. Here one process paid less.

**Give every result a control.** On the 600 user small set, the same settings found 151 pairs, and their correlation barely beat random, 0.22 against 0.15. Without the random pairs, both runs would have looked like a success.

## Where it landed

It was a course project, and nothing runs now. The movie twins section of our report is my notebook's output, and the notebook holds the full list of 100 pairs. The recommender side, ALS against the popularity baseline, is my teammates' work and is written up in the same report.

What I would keep: look at the shape of the work before reaching for a cluster, and check every clever result against a dumb one.

Full project: [Customer Segmentation and Recommendation System](https://github.com/SampreethAvvari/BigData).
