import type { Tour } from "./types";

export const scanValidator: Tour = {
  slug: "scan-validator",
  name: "CBCT Scan Validator",
  tail: "A pass, review or reject on every scan as it lands.",
  post: "/posts/cbct-scan-validator",
  cover: "/cbct-validator.png",
  kicker: "Medical imaging AI · Quality gate",
  accent: "#5B8DEF",
  accentRgb: "91, 141, 239",
  pitch:
    "An AI quality gate that inspects every incoming dental CBCT scan the moment it lands and returns a pass, review, or reject verdict, with the specific defect class and the exact action a technician should take, ideally before the patient leaves the chair.",
  problem:
    "Bad scans had been slipping through for a decade: movement blur, cut-off fields of view, scanner artifacts. Each one discovered late costs a design-queue slot and a patient recall. A vendor quoted $98,200 upfront plus $2,200 a month to solve it. The bet: build it in-house on commodity cloud for two orders of magnitude less.",
  metrics: [
    { label: "Cost vs vendor", value: "~$50/mo", sub: "vs $124,600 vendor year one, ~99% cheaper over 3 years" },
    { label: "Best AUROC", value: "0.82", sub: "patient-grouped, leakage-free eval, 191 scans" },
    { label: "Inference", value: "2.2 s", sub: "OpenVINO on CPU, scale-to-zero Cloud Run" },
    { label: "CI gate", value: "85%", sub: "accuracy on a fixed holdout or the build fails" },
  ],
  concepts: ["3D medical imaging", "Anomaly detection", "Active learning", "Train/inference parity", "Model benchmarking", "Continuous training gates", "Honest evals"],
  stack: ["PyTorch", "MONAI", "nnU-Net encoder", "OpenVINO", "FastAPI", "Cloud Run", "DVC", "W&B", "MLflow", "GitHub Actions"],
  steps: [
    {
      title: "A scan lands",
      body: "Studies arrive from the scanner via a chrooted SFTP endpoint or a scheduled drive mirror. An object-finalize event wakes the inference service, which scales from zero. Everything here is synthetic; real scans never leave the private environment.",
      screen: {
        kind: "upload",
        filename: "SYNTH-0042.zip · DICOM series",
        stage: "event received · preprocessing",
        progress: 35,
      },
    },
    {
      title: "One ETL for training and serving",
      body: "The DICOM series is HU-windowed, depth-sampled, and resampled to a fixed tensor. The exact same versioned ETL code produces training tensors and production inputs, so the model can never be surprised by preprocessing drift. Bumping the ETL version invalidates every cached tensor.",
      screen: {
        kind: "terminal",
        title: "ETL v1.1.0",
        lines: [
          "$ process_dicom_study SYNTH-0042",
          "read 486 native slices · window HU(c=1024, w=4096)",
          "resample → tensor (1, 64, 224, 224) · 2.98 s",
          "header facts: native_slices=486 · matrix=536 · scanner=DemoUnit 100",
        ],
      },
    },
    {
      title: "Rules catch what resampling erases",
      body: "Two defect types, a starved slice count and a cut-off field of view, are structurally invisible after resampling: the model literally cannot see them. Deterministic header rules run before the model and catch them from DICOM metadata alone. Knowing where your model is blind is half the system.",
      screen: {
        kind: "table",
        title: "Header rule layer",
        headers: ["Check", "Value", "Reference", "Result"],
        rows: [
          ["Native slice count", "486", "good scans: 325 to 652", { text: "pass", tone: "good" }],
          ["Native matrix / FOV", "536", "minimum threshold", { text: "pass", tone: "good" }],
          ["(Counter-example) lack_of_files", "76 slices", "below floor", { text: "reject on rule alone", tone: "bad" }],
        ],
      },
    },
    {
      title: "Inference and a conservative verdict",
      body: "A frozen encoder feeds a slice-sequence head that emits an anomaly score and a full 13-class distribution. Confidence gates decide the route: auto-decide at 0.80 and above, human review at 0.50 to 0.80. This synthetic case peaks at movement with 0.62 confidence, so it routes to review with a hypothesis instead of auto-rejecting on a guess.",
      screen: {
        kind: "upload",
        filename: "SYNTH-0042.zip",
        stage: "inference complete · 2.21 s (OpenVINO, CPU)",
        progress: 100,
        verdict: {
          label: "Review · likely movement (confidence 0.62)",
          tone: "warn",
          details: [
            { name: "anomaly score", value: "0.71 (τ = 0.15)", tone: "warn" },
            { name: "movement", value: "0.62", tone: "warn" },
            { name: "scatter", value: "0.11" },
            { name: "good", value: "0.09" },
            { name: "action", value: "rescan: reposition patient", tone: "warn" },
            { name: "family", value: "patient related" },
          ],
        },
      },
    },
    {
      title: "Human review feeds the flywheel",
      body: "A reviewer sees the montage, the class hypothesis, and the SOP action, then records the true verdict in one click. That label lands in the dataset for the next retrain, and the dashboard's confusion matrix updates live, with missed-bad scans highlighted as the number that matters most.",
      screen: {
        kind: "table",
        title: "Reviewer dashboard · confusion matrix (synthetic)",
        headers: ["", "Model: good", "Model: bad"],
        rows: [
          ["Truth: good", { text: "118", tone: "good" }, "9"],
          ["Truth: bad", { text: "14 missed", tone: "bad" }, { text: "44", tone: "good" }],
        ],
      },
    },
    {
      title: "CI that fails on model quality",
      body: "Every push runs lint, tests, and a six-architecture smoke. A continuous-training regression scores a fixed 20-scan holdout and fails the build below 85% accuracy, so a bad model cannot ship by accident. Releases are version tags that rebuild and redeploy everything. The documented conclusion after benchmarking six architectures: the ceiling is data, not architecture.",
      screen: {
        kind: "terminal",
        title: "CI / CT",
        lines: [
          "$ git tag v1.4.0 && git push --tags",
          "lint ✓ · 6-arch smoke ✓ · pytest ✓",
          "CT regression: holdout 20 scans → accuracy 90% (gate: 85%) ✓",
          "build images → registry → deploy service + jobs ✓",
        ],
      },
    },
  ],
  architecture: [
    { lane: "Training", items: ["PyTorch + Lightning + MONAI, six benchmarked architectures", "Frozen nnU-Net encoder + slice-sequence head", "DVC data versions · W&B and MLflow tracking"] },
    { lane: "Serving", items: ["FastAPI on Cloud Run, CPU only, scale to zero", "PyTorch → ONNX → OpenVINO IR baked into the image", "2.2 s encoder pass · ~20 s event to verdict"] },
    { lane: "Data flow", items: ["SFTP endpoint + scheduled drive mirror into object storage", "Lifecycle prefixes: intake, tensors, checkpoints, holdout, archive", "Idempotent, self-healing sync with quarantine on repeat failure"] },
    { lane: "Guardrails", items: ["Header rules for defects the model cannot see", "Confidence gates: 0.80 auto, 0.50 review", "85% CT gate in CI · tag-triggered releases"] },
  ],
  outcome:
    "Shipped about eight weeks ahead of the original schedule, at roughly $50 a month against a vendor's $124,600 first year. The honest part: after cleaning label leakage the best model sits at 0.82 AUROC, the benchmark showed the ceiling is training data rather than architecture, and the system is framed accordingly, a workflow quality gate with a human in the loop, not a diagnostic device. Every scan, name, and number in this tour is synthetic.",
};
