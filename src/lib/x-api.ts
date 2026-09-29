type XUser = { id: string; username: string; name: string; description?: string; profile_image_url?: string };
const userFields = "user.fields=description,profile_image_url,public_metrics,created_at";

async function request<T>(path: string): Promise<T> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) throw new Error("X_BEARER_TOKEN is not configured");
  const response = await fetch(`https://api.x.com/2${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) throw new Error(`X API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export async function lookupXUser(username: string): Promise<XUser> {
  const result = await request<{ data?: XUser }>(`/users/by/username/${encodeURIComponent(username)}?${userFields}`);
  if (!result.data) throw new Error(`X account @${username} was not found`);
  return result.data;
}

export async function getFollowing(userId: string, maxPages = 10) {
  const users: XUser[] = [];
  let paginationToken = "";
  for (let page = 0; page < maxPages; page++) {
    const query = new URLSearchParams({ max_results: "1000", "user.fields": "description,profile_image_url,public_metrics,created_at" });
    if (paginationToken) query.set("pagination_token", paginationToken);
    const result = await request<{ data?: XUser[]; meta?: { next_token?: string } }>(`/users/${encodeURIComponent(userId)}/following?${query}`);
    users.push(...(result.data ?? []));
    if (!result.meta?.next_token) break;
    paginationToken = result.meta.next_token;
  }
  return users;
}
