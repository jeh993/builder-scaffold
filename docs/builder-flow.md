# Builder flow

End-to-end flow to test builder-scaffold against world-contracts.

**Choose one path, then follow that guide’s steps from start to finish:**

| Choice | Guide | When to use it |
|--------|--------|----------------|
| **Docker** | [builder-flow-docker.md](./builder-flow-docker.md) | No Sui/Node on your machine; run everything in a container (local or testnet). |
| **Host** | [builder-flow-host.md](./builder-flow-host.md) | Sui CLI and Node.js on your machine; target local or testnet from the host. |

**Path convention:** Ensure **world-contracts** is a sibling of **builder-scaffold** in your workspace (e.g. `workspace/world-contracts` and `workspace/builder-scaffold` on host, or `/workspace/world-contracts` and `/workspace/builder-scaffold` in Docker). All commands use paths relative to that layout.

---

## Copy world artifacts into builder-scaffold

```bash
NETWORK=localnet   # or testnet
mkdir -p ../builder-scaffold/deployments/$NETWORK/
cp -r deployments/* ../builder-scaffold/deployments/
cp test-resources.json ../builder-scaffold/test-resources.json
cp "contracts/world/Pub.localnet.toml" "../builder-scaffold/deployments/localnet/Pub.localnet.toml"
```

<a id="publish-custom-contract"></a>

## Publish custom contract

Use any example (e.g. **smart_gate_extension** or **storage_unit_extension**) from `move-contracts/`:

```bash
# In host , move to the builder-scaffold root directory first
cd move-contracts/smart_gate_extension   # or storage_unit_extension, or your package
```

- **Localnet:**  
  `sui client test-publish --build-env testnet --pubfile-path ../../deployments/localnet/Pub.localnet.toml`
- **Testnet:**  
  `sui client publish -e testnet`


<a id="configure-builder-scaffold-env"></a>

## Configure builder-scaffold .env

```bash
cd ../../
# From builder scaffold root 
cp .env.example .env
```
Set the following keys in .env:

Use the same keys/addresses used during world deployment
SUI_NETWORK = testnet or localnet

After publishing the extension package, automatically sync deployment artifacts into .env:

pnpm sync-builder-env <network>
# Example:
pnpm sync-builder-env localnet

This command reads:

deployments/<network>/extracted-object-ids.json
deployments/<network>/publish-output.json

and updates:
- WORLD_PACKAGE_ID
- BUILDER_PACKAGE_ID
- EXTENSION_CONFIG_ID
- SUI_NETWORK

# Important

Do not publish extensions with:

`--with-unpublished-dependencies

when World has already been deployed.

Doing so may republish World dependencies into a new package ID, causing confusing Move type mismatch errors later when interacting with existing Gate, Character, and other World objects.

The sync utility also validates the publish output and warns if the extension publish appears to contain World modules unexpectedly.

## Interact with Custom Contract

From **builder-scaffold** root (e.g. for **smart_gate_extension**):

<!-- TODO: You can add references to additional example scripts when they're available -->

```bash
# from builder-scaffold root
pnpm install
pnpm configure-rules
pnpm authorise-gate-extension
pnpm authorise-storage-unit-extension
pnpm issue-tribe-jump-permit
pnpm jump-with-permit
pnpm collect-corpse-bounty
```
