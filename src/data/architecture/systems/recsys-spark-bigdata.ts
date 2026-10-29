import type { Architecture } from "../types";
import svg from "../svg/recsys-spark-bigdata.svg?raw";

// Sources: github.com/SampreethAvvari/BigData, folder "Capstone Proj" (code,
// notebook outputs and Capstone_g69_Report.pdf). Ownership follows commit
// authorship in the course repo: the movie twins notebook is mine.
// pandas-greene/large.ipynb sits under Capstone Proj/Customer-Segmentation/.
const arch: Architecture = {
  slug: "recsys-spark-bigdata",
  rank: 220,
  status: "preview",
  statusNote: "School project, not running",
  name: "Recommender at scale",
  project: "Recommender at scale",
  kind: "system",
  disciplines: ["mle", "sde"],
  post: "/posts/recsys-spark-bigdata",
  headline: "Finds movie twins among 330,975 users.",
  tail: "LSH in 37 seconds.",
  lede:
    "Spark on Dataproc splits 33.8 million MovieLens ratings by time, trains ALS and scores it against a popularity baseline. Beside it, MinHash and LSH in one Python process find users who rated the same movies, and a correlation check tests the top 100 pairs.",
  titleBlock: [
    ["System", "Recommender at scale"],
    ["Revision", "unversioned"],
    ["Live since", "Class project, May 2024"],
    ["Runs on", "Dataproc, Greene"],
    ["Region", "NYU, New York"],
    ["Data", "33.8M ratings"],
    ["Users", "330,975"],
    ["Team", "3 students"],
    ["Scale", "1 user : 30 numbers"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "37", unit: "s", label: "to index and query all 330,975 users, 10 s in and 27 s out" },
    { value: "0.73", label: "average rating correlation of the top 100 twins, against 0.03 for 100 random pairs" },
    { value: "33.8M", unit: "ratings", label: "in MovieLens ml-latest, January 1995 to July 2023" },
    { value: "22.2M", unit: "pairs", label: "candidate twins from LSH at a 0.9 threshold" },
  ],
  svg,
  views: [
    { id: "recs", label: "Recommendations", focus: ["movielens", "hdfs", "split", "als", "metrics"], note: "Spark splits each user's history by time, trains ALS on the early part and ranks 100 movies per user." },
    { id: "baseline", label: "The baseline", focus: ["split", "pop", "metrics"], note: "A damped popularity score gives every user the same top 100, scored with the same ranking metrics." },
    { id: "twins", label: "Movie twins", focus: ["movielens", "minhash", "lsh", "twins", "check"], note: "Each user's movie set becomes 30 MinHash numbers, LSH buckets them, and a correlation check tests the top 100 pairs." },
  ],
  parts: {
    movielens: {
      kind: "Public dataset",
      owner: "outside",
      what: "MovieLens ml-latest: 33,832,162 ratings from 330,975 users across 86,537 movies, January 1995 to July 2023.",
      source: "Capstone Proj/README_large.txt",
    },
    hdfs: {
      kind: "Cluster storage",
      owner: "managed",
      what: "HDFS on the course's Dataproc cluster. Ratings are copied in as CSV and the splits are written back as Parquet, so every run reads the same partitions.",
      source: "Capstone Proj/Capstone_g69_Report.pdf",
    },
    split: {
      kind: "Teammate's Spark job",
      owner: "outside",
      what: "Users are cut into thirds. One third keeps every rating in training. The other two keep their earliest 80 percent by timestamp in training and hold out the latest 20 percent, one third for validation and one for test.",
      source: "Capstone Proj/ALS/traintestsplit.py",
    },
    pop: {
      kind: "Teammate's baseline",
      owner: "outside",
      what: "Each movie scores its rating sum divided by its rating count plus 10,000, so a movie with a handful of perfect ratings cannot top the list. Every user gets the same top 100.",
      source: "Capstone Proj/ALS/popularity_baseline.py",
    },
    als: {
      kind: "Teammate's model",
      owner: "outside",
      what: "Spark ALS with rank 200, 15 iterations and non negative factors, trained on the large split. Users and movies it never saw are dropped from scoring.",
      source: "Capstone Proj/ALS/als.py",
    },
    metrics: {
      kind: "Evaluation",
      owner: "outside",
      what: "Spark RankingMetrics over the top 100 movies per user: mean average precision, precision at 100 and NDCG at 100.",
      source: "Capstone Proj/ALS/inference.py",
    },
    minhash: {
      kind: "My notebook",
      owner: "mine",
      what: "Each user becomes the set of movies they rated, and datasketch turns that set into 30 MinHash numbers. Signatures for every user took 6 minutes 19 seconds.",
      source: "pandas-greene/large.ipynb",
    },
    lsh: {
      kind: "My index",
      owner: "mine",
      what: "A MinHashLSH index with 6 bands of 5 rows at a 0.9 threshold. Inserting every user took 10 seconds and querying every user took 27.",
      source: "pandas-greene/large.ipynb",
    },
    twins: {
      kind: "Candidate pairs",
      owner: "mine",
      what: "The queries returned 22,215,721 candidate pairs. The top 100 are the pairs with the most movies in common.",
      source: "pandas-greene/large.ipynb",
    },
    check: {
      kind: "My validation",
      owner: "mine",
      what: "For each pair, the Pearson correlation of their ratings on the movies both rated. The top 100 averaged 0.7348; 100 random pairs averaged 0.0323.",
      source: "pandas-greene/large.ipynb",
    },
  },
  breaks: [
    { title: "Spark lost its workers", body: "The Spark MinHashLSH similarity join lost nodes on Dataproc even on a tenth of the users, so the twins search moved to datasketch in one Python process.", source: "Capstone Proj/Capstone_g69_Report.pdf" },
    { title: "A small dataset says little", body: "On the 600 user small set the same settings found 151 pairs, and their correlation barely beat random, 0.22 against 0.15.", source: "Capstone Proj/Capstone_g69_Report.pdf" },
    { title: "A user ALS never saw", body: "Cold start rows are dropped instead of scored, so ranking covers only users and movies with training history.", source: "Capstone Proj/ALS/als.py" },
  ],
  tuned: [
    { title: "30 permutations, 6 bands", body: "Settings from 15 to 500 permutations and 2 to 8 bands were tried. 30 and 6 gave the top 100 the highest correlation, 0.7348.", source: "Capstone Proj/Capstone_g69_Report.pdf" },
    { title: "Signatures in minutes", body: "30 permutations built every signature in 6 minutes 19 seconds. 500 took 33 minutes and scored worse.", source: "Capstone Proj/Capstone_g69_Report.pdf" },
    { title: "Damped popularity", body: "Adding 10,000 to each movie's rating count keeps rarely rated movies out of the baseline's top 100.", source: "Capstone Proj/ALS/popularity_baseline.py" },
  ],
  guards: [
    { title: "Hold out the latest ratings", body: "Validation and test users keep their earliest 80 percent of ratings in training and are scored on the rest, in time order.", source: "Capstone Proj/ALS/traintestsplit.py" },
    { title: "Random pairs as a control", body: "The twins are compared with 100 random pairs scored the same way, so a high correlation has something to beat.", source: "pandas-greene/large.ipynb" },
    { title: "Splits written once", body: "The partitions are saved to Parquet once and reused, so every experiment reads the same train, validation and test rows.", source: "Capstone Proj/Capstone_g69_Report.pdf" },
  ],
  cost: null,
  live: {
    mode: "event",
    label: "One user's ratings",
    everySeconds: 14,
    path: ["movielens", "minhash", "lsh", "twins", "check"],
    source: "one user's rated movies, replayed through the movie twins run",
  },
};

export default arch;
