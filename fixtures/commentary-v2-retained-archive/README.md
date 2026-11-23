# Synthetic retained archive fixture

This file pins the source of an inert GitHub Actions archive used by Commentary staging QA. The associated report contains a fabricated passing assertion. The workflow only publishes a disposable ZIP of that report. It reads no credentials beyond the ephemeral repository checkout token and never runs a release or deployment.
