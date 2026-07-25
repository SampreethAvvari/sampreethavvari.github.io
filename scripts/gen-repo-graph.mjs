// Regenerate src/data/mind/repo-graph.json from the GitHub contributions graph.
//
// Runs in CI before `astro build` (see package.json). Reads GH_GRAPH_TOKEN
// (a classic PAT with repo + read:org). With no token it leaves the committed
// snapshot untouched so local builds and forks still work. Never throws non-zero
// on a fetch problem — a bad run must not break the site deploy.
//
// Output shape mirrors JobPilot's RepoGraph tab so both stay consistent:
//   { nodes: [{id,type,label,data}], edges: [{source,target,rel}] }

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../src/data/mind/repo-graph.json", import.meta.url));

const REPO_FIELDS = `
  nameWithOwner
  name
  owner { login __typename }
  isPrivate
  isFork
  description
  stargazerCount
  url
  primaryLanguage { name }
  languages(first: 8, orderBy: { field: SIZE, direction: DESC }) { nodes { name } }
  repositoryTopics(first: 8) { nodes { topic { name } } }`;

// Everything Sampreeth is part of: repos he contributed to, repos he owns, and
// repos in orgs he belongs to (e.g. Hybridge). Merged + deduped below.
const QUERY = `query {
  viewer {
    contributed: repositoriesContributedTo(first: 100, contributionTypes: [COMMIT, PULL_REQUEST, REPOSITORY], includeUserRepositories: true) {
      nodes { ${REPO_FIELDS} }
    }
    owned: repositories(first: 100, ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER], orderBy: { field: PUSHED_AT, direction: DESC }) {
      nodes { ${REPO_FIELDS} }
    }
  }
}`;

const slug = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function build(repos) {
  const nodes = new Map();
  const edges = [];
  const seen = new Set();
  const node = (id, type, label, data) => {
    if (!id || !slug(label)) return null;
    if (!nodes.has(id)) nodes.set(id, { id, type, label, data: data || {} });
    return id;
  };
  const edge = (source, target, rel) => {
    if (!source || !target) return;
    const k = `${source}|${target}|${rel}`;
    if (seen.has(k)) return;
    seen.add(k);
    edges.push({ source, target, rel });
  };

  for (const r of repos) {
    const owner = r.owner?.login || "";
    const isOrg = r.owner?.__typename === "Organization";
    const langs = (r.languages?.nodes || []).map((n) => n.name).filter(Boolean);
    const primary = r.primaryLanguage?.name || langs[0] || "";
    const topics = (r.repositoryTopics?.nodes || []).map((t) => t.topic?.name).filter(Boolean);
    const rid = node(`repo:${slug(owner)}-${slug(r.name)}`, "repo", r.name, {
      owner,
      description: r.description || "",
      stars: r.stargazerCount || 0,
      url: r.url || "",
      languages: langs,
      primary_language: primary,
      topics,
      private: !!r.isPrivate,
    });
    if (!rid) continue;
    const allLangs = [...new Set([primary, ...langs].filter(Boolean))];
    for (const lang of allLangs) {
      const lid = node(`language:${slug(lang)}`, "language", lang, {});
      edge(rid, lid, "uses-language");
    }
    if (isOrg && owner) {
      const oid = node(`org:${slug(owner)}`, "org", owner, {});
      edge(rid, oid, "owned-by-org");
    }
    for (const t of r.repositoryTopics?.nodes || []) {
      const name = t.topic?.name;
      if (!name) continue;
      const tid = node(`topic:${slug(name)}`, "topic", name, {});
      edge(rid, tid, "tagged");
    }
  }
  return { nodes: [...nodes.values()], edges };
}

async function main() {
  const token = process.env.GH_GRAPH_TOKEN;
  if (!token) {
    console.log("[mind] GH_GRAPH_TOKEN not set — keeping committed repo-graph.json");
    return;
  }
  try {
    const resp = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY }),
    });
    const json = await resp.json();
    const v = json?.data?.viewer;
    const merged = [...(v?.contributed?.nodes || []), ...(v?.owned?.nodes || [])];
    // dedup by owner/name; drop forks (not "his" work)
    const seen = new Set();
    const repos = [];
    for (const r of merged) {
      const key = r?.nameWithOwner;
      if (!key || seen.has(key) || r.isFork) continue;
      seen.add(key);
      repos.push(r);
    }
    if (repos.length === 0) {
      console.log("[mind] no repos returned (errors:", JSON.stringify(json?.errors || "none"), ") — keeping snapshot");
      return;
    }
    const graph = { ...build(repos), generatedAt: new Date().toISOString() };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(graph, null, 2) + "\n", "utf-8");
    const repoCount = graph.nodes.filter((n) => n.type === "repo").length;
    const orgCount = graph.nodes.filter((n) => n.type === "org").length;
    console.log(`[mind] wrote repo-graph.json: ${repoCount} repos, ${orgCount} orgs`);
  } catch (err) {
    console.log("[mind] fetch failed, keeping snapshot:", err?.message || err);
  }
}

main();
