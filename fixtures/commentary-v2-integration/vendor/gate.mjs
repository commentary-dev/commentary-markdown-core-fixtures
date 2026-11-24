#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const audience = "commentary:release-workload:v1";
const sha256 = /^[a-f0-9]{64}$/u;
export async function fileDigest(path) {
  const h = createHash("sha256"); let bytes = 0;
  for await (const chunk of createReadStream(path, { signal: AbortSignal.timeout(120000) })) {
    bytes += chunk.length; if (bytes > 20 * 1024 ** 3) throw new Error("Artifact exceeds the gate input limit."); h.update(chunk);
  }
  return h.digest("hex");
}
export async function ociDigest(reference) {
  if (typeof reference !== "string" || reference.length > 512 || !/^[a-zA-Z0-9][a-zA-Z0-9_./:@-]+$/u.test(reference)) throw new Error("Invalid OCI reference.");
  const { stdout } = await promisify(execFile)("docker", ["buildx", "imagetools", "inspect", reference, "--format", "{{json .Manifest}}"], { timeout: 15000, maxBuffer: 65536, windowsHide: true });
  const digest = JSON.parse(stdout).digest;
  if (typeof digest !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(digest)) throw new Error("OCI digest resolution unsupported.");
  return digest.slice(7);
}
async function jsonResponse(response) {
  if (!response.ok || !response.body) throw new Error("Online gate unavailable; hold deployment.");
  const reader = response.body.getReader(); const chunks = []; let bytes = 0;
  try { for (;;) { const { value, done } = await reader.read(); if (done) break; bytes += value.length;
    if (bytes > 65536) throw new Error("Gate response too large."); chunks.push(value); } }
  finally { await reader.cancel(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function runGate(options, { fetcher = fetch, env = process.env, resolveOci = ociDigest } = {}) {
  const base = new URL(options.url);
  if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash) throw new Error("An exact HTTPS Commentary origin is required.");
  if (!/^[\w.-]{1,160}$/u.test(options.integration ?? "") || !/^[\w:.-]{1,160}$/u.test(options.key ?? "")) throw new Error("Integration and stable idempotency key required.");
  const purpose = options.purpose ?? "release", operation = options.mode ?? "authorize";
  if (!["release","integration"].includes(purpose) || !["authorize","report"].includes(operation)) throw new Error("Unsupported gate mode.");
  const candidateBytes = await readFile(options.candidate);
  if (candidateBytes.length > 262144) throw new Error("Candidate exceeds the gate limit.");
  const c = JSON.parse(candidateBytes.toString("utf8")), m = c.manifest;
  if (!m || !sha256.test(c.sha256) || !c.id || m.build.provider !== "github" || !env.GITHUB_RUN_ID || !env.GITHUB_RUN_ATTEMPT) throw new Error("Exact GitHub candidate/run required.");
  if (Boolean(options.artifact) === Boolean(options.oci)) throw new Error("Supply exactly one actual file artifact or OCI reference.");
  const [artifactSha256, configurationSha256, featureStateSha256, dependencyManifestSha256] = await Promise.all([
    options.artifact ? fileDigest(options.artifact) : resolveOci(options.oci), fileDigest(options.configuration), fileDigest(options.features), fileDigest(options.dependencies),
  ]);
  if (m.artifact.kind !== (options.artifact ? "file" : "oci") || m.artifact.sha256 !== artifactSha256 || m.configurationSha256 !== configurationSha256
    || m.featureStateSha256 !== featureStateSha256 || m.dependencyManifestSha256 !== dependencyManifestSha256) throw new Error("Actual artifact or configuration differs from the candidate; hold deployment.");
  const oidcUrl = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  if (oidcUrl.protocol !== "https:" || !oidcUrl.hostname.endsWith(".actions.githubusercontent.com") || oidcUrl.username || oidcUrl.password || !env.ACTIONS_ID_TOKEN_REQUEST_TOKEN) throw new Error("GitHub OIDC unavailable.");
  oidcUrl.searchParams.set("audience", audience);
  const proof = await jsonResponse(await fetcher(oidcUrl, { headers: { authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` }, redirect: "error", signal: AbortSignal.timeout(10000) }));
  if (typeof proof.value !== "string" || proof.value.length > 16384) throw new Error("OIDC proof unavailable.");
  const result = await jsonResponse(await fetcher(new URL(`/api/workloads/release-integrations/${encodeURIComponent(options.integration)}/${operation}`, base), {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(45000), headers: { authorization: `Bearer ${proof.value}`, "content-type": "application/json", "idempotency-key": options.key },
    body: JSON.stringify({ candidateId: c.id, candidateSha256: c.sha256, purpose, artifactSha256, configurationSha256, featureStateSha256, dependencyManifestSha256 }),
  }));
  const r = result.receipt;
  if (!r || r.candidateId !== c.id || r.candidateSha256 !== c.sha256 || r.purpose !== purpose || r.environment !== m.environment
    || r.attemptId !== `${env.GITHUB_RUN_ID}:${env.GITHUB_RUN_ATTEMPT}:${purpose}` || !Number.isFinite(Date.parse(r.expiresAt))
    || Date.parse(r.expiresAt) <= Date.now() || Date.parse(r.expiresAt) > Date.now() + 300000) throw new Error("Exact current attempt receipt unavailable; hold deployment.");
  if (operation === "report") { if (r.outcome !== "builder_assertion" || r.provenance !== "workload_reported") throw new Error("Builder report unconfirmed."); }
  else if (r.outcome !== "allowed" || r.provenance !== "online_evaluation" || result.usable !== true) throw new Error("Release blocked or indeterminate; hold deployment.");
  return { receiptId: r.id, outcome: r.outcome, expiresAt: r.expiresAt };
}
export function parseGateArgs(args) {
  const allowed = ["url","integration","key","candidate","artifact","oci","configuration","features","dependencies","purpose","mode"];
  const options = {};
  for (let i = 0; i < args.length; i += 2) { const key = args[i]?.slice(2); if (!args[i]?.startsWith("--") || !allowed.includes(key) || !args[i + 1] || Object.hasOwn(options,key)) throw new Error("Invalid gate arguments."); options[key] = args[i + 1]; }
  return options;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length === 3 && process.argv[2] === "--help") console.log("commentary-release-gate --url HTTPS_ORIGIN --integration ID --key ATTEMPT_KEY --candidate RECORD.json (--artifact FILE | --oci REFERENCE) --configuration FILE --features FILE --dependencies FILE [--purpose release|integration] [--mode authorize|report]");
  else try { console.log(JSON.stringify(await runGate(parseGateArgs(process.argv.slice(2))))); }
  catch { console.error("Current exact gate did not succeed. Hold the action; inspect authorized Commentary diagnostics."); process.exitCode = 1; }
}
