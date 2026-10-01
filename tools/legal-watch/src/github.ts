const API = "https://api.github.com";
export const LABEL = "legal-watch";

interface Repo {
  readonly token: string;
  readonly repository: string; // owner/name
}

async function gh(repo: Repo, method: string, pathname: string, body?: unknown): Promise<Response> {
  return fetch(`${API}/repos/${repo.repository}${pathname}`, {
    method,
    headers: {
      authorization: `Bearer ${repo.token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function ensureLabel(repo: Repo): Promise<void> {
  const res = await gh(repo, "POST", "/labels", { name: LABEL, color: "ff9900", description: "Weekly Vietnamese crypto-law scan" });
  if (!res.ok && res.status !== 422) throw new Error(`GitHub label: HTTP ${res.status}`); // 422 = already exists
}

/**
 * One open legal-watch issue at a time: new findings are added as a comment to the open issue,
 * otherwise a new issue is opened. Returns the issue URL.
 */
export async function upsertIssue(repo: Repo, issue: { title: string; body: string }): Promise<string> {
  await ensureLabel(repo);
  const open = await gh(repo, "GET", `/issues?state=open&labels=${LABEL}&per_page=1`);
  if (!open.ok) throw new Error(`GitHub issues: HTTP ${open.status}`);
  const [existing] = (await open.json()) as { number: number; html_url: string }[];

  if (existing) {
    const res = await gh(repo, "POST", `/issues/${existing.number}/comments`, { body: `## ${issue.title}\n\n${issue.body}` });
    if (!res.ok) throw new Error(`GitHub comment: HTTP ${res.status}`);
    return existing.html_url;
  }
  const res = await gh(repo, "POST", "/issues", { title: issue.title, body: issue.body, labels: [LABEL] });
  if (!res.ok) throw new Error(`GitHub issue: HTTP ${res.status}`);
  return ((await res.json()) as { html_url: string }).html_url;
}
