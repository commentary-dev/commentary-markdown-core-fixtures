# Integration-purpose trial

This fixture is for the optional X14 staging trial. The prepared branch is local.
It evaluates an inert text artifact and ends at the gate result. Its workflow
has no merge, deployment, provider status, or writeback step.

## Offline verification

Run `node fixtures/commentary-v2-integration/simulate.mjs` with Node 24. It uses
the unmodified, byte-pinned gate from Commentary commit
`4c90a501fe993eda0d52de78ba62e8908af10911`. Every transport response is simulated.
It checks a valid integration receipt, a held integration request, rejection of
an allowed release receipt for the same integration request, and rejection of
the substituted file before transport. The test prints the fixture file digests
and performs no network requests.

Artifact A uses the exact file from fixture commit
`1e17ea3117d898e1a07d7bde35ea8f1bc65e171c` and GitHub build `actions:45020666047`,
attempt `1`, artifact `14754000223`. The integration configuration supplies its
own digest and fixture environment. [Original inert artifact run](https://github.com/commentary-dev/commentary-markdown-core-fixtures/actions/runs/45020666047)

## Owner trial prerequisites

- An authorized owner establishes the exact observed staging candidate for
  `commentary-v2-public-integration-fixture`. Use Artifact A and the configuration,
  features and dependency bytes from this branch. The workflow executes only on
  the named nondefault branch.
- The verified repository administrator reviews distinct `integration` consent
  for `.github/workflows/commentary-v2-integration-fixture.yml` at that branch's
  exact ref, SHA and environment, with the approved read grant. The existing
  release fixture consent belongs to a different workflow and environment.
- The eligible reviewer uses native Commentary controls for the exact candidate
  and `integration` purpose. Preserve separate evidence for a held attempt where
  the exact integration requirement is unmet and only a release Decision exists.
  Use distinct GitHub workflow attempts for the held and allowed observations.
- The owner controls workflow publication, environment access, and test activation.
  The workflow's optional observation requires the owner-approved `observe` mode,
  the exact workflow SHA, binding ID and candidate record named in the YAML.
  Without those values only the offline job is eligible. No configuration was
  enabled during fixture preparation.

Record the pinned app image, candidate hash, workflow ref/SHA, run and attempt,
and observed allowed or held result. Record the check of the original ordinary
PR review independently. A held gate exits nonzero. A simulated result supplies
evidence about the consumer only. [Integration purpose semantics](https://github.com/srulyt/commentary/blob/4c90a501fe993eda0d52de78ba62e8908af10911/docs/engineering/release-integrations.md)
