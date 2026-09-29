import { neon } from "@neondatabase/serverless";

const accounts = [
  // Leading venture firms
  { username: "Alfred_Lin", name: "Alfred Lin (Sequoia)" },
  { username: "gradypb", name: "Pat Grady (Sequoia)" },
  { username: "shaunmmaguire", name: "Shaun Maguire (Sequoia)" },
  { username: "schreier", name: "Bryan Schreier (Sequoia)" },
  { username: "pmarca", name: "Marc Andreessen (a16z)" },
  { username: "bhorowitz", name: "Ben Horowitz (a16z)" },
  { username: "cdixon", name: "Chris Dixon (a16z)" },
  { username: "andrewchen", name: "Andrew Chen (a16z)" },
  { username: "anishacharya", name: "Anish Acharya (a16z)" },
  { username: "reidhoffman", name: "Reid Hoffman (Greylock)" },
  { username: "saammotamedi", name: "Saam Motamedi (Greylock)" },
  { username: "jerrychen", name: "Jerry Chen (Greylock)" },
  { username: "sarahtavel", name: "Sarah Tavel (Benchmark)" },

  // Seed-stage investors and angel investors with large X audiences
  { username: "paulg", name: "Paul Graham (Y Combinator co-founder)" },
  { username: "garrytan", name: "Garry Tan (Initialized / Y Combinator)" },
  { username: "rrhoover", name: "Ryan Hoover (Weekend Fund)" },
  { username: "semil", name: "Semil Shah (Haystack)" },
  { username: "dunkhippo33", name: "Elizabeth Yin (Hustle Fund)" },
  { username: "chudson", name: "Charles Hudson (Precursor Ventures)" },
  { username: "TurnerNovak", name: "Turner Novak (Banana Capital)" },
  { username: "jason", name: "Jason Calacanis (LAUNCH)" },
  { username: "naval", name: "Naval Ravikant (AngelList co-founder / angel)" },
  { username: "saranormous", name: "Sarah Guo (Conviction)" },
  { username: "eladgil", name: "Elad Gil (Gil&Co / angel)" },
  { username: "aileenlee", name: "Aileen Lee (Cowboy Ventures)" },
  { username: "alexisohanian", name: "Alexis Ohanian (Seven Seven Six)" },
  { username: "joshk", name: "Josh Kopelman (First Round Capital)" },
  { username: "hunterwalk", name: "Hunter Walk (Homebrew)" },
  { username: "roelofbotha", name: "Roelof Botha (Sequoia adviser)" },
  { username: "chamath", name: "Chamath Palihapitiya (Social Capital)" },
];

const maxTrackedAccounts = 30;
const seedBaselineLimit = 30;
const profileLookupCost = 0.18 / 1000;
const creditsPerUsd = 100_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(message) {
  process.stdout.write(`${message}\n`);
}

