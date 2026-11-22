import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const environment = 'commentary-v2-public-release-fixture';
const staging = 'https://staging.commentary.dev';
const sha256 = /^[a-f0-9]{64}$/u;
const digest = async file => createHash('sha256').update(await readFile(new URL(file, import.meta.url))).digest('hex');

async function authorize(binding, candidate, artifactSha256, digestA) {
  const manifest = candidate.manifest;
  if (artifactSha256 !== digestA || manifest.artifact?.sha256 !== artifactSha256 || manifest.artifact?.kind !== 'file') {
    throw new Error('Actual fixture artifact differs from the approved candidate.');
  }
  const { GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, ACTIONS_ID_TOKEN_REQUEST_TOKEN, ACTIONS_ID_TOKEN_REQUEST_URL } = process.env;
  if (![GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT].every(value => /^\d+$/u.test(value ?? '')) || !ACTIONS_ID_TOKEN_REQUEST_TOKEN || !ACTIONS_ID_TOKEN_REQUEST_URL) {
    throw new Error('GitHub Actions workload context is unavailable.');
  }
  const oidc = new URL(ACTIONS_ID_TOKEN_REQUEST_URL);
  if (oidc.protocol !== 'https:' || !oidc.hostname.endsWith('.actions.githubusercontent.com')) throw new Error('Unexpected OIDC endpoint.');
  oidc.searchParams.set('audience', 'commentary:release-workload:v1');
  const proof = await fetch(oidc, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}` } });
  if (!proof.ok) throw new Error('GitHub workload proof is unavailable.');
  const { value } = await proof.json();
  if (typeof value !== 'string' || value.length > 16_384) throw new Error('GitHub workload proof is invalid.');
  const response = await fetch(`${staging}/api/workloads/release-integrations/${binding}/authorize`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(35_000),
    headers: { Authorization: `Bearer ${value}`, 'Content-Type': 'application/json', 'Idempotency-Key': `public-fixture-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}` },
    body: JSON.stringify({ candidateId: candidate.id, candidateSha256: candidate.sha256, purpose: 'release', artifactSha256,
      configurationSha256: manifest.configurationSha256, featureStateSha256: manifest.featureStateSha256, dependencyManifestSha256: manifest.dependencyManifestSha256 }) });
  if (!response.ok) throw new Error(`The staging workload held with status ${response.status}.`);
  const { usable, receipt } = await response.json();
  if (!usable || receipt?.outcome !== 'allowed' || receipt.candidateId !== candidate.id || receipt.candidateSha256 !== candidate.sha256
    || receipt.environment !== environment || receipt.purpose !== 'release' || receipt.provenance !== 'online_evaluation'
    || receipt.attemptId !== `${GITHUB_RUN_ID}:${GITHUB_RUN_ATTEMPT}:release` || !(Date.parse(receipt.expiresAt) > Date.now())) {
    throw new Error('The current exact authorization is unavailable.');
  }
  console.log('RESULT: Artifact A has current online authorization for this fixture attempt.');
}

try {
  const [A, B, configurationSha256, featureStateSha256, dependencyManifestSha256] = await Promise.all(
    ['candidate-a.txt', 'candidate-b.txt', 'configuration.json', 'features.json', 'dependencies.json'].map(digest));
  if (A === B) throw new Error('The two inert fixture artifacts must differ.');
  const mode = process.argv[2];
  if (!mode) {
    console.log(JSON.stringify({ A, B, configurationSha256, featureStateSha256, dependencyManifestSha256 }));
  } else if (mode === '--published') {
    if (A !== process.env.ARTIFACT_A_DIGEST?.replace(/^sha256:/u, '') || B !== process.env.ARTIFACT_B_DIGEST?.replace(/^sha256:/u, '')) {
      throw new Error('Provider-reported digests differ from the fixture source.');
    }
    console.log('RESULT: GitHub independently records both exact artifact digests.');
  } else if (mode === '--observe') {
    const binding = process.env.FIXTURE_BINDING;
    const candidateInput = process.env.FIXTURE_CANDIDATE;
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(binding ?? '') || !candidateInput || Buffer.byteLength(candidateInput) > 8_000) {
      throw new Error('An exact consent and candidate are required.');
    }
    const candidate = JSON.parse(candidateInput);
    const manifest = candidate.manifest;
    if (!/^[\w:.-]{1,160}$/u.test(candidate?.id) || !sha256.test(candidate?.sha256) || manifest?.environment !== environment || manifest?.build?.provider !== 'github'
      || manifest.configurationSha256 !== configurationSha256 || manifest.featureStateSha256 !== featureStateSha256 || manifest.dependencyManifestSha256 !== dependencyManifestSha256) {
      throw new Error('Candidate scope and exact fixture inputs do not agree.');
    }
    try {
      await authorize(binding, candidate, B, A);
      throw new Error('The substituted artifact unexpectedly passed.');
    } catch (error) {
      if (error.message !== 'Actual fixture artifact differs from the approved candidate.') throw error;
    }
    console.log('RESULT: Artifact B held locally before asking for workload proof.');
    await authorize(binding, candidate, A, A);
  } else {
    throw new Error('Unknown fixture mode.');
  }
} catch (error) {
  console.error(`Fixture held: ${error instanceof SyntaxError || error instanceof TypeError ? 'invalid or unavailable fixture input' : error.message}`);
  process.exitCode = 1;
}
