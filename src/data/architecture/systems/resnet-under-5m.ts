import type { Architecture } from "../types";
import svg from "../svg/resnet-under-5m.svg?raw";

// Sources: the public repo SampreethAvvari/Resnetunder5mil (README.md,
// Report.pdf, Notebooks/), the results sheet its README links, and its
// history from the GitHub API, times converted to New York.
const arch: Architecture = {
  slug: "resnet-under-5m",
  rank: 250,
  status: "preview",
  statusNote: "Coursework, not deployed",
  name: "ResNet under 5M",
  project: "ResNet under 5M",
  kind: "system",
  disciplines: ["mle"],
  post: "/posts/resnet-under-5m",
  headline: "Classifies CIFAR-10 under 5M parameters.",
  tail: "97.12% on the test set.",
  lede:
    "CIFAR-10 images are augmented as they load and fed in batches of 128 to a four stage ResNet with 4,978,810 parameters, trained for 300 epochs. Every epoch is scored on 10,000 labeled test images, and the final model labels 10,000 hidden images in a CSV for the class leaderboard.",
  titleBlock: [
    ["System", "ResNet under 5M"],
    ["Revision", "unversioned"],
    ["Live since", "Not deployed"],
    ["Runs on", "PyTorch notebooks"],
    ["Region", "New York"],
    ["Params", "4,978,810"],
    ["Checked", "10,000 test images"],
    ["Epochs", "300"],
    ["Scale", "1 cat : any angle"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "300", unit: "epochs", label: "SGD at learning rate 0.1 on a cosine schedule, batches of 128" },
    { value: "21,190", unit: "params", label: "left under the 5,000,000 cap by the kept model" },
    { value: "88.56", unit: "%", label: "for the official ResNet18 in our runs, with more than twice the parameters" },
    { value: "93.76", unit: "%", label: "best run with flip and crop only, before AutoAugment and perspective reached 97.12%" },
  ],
  svg,
  views: [
    { id: "train", label: "One training step", focus: ["cifar", "augment", "model", "optim"], note: "Every batch of 128 is augmented on the fly, then one SGD step on a cosine schedule." },
    { id: "budget", label: "The 5M budget", focus: ["budget", "model"], note: "Trainable parameters are counted before training starts. The kept model has 4,978,810." },
    { id: "score", label: "Scoring", focus: ["model", "testset", "hidden", "predict", "board"], note: "Accuracy on 10,000 labeled test images, then a CSV of labels for 10,000 hidden ones." },
  ],
  parts: {
    cifar: {
      kind: "Public data",
      owner: "outside",
      what: "CIFAR-10 through torchvision: 50,000 training images, 5,000 in each of ten classes.",
      source: "Notebooks/ResNet26_97_best_model_1.ipynb",
    },
    augment: {
      kind: "My transform",
      owner: "mine",
      what: "Runs on every image as it loads: AutoAugment with the CIFAR-10 policy, a random 32 pixel crop with 4 pixels of padding, a horizontal flip half the time and a perspective warp half the time. It adds no parameters.",
      source: "Notebooks/ResNet26_97_best_model_1.ipynb",
    },
    model: {
      kind: "My model",
      owner: "mine",
      what: "Four stages of three residual blocks with 128, 100, 164 and 200 channels, 3 by 3 convolutions, 1 by 1 shortcuts and a 4 by 4 average pool. 4,978,810 trainable parameters.",
      source: "README.md",
    },
    budget: {
      kind: "Check",
      owner: "mine",
      what: "A cell sums every trainable parameter before the first epoch. The cap is 5,000,000 and the kept model sits 21,190 under it.",
      source: "Notebooks/ResNet26_97_best_model_1.ipynb",
    },
    optim: {
      kind: "My training loop",
      owner: "mine",
      what: "Cross entropy, SGD with momentum 0.9 and weight decay 0.0005, learning rate 0.1 on a cosine schedule over 300 epochs. Weights are saved every 10 epochs from epoch 170.",
      source: "Notebooks/ResNet26_97_best_model_1.ipynb",
    },
    testset: {
      kind: "Public data",
      owner: "outside",
      what: "The 10,000 labeled CIFAR-10 test images, 1,000 per class. Every epoch ends with accuracy on them, and the last epoch read 97.12%.",
      source: "Notebooks/ResNet26_97_best_model_1.ipynb",
    },
    predict: {
      kind: "My script",
      owner: "mine",
      what: "Scores the test set after each epoch. At the end it labels every hidden image, with the same normalization as the test set, and writes a CSV of image ID and label.",
      source: "Notebooks/ResNet26_97_best_model_1.ipynb",
    },
    hidden: {
      kind: "Course data",
      owner: "outside",
      what: "10,000 images from the course with no labels. Only the leaderboard holds the answers.",
      source: "Notebooks/ResNet26_97_best_model_1.ipynb",
    },
    board: {
      kind: "Course leaderboard",
      owner: "outside",
      what: "Holds the hidden labels and scores each submitted CSV.",
    },
  },
  breaks: [
    { title: "A run stops early", body: "Weights are saved every 10 epochs from epoch 170, so a stopped run still leaves its late checkpoints.", source: "Notebooks/ResNet26_97_best_model_1.ipynb" },
    { title: "Hidden images arrive flat", body: "Each hidden image is a row of 3,072 numbers. It is reshaped to 3 by 32 by 32 and normalized like the test set before the model sees it.", source: "Notebooks/ResNet26_97_best_model_1.ipynb" },
    { title: "The test score can flatter", body: "Two finalists were kept: the best on the labeled test set, and a slimmer ResNet24 the repo names best on unseen data.", source: "README.md" },
  ],
  tuned: [
    { title: "Uneven channel widths", body: "128, 100, 164 and 200 came from sweeping widths under the cap. The plain 16, 32, 64, 128 ladder scored 79%.", source: "Report.pdf" },
    { title: "Cosine over step", body: "In the report's comparison SGD with a step schedule peaked at 92%, and SGD with cosine annealing reached 97.12%.", source: "Report.pdf" },
    { title: "Three blocks per stage", body: "3, 3, 3, 3 blocks scored 97.12%. ResNet34's 3, 4, 6, 3 scored 91% and needed 5.3 million parameters.", source: "Report.pdf" },
  ],
  guards: [
    { title: "Counted before training", body: "The parameter count prints before the first epoch: 4,978,810 against a 5,000,000 cap.", source: "Notebooks/ResNet26_97_best_model_1.ipynb" },
    { title: "Scored images stay clean", body: "Test and hidden images get only tensor conversion and normalization. Augmentation touches training images alone.", source: "Notebooks/ResNet26_97_best_model_1.ipynb" },
    { title: "Every run in one sheet", body: "Each run is logged with its augmentation, channels, optimizer, epochs, parameter count, accuracy and who ran it.", source: "README.md" },
  ],
  cost: null,
  live: {
    mode: "event",
    label: "A batch, then a submission",
    everySeconds: 14,
    path: ["cifar", "augment", "model", "optim", "model", "predict", "board"],
    source: "a training cell run by hand in the notebook",
  },
};

export default arch;
