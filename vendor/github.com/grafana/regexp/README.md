# Grafana Go regexp package
This repo is a fork of the upstream Go `regexp` package, with some code optimisations to make it run faster.

All the optimisations have been submitted upstream, but not yet merged.

All semantics are the same, and the optimised code passes all tests from upstream.

The `main` branch is non-optimised: switch over to [`speedup`](https://github.com/grafana/regexp/tree/speedup) branch for the improved code.

## Benchmarks:

![image](https://user-images.githubusercontent.com/8125524/152182951-856549ed-6044-4285-b799-69b31f598e32.png)
