export type XUser = {
  id: string;
  username: string;
  name: string;
  description?: string;
  profile_image_url?: string;
  public_metrics?: { following_count?: number; followers_count?: number };
};

const providerBaseUrl = "https://api.twitterapi.io";
const creditsPerUsd = 100_000;

async function providerRequest<T>(path: string): Promise<T> {
  const apiKey = process.env.TWITTERAPI_IO_API_KEY;
  if (!apiKey) throw new Error("TWITTERAPI_IO_API_KEY is not configured");
  const response = await fetch(`${providerBaseUrl}${path}`, {
    headers: { "X-API-Key": apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`twitterapi.io ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

function asXUser(user: {
  id: string;
  userName: string;
  name: string;
  description?: string;
  profilePicture?: string;
  followers?: number;
  following?: number;
}): XUser {
  return {
    id: user.id,
    username: user.userName,
    name: user.name,
    description: user.description,
    profile_image_url: user.profilePicture,
    public_metrics: { followers_count: user.followers, following_count: user.following },
  };
}

export async function lookupXUser(username: string): Promise<XUser> {
  const query = new URLSearchParams({ userName: username });
  const result = await providerRequest<{
    data?: { id: string; userName: string; name: string; description?: string; profilePicture?: string; followers?: number; following?: number };
    status?: string;
    msg?: string;
  }>(`/twitter/user/info?${query}`);
  if (result.status !== "success" || !result.data?.id) {
    throw new Error(result.msg || `X account @${username} was not found`);
  }
  return asXUser(result.data);
}

export async function lookupOfficialXUser(username: string): Promise<XUser> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) throw new Error("X_BEARER_TOKEN is not configured; add it only if you want to compare counts with X directly");
  const query = new URLSearchParams({ "user.fields": "description,profile_image_url,public_metrics" });
  const response = await fetch(`https://api.x.com/2/users/by/username/${encodeURIComponent(username)}?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`X API ${response.status}: ${await response.text()}`);
  const result = await response.json() as { data?: XUser };
  if (!result.data) throw new Error(`X account @${username} was not found`);
  return result.data;
}

export function getFollowingScanLimit() {
  const configured = Number.parseInt(process.env.TWITTERAPI_IO_MAX_RESULTS_PER_ACCOUNT ?? "30", 10);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, 100_000) : 0;
}

export async function getFollowing(username: string, maxResults = getFollowingScanLimit()) {
  return getFollowingByUsername(username, maxResults);
}

export async function getFollowingByUsername(username: string, maxResults = getFollowingScanLimit()) {
  if (maxResults < 1) {
    throw new Error("Following scans are paused. Set TWITTERAPI_IO_MAX_RESULTS_PER_ACCOUNT to an explicit result limit.");
  }
  const users: XUser[] = [];
  let cursor = "";
  while (users.length < maxResults) {
    const pageSize = Math.min(200, Math.max(20, maxResults - users.length));
    const query = new URLSearchParams({ userName: username, pageSize: String(pageSize), cursor });
    const result = await providerRequest<{
      followings?: Array<{ id: string; userName: string; name: string; description?: string; profilePicture?: string; followers?: number; following?: number }>;
      has_next_page?: boolean;
      next_cursor?: string;
      status?: string;
      message?: string;
    }>(`/twitter/user/followings?${query}`);
    if (result.status === "error") throw new Error(result.message || `Could not fetch followings for @${username}`);
    const page = (result.followings ?? []).map(asXUser);
    users.push(...page.slice(0, maxResults - users.length));
    if (!result.has_next_page || !result.next_cursor || page.length === 0) break;
    cursor = result.next_cursor;
  }
  return users;
}

const providerProfileUsd = 0.18 / 1000;

export function estimateFollowingReadCost(resultLimit: number, accountCount: number) {
  // Provider charges per returned profile: 1 credit at a full 200-result page,
  // 2 credits for 100–199 results, and 3 credits for 20–99 results.
  const fullPages = Math.floor(resultLimit / 200);
  const remainder = resultLimit % 200;
  const creditsPerAccount = fullPages * 200 + (remainder >= 100 ? remainder * 2 : remainder > 0 ? Math.max(20, remainder) * 3 : 0);
  return creditsPerAccount * accountCount / creditsPerUsd;
}

export function estimateUserLookupCost(accountCount: number) {
  return accountCount * providerProfileUsd;
}
