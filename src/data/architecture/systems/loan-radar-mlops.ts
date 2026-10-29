import type { Architecture } from "../types";
import svg from "../svg/loan-radar-mlops.svg?raw";

// Sources: github.com/ds28-ops/loan-default-risk-assessment at main (May 12, 2025).
// Ownership follows commit authorship and the README contributors table.
const arch: Architecture = {
  slug: "loan-radar-mlops",
  rank: 210,
  status: "preview",
  statusNote: "School project, not running",
  name: "Loan Radar",
  project: "Loan Radar",
  kind: "system",
  disciplines: ["mle"],
  post: "/posts/loan-radar-mlops",
  headline: "Scores loan default risk.",
  tail: "Ran on Chameleon Cloud.",
  lede:
    "Containers pull the public LendingClub loan book, fit one transform on the training rows and save it beside the data. XGBoost trains on those rows, and a FastAPI service rebuilds each uploaded loan with the same saved transform before it scores it.",
  titleBlock: [
    ["System", "Loan Radar"],
    ["Revision", "unversioned"],
    ["Live since", "Class demo, May 2025"],
    ["Runs on", "Chameleon Cloud KVM"],
    ["Region", "CHI@TACC"],
    ["Model", "XGBoost, 150 trees"],
    ["Training rows", "1.81M"],
    ["Team", "3 students"],
    ["Scale", "1 pickle : 2 pipelines"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "0.79", unit: "ms", label: "median to score one loan row, model in process, over 100 calls" },
    { value: "22,607", unit: "loans", label: "held out for the stress tests, never seen in training" },
    { value: "7", unit: "days", label: "on the calendar from the first Dockerfile to the last commit, May 5 to 11, 2025" },
    { value: "0.71", unit: "AUC", label: "ROC AUC of the served model in 2 fold cross validation" },
  ],
  svg,
  views: [
    { id: "data-path", label: "From loan book to model", focus: ["lending", "etl", "store", "train", "mlflow"], note: "Containers pull the loan book, fit the transform on training rows only, and copy rows and transform to the object store." },
    { id: "one-loan", label: "One loan scored", focus: ["officer", "web", "api", "prom"], note: "A loan file goes through Flask to FastAPI, which rebuilds it with the saved transform, scores it and records the confidence." },
    { id: "stress", label: "Stress tests", focus: ["store", "tests", "train"], note: "Five altered copies of a held out slice check how the model behaves when its top features vanish or blow up." },
    { id: "tracking", label: "Run tracking", focus: ["train", "mlflow"], note: "Training runs log parameters, metrics and the model to MLflow, which keeps them in Postgres and MinIO." },
  ],
  parts: {
    lending: {
      kind: "Public dataset",
      owner: "outside",
      what: "The LendingClub accepted loan book, 2007 to 2018, about 2 GB. Fully Paid and Current loans are labeled low risk; late, charged off and defaulted loans count as high risk.",
      source: "etl/data-split/data-split.py",
    },
    etl: {
      kind: "My pipeline",
      owner: "mine",
      what: "Docker Compose stages on a Chameleon VM. They download the CSVs, fit medians, modes, label encoders and a scaler on the training rows, apply that saved state to validation, and copy everything to the object store. The fitted state is one pickle.",
      fails: "If an expected column is missing, the transform stops and lists what is missing before it writes a file.",
      source: "etl/docker/docker-compose-etl.yaml",
    },
    store: {
      kind: "Object store",
      owner: "outside",
      what: "Chameleon's object store, mounted on the VMs. rclone loads the transformed rows, the stress test slice and the transform pickle with 32 parallel transfers.",
      source: "etl/docker/docker-compose-etl.yaml",
    },
    tests: {
      kind: "My tests",
      owner: "mine",
      what: "pytest over the model: macro and per class F1, average confidence per class, and five stress sets cut from a held out tenth of validation. The stress sets zero or inflate the top five features, zero or inflate the rest, or add noise to every feature.",
      source: "tests/test_calibration.py",
    },
    train: {
      kind: "Teammates' training",
      owner: "outside",
      what: "Teammates ran training: XGBoost with 150 trees, depth 15 and scale_pos_weight 6.4, scored with 2 fold stratified cross validation over 1,808,534 rows.",
      source: "train/train_xgboost_onnx.ipynb",
    },
    mlflow: {
      kind: "My tracking stack",
      owner: "mine",
      what: "I wrote the compose file that runs MLflow 2.20 with Postgres for run records and MinIO for artifacts, both on block storage. The same file brings up a Ray head and two 8 CPU workers.",
      source: "train/docker/docker-compose-block.yaml",
    },
    api: {
      kind: "Teammate's service",
      owner: "outside",
      what: "FastAPI on Uvicorn. It parses a key and value text file, rebuilds the row with the pickle the ETL saved, scores it with XGBoost and returns the class, the confidence and the true label when the file carries one.",
      fails: "A file that cannot be parsed or encoded comes back as an error message in the response instead of a crash.",
      source: "fastapi_pt/app.py",
    },
    prom: {
      kind: "Monitoring",
      owner: "outside",
      what: "Prometheus scrapes the API every 15 seconds: request metrics, a histogram of prediction confidence and a count per predicted class. Grafana draws them.",
      source: "eval/eval_online/docker/prometheus.yml",
    },
    web: {
      kind: "Teammate's page",
      owner: "outside",
      what: "A one page Flask app that takes a .txt loan file, forwards it to the API and shows the class, the confidence and the true label.",
      source: "flask/app.py",
    },
    officer: {
      kind: "People",
      owner: "outside",
      what: "The user our brief pictured: a credit risk officer at a regional bank or micro finance lender. In practice it was us, uploading sample loan files.",
      source: "README.md",
    },
  },
  breaks: [
    { title: "A loan field is blank", body: "The API fills it with the training median or mode saved in the pickle, so one empty field does not sink the request.", source: "fastapi_pt/app.py" },
    { title: "A category never seen before", body: "One hot columns are rebuilt from the training list and missing ones are added as zeros, so the model always gets the columns it expects.", source: "fastapi_pt/app.py" },
    { title: "An expected column is gone", body: "The transform stops and names the missing columns before it writes anything.", source: "etl/docker/docker-compose-etl.yaml" },
  ],
  tuned: [
    { title: "Fit once, load everywhere", body: "Medians, modes, encoders and the scaler are fit on training rows only. Validation and the API load the same pickle.", source: "etl/docker/docker-compose-etl.yaml" },
    { title: "Class weight from the counts", body: "Training held 1,564,054 low risk and 244,480 high risk loans. A scale_pos_weight of 6.4 matches that ratio.", source: "train/train_xgboost_onnx.ipynb" },
    { title: "Run history on block storage", body: "MLflow keeps runs in Postgres and artifacts in MinIO on mounted block storage, so the history outlives any container.", source: "train/docker/docker-compose-block.yaml" },
  ],
  guards: [
    { title: "Training statistics only", body: "Validation rows are filled, encoded and scaled with values learned from training rows, never from themselves.", source: "etl/docker/docker-compose-etl.yaml" },
    { title: "Outcome columns dropped", body: "Payment, recovery and settlement fields only exist after a loan ends, so the split drops them before anything trains.", source: "etl/data-split/data-split.py" },
    { title: "Every score is counted", body: "Each prediction feeds a confidence histogram and a per class counter that Prometheus scrapes.", source: "fastapi_pt/app.py" },
  ],
  cost: null,
  live: {
    mode: "event",
    label: "A loan file",
    everySeconds: 14,
    path: ["officer", "web", "api", "web", "officer"],
    source: "a sample loan file uploaded on the Flask page",
  },
};

export default arch;
