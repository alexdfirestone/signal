const usernameArg = process.argv.find((argument) => argument.startsWith("--username="));
const username = usernameArg?.slice("--username=".length).trim().replace(/^@/, "");

if (!username || !/^[A-Za-z0-9_]{1,15}$/.test(username)) {
  throw new Error("Usage: npm run verify:account -- --username=handle");
}

async function getProviderProfile() {
  const apiKey = process.env.TWITTERAPI_IO_API_KEY;
  if (!apiKey) throw new Error("TWITTERAPI_IO_API_KEY is not available in .env.local");
  const query = new URLSearchParams({ userName: username });
  const response = await fetch(`https://api.twitterapi.io/twitter/user/info?${query}`, {
    headers: { "X-API-Key": apiKey },
  });
  if (!response.ok) throw new Error(`twitterapi.io ${response.status}: ${await response.text()}`);
  const result = await response.json();
  if (result.status !== "success" || !result.data?.id) throw new Error(result.msg || `@${username} was not found by twitterapi.io`);
  return result.data;
}

async function getXProfile() {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) throw new Error("X_BEARER_TOKEN is not available in .env.local");
  const query = new URLSearchParams({ "user.fields": "public_metrics" });
  const response = await fetch(`https://api.x.com/2/users/by/username/${encodeURIComponent(username)}?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`X API ${response.status}: ${await response.text()}`);
  const result = await response.json();
  if (!result.data) throw new Error(`@${username} was not found by the official X API`);
  return result.data;
}

const provider = await getProviderProfile();
const x = await getXProfile();
const comparisons = [
  ["Followers", provider.followers, x.public_metrics?.followers_count],
  ["Following", provider.following, x.public_metrics?.following_count],
];

process.stdout.write(`Count comparison for @${username}\n`);
process.stdout.write("Source             Followers       Following\n");
process.stdout.write(`twitterapi.io       ${String(provider.followers ?? "n/a").padEnd(15)} ${provider.following ?? "n/a"}\n`);
process.stdout.write(`Official X API      ${String(x.public_metrics?.followers_count ?? "n/a").padEnd(15)} ${x.public_metrics?.following_count ?? "n/a"}\n`);
for (const [label, providerValue, xValue] of comparisons) {
  process.stdout.write(`${label}: ${providerValue === xValue ? "match" : `DIFFERENCE (${providerValue ?? "n/a"} vs ${xValue ?? "n/a"})`}\n`);
}
process.stdout.write("This uses one official X profile lookup only; it does not fetch the account's following list from X. Based on the current official read pricing, budget about $0.01 for the X lookup.\n");