async function requestProvider(path) {
  const apiKey = process.env.TWITTERAPI_IO_API_KEY;
  if (!apiKey) throw new Error("TWITTERAPI_IO_API_KEY is not available in this process");
  const response = await fetch(`https://api.twitterapi.io${path}`, {
    headers: { "X-API-Key": apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`twitterapi.io ${response.status}: ${await response.text()}`);
  return response.json();
}

async function lookupUser(username) {
  const query = new URLSearchParams({ userName: username });
  const result = await requestProvider(`/twitter/user/info?${query}`);
  const user = result.data;
  if (result.status !== "success" || !user?.id) throw new Error(`twitterapi.io profile lookup failed for @${username}: ${result.msg || "account was not found"}`);
  return {
    id: user.id,
    username: user.userName,
    name: user.name,
    profile_image_url: user.profilePicture,
    public_metrics: { followers_count: user.followers, following_count: user.following },
  };
}

async function getFollowing(username, expectedFollowingCount) {
  const following = [];
  let cursor = "";
  let pageNumber = 0;
  while (following.length < expectedFollowingCount) {
    const pageSize = Math.min(200, Math.max(20, expectedFollowingCount - following.length));
    const query = new URLSearchParams({ userName: username, pageSize: String(pageSize), cursor });
    const result = await requestProvider(`/twitter/user/followings?${query}`);
    if (result.status === "error") throw new Error(result.message || `Could not fetch followings for @${username}`);
    const page = result.followings ?? [];
    pageNumber += 1;
    following.push(...page.map((user) => ({
      id: user.id,
      username: user.userName,
      name: user.name,
      description: user.description,
      profile_image_url: user.profilePicture,
    })));
    log(`  @${username}: page ${pageNumber}, ${following.length}/${expectedFollowingCount} follows loaded.`);
    if (!result.has_next_page || !result.next_cursor || page.length === 0) break;
    cursor = result.next_cursor;
  }
  return following;
}

function estimateFollowingCost(counts) {
  const totalCredits = counts.reduce((sum, count) => {
    let remaining = count;
    let credits = 0;
    while (remaining > 0) {
      const pageSize = Math.min(200, Math.max(20, remaining));
      credits += pageSize * (pageSize >= 200 ? 1 : pageSize >= 100 ? 2 : 3);
      remaining -= Math.min(pageSize, remaining);
    }
    return sum + credits;
  }, 0);
  return totalCredits / creditsPerUsd;
}

async function main() {
  const execute = process.argv.includes("--execute");
  const estimateOnly = process.argv.includes("--estimate");
  const refreshExisting = process.argv.includes("--refresh-existing");
  const budgetArg = process.argv.find((arg) => arg.startsWith("--max-cost-usd="));
  const maxCostUsd = budgetArg ? Number(budgetArg.split("=")[1]) : 0;
  if (execute && (!Number.isFinite(maxCostUsd) || maxCostUsd <= 0)) {
    throw new Error("Paid seeding is disabled without an explicit budget. Use --execute --max-cost-usd=1 after reviewing the twitterapi.io cost estimate.");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not available in this process");

  const sql = neon(process.env.DATABASE_URL);
  await sql`CREATE TABLE IF NOT EXISTS tracked_accounts (
    id text PRIMARY KEY, username text NOT NULL, name text NOT NULL, profile_image_url text,
    category text NOT NULL DEFAULT 'person', followers_count bigint,
    last_following_ids jsonb NOT NULL DEFAULT '[]'::jsonb, last_checked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE tracked_accounts ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'person'`;
  await sql`ALTER TABLE tracked_accounts ADD COLUMN IF NOT EXISTS followers_count bigint`;

  const existing = await sql`SELECT id, username, jsonb_array_length(last_following_ids) AS baseline_count FROM tracked_accounts ORDER BY created_at`;
  const existingByUsername = new Map(existing.map((account) => [account.username.toLowerCase(), account]));
  const known = new Set(existingByUsername.keys());
  const pending = accounts.filter((account) => !known.has(account.username.toLowerCase()));
  const slots = Math.max(0, maxTrackedAccounts - existing.length);
  const batch = (refreshExisting ? accounts : pending).slice(0, refreshExisting ? maxTrackedAccounts : slots);

  log(`Tracked already: ${existing.length}; new seed candidates: ${pending.length}; available slots: ${slots}${refreshExisting ? "; refreshing existing baselines" : ""}.`);
  if (!execute && !estimateOnly) {
    log("No API calls made. Seed is now dry-run by default.");
    for (const account of batch) log(`Would seed @${account.username} — ${account.name}`);
    log("Before execution, the script reads each profile from twitterapi.io and estimates following-list credits from its published page pricing. It stops before fetching following lists if the estimate exceeds the supplied budget.");
    return;
  }
  if (!process.env.TWITTERAPI_IO_API_KEY) throw new Error("TWITTERAPI_IO_API_KEY is not available in this process");

  // Profile lookups cost at most one user resource apiece. Fetch them first so
  // the complete graph estimate is checked before making any following calls.
  const profiles = [];
  const skippedProfiles = [];
  for (const account of batch) {
    try {
      const user = await lookupUser(account.username);
      const followingCount = user.public_metrics?.following_count;
      if (!Number.isFinite(followingCount)) {
        skippedProfiles.push({ username: account.username, reason: "provider omitted following count" });
        continue;
      }
      const stored = existingByUsername.get(account.username.toLowerCase());
      profiles.push({
        account,
        user,
        followingCount,
        baselineLimit: Math.min(seedBaselineLimit, followingCount),
        baselineCount: Number(stored?.baseline_count ?? 0),
        baselineComplete: Number(stored?.baseline_count ?? 0) >= Math.min(seedBaselineLimit, followingCount),
        alreadyTracked: Boolean(stored),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (/user not found|account was not found/i.test(reason)) {
        skippedProfiles.push({ username: account.username, reason });
        continue;
      }
      throw error;
    }
  }
  for (const skipped of skippedProfiles) log(`Skipping @${skipped.username}: ${skipped.reason}`);
  const profilesToFetch = profiles.filter((profile) => !profile.alreadyTracked || !profile.baselineComplete);
  const expectedCostUsd = profiles.length * profileLookupCost + estimateFollowingCost(profilesToFetch.map((profile) => profile.baselineLimit));
  const budgetText = estimateOnly && !execute ? "no execution budget (estimate only)" : `$${maxCostUsd.toFixed(2)}`;
  log(`Cost preflight: about $${expectedCostUsd.toFixed(4)} gross across ${profilesToFetch.length} baselines to fetch (up to ${seedBaselineLimit} most recent follows per account), budget ${budgetText}.`);
  if (estimateOnly && !execute) {
    log(`Estimate-only complete. No following lists fetched. Profile lookups may have cost about $${(profiles.length * profileLookupCost).toFixed(4)}.`);
    return;
  }
  if (expectedCostUsd > maxCostUsd) {
    throw new Error("Budget check stopped the seed before any following lists were fetched. Profile lookups may have cost about $" + (profiles.length * profileLookupCost).toFixed(4) + ". Increase the budget explicitly or reduce the seed list.");
  }

  let added = 0;
  let attempted = 0;
  const failures = [];
  for (const { account, user, followingCount, baselineLimit, baselineCount, baselineComplete, alreadyTracked } of profiles) {
    if (alreadyTracked && baselineComplete) {
      log(`Already initialized @${user.username}: ${baselineCount} follows in the baseline.`);
      continue;
    }
    attempted += 1;
    try {
      const following = await getFollowing(user.username, baselineLimit);
      const followersCount = user.public_metrics?.followers_count ?? null;
      await sql`INSERT INTO tracked_accounts
        (id, username, name, profile_image_url, category, followers_count, following_count, last_following_ids, last_checked_at)
        VALUES (${user.id}, ${user.username}, ${user.name}, ${user.profile_image_url ?? null}, 'investor', ${followersCount}, ${followingCount}, ${JSON.stringify(following.map((person) => person.id))}::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, name = EXCLUDED.name,
          profile_image_url = EXCLUDED.profile_image_url, category = EXCLUDED.category,
          followers_count = EXCLUDED.followers_count, following_count = EXCLUDED.following_count`;
      added += 1;
      log(`Saved @${user.username} (${user.name}); baseline: ${following.length} most recent follows (profile following count: ${followingCount}).`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push({ username: account.username, reason });
      log(`Failed @${account.username}: ${reason}`);
      if (/twitterapi\.io 401|twitterapi\.io 402|insufficient_credits|TWITTERAPI_IO_API_KEY/.test(reason)) {
        log("Stopping the batch because twitterapi.io authentication or credits are unavailable.");
        break;
      }
    }
    await sleep(250);
  }

  const notAttempted = Math.max(0, profiles.length - attempted);
  log(`Seed finished: ${added} added, ${failures.length} failed, ${notAttempted} not attempted, ${pending.length - batch.length} skipped (capacity).`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  log(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
