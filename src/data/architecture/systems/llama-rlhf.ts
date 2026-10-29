import type { Architecture } from "../types";
import svg from "../svg/llama-rlhf.svg?raw";

// Sources: the research repo Research work/LLM-Persuasion (paths below are
// relative to it) and the portfolio git stats for dates and times.
const arch: Architecture = {
  slug: "llama-rlhf",
  rank: 240,
  status: "preview",
  statusNote: "Research code, not deployed",
  name: "Llama RLHF",
  project: "Llama RLHF",
  kind: "system",
  disciplines: ["mle"],
  post: "/posts/llama-rlhf",
  headline: "Trains Llama 3 to write counterarguments.",
  tail: "A reward model judges each one.",
  lede:
    "Replies from Reddit's ChangeMyView that earned a delta, paired with replies that did not, train two models from one 4 bit Llama 3 8B: a writer through supervised fine tuning and a judge that scores replies. GRPO then lets the writer practice against the judge, and an eval script scores held out premises against the untrained base.",
  titleBlock: [
    ["System", "Llama RLHF"],
    ["Revision", "unversioned"],
    ["Live since", "Not deployed"],
    ["Runs on", "NYU GPU cluster"],
    ["Region", "New York"],
    ["Base", "Llama 3 8B, 4 bit"],
    ["Trainers", "TRL, Unsloth"],
    ["Checked", "Base vs trained"],
    ["Scale", "1 delta : 1 changed mind"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "1,000", unit: "premises", label: "per GRPO run, four sampled replies each, up to 256 tokens a reply" },
    { value: "0", unit: "prompt tokens", label: "in the SFT loss. Only the winning reply is scored" },
    { value: "5,000", unit: "replies", label: "in the first judge's set, 2,511 that earned a delta and 2,489 that did not" },
    { value: "4", unit: "bit", label: "Llama 3 8B under every stage, with LoRA rank 64 on top" },
  ],
  svg,
  views: [
    { id: "pairs", label: "From debates to pairs", focus: ["cmv", "pairs", "sft"], note: "Each pair is a reply that earned a delta and one that did not, and SFT learns from the winners." },
    { id: "practice", label: "The practice loop", focus: ["sft", "grpo", "reward", "pairs"], note: "GRPO samples four replies per premise and the reward model, trained on the same pairs, scores each one." },
    { id: "one-base", label: "One base model", focus: ["base", "sft", "reward", "grpo"], note: "SFT, the reward model and GRPO all load the same 4 bit Llama 3 8B, so their scores share a starting point." },
    { id: "eval", label: "Checking the result", focus: ["grpo", "eval", "evalset", "wandb"], note: "Held out premises run through the trained adapter and the untrained base, scored the same way." },
  ],
  parts: {
    cmv: {
      kind: "Public data",
      owner: "outside",
      what: "Reddit's ChangeMyView. A poster awards a delta to the reply that changed their view, and every reply row keeps the deltas it was awarded.",
      source: "Sampreeth/biased_5000.csv",
    },
    pairs: {
      kind: "My dataset",
      owner: "mine",
      what: "Train, validation and eval files of premise, chosen and rejected. The chosen reply earned a delta and the rejected one did not. The first version, for a Longformer judge, kept one of each per question and sampled 5,000 rows.",
      source: "Sampreeth/pairwise_bert_39.py:365",
    },
    base: {
      kind: "Open model",
      owner: "outside",
      what: "Llama 3 8B, loaded in 4 bit NF4 with double quantization through Unsloth. SFT, the reward model and GRPO all start from it.",
      source: "Sampreeth/Unsloth/SFT_unsloth.py:16",
    },
    sft: {
      kind: "My training job",
      owner: "mine",
      what: "Supervised fine tuning with LoRA rank 64 on every attention and MLP projection. The prompt tokens are masked, so the loss counts only the winning reply. One epoch.",
      source: "Sampreeth/Unsloth/SFT_unsloth.py:95",
    },
    reward: {
      kind: "My training job",
      owner: "mine",
      what: "The judge. Llama 3 8B with a one number head, trained with TRL's RewardTrainer for two epochs to score the chosen reply above the rejected one.",
      source: "Sampreeth/Unsloth/reward_unsloth.py:76",
    },
    grpo: {
      kind: "My training job",
      owner: "mine",
      what: "Starts from the SFT adapter. For each premise it samples four replies, the reward model scores each one, and replies that beat their group's average get pushed up. 1,000 premises per run.",
      source: "Sampreeth/Unsloth/grpo_unsloth.py:275",
    },
    eval: {
      kind: "My script",
      owner: "mine",
      what: "Writes a reply for each held out premise and scores it with BLEU and ROUGE-L against the winning human reply, plus the reward model's score. The untrained base runs through the same script as the control.",
      source: "Sampreeth/Unsloth/Inference.py:18",
    },
    evalset: {
      kind: "My dataset",
      owner: "mine",
      what: "Premises kept out of training. The inference script reads the first 100.",
      source: "Sampreeth/Unsloth/Inference.py:70",
    },
    wandb: {
      kind: "Experiment tracking",
      owner: "outside",
      what: "Every SFT, reward and GRPO run logs its loss and eval scores under a dated run name, like June15_GRPO_Run1.",
      source: "Sampreeth/Unsloth/grpo_unsloth.py:20",
    },
  },
  breaks: [
    { title: "A job dies mid run", body: "SFT saves a checkpoint every 225 steps and the reward model every 400, so a killed job restarts from the last one.", source: "Sampreeth/Unsloth/SFT_unsloth.py:135" },
    { title: "A score per token", body: "Loaded through Unsloth, the reward model can answer with a score per token. The reward function keeps the first, so each reply gets one number.", source: "Sampreeth/Unsloth/grpo_unsloth.py:219" },
    { title: "A premise runs long", body: "Only the first 470 words of a premise go in, so prompt and reply fit in 768 tokens.", source: "Sampreeth/Unsloth/SFT_unsloth.py:74" },
  ],
  tuned: [
    { title: "4 bit base, LoRA on top", body: "NF4 with double quantization keeps an 8B model trainable, and rank stabilized LoRA at rank 64 does the learning.", source: "Sampreeth/Unsloth/SFT_unsloth.py:50" },
    { title: "Four samples per premise", body: "GRPO compares four replies of up to 256 tokens from a 512 token prompt, so the judge ranks within a group.", source: "Sampreeth/Unsloth/grpo_unsloth.py:273" },
    { title: "Sampling for eval", body: "Temperature 0.7, top p 0.9, a 1.06 repetition penalty, no repeated 4 grams and at least 180 new tokens.", source: "Sampreeth/Unsloth/SFT_unsloth.py:184" },
  ],
  guards: [
    { title: "Loss on the reply only", body: "Prompt tokens get the ignore label, so the model learns to answer and never to echo the premise.", source: "Sampreeth/Unsloth/SFT_unsloth.py:95" },
    { title: "Reward path smoke test", body: "Before GRPO trains, the reward function scores a dummy reply and must print one float.", source: "Sampreeth/Unsloth/grpo_unsloth.py:240" },
    { title: "One base for every stage", body: "SFT, the reward model and GRPO load the same 4 bit Llama 3 8B, so scores never drift from a mismatched start.", source: "Sampreeth/Unsloth/grpo_unsloth.py:49" },
  ],
  cost: null,
  live: {
    mode: "event",
    label: "A premise through training",
    everySeconds: 14,
    path: ["pairs", "sft", "grpo", "reward", "grpo", "eval", "wandb"],
    source: "a training job started by hand on the cluster",
  },
};

export default arch;
