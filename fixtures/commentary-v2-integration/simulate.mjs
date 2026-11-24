import assert from "node:assert/strict";
import { mkdtemp, rm, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fileDigest, runGate } from "./vendor/gate.mjs";

const fixtureFile = path => fileURLToPath(new URL(path, import.meta.url));
const gateDigest = "c514d61f6d75ef365d57f137a566e4cefc215111f985edd074d7de939ce1c176";
const artifactDigest = "f0edfbb1d89b57fe3f07e32479b953222254f396f27ce34ed360c8d93730d7a0";
const environment = "commentary-v2-public-integration-fixture";
const vendorDigest = await fileDigest(fixtureFile("./vendor/gate.mjs"));
assert.equal(vendorDigest, gateDigest, "The pinned unmodified consumer is required.");

const paths = {
  artifact: fixtureFile("../commentary-v2-release/candidate-a.txt"),
  configuration: fixtureFile("./configuration.json"),
  features: fixtureFile("../commentary-v2-release/features.json"),
  dependencies: fixtureFile("../commentary-v2-release/dependencies.json"),
};
const digests = {
  artifactSha256: await fileDigest(paths.artifact),
  configurationSha256: await fileDigest(paths.configuration),
  featureStateSha256: await fileDigest(paths.features),
  dependencyManifestSha256: await fileDigest(paths.dependencies),
};
assert.equal(digests.artifactSha256, artifactDigest, "Use the exact previously published inert file.");

const temp = await mkdtemp(join(tmpdir(), "commentary-x14-"));
const candidatePath = join(temp, "synthetic-candidate.json");
const candidate = { id: "candidate-integration-fixture", sha256: "a".repeat(64), manifest: {
  environment, build: { provider: "github" }, artifact: { kind: "file", sha256: digests.artifactSha256 },
  configurationSha256: digests.configurationSha256,
  featureStateSha256: digests.featureStateSha256,
  dependencyManifestSha256: digests.dependencyManifestSha256,
} };
const options = {
  ...paths, candidate: candidatePath, url: "https://staging.commentary.dev", integration: "integration-fixture", key: "offline-fixture-attempt",
  purpose: "integration", mode: "authorize",
};
const env = { GITHUB_RUN_ID: "9001", GITHUB_RUN_ATTEMPT: "1",
  ACTIONS_ID_TOKEN_REQUEST_URL: "https://fixture.actions.githubusercontent.com/synthetic-token",
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: "inert-placeholder",
};
let calls = 0;
function simulator(outcome, purpose = "integration") {
  return async (url, request) => {
    calls++;
    if (url.hostname === "fixture.actions.githubusercontent.com") {
      assert.equal(url.searchParams.get("audience"), "commentary:release-workload:v1");
      return Response.json({ value: "inert-placeholder" });
    }
    assert.equal(url.origin, options.url);
    assert.equal(url.pathname, `/api/workloads/release-integrations/${options.integration}/authorize`);
    assert.equal(request.method, "POST");
    assert.deepEqual(JSON.parse(request.body), { candidateId: candidate.id, candidateSha256: candidate.sha256, purpose: "integration", ...digests });
    return Response.json({ usable: outcome === "allowed", receipt: { id: "local-case-receipt", candidateId: candidate.id,
      candidateSha256: candidate.sha256, purpose, environment, attemptId: `${env.GITHUB_RUN_ID}:${env.GITHUB_RUN_ATTEMPT}:${purpose}`,
      outcome, provenance: "online_evaluation", expiresAt: new Date(Date.now() + 90_000).toISOString() } });
  };
}

try {
  await writeFile(candidatePath, JSON.stringify(candidate));
  assert.equal((await runGate(options, { env, fetcher: simulator("allowed") })).outcome, "allowed");
  assert.equal(calls, 2);
  await assert.rejects(runGate(options, { env, fetcher: simulator("blocked") }), /Release blocked or indeterminate/u);
  assert.equal(calls, 4);
  await assert.rejects(runGate(options, { env, fetcher: simulator("allowed", "release") }), /Exact current attempt receipt unavailable/u);
  assert.equal(calls, 6);
  const substitution = { ...options, artifact: fixtureFile("../commentary-v2-release/candidate-b.txt") };
  await assert.rejects(runGate(substitution, { env, fetcher: simulator("allowed") }), /Actual artifact or configuration differs/u);
  assert.equal(calls, 6, "The file substitution must hold before the first transport call.");
  console.log(JSON.stringify({ cases: ["integration allowed", "integration blocked", "release receipt rejected", "wrong artifact rejected locally"],
    gateDigest, ...digests, networkRequests: 0 }));
} finally {
  await rm(candidatePath, { force: true });
  await rmdir(temp);
}
