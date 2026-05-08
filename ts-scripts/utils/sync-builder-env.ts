import fs from "fs";
import path from "path";

const network = process.argv[2] || process.env.SUI_NETWORK || "localnet";
const publishJsonArg = process.argv[3];

const root = process.cwd();
const envPath = path.join(root, ".env");
const worldIdsPath = path.join(root, "deployments", network, "extracted-object-ids.json");
const publishJsonPath =
  publishJsonArg || path.join(root, "deployments", network, "publish-output.json");

const forbiddenWorldModules = new Set([
  "access",
  "assembly",
  "character",
  "energy",
  "fuel",
  "gate",
  "inventory",
  "killmail",
  "location",
  "network_node",
  "object_registry",
  "storage_unit",
  "turret",
  "world",
]);

function fail(message: string): never {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function readJson(filePath: string) {
  if (!fs.existsSync(filePath)) fail(`Missing file: ${filePath}`);

  const raw = fs.readFileSync(filePath, "utf8").trim();

  try {
    return JSON.parse(raw);
  } catch {
    fail(
      `${filePath} is not valid JSON.\n\n` +
          `First line:\n${raw.split("\n")[0]}`
    );
  }
}

function upsertEnv(envText: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const regex = new RegExp(`^${key}=.*$`, "m");

  if (regex.test(envText)) return envText.replace(regex, line);
  return `${envText.trimEnd()}\n${line}\n`;
}

function getObjectChanges(publishOutput: any): any[] {
  return publishOutput.objectChanges || publishOutput.effects?.objectChanges || [];
}

function getPublishedChange(publishOutput: any): any | null {
  const changes = getObjectChanges(publishOutput);
  return changes.find((change: any) => change.type === "published" && change.packageId) || null;
}

function findBuilderPackageId(publishOutput: any): string | null {
  const published = getPublishedChange(publishOutput);
  return published?.packageId || null;
}

function findExtensionConfigId(publishOutput: any): string | null {
  const changes = getObjectChanges(publishOutput);

  const config = changes.find(
    (change: any) =>
      typeof change.objectType === "string" &&
      change.objectType.endsWith("config::ExtensionConfig")
  );

  return config?.objectId || null;
}

function validateExtensionPublish(publishOutput: any) {
  const published = getPublishedChange(publishOutput);

  if (!published) {
    fail("Publish output does not contain a published package change.");
  }

  const modules: string[] = published.modules || [];
  const badModules = modules.filter((m) => forbiddenWorldModules.has(m));

  if (badModules.length > 0) {
    fail(
      `This publish output looks like it republished World, not just the extension.\n\n` +
        `Forbidden world modules found: ${badModules.join(", ")}\n\n` +
        `Likely cause:\n` +
        `- You used --with-unpublished-dependencies, or\n` +
        `- your Pub.localnet.toml did not contain the already-published World dependency.\n\n` +
        `Fix:\n` +
        `1. Restore builder-scaffold/deployments/${network}/Pub.${network}.toml from world-contracts/contracts/world/Pub.${network}.toml\n` +
        `2. Republish the extension WITHOUT --with-unpublished-dependencies\n` +
        `3. Rerun pnpm sync-builder-env ${network}`
    );
  }
}

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(path.join(root, ".env.example"))) {
    fs.copyFileSync(path.join(root, ".env.example"), envPath);
    console.log("Created .env from .env.example");
  } else {
    fail("Missing .env and .env.example");
  }
}

const worldIds = readJson(worldIdsPath);
const publishOutput = readJson(publishJsonPath);

validateExtensionPublish(publishOutput);

const worldPackageId = worldIds.world?.packageId;
const builderPackageId = findBuilderPackageId(publishOutput);
const extensionConfigId = findExtensionConfigId(publishOutput);

if (!worldPackageId) fail(`Could not find world.packageId in ${worldIdsPath}`);
if (!builderPackageId) fail(`Could not find BUILDER_PACKAGE_ID in ${publishJsonPath}`);
if (!extensionConfigId) fail(`Could not find EXTENSION_CONFIG_ID in ${publishJsonPath}`);

let envText = fs.readFileSync(envPath, "utf8");

const updates: Record<string, string> = {
  SUI_NETWORK: network,
  WORLD_PACKAGE_ID: worldPackageId,
  BUILDER_PACKAGE_ID: builderPackageId,
  EXTENSION_CONFIG_ID: extensionConfigId,
};

for (const [key, value] of Object.entries(updates)) {
  envText = upsertEnv(envText, key, value);
}

fs.writeFileSync(envPath, envText);

console.log(`\n✅ Synced builder-scaffold .env for ${network}\n`);
for (const [key, value] of Object.entries(updates)) {
  console.log(`${key}=${value}`);
}

console.log("\nSanity check passed: publish output does not look like a republished World package.");
console.log("\nNext:");
console.log("pnpm configure-rules");
console.log("pnpm authorise-gate-extension");
