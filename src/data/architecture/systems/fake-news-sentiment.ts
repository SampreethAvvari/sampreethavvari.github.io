import type { Architecture } from "../types";
import svg from "../svg/fake-news-sentiment.svg?raw";

// Sources: github.com/SampreethAvvari/us2020electionanalysis at main (May 13, 2024):
// notebooks with outputs, "5 Page Report.pdf" and "Final Report.pdf".
// Notebook sources live in Fake_News_Detection/.
// Ownership follows commit authorship: sentiment notebook, Power BI and report are mine.
const arch: Architecture = {
  slug: "fake-news-sentiment",
  rank: 230,
  status: "preview",
  statusNote: "School project, not running",
  name: "Election Fake News",
  project: "Election Fake News",
  kind: "system",
  disciplines: ["mle"],
  post: "/posts/fake-news-sentiment",
  headline: "Labels election tweets true, false or opinion.",
  tail: "On one V100 GPU.",
  lede:
    "A 4 bit Llama 3 8B, fine tuned on LIAR claims, labels 2020 election tweets True, False or Personal with a one token answer. RoBERTa adds a mood to each tweet, and the counts become state maps, swing state charts and a topic table.",
  titleBlock: [
    ["System", "Election Fake News"],
    ["Revision", "unversioned"],
    ["Live since", "Class project, May 2024"],
    ["Runs on", "Greene, one V100"],
    ["Region", "NYU, New York"],
    ["Base model", "Llama 3 8B, 4 bit"],
    ["Trainable", "83.9M parameters"],
    ["Team", "3 students"],
    ["Scale", "1 tweet : 1 token"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "1", unit: "token", label: "generated per tweet, so each verdict is one decoding step" },
    { value: "315,020", unit: "tweets", label: "found under both hashtags after cleaning, removed from both before labeling" },
    { value: "4", unit: "days", label: "from the first commit to the final report, May 8 to 12, 2024" },
    { value: "76", unit: "%", label: "accuracy on LIAR test claims, true or false, as the report states" },
  ],
  svg,
  views: [
    { id: "teach", label: "Teaching the claim model", focus: ["liar", "tune", "hub"], note: "LIAR claims collapse to true or false, and QLoRA trains a small adapter on a frozen 4 bit Llama 3 8B." },
    { id: "label", label: "Labeling tweets", focus: ["tweets", "clean", "classify", "hub"], note: "Tweets are cleaned, deduped across the two hashtags and labeled True, False or Personal with a one token answer." },
    { id: "mood", label: "Reading the mood", focus: ["classify", "sentiment", "lda", "maps", "report"], note: "RoBERTa adds positive, neutral or negative, and the counts become state maps and a topic table." },
  ],
  parts: {
    liar: {
      kind: "Benchmark",
      owner: "outside",
      what: "LIAR: short political claims rated by PolitiFact editors on a six step scale. 10,240 claims for training, 1,284 for validation and 1,267 for test.",
      source: "fake_news_detection-finetuning.ipynb",
    },
    tune: {
      kind: "Teammate's fine tune",
      owner: "outside",
      what: "Unsloth QLoRA on Llama 3 8B in 4 bit: LoRA rank 32 on all seven projection layers, 83,886,080 trainable parameters, 30 epochs at a learning rate of 8e-6 with 8 bit AdamW. True and mostly true became true; false, barely true and pants on fire became false; half true was split at random.",
      source: "fake_news_detection-finetuning.ipynb",
    },
    hub: {
      kind: "Model host",
      owner: "outside",
      what: "The 336 MB LoRA adapter is pushed to Hugging Face, and the classifier loads it on top of the 4 bit base.",
      source: "fake_news_detection-finetuning.ipynb",
    },
    tweets: {
      kind: "Public dataset",
      owner: "outside",
      what: "A Kaggle set of about 1.7 million tweets tagged #JoeBiden or #DonaldTrump, October 15 to November 8, 2020, with likes, retweets and state where known.",
      source: "5 Page Report.pdf",
    },
    clean: {
      kind: "Teammate's cleaning",
      owner: "outside",
      what: "Strips punctuation, non ASCII text, digits and anything outside an English word list. Tweets that end up identical under both hashtags are dropped from both.",
      source: "fake_news_detection_inference.ipynb",
    },
    classify: {
      kind: "Teammate's classifier",
      owner: "outside",
      what: "A 12 shot prompt asks for True, False or Personal, and the model generates exactly one token. More than 156,000 tweets from each hashtag went through it on one V100.",
      source: "fake_news_detection_inference.ipynb",
    },
    sentiment: {
      kind: "My notebook",
      owner: "mine",
      what: "cardiffnlp's Twitter RoBERTa, zero shot, scores each tweet positive, neutral or negative. Its own cleaning turns emojis into words, drops links, masks mentions as @user and keeps English tweets only.",
      source: "Sentiment Analysis/Sentiment Analysis.ipynb",
    },
    maps: {
      kind: "My Power BI",
      owner: "mine",
      what: "One Power BI file with state maps for each mood and label, the swing state chart and the hashtag trend lines over the campaign's last weeks.",
      source: "Plots/All Plots.pbix",
    },
    lda: {
      kind: "Topic model",
      owner: "outside",
      what: "LDA groups tweets by truth label and mood and pulls out their themes. The report's table names nine, from pandemic and taxes to whether the vaccine is safe.",
      source: "5 Page Report.pdf",
    },
    report: {
      kind: "My write up",
      owner: "mine",
      what: "The README and the final report: methods, maps and the topic table. It says plainly that the tweets have no answer key, so the 76 percent applies to LIAR claims only.",
      source: "Final Report.pdf",
    },
  },
  breaks: [
    { title: "Answers off the label list", body: "A one token answer is not always a label. On one run 2,945 answers came back as four hash marks.", source: "fake_news_detection_inference.ipynb" },
    { title: "Same tweet, both hashtags", body: "315,020 cleaned tweets appeared in both files. Kept, they would count once for each candidate.", source: "fake_news_detection_inference.ipynb" },
    { title: "No answer key for tweets", body: "Accuracy can only be measured on LIAR. The tweets carry no labels, and the report says so.", source: "Final Report.pdf" },
  ],
  tuned: [
    { title: "4 bit base, small adapter", body: "QLoRA freezes the 4 bit base and trains 83.9 million adapter parameters, so the run fits on one 32 GB V100.", source: "fake_news_detection-finetuning.ipynb" },
    { title: "Six labels down to two", body: "Training ended with 5,545 false and 4,695 true claims after half true was split at random.", source: "fake_news_detection-finetuning.ipynb" },
    { title: "Learning rate cut to 8e-6", body: "Early runs used 2e-4. The final run used 8e-6 over 30 epochs and 38,400 steps.", source: "fake_news_detection-finetuning.ipynb" },
  ],
  guards: [
    { title: "One prompt shape", body: "Claims and tweets go through the same instruction, input and response template the adapter was trained on.", source: "fake_news_detection_inference.ipynb" },
    { title: "English only for mood", body: "Language detection drops non English tweets before RoBERTa scores them.", source: "Sentiment Analysis/Sentiment Analysis.ipynb" },
    { title: "Mentions and links masked", body: "Handles become @user and links become http, the form the RoBERTa model expects.", source: "Sentiment Analysis/Sentiment Analysis.ipynb" },
  ],
  cost: null,
  live: {
    mode: "event",
    label: "A tweet",
    everySeconds: 13,
    path: ["tweets", "clean", "classify", "sentiment", "maps"],
    source: "one #JoeBiden or #DonaldTrump tweet, replayed through the analysis",
  },
};

export default arch;
