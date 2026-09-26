# Frozen v0.1 verifier

`bridge.mjs` and `THIRD_PARTY_NOTICES.txt` are unchanged copies of `dist/` from
`4fc4407a3778aad9d0b71db2e1f3e8e58051570a` (the `v0.1` tag). Their byte counts and
SHA-256 digests are recorded in `provenance.json`. These are generated release
artifacts, not a second implementation of the current verifier. Do not rebuild
or edit this baseline when changing the current source.

`test/integration/compatibility.test.ts` runs this bundle against the same
disposable local EVM and identical signed endorsement as the current verifier.
The baseline is checked in so a shallow CI checkout needs no historical Git
objects or network downloads to run the comparison.

Devouch code retains the repository's MIT license. Bundled third-party
attributions and licenses are preserved in `THIRD_PARTY_NOTICES.txt` alongside
the bundle. No real wallet secret or public-chain write is used by these tests.
