# Changes

## [0.9.0](https://github.com/googleapis/google-cloud-go/compare/compute/metadata/v0.8.4...compute/metadata/v0.9.0) (2025-09-24)


### Features

* **compute/metadata:** Retry on HTTP 429 ([#12932](https://github.com/googleapis/google-cloud-go/issues/12932)) ([1e91f5c](https://github.com/googleapis/google-cloud-go/commit/1e91f5c07acacd38ecdd4ff3e83e092b745e0bc2))

## [0.8.4](https://github.com/googleapis/google-cloud-go/compare/compute/metadata/v0.8.3...compute/metadata/v0.8.4) (2025-09-18)


### Bug Fixes

* **compute/metadata:** Set subClient for UseDefaultClient case ([#12911](https://github.com/googleapis/google-cloud-go/issues/12911)) ([9e2646b](https://github.com/googleapis/google-cloud-go/commit/9e2646b1821231183fd775bb107c062865eeaccd))

## [0.8.3](https://github.com/googleapis/google-cloud-go/compare/compute/metadata/v0.8.2...compute/metadata/v0.8.3) (2025-09-17)


### Bug Fixes

* **compute/metadata:** Disable Client timeouts for subscription client ([#12910](https://github.com/googleapis/google-cloud-go/issues/12910)) ([187a58a](https://github.com/googleapis/google-cloud-go/commit/187a58a540494e1e8562b046325b8cad8cf7af4a))

## [0.8.2](https://github.com/googleapis/google-cloud-go/compare/compute/metadata/v0.8.1...compute/metadata/v0.8.2) (2025-09-17)


### Bug Fixes

* **compute/metadata:** Racy test and uninitialized subClient ([#12892](https://github.com/googleapis/google-cloud-go/issues/12892)) ([4943ca2](https://github.com/googleapis/google-cloud-go/commit/4943ca2bf83908a23806247bc4252dfb440d09cc)), refs [#12888](https://github.com/googleapis/google-cloud-go/issues/12888)

## [0.8.1](https://github.com/googleapis/google-cloud-go/compare/compute/metadata/v0.8.0...compute/metadata/v0.8.1) (2025-09-16)


### Bug Fixes

* **compute/metadata:** Use separate client for subscribe methods  ([#12885](https://github.com/googleapis/google-cloud-go/issues/12885)) ([76b80f8](https://github.com/googleapis/google-cloud-go/commit/76b80f8df9bf9339d175407e8c15936fe1ac1c9c))

## [0.8.0](https://github.com/googleapis/google-cloud-go/compare/compute/metadata/v0.7.0...compute/metadata/v0.8.0) (2025-08-06)


### Features

* **compute/metadata:** Add Options.UseDefaultClient ([#12657](https://github.com/googleapis/google-cloud-go/issues/12657)) ([1a88209](https://github.com/googleapis/google-cloud-go/commit/1a8820900f20e038291c4bb2c5284a449196e81f)), refs [#11078](https://github.com/googleapis/google-cloud-go/issues/11078)

## [0.7.0](https://github.com/googleapis/google-cloud-go/compare/compute/metadata/v0.6.0...compute/metadata/v0.7.0) (2025-05-13)


### Features

* **compute/metadata:** Allow canceling GCE detection ([#11786](https://github.com/googleapis/google-cloud-go/issues/11786)) ([78100fe](https://github.com/googleapis/google-cloud-go/commit/78100fe7e28cd30f1e10b47191ac3c9839663b64))

## [0.6.0](https://github.com/googleapis/google-cloud-go/compare/compute/metadata/v0.5.2...compute/metadata/v0.6.0) (2024-12-13)


### Features

* **compute/metadata:** Add debug logging ([#11078](https://github.com/googleapis/google-cloud-go/issues/11078)) ([a816814](https://github.com/googleapis/google-cloud-go/commit/a81681463906e4473570a2f426eb0dc2de64e53f))

## [0.5.2](https://github.com/googleapis/google-cloud-go/compare/compute/metadata/v0.5.1...compute/metadata/v0.5.2) (2024-09-20)


### Bug Fixes

* **compute/metadata:** Close Response Body for failed request ([#10891](https://github.com/googleapis/google-cloud-go/issues/10891)) ([e91d45e](https://github.com/googleapis/google-cloud-go/commit/e91d45e4757a9e354114509ba9800085d9e0ff1f))

## [0.5.1](https://github.com/googleapis/google-cloud-go/compare/compute/metadata/v0.5.0...compute/metadata/v0.5.1) (2024-09-12)


### Bug Fixes

* **compute/metadata:** Check error chain for retryable error ([#10840](https://github.com/googleapis/google-cloud-go/issues/10840)) ([2bdedef](https://github.com/googleapis/google-cloud-go/commit/2bdedeff621b223d63cebc4355fcf83bc68412cd))

## [0.5.0](https://github.com/googleapis/google-cloud-go/compare/compute/metadata/v0.4.0...compute/metadata/v0.5.0) (2024-07-10)


### Features

* **compute/metadata:** Add sys check for windows OnGCE ([#10521](https://github.com/googleapis/google-cloud-go/issues/10521)) ([3b9a830](https://github.com/googleapis/google-cloud-go/commit/3b9a83063960d2a2ac20beb47cc15818a68bd302))

## [0.4.0](https://github.com/googleapis/google-cloud-go/compare/compute/metadata/v0.3.0...compute/metadata/v0.4.0) (2024-07-01)


### Features

* **compute/metadata:** Add context for all functions/methods ([#10370](https://github.com/googleapis/google-cloud-go/issues/10370)) ([66b8efe](https://github.com/googleapis/google-cloud-go/commit/66b8efe7ad877e052b2987bb4475477e38c67bb3))


### Documentation

* **compute/metadata:** Update OnGCE description ([#10408](https://github.com/googleapis/google-cloud-go/issues/10408)) ([6a46dca](https://github.com/googleapis/google-cloud-go/commit/6a46dca4eae4f88ec6f88822e01e5bf8aeca787f))

## [0.3.0](https://github.com/googleapis/google-cloud-go/compare/compute/metadata/v0.2.3...compute/metadata/v0.3.0) (2024-04-15)


### Features

* **compute/metadata:** Add context aware functions  ([#9733](https://github.com/googleapis/google-cloud-go/issues/9733)) ([e4eb5b4](https://github.com/googleapis/google-cloud-go/commit/e4eb5b46ee2aec9d2fc18300bfd66015e25a0510))

## [0.2.3](https://github.com/googleapis/google-cloud-go/compare/compute/metadata/v0.2.2...compute/metadata/v0.2.3) (2022-12-15)


### Bug Fixes

* **compute/metadata:** Switch DNS lookup to an absolute lookup ([119b410](https://github.com/googleapis/google-cloud-go/commit/119b41060c7895e45e48aee5621ad35607c4d021)), refs [#7165](https://github.com/googleapis/google-cloud-go/issues/7165)

## [0.2.2](https://github.com/googleapis/google-cloud-go/compare/compute/metadata/v0.2.1...compute/metadata/v0.2.2) (2022-12-01)


### Bug Fixes

* **compute/metadata:** Set IdleConnTimeout for http.Client ([#7084](https://github.com/googleapis/google-cloud-go/issues/7084)) ([766516a](https://github.com/googleapis/google-cloud-go/commit/766516aaf3816bfb3159efeea65aa3d1d205a3e2)), refs [#5430](https://github.com/googleapis/google-cloud-go/issues/5430)

## [0.1.0] (2022-10-26)

Initial release of metadata being it's own module.
