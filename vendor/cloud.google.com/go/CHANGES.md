# Changes



## [0.121.1](https://github.com/googleapis/google-cloud-go/compare/v0.121.0...v0.121.1) (2025-05-13)


### Bug Fixes

* **civil:** Add support for civil.Date, civil.Time and civil.DateTime arguments to their respective Scan methods ([#12240](https://github.com/googleapis/google-cloud-go/issues/12240)) ([7127ce9](https://github.com/googleapis/google-cloud-go/commit/7127ce9992f890667f2c8f75c924136b0e94f115)), refs [#12060](https://github.com/googleapis/google-cloud-go/issues/12060)

## [0.121.0](https://github.com/googleapis/google-cloud-go/compare/v0.120.1...v0.121.0) (2025-04-28)


### Features

* **debugger:** Remove debugger/apiv2 client ([#12050](https://github.com/googleapis/google-cloud-go/issues/12050)) ([af8641e](https://github.com/googleapis/google-cloud-go/commit/af8641e7d011349afa774b668b30a95b007fd076))

## [0.120.1](https://github.com/googleapis/google-cloud-go/compare/v0.120.0...v0.120.1) (2025-04-14)


### Bug Fixes

* **readme:** Update authentication section ([#11918](https://github.com/googleapis/google-cloud-go/issues/11918)) ([2fda860](https://github.com/googleapis/google-cloud-go/commit/2fda86031820ad7d29322f03ad6f34871ad5ff59))

## [0.120.0](https://github.com/googleapis/google-cloud-go/compare/v0.119.0...v0.120.0) (2025-03-20)


### Features

* **civil:** Implement database/sql.Scanner|Valuer ([#1145](https://github.com/googleapis/google-cloud-go/issues/1145)) ([#11808](https://github.com/googleapis/google-cloud-go/issues/11808)) ([cbe4419](https://github.com/googleapis/google-cloud-go/commit/cbe4419c17f677c05f3f52c2080861adce705db4))


### Bug Fixes

* **third_party/pkgsite:** Increase comment size limit ([#11877](https://github.com/googleapis/google-cloud-go/issues/11877)) ([587b5cc](https://github.com/googleapis/google-cloud-go/commit/587b5ccc684ad99cb9eeba897304b7143564d423))

## [0.119.0](https://github.com/googleapis/google-cloud-go/compare/v0.118.3...v0.119.0) (2025-03-11)


### Features

* **main:** Add support for listening on custom host to internal/testutil ([#11780](https://github.com/googleapis/google-cloud-go/issues/11780)) ([9608a09](https://github.com/googleapis/google-cloud-go/commit/9608a09a5d41778c7bb93792b5d5128d7081d4a6)), refs [#11586](https://github.com/googleapis/google-cloud-go/issues/11586)

## [0.118.3](https://github.com/googleapis/google-cloud-go/compare/v0.118.2...v0.118.3) (2025-02-20)


### Bug Fixes

* **main:** Bump github.com/envoyproxy/go-control-plane/envoy to v1.32.4 ([#11591](https://github.com/googleapis/google-cloud-go/issues/11591)) ([d52451a](https://github.com/googleapis/google-cloud-go/commit/d52451aa22fb7120e37b43161d3d3103c19e5943))

## [0.118.2](https://github.com/googleapis/google-cloud-go/compare/v0.118.1...v0.118.2) (2025-02-06)


### Bug Fixes

* **internal/godocfx:** Don't save timestamps until modules are successfully processed ([#11563](https://github.com/googleapis/google-cloud-go/issues/11563)) ([8f38b3d](https://github.com/googleapis/google-cloud-go/commit/8f38b3d912354027c30977b5adc928e0c6eff7a9))
* **internal/godocfx:** Retry go get with explicit envoy dependency ([#11564](https://github.com/googleapis/google-cloud-go/issues/11564)) ([a06a6a5](https://github.com/googleapis/google-cloud-go/commit/a06a6a5542939b6239e1ec2c944eb1aae56745d9))

## [0.118.1](https://github.com/googleapis/google-cloud-go/compare/v0.118.0...v0.118.1) (2025-01-30)


### Bug Fixes

* **main:** Remove OpenCensus dependency ([6243d91](https://github.com/googleapis/google-cloud-go/commit/6243d910b2bb502211d8308f9cc7723829d9f844))

## [0.118.0](https://github.com/googleapis/google-cloud-go/compare/v0.117.0...v0.118.0) (2025-01-02)


### Features

* **civil:** Add AddMonths, AddYears and Weekday methods to Date ([#11340](https://github.com/googleapis/google-cloud-go/issues/11340)) ([d45f1a0](https://github.com/googleapis/google-cloud-go/commit/d45f1a01ebff868418aa14fe762ef7d1334f797d))

## [0.117.0](https://github.com/googleapis/google-cloud-go/compare/v0.116.0...v0.117.0) (2024-12-16)


### Features

* **internal/trace:** Remove previously deprecated OpenCensus support ([#11230](https://github.com/googleapis/google-cloud-go/issues/11230)) ([40cf125](https://github.com/googleapis/google-cloud-go/commit/40cf1251c9d73be435585ce204a63588446c72b1)), refs [#10287](https://github.com/googleapis/google-cloud-go/issues/10287)
* **transport:** Remove deprecated EXPERIMENTAL OpenCensus trace context propagation ([#11239](https://github.com/googleapis/google-cloud-go/issues/11239)) ([0d1ac87](https://github.com/googleapis/google-cloud-go/commit/0d1ac87174ed8526ea47d71a80e641ffbd687a6c)), refs [#10287](https://github.com/googleapis/google-cloud-go/issues/10287) [#11230](https://github.com/googleapis/google-cloud-go/issues/11230)

## [0.116.0](https://github.com/googleapis/google-cloud-go/compare/v0.115.1...v0.116.0) (2024-10-09)


### Features

* **genai:** Add tokenizer package ([#10699](https://github.com/googleapis/google-cloud-go/issues/10699)) ([214af16](https://github.com/googleapis/google-cloud-go/commit/214af1604bf3837f68e96dbf81c1331b90c9375f))

## [0.115.1](https://github.com/googleapis/google-cloud-go/compare/v0.115.0...v0.115.1) (2024-08-13)


### Bug Fixes

* **cloud.google.com/go:** Bump google.golang.org/grpc@v1.64.1 ([8ecc4e9](https://github.com/googleapis/google-cloud-go/commit/8ecc4e9622e5bbe9b90384d5848ab816027226c5))

## [0.115.0](https://github.com/googleapis/google-cloud-go/compare/v0.114.0...v0.115.0) (2024-06-12)


### Features

* **internal/trace:** Deprecate OpenCensus support ([#10287](https://github.com/googleapis/google-cloud-go/issues/10287)) ([430ce8a](https://github.com/googleapis/google-cloud-go/commit/430ce8adea2d0be43461e2ca783b7c17794e983f)), refs [#2205](https://github.com/googleapis/google-cloud-go/issues/2205) [#8655](https://github.com/googleapis/google-cloud-go/issues/8655)


### Bug Fixes

* **internal/postprocessor:** Use approved image tag ([#10341](https://github.com/googleapis/google-cloud-go/issues/10341)) ([a388fe5](https://github.com/googleapis/google-cloud-go/commit/a388fe5cf075d0af986861c70dcb7b9f97c31019))

## [0.114.0](https://github.com/googleapis/google-cloud-go/compare/v0.113.0...v0.114.0) (2024-05-23)


### Features

* **civil:** Add Compare method to Date, Time, and DateTime ([#10193](https://github.com/googleapis/google-cloud-go/issues/10193)) ([c2920d7](https://github.com/googleapis/google-cloud-go/commit/c2920d7c9007a11d9232c628fba5496197deeba4))


### Bug Fixes

* **internal/postprocessor:** Add scopes to all appropriate commit lines ([#10192](https://github.com/googleapis/google-cloud-go/issues/10192)) ([c21399b](https://github.com/googleapis/google-cloud-go/commit/c21399bdc362c6c646c2c0f8c2c55903898e0eab))

## [0.113.0](https://github.com/googleapis/google-cloud-go/compare/v0.112.2...v0.113.0) (2024-05-08)


### Features

* **civil:** Add Compare method to Date, Time, and DateTime ([#10010](https://github.com/googleapis/google-cloud-go/issues/10010)) ([34455c1](https://github.com/googleapis/google-cloud-go/commit/34455c15d62b089f3281ff4c663245e72b257f37))


### Bug Fixes

* **all:** Bump x/net to v0.24.0 ([#10000](https://github.com/googleapis/google-cloud-go/issues/10000)) ([ba31ed5](https://github.com/googleapis/google-cloud-go/commit/ba31ed5fda2c9664f2e1cf972469295e63deb5b4))
* **debugger:** Add internaloption.WithDefaultEndpointTemplate ([3b41408](https://github.com/googleapis/google-cloud-go/commit/3b414084450a5764a0248756e95e13383a645f90))
* **internal/aliasfix:** Handle import paths correctly ([#10097](https://github.com/googleapis/google-cloud-go/issues/10097)) ([fafaf0d](https://github.com/googleapis/google-cloud-go/commit/fafaf0d0a293096559a4655ea61062cb896f1568))
* **rpcreplay:** Properly unmarshal dynamic message ([#9774](https://github.com/googleapis/google-cloud-go/issues/9774)) ([53ccb20](https://github.com/googleapis/google-cloud-go/commit/53ccb20d925ccb00f861958d9658b55738097dc6)), refs [#9773](https://github.com/googleapis/google-cloud-go/issues/9773)


### Documentation

* **testing:** Switch deprecated WithInsecure to WithTransportCredentials ([#10091](https://github.com/googleapis/google-cloud-go/issues/10091)) ([2b576ab](https://github.com/googleapis/google-cloud-go/commit/2b576abd1c3bfca2f962de0e024524f72d3652c0))

## [0.112.2](https://github.com/googleapis/google-cloud-go/compare/v0.112.1...v0.112.2) (2024-03-27)


### Bug Fixes

* **all:** Release protobuf dep bump ([#9586](https://github.com/googleapis/google-cloud-go/issues/9586)) ([30b038d](https://github.com/googleapis/google-cloud-go/commit/30b038d8cac0b8cd5dd4761c87f3f298760dd33a))

## [0.112.1](https://github.com/googleapis/google-cloud-go/compare/v0.112.0...v0.112.1) (2024-02-26)


### Bug Fixes

* **internal/postprocessor:** Handle googleapis link in commit body ([#9251](https://github.com/googleapis/google-cloud-go/issues/9251)) ([1dd3515](https://github.com/googleapis/google-cloud-go/commit/1dd35157bff871a2b3e5b0e3cac33502737fd631))


### Documentation

* **main:** Add OpenTelemetry-Go compatibility warning to debug.md ([#9268](https://github.com/googleapis/google-cloud-go/issues/9268)) ([18f9bb9](https://github.com/googleapis/google-cloud-go/commit/18f9bb94fbc239255a873b29462fc7c2eac3c0aa)), refs [#9267](https://github.com/googleapis/google-cloud-go/issues/9267)

## [0.112.0](https://github.com/googleapis/google-cloud-go/compare/v0.111.0...v0.112.0) (2024-01-11)


### Features

* **internal/trace:** Export internal/trace package constants and vars ([#9242](https://github.com/googleapis/google-cloud-go/issues/9242)) ([941c16f](https://github.com/googleapis/google-cloud-go/commit/941c16f3a2602e9bdc737b139060a7dd8318f9dd))


### Documentation

* **main:** Add telemetry discussion to debug.md ([#9074](https://github.com/googleapis/google-cloud-go/issues/9074)) ([90ed12e](https://github.com/googleapis/google-cloud-go/commit/90ed12e1dffe722b42f58556f0e17b808da9714d)), refs [#8655](https://github.com/googleapis/google-cloud-go/issues/8655)

## [0.111.0](https://github.com/googleapis/google-cloud-go/compare/v0.110.10...v0.111.0) (2023-11-29)


### Features

* **internal/trace:** Add OpenTelemetry support ([#8655](https://github.com/googleapis/google-cloud-go/issues/8655)) ([7a46b54](https://github.com/googleapis/google-cloud-go/commit/7a46b5428f239871993d66be2c7c667121f60a6f)), refs [#2205](https://github.com/googleapis/google-cloud-go/issues/2205)


### Bug Fixes

* **all:** Bump google.golang.org/api to v0.149.0 ([#8959](https://github.com/googleapis/google-cloud-go/issues/8959)) ([8d2ab9f](https://github.com/googleapis/google-cloud-go/commit/8d2ab9f320a86c1c0fab90513fc05861561d0880))

## [0.110.10](https://github.com/googleapis/google-cloud-go/compare/v0.110.9...v0.110.10) (2023-10-31)


### Bug Fixes

* **all:** Update grpc-go to v1.56.3 ([#8916](https://github.com/googleapis/google-cloud-go/issues/8916)) ([343cea8](https://github.com/googleapis/google-cloud-go/commit/343cea8c43b1e31ae21ad50ad31d3b0b60143f8c))
* **all:** Update grpc-go to v1.59.0 ([#8922](https://github.com/googleapis/google-cloud-go/issues/8922)) ([81a97b0](https://github.com/googleapis/google-cloud-go/commit/81a97b06cb28b25432e4ece595c55a9857e960b7))
* **internal/godocfx:** Fix links to other packages in summary ([#8756](https://github.com/googleapis/google-cloud-go/issues/8756)) ([6220a9a](https://github.com/googleapis/google-cloud-go/commit/6220a9afeb89df3080e9e663e97648939fd4e15f))

## [0.110.9](https://github.com/googleapis/google-cloud-go/compare/v0.110.8...v0.110.9) (2023-10-19)


### Bug Fixes

* **all:** Update golang.org/x/net to v0.17.0 ([#8705](https://github.com/googleapis/google-cloud-go/issues/8705)) ([174da47](https://github.com/googleapis/google-cloud-go/commit/174da47254fefb12921bbfc65b7829a453af6f5d))
* **internal/aliasgen:** Update golang.org/x/net to v0.17.0 ([174da47](https://github.com/googleapis/google-cloud-go/commit/174da47254fefb12921bbfc65b7829a453af6f5d))
* **internal/examples/fake:** Update golang.org/x/net to v0.17.0 ([174da47](https://github.com/googleapis/google-cloud-go/commit/174da47254fefb12921bbfc65b7829a453af6f5d))
* **internal/gapicgen:** Update golang.org/x/net to v0.17.0 ([174da47](https://github.com/googleapis/google-cloud-go/commit/174da47254fefb12921bbfc65b7829a453af6f5d))
* **internal/generated/snippets:** Update golang.org/x/net to v0.17.0 ([174da47](https://github.com/googleapis/google-cloud-go/commit/174da47254fefb12921bbfc65b7829a453af6f5d))
* **internal/godocfx:** Update golang.org/x/net to v0.17.0 ([174da47](https://github.com/googleapis/google-cloud-go/commit/174da47254fefb12921bbfc65b7829a453af6f5d))
* **internal/postprocessor:** Add ability to override release level ([#8643](https://github.com/googleapis/google-cloud-go/issues/8643)) ([26c608a](https://github.com/googleapis/google-cloud-go/commit/26c608a8204d740767dfebf6aa473cdf1873e5f0))
* **internal/postprocessor:** Add missing assignment ([#8646](https://github.com/googleapis/google-cloud-go/issues/8646)) ([d8c5746](https://github.com/googleapis/google-cloud-go/commit/d8c5746e6dde1bd34c01a9886804f861c88c0cb7))
* **internal/postprocessor:** Update golang.org/x/net to v0.17.0 ([174da47](https://github.com/googleapis/google-cloud-go/commit/174da47254fefb12921bbfc65b7829a453af6f5d))

## [0.110.8](https://github.com/googleapis/google-cloud-go/compare/v0.110.7...v0.110.8) (2023-09-11)


### Documentation

* **postprocessor:** Nudge users towards stable clients ([#8513](https://github.com/googleapis/google-cloud-go/issues/8513)) ([05a1484](https://github.com/googleapis/google-cloud-go/commit/05a1484b0752aaa3d6a164d37686d6de070cc78d))

## [0.110.7](https://github.com/googleapis/google-cloud-go/compare/v0.110.6...v0.110.7) (2023-07-31)


### Bug Fixes

* **main:** Add more docs to base package ([c401ab4](https://github.com/googleapis/google-cloud-go/commit/c401ab4a576c64ab2b8840a90f7ccd5d031cea57))

## [0.110.6](https://github.com/googleapis/google-cloud-go/compare/v0.110.5...v0.110.6) (2023-07-13)


### Bug Fixes

* **httpreplay:** Ignore GCS header by default ([#8260](https://github.com/googleapis/google-cloud-go/issues/8260)) ([b961a1a](https://github.com/googleapis/google-cloud-go/commit/b961a1abe7aeafe420c88eed38035fed0bbf7bbe)), refs [#8233](https://github.com/googleapis/google-cloud-go/issues/8233)

## [0.110.5](https://github.com/googleapis/google-cloud-go/compare/v0.110.4...v0.110.5) (2023-07-07)


### Bug Fixes

* **logadmin:** Use consistent filter in paging example ([#8221](https://github.com/googleapis/google-cloud-go/issues/8221)) ([9570159](https://github.com/googleapis/google-cloud-go/commit/95701597b1d709543ea22a4b6ff9b28b14a2d4fc))

## [0.110.4](https://github.com/googleapis/google-cloud-go/compare/v0.110.3...v0.110.4) (2023-07-05)


### Bug Fixes

* **internal/retry:** Simplify gRPC status code mapping of retry error ([#8196](https://github.com/googleapis/google-cloud-go/issues/8196)) ([e8b224a](https://github.com/googleapis/google-cloud-go/commit/e8b224a3bcb0ca9430990ef6ae8ddb7b60f5225d))

## [0.110.3](https://github.com/googleapis/google-cloud-go/compare/v0.110.2...v0.110.3) (2023-06-23)


### Bug Fixes

* **internal/retry:** Never return nil from GRPCStatus() ([#8128](https://github.com/googleapis/google-cloud-go/issues/8128)) ([005d2df](https://github.com/googleapis/google-cloud-go/commit/005d2dfb6b68bf5a35bfb8db449d3f0084b34d6e))


### Documentation

* **v1:** Minor clarifications for TaskGroup and min_cpu_platform ([3382ef8](https://github.com/googleapis/google-cloud-go/commit/3382ef81b6bcefe1c7bfc14aa5ff9bbf25850966))

## [0.110.2](https://github.com/googleapis/google-cloud-go/compare/v0.110.1...v0.110.2) (2023-05-08)


### Bug Fixes

* **deps:** Update grpc to v1.55.0 ([#7885](https://github.com/googleapis/google-cloud-go/issues/7885)) ([9fc48a9](https://github.com/googleapis/google-cloud-go/commit/9fc48a921428c94c725ea90415d55ff0c177dd81))

## [0.110.1](https://github.com/googleapis/google-cloud-go/compare/v0.110.0...v0.110.1) (2023-05-03)


### Bug Fixes

* **httpreplay:** Add ignore-header flag, fix tests ([#7865](https://github.com/googleapis/google-cloud-go/issues/7865)) ([1829706](https://github.com/googleapis/google-cloud-go/commit/1829706c5ade36cc786b2e6780fda5e7302f965b))

## [0.110.0](https://github.com/googleapis/google-cloud-go/compare/v0.109.0...v0.110.0) (2023-02-15)


### Features

* **internal/postprocessor:** Detect and initialize new modules ([#7288](https://github.com/googleapis/google-cloud-go/issues/7288)) ([59ce02c](https://github.com/googleapis/google-cloud-go/commit/59ce02c13f265741a8f1f0f7ad5109bf83e3df82))
* **internal/postprocessor:** Only regen snippets for changed modules ([#7300](https://github.com/googleapis/google-cloud-go/issues/7300)) ([220f8a5](https://github.com/googleapis/google-cloud-go/commit/220f8a5ad2fd64b75c5a1af531b1ab4597cf17d7))


### Bug Fixes

* **internal/postprocessor:** Add scopes without OwlBot api-name feature ([#7404](https://github.com/googleapis/google-cloud-go/issues/7404)) ([f7fe4f6](https://github.com/googleapis/google-cloud-go/commit/f7fe4f68ebf2ca28efd282f3419329dd2c09d245))
* **internal/postprocessor:** Include module and package in scope ([#7294](https://github.com/googleapis/google-cloud-go/issues/7294)) ([d2c5c84](https://github.com/googleapis/google-cloud-go/commit/d2c5c8449f6939301f0fd506282e8fc73fc84f96))

## [0.109.0](https://github.com/googleapis/google-cloud-go/compare/v0.108.0...v0.109.0) (2023-01-18)


### Features

* **internal/postprocessor:** Make OwlBot postprocessor ([#7202](https://github.com/googleapis/google-cloud-go/issues/7202)) ([7a1022e](https://github.com/googleapis/google-cloud-go/commit/7a1022e215261d679c8496cdd35a9cad1f13e527))

## [0.108.0](https://github.com/googleapis/google-cloud-go/compare/v0.107.0...v0.108.0) (2023-01-05)


### Features

* **all:** Enable REGAPIC and REST numeric enums ([#6999](https://github.com/googleapis/google-cloud-go/issues/6999)) ([28f3572](https://github.com/googleapis/google-cloud-go/commit/28f3572addb0f563a2a42a76977b4e083191613f))
* **debugger:** Add REST client ([06a54a1](https://github.com/googleapis/google-cloud-go/commit/06a54a16a5866cce966547c51e203b9e09a25bc0))


### Bug Fixes

* **internal/gapicgen:** Disable rest for non-rest APIs ([#7157](https://github.com/googleapis/google-cloud-go/issues/7157)) ([ab332ce](https://github.com/googleapis/google-cloud-go/commit/ab332ced06f6c07909444e4528c02a8b6a0a70a6))

## [0.107.0](https://github.com/googleapis/google-cloud-go/compare/v0.106.0...v0.107.0) (2022-11-15)


### Features

* **routing:** Start generating apiv2 ([#7011](https://github.com/googleapis/google-cloud-go/issues/7011)) ([66e8e27](https://github.com/googleapis/google-cloud-go/commit/66e8e2717b2593f4e5640ecb97344bb1d5e5fc0b))

## [0.106.0](https://github.com/googleapis/google-cloud-go/compare/v0.105.0...v0.106.0) (2022-11-09)


### Features

* **debugger:** rewrite signatures in terms of new location ([3c4b2b3](https://github.com/googleapis/google-cloud-go/commit/3c4b2b34565795537aac1661e6af2442437e34ad))

## [0.104.0](https://github.com/googleapis/google-cloud-go/compare/v0.103.0...v0.104.0) (2022-08-24)


### Features

* **godocfx:** add friendlyAPIName ([#6447](https://github.com/googleapis/google-cloud-go/issues/6447)) ([c6d3ba4](https://github.com/googleapis/google-cloud-go/commit/c6d3ba401b7b3ae9b710a8850c6ec5d49c4c1490))

## [0.103.0](https://github.com/googleapis/google-cloud-go/compare/v0.102.1...v0.103.0) (2022-06-29)


### Features

* **privateca:** temporarily remove REGAPIC support ([199b725](https://github.com/googleapis/google-cloud-go/commit/199b7250f474b1a6f53dcf0aac0c2966f4987b68))

## [0.102.1](https://github.com/googleapis/google-cloud-go/compare/v0.102.0...v0.102.1) (2022-06-17)


### Bug Fixes

* **longrunning:** regapic remove path params duped as query params ([#6183](https://github.com/googleapis/google-cloud-go/issues/6183)) ([c963be3](https://github.com/googleapis/google-cloud-go/commit/c963be301f074779e6bb8c897d8064fa076e9e35))

## [0.102.0](https://github.com/googleapis/google-cloud-go/compare/v0.101.1...v0.102.0) (2022-05-24)


### Features

* **civil:** add Before and After methods to civil.Time ([#5703](https://github.com/googleapis/google-cloud-go/issues/5703)) ([7acaaaf](https://github.com/googleapis/google-cloud-go/commit/7acaaafef47668c3e8382b8bc03475598c3db187))

### [0.101.1](https://github.com/googleapis/google-cloud-go/compare/v0.101.0...v0.101.1) (2022-05-03)


### Bug Fixes

* **internal/gapicgen:** properly update modules that have no gapic changes ([#5945](https://github.com/googleapis/google-cloud-go/issues/5945)) ([de2befc](https://github.com/googleapis/google-cloud-go/commit/de2befcaa2a886499db9da6d4d04d28398c8d44b))

## [0.101.0](https://github.com/googleapis/google-cloud-go/compare/v0.100.2...v0.101.0) (2022-04-20)


### Features

* **all:** bump grpc dep ([#5481](https://github.com/googleapis/google-cloud-go/issues/5481)) ([b12964d](https://github.com/googleapis/google-cloud-go/commit/b12964df5c63c647aaf204e73cfcdfd379d19682))
* **internal/gapicgen:** change versionClient for gapics ([#5687](https://github.com/googleapis/google-cloud-go/issues/5687)) ([55f0d92](https://github.com/googleapis/google-cloud-go/commit/55f0d92bf112f14b024b4ab0076c9875a17423c9))


### Bug Fixes

* **internal/gapicgen:** add generation of internal/version.go for new client modules ([#5726](https://github.com/googleapis/google-cloud-go/issues/5726)) ([341e0df](https://github.com/googleapis/google-cloud-go/commit/341e0df1e44480706180cc5b07c49b3cee904095))
* **internal/gapicgen:** don't gen version files for longrunning and debugger ([#5698](https://github.com/googleapis/google-cloud-go/issues/5698)) ([3a81108](https://github.com/googleapis/google-cloud-go/commit/3a81108c74cd8864c56b8ab5939afd864db3c64b))
* **internal/gapicgen:** don't try to make snippets for non-gapics ([#5919](https://github.com/googleapis/google-cloud-go/issues/5919)) ([c94dddc](https://github.com/googleapis/google-cloud-go/commit/c94dddc60ef83a0584ba8f7dd24589d9db971672))
* **internal/gapicgen:** move breaking change indicator if present ([#5452](https://github.com/googleapis/google-cloud-go/issues/5452)) ([e712df5](https://github.com/googleapis/google-cloud-go/commit/e712df5ebb45598a1653081d7e11e578bad22ff8))
* **internal/godocfx:** prevent errors for filtered mods ([#5485](https://github.com/googleapis/google-cloud-go/issues/5485)) ([6cb9b89](https://github.com/googleapis/google-cloud-go/commit/6cb9b89b2d654c695eab00d8fb375cce0cd6e059))

## [0.100.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.99.0...v0.100.0) (2022-01-04)


### Features

* **analytics/admin:** add the `AcknowledgeUserDataCollection` operation which acknowledges the terms of user data collection for the specified property feat: add the new resource type `DataStream`, which is planned to eventually replace `WebDataStream`, `IosAppDataStream`, `AndroidAppDataStream` resources fix!: remove `GetEnhancedMeasurementSettings`, `UpdateEnhancedMeasurementSettingsRequest`, `UpdateEnhancedMeasurementSettingsRequest` operations from the API feat: add `CreateDataStream`, `DeleteDataStream`, `UpdateDataStream`, `ListDataStreams` operations to support the new `DataStream` resource feat: add `DISPLAY_VIDEO_360_ADVERTISER_LINK`,  `DISPLAY_VIDEO_360_ADVERTISER_LINK_PROPOSAL` fields to `ChangeHistoryResourceType` enum feat: add the `account` field to the `Property` type docs: update the documentation with a new list of valid values for `UserLink.direct_roles` field ([5444809](https://www.github.com/googleapis/google-cloud-go/commit/5444809e0b7cf9f5416645ea2df6fec96f8b9023))
* **assuredworkloads:** EU Regions and Support With Sovereign Controls ([5444809](https://www.github.com/googleapis/google-cloud-go/commit/5444809e0b7cf9f5416645ea2df6fec96f8b9023))
* **dialogflow/cx:** added the display name of the current page in webhook requests ([e0833b2](https://www.github.com/googleapis/google-cloud-go/commit/e0833b2853834ba79fd20ca2ae9c613d585dd2a5))
* **dialogflow/cx:** added the display name of the current page in webhook requests ([e0833b2](https://www.github.com/googleapis/google-cloud-go/commit/e0833b2853834ba79fd20ca2ae9c613d585dd2a5))
* **dialogflow:** added export documentation method feat: added filter in list documentations request feat: added option to import custom metadata from Google Cloud Storage in reload document request feat: added option to apply partial update to the smart messaging allowlist in reload document request feat: added filter in list knowledge bases request ([5444809](https://www.github.com/googleapis/google-cloud-go/commit/5444809e0b7cf9f5416645ea2df6fec96f8b9023))
* **dialogflow:** removed OPTIONAL for speech model variant docs: added more docs for speech model variant and improved docs format for participant ([5444809](https://www.github.com/googleapis/google-cloud-go/commit/5444809e0b7cf9f5416645ea2df6fec96f8b9023))
* **recaptchaenterprise:** add new reCAPTCHA Enterprise fraud annotations ([3dd34a2](https://www.github.com/googleapis/google-cloud-go/commit/3dd34a262edbff63b9aece8faddc2ff0d98ce42a))


### Bug Fixes

* **artifactregistry:** fix resource pattern ID segment name ([5444809](https://www.github.com/googleapis/google-cloud-go/commit/5444809e0b7cf9f5416645ea2df6fec96f8b9023))
* **compute:** add parameter in compute bazel rules ([#692](https://www.github.com/googleapis/google-cloud-go/issues/692)) ([5444809](https://www.github.com/googleapis/google-cloud-go/commit/5444809e0b7cf9f5416645ea2df6fec96f8b9023))
* **profiler:** refine regular expression for parsing backoff duration in E2E tests ([#5229](https://www.github.com/googleapis/google-cloud-go/issues/5229)) ([4438aeb](https://www.github.com/googleapis/google-cloud-go/commit/4438aebca2ec01d4dbf22287aa651937a381e043))
* **profiler:** remove certificate expiration workaround ([#5222](https://www.github.com/googleapis/google-cloud-go/issues/5222)) ([2da36c9](https://www.github.com/googleapis/google-cloud-go/commit/2da36c95f44d5f88fd93cd949ab78823cea74fe7))

## [0.99.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.98.0...v0.99.0) (2021-12-06)


### Features

* **dialogflow/cx:** added `TelephonyTransferCall` in response message ([fe27098](https://www.github.com/googleapis/google-cloud-go/commit/fe27098e5d429911428821ded57384353e699774))

## [0.98.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.97.0...v0.98.0) (2021-12-03)


### Features

* **aiplatform:** add enable_private_service_connect field to Endpoint feat: add id field to DeployedModel feat: add service_attachment field to PrivateEndpoints feat: add endpoint_id to CreateEndpointRequest and method signature to CreateEndpoint feat: add method signature to CreateFeatureStore, CreateEntityType, CreateFeature feat: add network and enable_private_service_connect to IndexEndpoint feat: add service_attachment to IndexPrivateEndpoints feat: add stratified_split field to training_pipeline InputDataConfig ([a2c0bef](https://www.github.com/googleapis/google-cloud-go/commit/a2c0bef551489c9f1d0d12b973d3bf095354841e))
* **aiplatform:** add featurestore service to aiplatform v1 feat: add metadata service to aiplatform v1 ([30794e7](https://www.github.com/googleapis/google-cloud-go/commit/30794e70050b55ff87d6a80d0b4075065e9d271d))
* **aiplatform:** Adds support for `google.protobuf.Value` pipeline parameters in the `parameter_values` field ([88a1cdb](https://www.github.com/googleapis/google-cloud-go/commit/88a1cdbef3cc337354a61bc9276725bfb9a686d8))
* **aiplatform:** Tensorboard v1 protos release feat:Exposing a field for v1 CustomJob-Tensorboard integration. ([90e2868](https://www.github.com/googleapis/google-cloud-go/commit/90e2868a3d220aa7f897438f4917013fda7a7c59))
* **binaryauthorization:** add new admission rule types to Policy feat: update SignatureAlgorithm enum to match algorithm names in KMS feat: add SystemPolicyV1Beta1 service ([1f5aa78](https://www.github.com/googleapis/google-cloud-go/commit/1f5aa78a4d6633871651c89a6d9c48e3409fecc5))
* **channel:** add resource type to ChannelPartnerLink ([c206948](https://www.github.com/googleapis/google-cloud-go/commit/c2069487f6af5bcb37d519afeb60e312e35e67d5))
* **cloudtasks:** add C++ rules for Cloud Tasks ([90e2868](https://www.github.com/googleapis/google-cloud-go/commit/90e2868a3d220aa7f897438f4917013fda7a7c59))
* **compute:** Move compute.v1 from googleapis-discovery to googleapis ([#675](https://www.github.com/googleapis/google-cloud-go/issues/675)) ([1f5aa78](https://www.github.com/googleapis/google-cloud-go/commit/1f5aa78a4d6633871651c89a6d9c48e3409fecc5))
* **compute:** Switch to string enums for compute ([#685](https://www.github.com/googleapis/google-cloud-go/issues/685)) ([c8271d4](https://www.github.com/googleapis/google-cloud-go/commit/c8271d4b217a6e6924d9f87eac9468c4b5767ba7))
* **contactcenterinsights:** Add ability to update phrase matchers feat: Add issue model stats to time series feat: Add display name to issue model stats ([1f5aa78](https://www.github.com/googleapis/google-cloud-go/commit/1f5aa78a4d6633871651c89a6d9c48e3409fecc5))
* **contactcenterinsights:** Add WriteDisposition to BigQuery Export API ([a2c0bef](https://www.github.com/googleapis/google-cloud-go/commit/a2c0bef551489c9f1d0d12b973d3bf095354841e))
* **contactcenterinsights:** deprecate issue_matches docs: if conversation medium is unspecified, it will default to PHONE_CALL ([1a0720f](https://www.github.com/googleapis/google-cloud-go/commit/1a0720f2f33bb14617f5c6a524946a93209e1266))
* **contactcenterinsights:** new feature flag disable_issue_modeling docs: fixed formatting issues in the reference documentation ([c8271d4](https://www.github.com/googleapis/google-cloud-go/commit/c8271d4b217a6e6924d9f87eac9468c4b5767ba7))
* **contactcenterinsights:** remove feature flag disable_issue_modeling ([c8271d4](https://www.github.com/googleapis/google-cloud-go/commit/c8271d4b217a6e6924d9f87eac9468c4b5767ba7))
* **datacatalog:** Added BigQueryDateShardedSpec.latest_shard_resource field feat: Added SearchCatalogResult.display_name field feat: Added SearchCatalogResult.description field ([1f5aa78](https://www.github.com/googleapis/google-cloud-go/commit/1f5aa78a4d6633871651c89a6d9c48e3409fecc5))
* **dataproc:** add Dataproc Serverless for Spark Batches API ([30794e7](https://www.github.com/googleapis/google-cloud-go/commit/30794e70050b55ff87d6a80d0b4075065e9d271d))
* **dataproc:** Add support for dataproc BatchController service ([8519b94](https://www.github.com/googleapis/google-cloud-go/commit/8519b948fee5dc82d39300c4d96e92c85fe78fe6))
* **dialogflow/cx:** added API for changelogs docs: clarified semantic of the streaming APIs ([587bba5](https://www.github.com/googleapis/google-cloud-go/commit/587bba5ad792a92f252107aa38c6af50fb09fb58))
* **dialogflow/cx:** added API for changelogs docs: clarified semantic of the streaming APIs ([587bba5](https://www.github.com/googleapis/google-cloud-go/commit/587bba5ad792a92f252107aa38c6af50fb09fb58))
* **dialogflow/cx:** added support for comparing between versions docs: clarified security settings API reference ([83b941c](https://www.github.com/googleapis/google-cloud-go/commit/83b941c0983e44fdd18ceee8c6f3e91219d72ad1))
* **dialogflow/cx:** added support for Deployments with ListDeployments and GetDeployment apis feat: added support for DeployFlow api under Environments feat: added support for TestCasesConfig under Environment docs: added long running operation explanation for several apis fix!: marked resource name of security setting as not-required ([8c5c6cf](https://www.github.com/googleapis/google-cloud-go/commit/8c5c6cf9df046b67998a8608d05595bd9e34feb0))
* **dialogflow/cx:** allow setting custom CA for generic webhooks and release CompareVersions API docs: clarify DLP template reader usage ([90e2868](https://www.github.com/googleapis/google-cloud-go/commit/90e2868a3d220aa7f897438f4917013fda7a7c59))
* **dialogflow:** added support to configure security settings, language code and time zone on conversation profile ([1f5aa78](https://www.github.com/googleapis/google-cloud-go/commit/1f5aa78a4d6633871651c89a6d9c48e3409fecc5))
* **dialogflow:** support document metadata filter in article suggestion and smart reply model in human agent assistant ([e33350c](https://www.github.com/googleapis/google-cloud-go/commit/e33350cfcabcddcda1a90069383d39c68deb977a))
* **dlp:** added deidentify replacement dictionaries feat: added field for BigQuery inspect template inclusion lists feat: added field to support infotype versioning ([a2c0bef](https://www.github.com/googleapis/google-cloud-go/commit/a2c0bef551489c9f1d0d12b973d3bf095354841e))
* **domains:** added library for Cloud Domains v1 API. Also added methods for the transfer-in flow docs: improved API comments ([8519b94](https://www.github.com/googleapis/google-cloud-go/commit/8519b948fee5dc82d39300c4d96e92c85fe78fe6))
* **functions:** Secret Manager integration fields 'secret_environment_variables' and 'secret_volumes' added feat: CMEK integration fields 'kms_key_name' and 'docker_repository' added ([1f5aa78](https://www.github.com/googleapis/google-cloud-go/commit/1f5aa78a4d6633871651c89a6d9c48e3409fecc5))
* **kms:** add OAEP+SHA1 to the list of supported algorithms ([8c5c6cf](https://www.github.com/googleapis/google-cloud-go/commit/8c5c6cf9df046b67998a8608d05595bd9e34feb0))
* **kms:** add RPC retry information for MacSign, MacVerify, and GenerateRandomBytes Committer: [@bdhess](https://www.github.com/bdhess) ([1a0720f](https://www.github.com/googleapis/google-cloud-go/commit/1a0720f2f33bb14617f5c6a524946a93209e1266))
* **kms:** add support for Raw PKCS[#1](https://www.github.com/googleapis/google-cloud-go/issues/1) signing keys ([58bea89](https://www.github.com/googleapis/google-cloud-go/commit/58bea89a3d177d5c431ff19310794e3296253353))
* **monitoring/apiv3:** add CreateServiceTimeSeries RPC ([9e41088](https://www.github.com/googleapis/google-cloud-go/commit/9e41088bb395fbae0e757738277d5c95fa2749c8))
* **monitoring/dashboard:** Added support for auto-close configurations ([90e2868](https://www.github.com/googleapis/google-cloud-go/commit/90e2868a3d220aa7f897438f4917013fda7a7c59))
* **monitoring/metricsscope:** promote apiv1 to GA ([#5135](https://www.github.com/googleapis/google-cloud-go/issues/5135)) ([33c0f63](https://www.github.com/googleapis/google-cloud-go/commit/33c0f63e0e0ce69d9ef6e57b04d1b8cc10ed2b78))
* **osconfig:** OSConfig: add OS policy assignment rpcs ([83b941c](https://www.github.com/googleapis/google-cloud-go/commit/83b941c0983e44fdd18ceee8c6f3e91219d72ad1))
* **osconfig:** Update OSConfig API ([e33350c](https://www.github.com/googleapis/google-cloud-go/commit/e33350cfcabcddcda1a90069383d39c68deb977a))
* **osconfig:** Update osconfig v1 and v1alpha RecurringSchedule.Frequency with DAILY frequency ([59e548a](https://www.github.com/googleapis/google-cloud-go/commit/59e548acc249c7bddd9c884c2af35d582a408c4d))
* **recaptchaenterprise:** add reCAPTCHA Enterprise account defender API methods ([88a1cdb](https://www.github.com/googleapis/google-cloud-go/commit/88a1cdbef3cc337354a61bc9276725bfb9a686d8))
* **redis:** [Cloud Memorystore for Redis] Support Multiple Read Replicas when creating Instance ([1f5aa78](https://www.github.com/googleapis/google-cloud-go/commit/1f5aa78a4d6633871651c89a6d9c48e3409fecc5))
* **redis:** [Cloud Memorystore for Redis] Support Multiple Read Replicas when creating Instance ([1f5aa78](https://www.github.com/googleapis/google-cloud-go/commit/1f5aa78a4d6633871651c89a6d9c48e3409fecc5))
* **security/privateca:** add IAMPolicy & Locations mix-in support ([1a0720f](https://www.github.com/googleapis/google-cloud-go/commit/1a0720f2f33bb14617f5c6a524946a93209e1266))
* **securitycenter:** Added a new API method UpdateExternalSystem, which enables updating a finding w/ external system metadata. External systems are a child resource under finding, and are housed on the finding itself, and can also be filtered on in Notifications, the ListFindings and GroupFindings API ([c8271d4](https://www.github.com/googleapis/google-cloud-go/commit/c8271d4b217a6e6924d9f87eac9468c4b5767ba7))
* **securitycenter:** Added mute related APIs, proto messages and fields ([3e7185c](https://www.github.com/googleapis/google-cloud-go/commit/3e7185c241d97ee342f132ae04bc93bb79a8e897))
* **securitycenter:** Added resource type and display_name field to the FindingResult, and supported them in the filter for ListFindings and GroupFindings. Also added display_name to the resource which is surfaced in NotificationMessage ([1f5aa78](https://www.github.com/googleapis/google-cloud-go/commit/1f5aa78a4d6633871651c89a6d9c48e3409fecc5))
* **securitycenter:** Added vulnerability field to the finding feat: Added type field to the resource which is surfaced in NotificationMessage ([090cc3a](https://www.github.com/googleapis/google-cloud-go/commit/090cc3ae0f8747a14cc904fc6d429e2f5379bb03))
* **servicecontrol:** add C++ rules for many Cloud services ([c8271d4](https://www.github.com/googleapis/google-cloud-go/commit/c8271d4b217a6e6924d9f87eac9468c4b5767ba7))
* **speech:** add result_end_time to SpeechRecognitionResult ([a2c0bef](https://www.github.com/googleapis/google-cloud-go/commit/a2c0bef551489c9f1d0d12b973d3bf095354841e))
* **speech:** added alternative_language_codes to RecognitionConfig feat: WEBM_OPUS codec feat: SpeechAdaptation configuration feat: word confidence feat: spoken punctuation and spoken emojis feat: hint boost in SpeechContext ([a2c0bef](https://www.github.com/googleapis/google-cloud-go/commit/a2c0bef551489c9f1d0d12b973d3bf095354841e))
* **texttospeech:** update v1 proto ([90e2868](https://www.github.com/googleapis/google-cloud-go/commit/90e2868a3d220aa7f897438f4917013fda7a7c59))
* **workflows/executions:** add a stack_trace field to the Error messages specifying where the error occured feat: add call_log_level field to Execution messages doc: clarify requirement to escape strings within JSON arguments ([1f5aa78](https://www.github.com/googleapis/google-cloud-go/commit/1f5aa78a4d6633871651c89a6d9c48e3409fecc5))


### Bug Fixes

* **accesscontextmanager:** nodejs package name access-context-manager ([30794e7](https://www.github.com/googleapis/google-cloud-go/commit/30794e70050b55ff87d6a80d0b4075065e9d271d))
* **aiplatform:** Remove invalid resource annotations ([587bba5](https://www.github.com/googleapis/google-cloud-go/commit/587bba5ad792a92f252107aa38c6af50fb09fb58))
* **compute/metadata:** return an error when all retries have failed ([#5063](https://www.github.com/googleapis/google-cloud-go/issues/5063)) ([c792a0d](https://www.github.com/googleapis/google-cloud-go/commit/c792a0d13db019c9964efeee5c6bc85b07ca50fa)), refs [#5062](https://www.github.com/googleapis/google-cloud-go/issues/5062)
* **compute:** make parent_id fields required compute move and insert methods ([#686](https://www.github.com/googleapis/google-cloud-go/issues/686)) ([c8271d4](https://www.github.com/googleapis/google-cloud-go/commit/c8271d4b217a6e6924d9f87eac9468c4b5767ba7))
* **compute:** Move compute_small protos under its own directory ([#681](https://www.github.com/googleapis/google-cloud-go/issues/681)) ([3e7185c](https://www.github.com/googleapis/google-cloud-go/commit/3e7185c241d97ee342f132ae04bc93bb79a8e897))
* **internal/gapicgen:** fix a compute filtering ([#5111](https://www.github.com/googleapis/google-cloud-go/issues/5111)) ([77aa19d](https://www.github.com/googleapis/google-cloud-go/commit/77aa19de7fc33a9e831e6b91bd324d6832b44d99))
* **internal/godocfx:** only put TOC status on mod if all pkgs have same status ([#4974](https://www.github.com/googleapis/google-cloud-go/issues/4974)) ([309b59e](https://www.github.com/googleapis/google-cloud-go/commit/309b59e583d1bf0dd9ffe84223034eb8a2975d47))
* **internal/godocfx:** replace * with HTML code ([#5049](https://www.github.com/googleapis/google-cloud-go/issues/5049)) ([a8f7c06](https://www.github.com/googleapis/google-cloud-go/commit/a8f7c066e8d97120ae4e12963e3c9acc8b8906c2))
* **monitoring/apiv3:** Reintroduce deprecated field/enum for backward compatibility docs: Use absolute link targets in comments ([45fd259](https://www.github.com/googleapis/google-cloud-go/commit/45fd2594d99ef70c776df26866f0a3b537e7e69e))
* **profiler:** workaround certificate expiration issue in integration tests ([#4955](https://www.github.com/googleapis/google-cloud-go/issues/4955)) ([de9e465](https://www.github.com/googleapis/google-cloud-go/commit/de9e465bea8cd0580c45e87d2cbc2b610615b363))
* **security/privateca:** include mixin protos as input for mixin rpcs ([479c2f9](https://www.github.com/googleapis/google-cloud-go/commit/479c2f90d556a106b25ebcdb1539d231488182da))
* **security/privateca:** repair service config to enable mixins ([83b941c](https://www.github.com/googleapis/google-cloud-go/commit/83b941c0983e44fdd18ceee8c6f3e91219d72ad1))
* **video/transcoder:** update nodejs package name to video-transcoder ([30794e7](https://www.github.com/googleapis/google-cloud-go/commit/30794e70050b55ff87d6a80d0b4075065e9d271d))

## [0.97.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.96.0...v0.97.0) (2021-09-29)


### Features

* **internal** add Retry func to testutil from samples repository [#4902](https://github.com/googleapis/google-cloud-go/pull/4902)

## [0.96.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.95.0...v0.96.0) (2021-09-28)


### Features

* **civil:** add IsEmpty function to time, date and datetime ([#4728](https://www.github.com/googleapis/google-cloud-go/issues/4728)) ([88bfa64](https://www.github.com/googleapis/google-cloud-go/commit/88bfa64d6df2f3bb7d41e0b8f56717dd3de790e2)), refs [#4727](https://www.github.com/googleapis/google-cloud-go/issues/4727)
* **internal/godocfx:** detect preview versions ([#4899](https://www.github.com/googleapis/google-cloud-go/issues/4899)) ([9b60844](https://www.github.com/googleapis/google-cloud-go/commit/9b608445ce9ebabbc87a50e85ce6ef89125031d2))
* **internal:** provide wrapping for retried errors ([#4797](https://www.github.com/googleapis/google-cloud-go/issues/4797)) ([ce5f4db](https://www.github.com/googleapis/google-cloud-go/commit/ce5f4dbab884e847a2d9f1f8f3fcfd7df19a505a))


### Bug Fixes

* **internal/gapicgen:** restore fmting proto files ([#4789](https://www.github.com/googleapis/google-cloud-go/issues/4789)) ([5606b54](https://www.github.com/googleapis/google-cloud-go/commit/5606b54b97bb675487c6c138a4081c827218f933))
* **internal/trace:** use xerrors.As for trace ([#4813](https://www.github.com/googleapis/google-cloud-go/issues/4813)) ([05fe61c](https://www.github.com/googleapis/google-cloud-go/commit/05fe61c5aa4860bdebbbe3e91a9afaba16aa6184))

## [0.95.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.94.1...v0.95.0) (2021-09-21)

### Bug Fixes

* **internal/gapicgen:** add a temporary import ([#4756](https://www.github.com/googleapis/google-cloud-go/issues/4756)) ([4d9c046](https://www.github.com/googleapis/google-cloud-go/commit/4d9c046b66a2dc205e2c14b676995771301440da))
* **compute/metadata:** remove heavy gax dependency ([#4784](https://www.github.com/googleapis/google-cloud-go/issues/4784)) ([ea00264](https://www.github.com/googleapis/google-cloud-go/commit/ea00264428137471805f2ec67f04f3a5a42928fa))

### [0.94.1](https://www.github.com/googleapis/google-cloud-go/compare/v0.94.0...v0.94.1) (2021-09-02)


### Bug Fixes

* **compute/metadata:** fix retry logic to not panic on error ([#4714](https://www.github.com/googleapis/google-cloud-go/issues/4714)) ([75c63b9](https://www.github.com/googleapis/google-cloud-go/commit/75c63b94d2cf86606fffc3611f7e6150b667eedc)), refs [#4713](https://www.github.com/googleapis/google-cloud-go/issues/4713)

## [0.94.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.92.0...v0.94.0) (2021-08-31)


### Features

* **aiplatform:** add XAI, model monitoring, and index services to aiplatform v1 ([e385b40](https://www.github.com/googleapis/google-cloud-go/commit/e385b40a1e2ecf81f5fd0910de5c37275951f86b))
* **analytics/admin:** add `GetDataRetentionSettings`, `UpdateDataRetentionSettings` methods to the API ([8467899](https://www.github.com/googleapis/google-cloud-go/commit/8467899ab6ebf0328c543bfb5fbcddeb2f53a082))
* **asset:** Release of relationships in v1, Add content type Relationship to support relationship export Committer: lvv@ ([d4c3340](https://www.github.com/googleapis/google-cloud-go/commit/d4c3340bfc8b6793d6d2c8a3ed8ccdb472e1efd3))
* **assuredworkloads:** Add Canada Regions And Support compliance regime ([b9226eb](https://www.github.com/googleapis/google-cloud-go/commit/b9226eb0b34473cb6f920c2526ad0d6dacb03f3c))
* **cloudbuild/apiv1:** Add ability to configure BuildTriggers to create Builds that require approval before executing and ApproveBuild API to approve or reject pending Builds ([d4c3340](https://www.github.com/googleapis/google-cloud-go/commit/d4c3340bfc8b6793d6d2c8a3ed8ccdb472e1efd3))
* **cloudbuild/apiv1:** add script field to BuildStep message ([b9226eb](https://www.github.com/googleapis/google-cloud-go/commit/b9226eb0b34473cb6f920c2526ad0d6dacb03f3c))
* **cloudbuild/apiv1:** Update cloudbuild proto with the service_account for BYOSA Triggers. ([b9226eb](https://www.github.com/googleapis/google-cloud-go/commit/b9226eb0b34473cb6f920c2526ad0d6dacb03f3c))
* **compute/metadata:** retry error when talking to metadata service ([#4648](https://www.github.com/googleapis/google-cloud-go/issues/4648)) ([81c6039](https://www.github.com/googleapis/google-cloud-go/commit/81c6039503121f8da3de4f4cd957b8488a3ef620)), refs [#4642](https://www.github.com/googleapis/google-cloud-go/issues/4642)
* **dataproc:** remove apiv1beta2 client ([#4682](https://www.github.com/googleapis/google-cloud-go/issues/4682)) ([2248554](https://www.github.com/googleapis/google-cloud-go/commit/22485541affb1251604df292670a20e794111d3e))
* **gaming:** support version reporting API ([cd65cec](https://www.github.com/googleapis/google-cloud-go/commit/cd65cecf15c4a01648da7f8f4f4d497772961510))
* **gkehub:** Add request_id under `DeleteMembershipRequest` and `UpdateMembershipRequest` ([b9226eb](https://www.github.com/googleapis/google-cloud-go/commit/b9226eb0b34473cb6f920c2526ad0d6dacb03f3c))
* **internal/carver:** support carving batches ([#4623](https://www.github.com/googleapis/google-cloud-go/issues/4623)) ([2972d19](https://www.github.com/googleapis/google-cloud-go/commit/2972d194da19bedf16d76fda471c06a965cfdcd6))
* **kms:** add support for Key Reimport ([bf4378b](https://www.github.com/googleapis/google-cloud-go/commit/bf4378b5b859f7b835946891dbfebfee31c4b123))
* **metastore:** Added the Backup resource and Backup resource GetIamPolicy/SetIamPolicy to V1 feat: Added the RestoreService method to V1 ([d4c3340](https://www.github.com/googleapis/google-cloud-go/commit/d4c3340bfc8b6793d6d2c8a3ed8ccdb472e1efd3))
* **monitoring/dashboard:** Added support for logs-based alerts: https://cloud.google.com/logging/docs/alerting/log-based-alerts feat: Added support for user-defined labels on cloud monitoring's Service and ServiceLevelObjective objects fix!: mark required fields in QueryTimeSeriesRequest as required ([b9226eb](https://www.github.com/googleapis/google-cloud-go/commit/b9226eb0b34473cb6f920c2526ad0d6dacb03f3c))
* **osconfig:** Update osconfig v1 and v1alpha with WindowsApplication ([bf4378b](https://www.github.com/googleapis/google-cloud-go/commit/bf4378b5b859f7b835946891dbfebfee31c4b123))
* **speech:** Add transcript normalization ([b31646d](https://www.github.com/googleapis/google-cloud-go/commit/b31646d1e12037731df4b5c0ba9f60b6434d7b9b))
* **talent:** Add new commute methods in Search APIs feat: Add new histogram type 'publish_time_in_day' feat: Support filtering by requisitionId is ListJobs API ([d4c3340](https://www.github.com/googleapis/google-cloud-go/commit/d4c3340bfc8b6793d6d2c8a3ed8ccdb472e1efd3))
* **translate:** added v3 proto for online/batch document translation and updated v3beta1 proto for format conversion ([bf4378b](https://www.github.com/googleapis/google-cloud-go/commit/bf4378b5b859f7b835946891dbfebfee31c4b123))


### Bug Fixes

* **datastream:** Change a few resource pattern variables from camelCase to snake_case ([bf4378b](https://www.github.com/googleapis/google-cloud-go/commit/bf4378b5b859f7b835946891dbfebfee31c4b123))

## [0.92.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.91.0...v0.92.0) (2021-08-16)


### Features

* **all:** remove testing deps ([#4580](https://www.github.com/googleapis/google-cloud-go/issues/4580)) ([15c1eb9](https://www.github.com/googleapis/google-cloud-go/commit/15c1eb9730f0b514edb911161f9c59e8d790a5ec)), refs [#4061](https://www.github.com/googleapis/google-cloud-go/issues/4061)
* **internal/detect:** add helper to detect projectID from env ([#4582](https://www.github.com/googleapis/google-cloud-go/issues/4582)) ([cc65d94](https://www.github.com/googleapis/google-cloud-go/commit/cc65d945688ac446602bce6ef86a935714dfe2f8)), refs [#1294](https://www.github.com/googleapis/google-cloud-go/issues/1294)
* **spannertest:** Add validation of duplicated column names ([#4611](https://www.github.com/googleapis/google-cloud-go/issues/4611)) ([84f86a6](https://www.github.com/googleapis/google-cloud-go/commit/84f86a605c809ab36dd3cb4b3ab1df15a5302083))

## [0.91.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.90.0...v0.91.0) (2021-08-11)


### Features

* **.github:** support dynamic submodule detection ([#4537](https://www.github.com/googleapis/google-cloud-go/issues/4537)) ([4374b90](https://www.github.com/googleapis/google-cloud-go/commit/4374b907e9f166da6bd23a8ef94399872b00afd6))
* **dialogflow/cx:** add advanced settings for agent level feat: add rollout config, state and failure reason for experiment feat: add insights export settings for security setting feat: add language code for streaming recognition result and flow versions for query parameters docs: deprecate legacy logging settings ([ed73554](https://www.github.com/googleapis/google-cloud-go/commit/ed735541dc57d0681d84b46853393eac5f7ccec3))
* **dialogflow/cx:** add advanced settings for agent level feat: add rollout config, state and failure reason for experiment feat: add insights export settings for security setting feat: add language code for streaming recognition result and flow versions for query parameters docs: deprecate legacy logging settings ([ed73554](https://www.github.com/googleapis/google-cloud-go/commit/ed735541dc57d0681d84b46853393eac5f7ccec3))
* **dialogflow/cx:** added support for DLP templates; expose `Locations` service to get/list avaliable locations of Dialogflow products ([5996846](https://www.github.com/googleapis/google-cloud-go/commit/59968462a3870c6289166fa1161f9b6d9c10e093))
* **dialogflow/cx:** added support for DLP templates; expose `Locations` service to get/list avaliable locations of Dialogflow products docs: reorder some fields ([5996846](https://www.github.com/googleapis/google-cloud-go/commit/59968462a3870c6289166fa1161f9b6d9c10e093))
* **dialogflow:** expose `Locations` service to get/list avaliable locations of Dialogflow products; fixed some API annotations ([5996846](https://www.github.com/googleapis/google-cloud-go/commit/59968462a3870c6289166fa1161f9b6d9c10e093))
* **kms:** add support for HMAC, Variable Key Destruction, and GenerateRandom ([5996846](https://www.github.com/googleapis/google-cloud-go/commit/59968462a3870c6289166fa1161f9b6d9c10e093))
* **speech:** add total_billed_time response field ([5996846](https://www.github.com/googleapis/google-cloud-go/commit/59968462a3870c6289166fa1161f9b6d9c10e093))
* **video/transcoder:** Add video cropping feature feat: Add video padding feature feat: Add ttl_after_completion_days field to Job docs: Update proto documentation docs: Indicate v1beta1 deprecation ([5996846](https://www.github.com/googleapis/google-cloud-go/commit/59968462a3870c6289166fa1161f9b6d9c10e093))


### Bug Fixes

* **functions:** Updating behavior of source_upload_url during Get/List function calls ([381a494](https://www.github.com/googleapis/google-cloud-go/commit/381a494c29da388977b0bdda2177058328cc4afe))

## [0.90.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.89.0...v0.90.0) (2021-08-03)


### ⚠ BREAKING CHANGES

* **compute:** add pagination and an Operation wrapper (#4542)

### Features

* **compute:** add pagination and an Operation wrapper ([#4542](https://www.github.com/googleapis/google-cloud-go/issues/4542)) ([36f4649](https://www.github.com/googleapis/google-cloud-go/commit/36f46494111f6d16d103fb208d49616576dbf91e))
* **internal/godocfx:** add status to packages and TOCs ([#4547](https://www.github.com/googleapis/google-cloud-go/issues/4547)) ([c6de69c](https://www.github.com/googleapis/google-cloud-go/commit/c6de69c710561bb2a40eff05417df4b9798c258a))
* **internal/godocfx:** mark status of deprecated items ([#4525](https://www.github.com/googleapis/google-cloud-go/issues/4525)) ([d571c6f](https://www.github.com/googleapis/google-cloud-go/commit/d571c6f4337ec9c4807c230cd77f53b6e7db6437))


### Bug Fixes

* **internal/carver:** don't tag commits ([#4518](https://www.github.com/googleapis/google-cloud-go/issues/4518)) ([c355eb8](https://www.github.com/googleapis/google-cloud-go/commit/c355eb8ecb0bb1af0ccf55e6262ca8c0d5c7e352))

## [0.89.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.88.0...v0.89.0) (2021-07-29)


### Features

* **assuredworkloads:** Add EU Regions And Support compliance regime ([a52baa4](https://www.github.com/googleapis/google-cloud-go/commit/a52baa456ed8513ec492c4b573c191eb61468758))
* **datacatalog:** Added support for BigQuery connections entries feat: Added support for BigQuery routines entries feat: Added usage_signal field feat: Added labels field feat: Added ReplaceTaxonomy in Policy Tag Manager Serialization API feat: Added support for public tag templates feat: Added support for rich text tags docs: Documentation improvements ([a52baa4](https://www.github.com/googleapis/google-cloud-go/commit/a52baa456ed8513ec492c4b573c191eb61468758))
* **datafusion:** start generating apiv1 ([e55a016](https://www.github.com/googleapis/google-cloud-go/commit/e55a01667afaf36ff70807d061ecafb61827ba97))
* **iap:** start generating apiv1 ([e55a016](https://www.github.com/googleapis/google-cloud-go/commit/e55a01667afaf36ff70807d061ecafb61827ba97))
* **internal/carver:** add tooling to help carve out sub-modules ([#4417](https://www.github.com/googleapis/google-cloud-go/issues/4417)) ([a7e28f2](https://www.github.com/googleapis/google-cloud-go/commit/a7e28f2557469562ae57e5174b41bdf8fce62b63))
* **networkconnectivity:** Add files for Network Connectivity v1 API. ([a52baa4](https://www.github.com/googleapis/google-cloud-go/commit/a52baa456ed8513ec492c4b573c191eb61468758))
* **retail:** Add restricted Retail Search features for Retail API v2. ([a52baa4](https://www.github.com/googleapis/google-cloud-go/commit/a52baa456ed8513ec492c4b573c191eb61468758))
* **secretmanager:** In Secret Manager, users can now use filter to customize the output of ListSecrets/ListSecretVersions calls ([a52baa4](https://www.github.com/googleapis/google-cloud-go/commit/a52baa456ed8513ec492c4b573c191eb61468758))
* **securitycenter:** add finding_class and indicator fields in Finding ([a52baa4](https://www.github.com/googleapis/google-cloud-go/commit/a52baa456ed8513ec492c4b573c191eb61468758))
* **speech:** add total_billed_time response field. fix!: phrase_set_id is required field in CreatePhraseSetRequest. fix!: custom_class_id is required field in CreateCustomClassRequest. ([a52baa4](https://www.github.com/googleapis/google-cloud-go/commit/a52baa456ed8513ec492c4b573c191eb61468758))
* **storagetransfer:** start generating apiv1 ([#4505](https://www.github.com/googleapis/google-cloud-go/issues/4505)) ([f2d531d](https://www.github.com/googleapis/google-cloud-go/commit/f2d531d2b519efa58e0f23a178bbebe675c203c3))


### Bug Fixes

* **internal/gapicgen:** exec Stdout already set ([#4509](https://www.github.com/googleapis/google-cloud-go/issues/4509)) ([41246e9](https://www.github.com/googleapis/google-cloud-go/commit/41246e900aaaea92a9f956e92956c40c86f4cb3a))
* **internal/gapicgen:** tidy all after dep bump  ([#4515](https://www.github.com/googleapis/google-cloud-go/issues/4515)) ([9401be5](https://www.github.com/googleapis/google-cloud-go/commit/9401be509c570c3c55694375065c84139e961857)), refs [#4434](https://www.github.com/googleapis/google-cloud-go/issues/4434)

## [0.88.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.87.0...v0.88.0) (2021-07-22)


### ⚠ BREAKING CHANGES

* **cloudbuild/apiv1:** Proto had a prior definitions of WorkerPool resources which were never supported. This change replaces those resources with definitions that are currently supported.

### Features

* **cloudbuild/apiv1:** add a WorkerPools API ([19ea3f8](https://www.github.com/googleapis/google-cloud-go/commit/19ea3f830212582bfee21d9e09f0034f9ce76547))
* **cloudbuild/apiv1:** Implementation of Build Failure Info: - Added message FailureInfo field ([19ea3f8](https://www.github.com/googleapis/google-cloud-go/commit/19ea3f830212582bfee21d9e09f0034f9ce76547))
* **osconfig/agentendpoint:** OSConfig AgentEndpoint: add basic os info to RegisterAgentRequest, add WindowsApplication type to Inventory ([8936bc3](https://www.github.com/googleapis/google-cloud-go/commit/8936bc3f2d0fb2f6514f6e019fa247b8f41bd43c))
* **resourcesettings:** Publish Cloud ResourceSettings v1 API ([43ad3cb](https://www.github.com/googleapis/google-cloud-go/commit/43ad3cb7be981fff9dc5dcf4510f1cd7bea99957))


### Bug Fixes

* **internal/godocfx:** set exit code, print cmd output, no go get ... ([#4445](https://www.github.com/googleapis/google-cloud-go/issues/4445)) ([cc70f77](https://www.github.com/googleapis/google-cloud-go/commit/cc70f77ac279a62e24e1b07f6e53fd126b7286b0))
* **internal:** detect module for properly generating docs URLs ([#4460](https://www.github.com/googleapis/google-cloud-go/issues/4460)) ([1eaba8b](https://www.github.com/googleapis/google-cloud-go/commit/1eaba8bd694f7552a8e3e09b4f164de8b6ca23f0)), refs [#4447](https://www.github.com/googleapis/google-cloud-go/issues/4447)
* **kms:** Updating WORKSPACE files to use the newest version of the Typescript generator. ([8936bc3](https://www.github.com/googleapis/google-cloud-go/commit/8936bc3f2d0fb2f6514f6e019fa247b8f41bd43c))

## [0.87.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.86.0...v0.87.0) (2021-07-13)


### Features

* **container:** allow updating security group on existing clusters ([528ffc9](https://www.github.com/googleapis/google-cloud-go/commit/528ffc9bd63090129a8b1355cd31273f8c23e34c))
* **monitoring/dashboard:** added validation only mode when writing dashboards feat: added alert chart widget ([652d7c2](https://www.github.com/googleapis/google-cloud-go/commit/652d7c277da2f6774729064ab65d557875c81567))
* **networkmanagment:** start generating apiv1 ([907592c](https://www.github.com/googleapis/google-cloud-go/commit/907592c576abfc65c01bbcd30c1a6094916cdc06))
* **secretmanager:** Tune Secret Manager auto retry parameters ([528ffc9](https://www.github.com/googleapis/google-cloud-go/commit/528ffc9bd63090129a8b1355cd31273f8c23e34c))
* **video/transcoder:** start generating apiv1 ([907592c](https://www.github.com/googleapis/google-cloud-go/commit/907592c576abfc65c01bbcd30c1a6094916cdc06))


### Bug Fixes

* **compute:** properly generate PUT requests ([#4426](https://www.github.com/googleapis/google-cloud-go/issues/4426)) ([a7491a5](https://www.github.com/googleapis/google-cloud-go/commit/a7491a533e4ad75eb6d5f89718d4dafb0c5b4167))
* **internal:** fix relative pathing for generator ([#4397](https://www.github.com/googleapis/google-cloud-go/issues/4397)) ([25e0eae](https://www.github.com/googleapis/google-cloud-go/commit/25e0eaecf9feb1caa97988c5398ac58f6ca17391))


### Miscellaneous Chores

* **all:** fix release version ([#4427](https://www.github.com/googleapis/google-cloud-go/issues/4427)) ([2c0d267](https://www.github.com/googleapis/google-cloud-go/commit/2c0d2673ccab7281b6432215ee8279f9efd04a15))

## [0.86.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.85.0...v0.86.0) (2021-07-01)


### Features

* **bigquery managedwriter:** schema conversion support ([#4357](https://www.github.com/googleapis/google-cloud-go/issues/4357)) ([f2b20f4](https://www.github.com/googleapis/google-cloud-go/commit/f2b20f493e2ed5a883ce42fa65695c03c574feb5))

## [0.85.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.84.0...v0.85.0) (2021-06-30)


### Features

* **dataflow:** start generating apiv1beta3 ([cfee361](https://www.github.com/googleapis/google-cloud-go/commit/cfee36161d41e3a0f769e51ab96c25d0967af273))
* **datastream:** start generating apiv1alpha1 ([cfee361](https://www.github.com/googleapis/google-cloud-go/commit/cfee36161d41e3a0f769e51ab96c25d0967af273))
* **dialogflow:** added Automated agent reply type and allow cancellation flag for partial response feature. ([5a9c6ce](https://www.github.com/googleapis/google-cloud-go/commit/5a9c6ce781fb6a338e29d3dee72367998d834af0))
* **documentai:** update document.proto, add the processor management methods. ([5a9c6ce](https://www.github.com/googleapis/google-cloud-go/commit/5a9c6ce781fb6a338e29d3dee72367998d834af0))
* **eventarc:** start generating apiv1 ([cfee361](https://www.github.com/googleapis/google-cloud-go/commit/cfee36161d41e3a0f769e51ab96c25d0967af273))
* **gkehub:** added v1alpha messages and client for gkehub ([8fb4649](https://www.github.com/googleapis/google-cloud-go/commit/8fb464956f0ca51d30e8e14dc625ff9fa150c437))
* **internal/godocfx:** add support for other modules ([#4290](https://www.github.com/googleapis/google-cloud-go/issues/4290)) ([d52bae6](https://www.github.com/googleapis/google-cloud-go/commit/d52bae6cd77474174192c46236d309bf967dfa00))
* **internal/godocfx:** different metadata for different modules ([#4297](https://www.github.com/googleapis/google-cloud-go/issues/4297)) ([598f5b9](https://www.github.com/googleapis/google-cloud-go/commit/598f5b93778b2e2e75265ae54484dd54477433f5))
* **internal:** add force option for regen ([#4310](https://www.github.com/googleapis/google-cloud-go/issues/4310)) ([de654eb](https://www.github.com/googleapis/google-cloud-go/commit/de654ebfcf23a53b4d1fee0aa48c73999a55c1a6))
* **servicecontrol:** Added the gRPC service config for the Service Controller v1 API docs: Updated some comments. ([8fb4649](https://www.github.com/googleapis/google-cloud-go/commit/8fb464956f0ca51d30e8e14dc625ff9fa150c437))
* **workflows/executions:** start generating apiv1 ([cfee361](https://www.github.com/googleapis/google-cloud-go/commit/cfee36161d41e3a0f769e51ab96c25d0967af273))


### Bug Fixes

* **internal:** add autogenerated header to snippets ([#4261](https://www.github.com/googleapis/google-cloud-go/issues/4261)) ([2220787](https://www.github.com/googleapis/google-cloud-go/commit/222078722c37c3fdadec7bbbe0bcf81edd105f1a)), refs [#4260](https://www.github.com/googleapis/google-cloud-go/issues/4260)
* **internal:** fix googleapis-disco regen ([#4354](https://www.github.com/googleapis/google-cloud-go/issues/4354)) ([aeea1ce](https://www.github.com/googleapis/google-cloud-go/commit/aeea1ce1e5dff3acdfe208932327b52c49851b41))
* **kms:** replace IAMPolicy mixin in service config. ([5a9c6ce](https://www.github.com/googleapis/google-cloud-go/commit/5a9c6ce781fb6a338e29d3dee72367998d834af0))
* **security/privateca:** Fixed casing of the Ruby namespace ([5a9c6ce](https://www.github.com/googleapis/google-cloud-go/commit/5a9c6ce781fb6a338e29d3dee72367998d834af0))

## [0.84.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.83.0...v0.84.0) (2021-06-09)


### Features

* **aiplatform:** start generating apiv1 ([be1d729](https://www.github.com/googleapis/google-cloud-go/commit/be1d729fdaa18eb1c782f3b09a6bb8fd6b3a144c))
* **apigeeconnect:** start generating abiv1 ([be1d729](https://www.github.com/googleapis/google-cloud-go/commit/be1d729fdaa18eb1c782f3b09a6bb8fd6b3a144c))
* **dialogflow/cx:** support sentiment analysis in bot testing ([7a57aac](https://www.github.com/googleapis/google-cloud-go/commit/7a57aac996f2bae20ee6ddbd02ad9e56e380099b))
* **dialogflow/cx:** support sentiment analysis in bot testing ([6ad2306](https://www.github.com/googleapis/google-cloud-go/commit/6ad2306f64710ce16059b464342dbc6a98d2d9c2))
* **documentai:** Move CommonOperationMetadata into a separate proto file for potential reuse. ([9e80ea0](https://www.github.com/googleapis/google-cloud-go/commit/9e80ea0d053b06876418194f65a478045dc4fe6c))
* **documentai:** Move CommonOperationMetadata into a separate proto file for potential reuse. ([18375e5](https://www.github.com/googleapis/google-cloud-go/commit/18375e50e8f16e63506129b8927a7b62f85e407b))
* **gkeconnect/gateway:** start generating apiv1beta1 ([#4235](https://www.github.com/googleapis/google-cloud-go/issues/4235)) ([1c3e968](https://www.github.com/googleapis/google-cloud-go/commit/1c3e9689d78670a231a3660db00fd4fd8f5c6345))
* **lifesciences:** strat generating apiv2beta ([be1d729](https://www.github.com/googleapis/google-cloud-go/commit/be1d729fdaa18eb1c782f3b09a6bb8fd6b3a144c))
* **tpu:** start generating apiv1 ([#4199](https://www.github.com/googleapis/google-cloud-go/issues/4199)) ([cac48ea](https://www.github.com/googleapis/google-cloud-go/commit/cac48eab960cd34cc20732f6a1aeb93c540a036b))


### Bug Fixes

* **bttest:** fix race condition in SampleRowKeys ([#4207](https://www.github.com/googleapis/google-cloud-go/issues/4207)) ([5711fb1](https://www.github.com/googleapis/google-cloud-go/commit/5711fb10d25c458807598d736a232bb2210a047a))
* **documentai:** Fix Ruby gem title of documentai v1 (package not currently published) ([9e80ea0](https://www.github.com/googleapis/google-cloud-go/commit/9e80ea0d053b06876418194f65a478045dc4fe6c))

## [0.83.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.82.0...v0.83.0) (2021-06-02)


### Features

* **dialogflow:** added a field in the query result to indicate whether slot filling is cancelled. ([f9cda8f](https://www.github.com/googleapis/google-cloud-go/commit/f9cda8fb6c3d76a062affebe6649f0a43aeb96f3))
* **essentialcontacts:** start generating apiv1 ([#4118](https://www.github.com/googleapis/google-cloud-go/issues/4118)) ([fe14afc](https://www.github.com/googleapis/google-cloud-go/commit/fe14afcf74e09089b22c4f5221cbe37046570fda))
* **gsuiteaddons:** start generating apiv1 ([#4082](https://www.github.com/googleapis/google-cloud-go/issues/4082)) ([6de5c99](https://www.github.com/googleapis/google-cloud-go/commit/6de5c99173c4eeaf777af18c47522ca15637d232))
* **osconfig:** OSConfig: add ExecResourceOutput and per step error message. ([f9cda8f](https://www.github.com/googleapis/google-cloud-go/commit/f9cda8fb6c3d76a062affebe6649f0a43aeb96f3))
* **osconfig:** start generating apiv1alpha ([#4119](https://www.github.com/googleapis/google-cloud-go/issues/4119)) ([8ad471f](https://www.github.com/googleapis/google-cloud-go/commit/8ad471f26087ec076460df6dcf27769ffe1b8834))
* **privatecatalog:** start generating apiv1beta1 ([500c1a6](https://www.github.com/googleapis/google-cloud-go/commit/500c1a6101f624cb6032f0ea16147645a02e7076))
* **serviceusage:** start generating apiv1 ([#4120](https://www.github.com/googleapis/google-cloud-go/issues/4120)) ([e4531f9](https://www.github.com/googleapis/google-cloud-go/commit/e4531f93cfeb6388280bb253ef6eb231aba37098))
* **shell:** start generating apiv1 ([500c1a6](https://www.github.com/googleapis/google-cloud-go/commit/500c1a6101f624cb6032f0ea16147645a02e7076))
* **vpcaccess:** start generating apiv1 ([500c1a6](https://www.github.com/googleapis/google-cloud-go/commit/500c1a6101f624cb6032f0ea16147645a02e7076))

## [0.82.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.81.0...v0.82.0) (2021-05-17)


### Features

* **billing/budgets:** Added support for configurable budget time period. fix: Updated some documentation links. ([83b1b3b](https://www.github.com/googleapis/google-cloud-go/commit/83b1b3b648c6d9225f07f00e8c0cdabc3d1fc1ab))
* **billing/budgets:** Added support for configurable budget time period. fix: Updated some documentation links. ([83b1b3b](https://www.github.com/googleapis/google-cloud-go/commit/83b1b3b648c6d9225f07f00e8c0cdabc3d1fc1ab))
* **cloudbuild/apiv1:** Add fields for Pub/Sub triggers ([8b4adbf](https://www.github.com/googleapis/google-cloud-go/commit/8b4adbf9815e1ec229dfbcfb9189d3ea63112e1b))
* **cloudbuild/apiv1:** Implementation of Source Manifests: - Added message StorageSourceManifest as an option for the Source message - Added StorageSourceManifest field to the SourceProvenance message ([7fd2ccd](https://www.github.com/googleapis/google-cloud-go/commit/7fd2ccd26adec1468e15fe84bf75210255a9dfea))
* **clouddms:** start generating apiv1 ([#4081](https://www.github.com/googleapis/google-cloud-go/issues/4081)) ([29df85c](https://www.github.com/googleapis/google-cloud-go/commit/29df85c40ab64d59e389a980c9ce550077839763))
* **dataproc:** update the Dataproc V1 API client library ([9a459d5](https://www.github.com/googleapis/google-cloud-go/commit/9a459d5d149b9c3b02a35d4245d164b899ff09b3))
* **dialogflow/cx:** add support for service directory webhooks ([7fd2ccd](https://www.github.com/googleapis/google-cloud-go/commit/7fd2ccd26adec1468e15fe84bf75210255a9dfea))
* **dialogflow/cx:** add support for service directory webhooks ([7fd2ccd](https://www.github.com/googleapis/google-cloud-go/commit/7fd2ccd26adec1468e15fe84bf75210255a9dfea))
* **dialogflow/cx:** support setting current_page to resume sessions; expose transition_route_groups in flows and language_code in webhook ([9a459d5](https://www.github.com/googleapis/google-cloud-go/commit/9a459d5d149b9c3b02a35d4245d164b899ff09b3))
* **dialogflow/cx:** support setting current_page to resume sessions; expose transition_route_groups in flows and language_code in webhook ([9a459d5](https://www.github.com/googleapis/google-cloud-go/commit/9a459d5d149b9c3b02a35d4245d164b899ff09b3))
* **dialogflow:** added more Environment RPCs feat: added Versions service feat: added Fulfillment service feat: added TextToSpeechSettings. feat: added location in some resource patterns. ([4f73dc1](https://www.github.com/googleapis/google-cloud-go/commit/4f73dc19c2e05ad6133a8eac3d62ddb522314540))
* **documentai:** add confidence field to the PageAnchor.PageRef in document.proto. ([d089dda](https://www.github.com/googleapis/google-cloud-go/commit/d089dda0089acb9aaef9b3da40b219476af9fc06))
* **documentai:** add confidence field to the PageAnchor.PageRef in document.proto. ([07fdcd1](https://www.github.com/googleapis/google-cloud-go/commit/07fdcd12499eac26f9b5fae01d6c1282c3e02b7c))
* **internal/gapicgen:** only update relevant gapic files ([#4066](https://www.github.com/googleapis/google-cloud-go/issues/4066)) ([5948bee](https://www.github.com/googleapis/google-cloud-go/commit/5948beedbadd491601bdee6a006cf685e94a85f4))
* **internal/gensnippets:** add license header and region tags ([#3924](https://www.github.com/googleapis/google-cloud-go/issues/3924)) ([e9ff7a0](https://www.github.com/googleapis/google-cloud-go/commit/e9ff7a0f9bb1cc67f5d0de47934811960429e72c))
* **internal/gensnippets:** initial commit ([#3922](https://www.github.com/googleapis/google-cloud-go/issues/3922)) ([3fabef0](https://www.github.com/googleapis/google-cloud-go/commit/3fabef032388713f732ab4dbfc51624cdca0f481))
* **internal:** auto-generate snippets ([#3949](https://www.github.com/googleapis/google-cloud-go/issues/3949)) ([b70e0fc](https://www.github.com/googleapis/google-cloud-go/commit/b70e0fccdc86813e0d97ff63b585822d4deafb38))
* **internal:** generate region tags for snippets ([#3962](https://www.github.com/googleapis/google-cloud-go/issues/3962)) ([ef2b90e](https://www.github.com/googleapis/google-cloud-go/commit/ef2b90ea6d47e27744c98a1a9ae0c487c5051808))
* **metastore:** start generateing apiv1 ([#4083](https://www.github.com/googleapis/google-cloud-go/issues/4083)) ([661610a](https://www.github.com/googleapis/google-cloud-go/commit/661610afa6a9113534884cafb138109536724310))
* **security/privateca:** start generating apiv1 ([#4023](https://www.github.com/googleapis/google-cloud-go/issues/4023)) ([08aa83a](https://www.github.com/googleapis/google-cloud-go/commit/08aa83a5371bb6485bc3b19b3ed5300f807ce69f))
* **securitycenter:** add canonical_name and folder fields ([5c5ca08](https://www.github.com/googleapis/google-cloud-go/commit/5c5ca08c637a23cfa3e3a051fea576e1feb324fd))
* **securitycenter:** add canonical_name and folder fields ([5c5ca08](https://www.github.com/googleapis/google-cloud-go/commit/5c5ca08c637a23cfa3e3a051fea576e1feb324fd))
* **speech:** add webm opus support. ([d089dda](https://www.github.com/googleapis/google-cloud-go/commit/d089dda0089acb9aaef9b3da40b219476af9fc06))
* **speech:** Support for spoken punctuation and spoken emojis. ([9a459d5](https://www.github.com/googleapis/google-cloud-go/commit/9a459d5d149b9c3b02a35d4245d164b899ff09b3))


### Bug Fixes

* **binaryauthorization:** add Java options to Binaryauthorization protos ([9a459d5](https://www.github.com/googleapis/google-cloud-go/commit/9a459d5d149b9c3b02a35d4245d164b899ff09b3))
* **internal/gapicgen:** filter out internal directory changes ([#4085](https://www.github.com/googleapis/google-cloud-go/issues/4085)) ([01473f6](https://www.github.com/googleapis/google-cloud-go/commit/01473f6d8db26c6e18969ace7f9e87c66e94ad9e))
* **internal/gapicgen:** use correct region tags for gensnippets ([#4022](https://www.github.com/googleapis/google-cloud-go/issues/4022)) ([8ccd689](https://www.github.com/googleapis/google-cloud-go/commit/8ccd689cab08f016008ca06a939a4828817d4a25))
* **internal/gensnippets:** run goimports ([#3931](https://www.github.com/googleapis/google-cloud-go/issues/3931)) ([10050f0](https://www.github.com/googleapis/google-cloud-go/commit/10050f05c20c226547d87c08168fa4bc551395c5))
* **internal:** append a new line to comply with go fmt ([#4028](https://www.github.com/googleapis/google-cloud-go/issues/4028)) ([a297278](https://www.github.com/googleapis/google-cloud-go/commit/a2972783c4af806199d1c67c9f63ad9677f20f34))
* **internal:** make sure formatting is run on snippets ([#4039](https://www.github.com/googleapis/google-cloud-go/issues/4039)) ([130dfc5](https://www.github.com/googleapis/google-cloud-go/commit/130dfc535396e98fc009585b0457e3bc48ead941)), refs [#4037](https://www.github.com/googleapis/google-cloud-go/issues/4037)
* **metastore:** increase metastore lro polling timeouts ([83b1b3b](https://www.github.com/googleapis/google-cloud-go/commit/83b1b3b648c6d9225f07f00e8c0cdabc3d1fc1ab))


### Miscellaneous Chores

* **all:** fix release version ([#4040](https://www.github.com/googleapis/google-cloud-go/issues/4040)) ([4c991a9](https://www.github.com/googleapis/google-cloud-go/commit/4c991a928665d9be93691decce0c653f430688b7))

## [0.81.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.80.0...v0.81.0) (2021-04-02)


### Features

* **datacatalog:** Policy Tag Manager v1 API service feat: new RenameTagTemplateFieldEnumValue API feat: adding fully_qualified_name in lookup and search feat: added DATAPROC_METASTORE integrated system along with new entry types: DATABASE and SERVICE docs: Documentation improvements ([2b02a03](https://www.github.com/googleapis/google-cloud-go/commit/2b02a03ff9f78884da5a8e7b64a336014c61bde7))
* **dialogflow/cx:** include original user query in WebhookRequest; add GetTextCaseresult API. doc: clarify resource format for session response. ([a0b1f6f](https://www.github.com/googleapis/google-cloud-go/commit/a0b1f6faae77d014fdee166ab018ddcd6f846ab4))
* **dialogflow/cx:** include original user query in WebhookRequest; add GetTextCaseresult API. doc: clarify resource format for session response. ([b5b4da6](https://www.github.com/googleapis/google-cloud-go/commit/b5b4da6952922440d03051f629f3166f731dfaa3))
* **dialogflow:** expose MP3_64_KBPS and MULAW for output audio encodings. ([b5b4da6](https://www.github.com/googleapis/google-cloud-go/commit/b5b4da6952922440d03051f629f3166f731dfaa3))
* **secretmanager:** Rotation for Secrets ([2b02a03](https://www.github.com/googleapis/google-cloud-go/commit/2b02a03ff9f78884da5a8e7b64a336014c61bde7))


### Bug Fixes

* **internal/godocfx:** filter out non-Cloud ([#3878](https://www.github.com/googleapis/google-cloud-go/issues/3878)) ([625aef9](https://www.github.com/googleapis/google-cloud-go/commit/625aef9b47181cf627587cc9cde9e400713c6678))

## [0.80.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.79.0...v0.80.0) (2021-03-23)


### ⚠ BREAKING CHANGES

* **all:** This is a breaking change in dialogflow

### Features

* **appengine:** added vm_liveness, search_api_available, network_settings, service_account, build_env_variables, kms_key_reference to v1 API ([fd04a55](https://www.github.com/googleapis/google-cloud-go/commit/fd04a552213f99619c714b5858548f61f4948493))
* **assuredworkloads:** Add 'resource_settings' field to provide custom properties (ids) for the provisioned projects. ([ab4824a](https://www.github.com/googleapis/google-cloud-go/commit/ab4824a7914864228e59b244d6382de862139524))
* **assuredworkloads:** add HIPAA and HITRUST compliance regimes ([ab4824a](https://www.github.com/googleapis/google-cloud-go/commit/ab4824a7914864228e59b244d6382de862139524))
* **dialogflow/cx:** added fallback option when restoring an agent docs: clarified experiment length ([cd70aa9](https://www.github.com/googleapis/google-cloud-go/commit/cd70aa9cc1a5dccfe4e49d2d6ca6db2119553c86))
* **dialogflow/cx:** start generating apiv3 ([#3850](https://www.github.com/googleapis/google-cloud-go/issues/3850)) ([febbdcf](https://www.github.com/googleapis/google-cloud-go/commit/febbdcf13fcea3f5d8186c3d3dface1c0d27ef9e)), refs [#3634](https://www.github.com/googleapis/google-cloud-go/issues/3634)
* **documentai:** add EVAL_SKIPPED value to the Provenance.OperationType enum in document.proto. ([cb43066](https://www.github.com/googleapis/google-cloud-go/commit/cb4306683926843f6e977f207fa6070bb9242a61))
* **documentai:** start generating apiv1 ([#3853](https://www.github.com/googleapis/google-cloud-go/issues/3853)) ([d68e604](https://www.github.com/googleapis/google-cloud-go/commit/d68e604c953eea90489f6134e71849b24dd0fcbf))
* **internal/godocfx:** add prettyprint class to code blocks ([#3819](https://www.github.com/googleapis/google-cloud-go/issues/3819)) ([6e49f21](https://www.github.com/googleapis/google-cloud-go/commit/6e49f2148b116ee439c8a882dcfeefb6e7647c57))
* **internal/godocfx:** handle Markdown content ([#3816](https://www.github.com/googleapis/google-cloud-go/issues/3816)) ([56d5d0a](https://www.github.com/googleapis/google-cloud-go/commit/56d5d0a900197fb2de46120a0eda649f2c17448f))
* **kms:** Add maxAttempts to retry policy for KMS gRPC service config feat: Add Bazel exports_files entry for KMS gRPC service config ([fd04a55](https://www.github.com/googleapis/google-cloud-go/commit/fd04a552213f99619c714b5858548f61f4948493))
* **resourcesettings:** start generating apiv1 ([#3854](https://www.github.com/googleapis/google-cloud-go/issues/3854)) ([3b288b4](https://www.github.com/googleapis/google-cloud-go/commit/3b288b4fa593c6cb418f696b5b26768967c20b9e))
* **speech:** Support output transcript to GCS for LongRunningRecognize. ([fd04a55](https://www.github.com/googleapis/google-cloud-go/commit/fd04a552213f99619c714b5858548f61f4948493))
* **speech:** Support output transcript to GCS for LongRunningRecognize. ([cd70aa9](https://www.github.com/googleapis/google-cloud-go/commit/cd70aa9cc1a5dccfe4e49d2d6ca6db2119553c86))
* **speech:** Support output transcript to GCS for LongRunningRecognize. ([35a8706](https://www.github.com/googleapis/google-cloud-go/commit/35a870662df8bf63c4ec10a0233d1d7a708007ee))


### Miscellaneous Chores

* **all:** auto-regenerate gapics ([#3837](https://www.github.com/googleapis/google-cloud-go/issues/3837)) ([ab4824a](https://www.github.com/googleapis/google-cloud-go/commit/ab4824a7914864228e59b244d6382de862139524))

## [0.79.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.78.0...v0.79.0) (2021-03-10)


### Features

* **apigateway:** start generating apiv1 ([#3726](https://www.github.com/googleapis/google-cloud-go/issues/3726)) ([66046da](https://www.github.com/googleapis/google-cloud-go/commit/66046da2a4be5971ce2655dc6a5e1fadb08c3d1f))
* **channel:** addition of billing_account field on Plan. docs: clarification that valid address lines are required for all customers. ([d4246aa](https://www.github.com/googleapis/google-cloud-go/commit/d4246aad4da3c3ef12350385f229bb908e3fb215))
* **dialogflow/cx:** allow to disable webhook invocation per request ([d4246aa](https://www.github.com/googleapis/google-cloud-go/commit/d4246aad4da3c3ef12350385f229bb908e3fb215))
* **dialogflow/cx:** allow to disable webhook invocation per request ([44c6bf9](https://www.github.com/googleapis/google-cloud-go/commit/44c6bf986f39a3c9fddf46788ae63bfbb3739441))
* **dialogflow:** Add CCAI API ([18c88c4](https://www.github.com/googleapis/google-cloud-go/commit/18c88c437bd1741eaf5bf5911b9da6f6ea7cd75d))
* **documentai:** remove the translation fields in document.proto. ([18c88c4](https://www.github.com/googleapis/google-cloud-go/commit/18c88c437bd1741eaf5bf5911b9da6f6ea7cd75d))
* **documentai:** Update documentai/v1beta3 protos: add support for boolean normalized value ([529925b](https://www.github.com/googleapis/google-cloud-go/commit/529925ba79f4d3191ef80a13e566d86210fe4d25))
* **internal/godocfx:** keep some cross links on same domain ([#3767](https://www.github.com/googleapis/google-cloud-go/issues/3767)) ([77f76ed](https://www.github.com/googleapis/google-cloud-go/commit/77f76ed09cb07a090ba9054063a7c002a35bca4e))
* **internal:** add ability to regenerate one module's docs ([#3777](https://www.github.com/googleapis/google-cloud-go/issues/3777)) ([dc15995](https://www.github.com/googleapis/google-cloud-go/commit/dc15995521bd065da4cfaae95642588919a8c548))
* **metastore:** added support for release channels when creating service ([18c88c4](https://www.github.com/googleapis/google-cloud-go/commit/18c88c437bd1741eaf5bf5911b9da6f6ea7cd75d))
* **metastore:** Publish Dataproc Metastore v1alpha API ([18c88c4](https://www.github.com/googleapis/google-cloud-go/commit/18c88c437bd1741eaf5bf5911b9da6f6ea7cd75d))
* **metastore:** start generating apiv1alpha ([#3747](https://www.github.com/googleapis/google-cloud-go/issues/3747)) ([359312a](https://www.github.com/googleapis/google-cloud-go/commit/359312ad6d4f61fb341d41ffa35fc0634979e650))
* **metastore:** start generating apiv1beta ([#3788](https://www.github.com/googleapis/google-cloud-go/issues/3788)) ([2977095](https://www.github.com/googleapis/google-cloud-go/commit/297709593ad32f234c0fbcfa228cffcfd3e591f4))
* **secretmanager:** added topic field to Secret ([f1323b1](https://www.github.com/googleapis/google-cloud-go/commit/f1323b10a3c7cc1d215730cefd3062064ef54c01))


### Bug Fixes

* **analytics/admin:** add `https://www.googleapis.com/auth/analytics.edit` OAuth2 scope to the list of acceptable scopes for all read only methods of the Admin API docs: update the documentation of the `update_mask` field used by Update() methods ([f1323b1](https://www.github.com/googleapis/google-cloud-go/commit/f1323b10a3c7cc1d215730cefd3062064ef54c01))
* **apigateway:** Provide resource definitions for service management and IAM resources ([18c88c4](https://www.github.com/googleapis/google-cloud-go/commit/18c88c437bd1741eaf5bf5911b9da6f6ea7cd75d))
* **functions:** Fix service namespace in grpc_service_config. ([7811a34](https://www.github.com/googleapis/google-cloud-go/commit/7811a34ef64d722480c640810251bb3a0d65d495))
* **internal/godocfx:** prevent index out of bounds when pkg == mod ([#3768](https://www.github.com/googleapis/google-cloud-go/issues/3768)) ([3d80b4e](https://www.github.com/googleapis/google-cloud-go/commit/3d80b4e93b0f7e857d6e9681d8d6a429750ecf80))
* **internal/godocfx:** use correct anchor links ([#3738](https://www.github.com/googleapis/google-cloud-go/issues/3738)) ([919039a](https://www.github.com/googleapis/google-cloud-go/commit/919039a01a006c41e720218bd55f83ce98a5edef))
* **internal:** fix Bash syntax ([#3779](https://www.github.com/googleapis/google-cloud-go/issues/3779)) ([3dd245d](https://www.github.com/googleapis/google-cloud-go/commit/3dd245dbdbfa84f0bbe5a476412d8463fe3e700c))
* **tables:** use area120tables_v1alpha1.yaml as api-service-config ([#3759](https://www.github.com/googleapis/google-cloud-go/issues/3759)) ([b130ec0](https://www.github.com/googleapis/google-cloud-go/commit/b130ec0aa946b1a1eaa4d5a7c33e72353ac1612e))

## [0.78.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.77.0...v0.78.0) (2021-02-22)


### Features

* **area120/tables:** Added ListWorkspaces, GetWorkspace, BatchDeleteRows APIs. ([16597fa](https://www.github.com/googleapis/google-cloud-go/commit/16597fa1ce549053c7183e8456e23f554a5501de))
* **area120/tables:** Added ListWorkspaces, GetWorkspace, BatchDeleteRows APIs. ([0bd21d7](https://www.github.com/googleapis/google-cloud-go/commit/0bd21d793f75924e5a2d033c58e8aaef89cf8113))
* **dialogflow:** add additional_bindings to Dialogflow v2 ListIntents API docs: update copyrights and session docs ([0bd21d7](https://www.github.com/googleapis/google-cloud-go/commit/0bd21d793f75924e5a2d033c58e8aaef89cf8113))
* **documentai:** Update documentai/v1beta3 protos ([613ced7](https://www.github.com/googleapis/google-cloud-go/commit/613ced702bbc82a154a4d3641b483f71c7cd1af4))
* **gkehub:** Update Membership API v1beta1 proto ([613ced7](https://www.github.com/googleapis/google-cloud-go/commit/613ced702bbc82a154a4d3641b483f71c7cd1af4))
* **servicecontrol:** Update the ruby_cloud_gapic_library rules for the libraries published to google-cloud-ruby to the form that works with build_gen (separate parameters for ruby_cloud_title and ruby_cloud_description). chore: Update Bazel-Ruby rules version. chore: Update build_gen version. ([0bd21d7](https://www.github.com/googleapis/google-cloud-go/commit/0bd21d793f75924e5a2d033c58e8aaef89cf8113))
* **speech:** Support Model Adaptation. ([0bd21d7](https://www.github.com/googleapis/google-cloud-go/commit/0bd21d793f75924e5a2d033c58e8aaef89cf8113))


### Bug Fixes

* **dialogflow/cx:** RunTestCase http template. PHP REST client lib can be generated. feat: Support transition route group coverage for Test Cases. ([613ced7](https://www.github.com/googleapis/google-cloud-go/commit/613ced702bbc82a154a4d3641b483f71c7cd1af4))
* **errorreporting:** Fixes ruby gem build ([0bd21d7](https://www.github.com/googleapis/google-cloud-go/commit/0bd21d793f75924e5a2d033c58e8aaef89cf8113))

## [0.77.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.76.0...v0.77.0) (2021-02-16)


### Features

* **channel:** Add Pub/Sub endpoints for Cloud Channel API. ([1aea7c8](https://www.github.com/googleapis/google-cloud-go/commit/1aea7c87d39eed87620b488ba0dd60b88ff26c04))
* **dialogflow/cx:** supports SentimentAnalysisResult in webhook request docs: minor updates in wording ([2b4414d](https://www.github.com/googleapis/google-cloud-go/commit/2b4414d973e3445725cd38901bf75340c97fc663))
* **errorreporting:** Make resolution status field available for error groups. Now callers can set the status of an error group by passing this to UpdateGroup. When not specified, it's treated like OPEN. feat: Make source location available for error groups created from GAE. ([2b4414d](https://www.github.com/googleapis/google-cloud-go/commit/2b4414d973e3445725cd38901bf75340c97fc663))
* **errorreporting:** Make resolution status field available for error groups. Now callers can set the status of an error group by passing this to UpdateGroup. When not specified, it's treated like OPEN. feat: Make source location available for error groups created from GAE. ([f66114b](https://www.github.com/googleapis/google-cloud-go/commit/f66114bc7233ad06e18f38dd39497a74d85fdbd8))
* **gkehub:** start generating apiv1beta1 ([#3698](https://www.github.com/googleapis/google-cloud-go/issues/3698)) ([8aed3bd](https://www.github.com/googleapis/google-cloud-go/commit/8aed3bd1bbbe983e4891c813e4c5dc9b3aa1b9b2))
* **internal/docfx:** full cross reference linking ([#3656](https://www.github.com/googleapis/google-cloud-go/issues/3656)) ([fcb7318](https://www.github.com/googleapis/google-cloud-go/commit/fcb7318eb338bf3828ac831ed06ca630e1876418))
* **memcache:** added ApplySoftwareUpdate API docs: various clarifications, new documentation for ApplySoftwareUpdate chore: update proto annotations ([2b4414d](https://www.github.com/googleapis/google-cloud-go/commit/2b4414d973e3445725cd38901bf75340c97fc663))
* **networkconnectivity:** Add state field in resources docs: Minor changes ([0b4370a](https://www.github.com/googleapis/google-cloud-go/commit/0b4370a0d397913d932dbbdc2046a958dc3b836a))
* **networkconnectivity:** Add state field in resources docs: Minor changes ([b4b5898](https://www.github.com/googleapis/google-cloud-go/commit/b4b58987368f80494bbc7f651f50e9123200fb3f))
* **recommendationengine:** start generating apiv1beta1 ([#3686](https://www.github.com/googleapis/google-cloud-go/issues/3686)) ([8f4e130](https://www.github.com/googleapis/google-cloud-go/commit/8f4e13009444d88a5a56144129f055623a2205ac))


### Bug Fixes

* **errorreporting:** Remove dependency on AppEngine's proto definitions. This also removes the source_references field. ([2b4414d](https://www.github.com/googleapis/google-cloud-go/commit/2b4414d973e3445725cd38901bf75340c97fc663))
* **errorreporting:** Update bazel builds for ER client libraries. ([0b4370a](https://www.github.com/googleapis/google-cloud-go/commit/0b4370a0d397913d932dbbdc2046a958dc3b836a))
* **internal/godocfx:** use exact list of top-level decls ([#3665](https://www.github.com/googleapis/google-cloud-go/issues/3665)) ([3cd2961](https://www.github.com/googleapis/google-cloud-go/commit/3cd2961bd7b9c29d82a21ba8850eff00c7c332fd))
* **kms:** do not retry on 13 INTERNAL ([2b4414d](https://www.github.com/googleapis/google-cloud-go/commit/2b4414d973e3445725cd38901bf75340c97fc663))
* **orgpolicy:** Fix constraint resource pattern annotation ([f66114b](https://www.github.com/googleapis/google-cloud-go/commit/f66114bc7233ad06e18f38dd39497a74d85fdbd8))
* **orgpolicy:** Fix constraint resource pattern annotation ([0b4370a](https://www.github.com/googleapis/google-cloud-go/commit/0b4370a0d397913d932dbbdc2046a958dc3b836a))
* **profiler:** make sure retries use the most up-to-date copy of the trailer ([#3660](https://www.github.com/googleapis/google-cloud-go/issues/3660)) ([3ba9ebc](https://www.github.com/googleapis/google-cloud-go/commit/3ba9ebcee2b8b43cdf2c8f8a3d810516a604b363))
* **vision:** sync vision v1 protos to get extra FaceAnnotation Landmark Types ([2b4414d](https://www.github.com/googleapis/google-cloud-go/commit/2b4414d973e3445725cd38901bf75340c97fc663))

## [0.76.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.75.0...v0.76.0) (2021-02-02)


### Features

* **accessapproval:** Migrate the Bazel rules for the libraries published to google-cloud-ruby to use the gapic-generator-ruby instead of the monolith generator. ([ac22beb](https://www.github.com/googleapis/google-cloud-go/commit/ac22beb9b90771b24c8b35db7587ad3f5c0a970e))
* **all:** auto-regenerate gapics ([#3526](https://www.github.com/googleapis/google-cloud-go/issues/3526)) ([ab2af0b](https://www.github.com/googleapis/google-cloud-go/commit/ab2af0b32630dd97f44800f4e273184f887375db))
* **all:** auto-regenerate gapics ([#3539](https://www.github.com/googleapis/google-cloud-go/issues/3539)) ([84d4d8a](https://www.github.com/googleapis/google-cloud-go/commit/84d4d8ae2d3fbf34a4a312a0a2e4062d18caaa3d))
* **all:** auto-regenerate gapics ([#3546](https://www.github.com/googleapis/google-cloud-go/issues/3546)) ([959fde5](https://www.github.com/googleapis/google-cloud-go/commit/959fde5ab12f7aee206dd46022e3cad1bc3470f7))
* **all:** auto-regenerate gapics ([#3563](https://www.github.com/googleapis/google-cloud-go/issues/3563)) ([102112a](https://www.github.com/googleapis/google-cloud-go/commit/102112a4e9285a16645aabc89789f613d4f47c9e))
* **all:** auto-regenerate gapics ([#3576](https://www.github.com/googleapis/google-cloud-go/issues/3576)) ([ac22beb](https://www.github.com/googleapis/google-cloud-go/commit/ac22beb9b90771b24c8b35db7587ad3f5c0a970e))
* **all:** auto-regenerate gapics ([#3580](https://www.github.com/googleapis/google-cloud-go/issues/3580)) ([9974a80](https://www.github.com/googleapis/google-cloud-go/commit/9974a8017b5de8129a586f2404a23396caea0ee1))
* **all:** auto-regenerate gapics ([#3587](https://www.github.com/googleapis/google-cloud-go/issues/3587)) ([3859a6f](https://www.github.com/googleapis/google-cloud-go/commit/3859a6ffc447e9c0b4ef231e2788fbbcfe48a94f))
* **all:** auto-regenerate gapics ([#3598](https://www.github.com/googleapis/google-cloud-go/issues/3598)) ([7bdebad](https://www.github.com/googleapis/google-cloud-go/commit/7bdebadbe06774c94ab745dfef4ce58ce40a5582))
* **appengine:** start generating apiv1 ([#3561](https://www.github.com/googleapis/google-cloud-go/issues/3561)) ([2b6a3b4](https://www.github.com/googleapis/google-cloud-go/commit/2b6a3b4609e389da418a83eb60a8ae3710d646d7))
* **assuredworkloads:** updated google.cloud.assuredworkloads.v1beta1.AssuredWorkloadsService service. Clients can now create workloads with US_REGIONAL_ACCESS compliance regime ([7bdebad](https://www.github.com/googleapis/google-cloud-go/commit/7bdebadbe06774c94ab745dfef4ce58ce40a5582))
* **binaryauthorization:** start generating apiv1beta1 ([#3562](https://www.github.com/googleapis/google-cloud-go/issues/3562)) ([56e18a6](https://www.github.com/googleapis/google-cloud-go/commit/56e18a64836ab9482528b212eb139f649f7a35c3))
* **channel:** Add Pub/Sub endpoints for Cloud Channel API. ([9070c86](https://www.github.com/googleapis/google-cloud-go/commit/9070c86e2c69f9405d42fc0e6fe7afd4a256d8b8))
* **cloudtasks:** introducing field: ListQueuesRequest.read_mask, GetQueueRequest.read_mask, Queue.task_ttl, Queue.tombstone_ttl, Queue.stats, Task.pull_message and introducing messages: QueueStats PullMessage docs: updates to max burst size description ([7bdebad](https://www.github.com/googleapis/google-cloud-go/commit/7bdebadbe06774c94ab745dfef4ce58ce40a5582))
* **cloudtasks:** introducing fields: ListQueuesRequest.read_mask, GetQueueRequest.read_mask, Queue.task_ttl, Queue.tombstone_ttl, Queue.stats and introducing messages: QueueStats docs: updates to AppEngineHttpRequest description ([7bdebad](https://www.github.com/googleapis/google-cloud-go/commit/7bdebadbe06774c94ab745dfef4ce58ce40a5582))
* **datalabeling:** start generating apiv1beta1 ([#3582](https://www.github.com/googleapis/google-cloud-go/issues/3582)) ([d8a7fee](https://www.github.com/googleapis/google-cloud-go/commit/d8a7feef51d3344fa7e258aba1d9fbdab56dadcf))
* **dataqna:** start generating apiv1alpha ([#3586](https://www.github.com/googleapis/google-cloud-go/issues/3586)) ([24c5b8f](https://www.github.com/googleapis/google-cloud-go/commit/24c5b8f4f45f8cd8b3001b1ca5a8d80e9f3b39d5))
* **dialogflow/cx:** Add new Experiment service docs: minor doc update on redact field in intent.proto and page.proto ([0959f27](https://www.github.com/googleapis/google-cloud-go/commit/0959f27e85efe94d39437ceef0ff62ddceb8e7a7))
* **dialogflow/cx:** added support for test cases and agent validation ([7bdebad](https://www.github.com/googleapis/google-cloud-go/commit/7bdebadbe06774c94ab745dfef4ce58ce40a5582))
* **dialogflow/cx:** added support for test cases and agent validation ([3859a6f](https://www.github.com/googleapis/google-cloud-go/commit/3859a6ffc447e9c0b4ef231e2788fbbcfe48a94f))
* **dialogflow:** add C++ targets for DialogFlow ([959fde5](https://www.github.com/googleapis/google-cloud-go/commit/959fde5ab12f7aee206dd46022e3cad1bc3470f7))
* **documentai:** start generating apiv1beta3 ([#3595](https://www.github.com/googleapis/google-cloud-go/issues/3595)) ([5ae21fa](https://www.github.com/googleapis/google-cloud-go/commit/5ae21fa1cfb8b8dacbcd0fc43eee430f7db63102))
* **domains:** start generating apiv1beta1 ([#3632](https://www.github.com/googleapis/google-cloud-go/issues/3632)) ([b8ada6f](https://www.github.com/googleapis/google-cloud-go/commit/b8ada6f197e680d0bb26aa031e6431bc099a3149))
* **godocfx:** include alt documentation link ([#3530](https://www.github.com/googleapis/google-cloud-go/issues/3530)) ([806cdd5](https://www.github.com/googleapis/google-cloud-go/commit/806cdd56fb6fdddd7a6c1354e55e0d1259bd6c8b))
* **internal/gapicgen:** change commit formatting to match standard ([#3500](https://www.github.com/googleapis/google-cloud-go/issues/3500)) ([d1e3d46](https://www.github.com/googleapis/google-cloud-go/commit/d1e3d46c47c425581e2b149c07f8e27ffc373c7e))
* **internal/godocfx:** xref function declarations ([#3615](https://www.github.com/googleapis/google-cloud-go/issues/3615)) ([2bdbb87](https://www.github.com/googleapis/google-cloud-go/commit/2bdbb87a682d799cf5e262a61a3ef1faf41151af))
* **mediatranslation:** start generating apiv1beta1 ([#3636](https://www.github.com/googleapis/google-cloud-go/issues/3636)) ([4129469](https://www.github.com/googleapis/google-cloud-go/commit/412946966cf7f53c51deff1b1cc1a12d62ed0279))
* **memcache:** start generating apiv1 ([#3579](https://www.github.com/googleapis/google-cloud-go/issues/3579)) ([eabf7cf](https://www.github.com/googleapis/google-cloud-go/commit/eabf7cfde7b3a3cc1b35c320ba52e07be9926359))
* **networkconnectivity:** initial generation of apiv1alpha1 ([#3567](https://www.github.com/googleapis/google-cloud-go/issues/3567)) ([adf489a](https://www.github.com/googleapis/google-cloud-go/commit/adf489a536292e3196677621477eae0d52761e7f))
* **orgpolicy:** start generating apiv2 ([#3652](https://www.github.com/googleapis/google-cloud-go/issues/3652)) ([c103847](https://www.github.com/googleapis/google-cloud-go/commit/c1038475779fda3589aa9659d4ad0b703036b531))
* **osconfig/agentendpoint:** add ApplyConfigTask to AgentEndpoint API ([9070c86](https://www.github.com/googleapis/google-cloud-go/commit/9070c86e2c69f9405d42fc0e6fe7afd4a256d8b8))
* **osconfig/agentendpoint:** add ApplyConfigTask to AgentEndpoint API ([9af529c](https://www.github.com/googleapis/google-cloud-go/commit/9af529c21e98b62c4617f7a7191c307659cf8bb8))
* **recommender:** add bindings for folder/org type resources for protos in recommendations, insights and recommender_service to enable v1 api for folder/org ([7bdebad](https://www.github.com/googleapis/google-cloud-go/commit/7bdebadbe06774c94ab745dfef4ce58ce40a5582))
* **recommender:** auto generated cl for enabling v1beta1 folder/org APIs and integration test ([7bdebad](https://www.github.com/googleapis/google-cloud-go/commit/7bdebadbe06774c94ab745dfef4ce58ce40a5582))
* **resourcemanager:** start generating apiv2 ([#3575](https://www.github.com/googleapis/google-cloud-go/issues/3575)) ([93d0ebc](https://www.github.com/googleapis/google-cloud-go/commit/93d0ebceb4270351518a13958005bb68f0cace60))
* **secretmanager:** added expire_time and ttl fields to Secret ([9974a80](https://www.github.com/googleapis/google-cloud-go/commit/9974a8017b5de8129a586f2404a23396caea0ee1))
* **secretmanager:** added expire_time and ttl fields to Secret ([ac22beb](https://www.github.com/googleapis/google-cloud-go/commit/ac22beb9b90771b24c8b35db7587ad3f5c0a970e))
* **servicecontrol:** start generating apiv1 ([#3644](https://www.github.com/googleapis/google-cloud-go/issues/3644)) ([f84938b](https://www.github.com/googleapis/google-cloud-go/commit/f84938bb4042a5629fd66bda42de028fd833648a))
* **servicemanagement:** start generating apiv1 ([#3614](https://www.github.com/googleapis/google-cloud-go/issues/3614)) ([b96134f](https://www.github.com/googleapis/google-cloud-go/commit/b96134fe91c182237359000cd544af5fec60d7db))


### Bug Fixes

* **datacatalog:** Update PHP package name casing to match the PHP namespace in the proto files ([c7ecf0f](https://www.github.com/googleapis/google-cloud-go/commit/c7ecf0f3f454606b124e52d20af2545b2c68646f))
* **internal/godocfx:** add TOC element for module root package ([#3599](https://www.github.com/googleapis/google-cloud-go/issues/3599)) ([1d6eb23](https://www.github.com/googleapis/google-cloud-go/commit/1d6eb238206fcf8815d88981527ef176851afd7a))
* **profiler:** Force gax to retry in case of certificate errors ([#3178](https://www.github.com/googleapis/google-cloud-go/issues/3178)) ([35dcd72](https://www.github.com/googleapis/google-cloud-go/commit/35dcd725dcd03266ed7439de40c277376b38cd71))

## [0.75.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.74.0...v0.75.0) (2021-01-11)


### Features

* **all:** auto-regenerate gapics , refs [#3514](https://www.github.com/googleapis/google-cloud-go/issues/3514) [#3501](https://www.github.com/googleapis/google-cloud-go/issues/3501) [#3497](https://www.github.com/googleapis/google-cloud-go/issues/3497) [#3455](https://www.github.com/googleapis/google-cloud-go/issues/3455) [#3448](https://www.github.com/googleapis/google-cloud-go/issues/3448)
* **channel:** start generating apiv1 ([#3517](https://www.github.com/googleapis/google-cloud-go/issues/3517)) ([2cf3b3c](https://www.github.com/googleapis/google-cloud-go/commit/2cf3b3cf7d99f2efd6868a710fad9e935fc87965))


### Bug Fixes

* **internal/gapicgen:** don't regen files that have been deleted ([#3471](https://www.github.com/googleapis/google-cloud-go/issues/3471)) ([112ca94](https://www.github.com/googleapis/google-cloud-go/commit/112ca9416cc8a2502b32547dc8d789655452f84a))

## [0.74.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.73.0...v0.74.0) (2020-12-10)


### Features

* **all:** auto-regenerate gapics , refs [#3440](https://www.github.com/googleapis/google-cloud-go/issues/3440) [#3436](https://www.github.com/googleapis/google-cloud-go/issues/3436) [#3394](https://www.github.com/googleapis/google-cloud-go/issues/3394) [#3391](https://www.github.com/googleapis/google-cloud-go/issues/3391) [#3374](https://www.github.com/googleapis/google-cloud-go/issues/3374)
* **internal/gapicgen:** support generating only gapics with genlocal ([#3383](https://www.github.com/googleapis/google-cloud-go/issues/3383)) ([eaa742a](https://www.github.com/googleapis/google-cloud-go/commit/eaa742a248dc7d93c019863248f28e37f88aae84))
* **servicedirectory:** start generating apiv1 ([#3382](https://www.github.com/googleapis/google-cloud-go/issues/3382)) ([2774925](https://www.github.com/googleapis/google-cloud-go/commit/2774925925909071ebc585cf7400373334c156ba))


### Bug Fixes

* **internal/gapicgen:** don't create genproto pr as draft ([#3379](https://www.github.com/googleapis/google-cloud-go/issues/3379)) ([517ab0f](https://www.github.com/googleapis/google-cloud-go/commit/517ab0f25e544498c5374b256354bc41ba936ad5))

## [0.73.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.72.0...v0.73.0) (2020-12-04)


### Features

* **all:** auto-regenerate gapics , refs [#3335](https://www.github.com/googleapis/google-cloud-go/issues/3335) [#3294](https://www.github.com/googleapis/google-cloud-go/issues/3294) [#3250](https://www.github.com/googleapis/google-cloud-go/issues/3250) [#3229](https://www.github.com/googleapis/google-cloud-go/issues/3229) [#3211](https://www.github.com/googleapis/google-cloud-go/issues/3211) [#3217](https://www.github.com/googleapis/google-cloud-go/issues/3217) [#3212](https://www.github.com/googleapis/google-cloud-go/issues/3212) [#3209](https://www.github.com/googleapis/google-cloud-go/issues/3209) [#3206](https://www.github.com/googleapis/google-cloud-go/issues/3206) [#3199](https://www.github.com/googleapis/google-cloud-go/issues/3199)
* **artifactregistry:** start generating apiv1beta2 ([#3352](https://www.github.com/googleapis/google-cloud-go/issues/3352)) ([2e6f20b](https://www.github.com/googleapis/google-cloud-go/commit/2e6f20b0ab438b0b366a1a3802fc64d1a0e66fff))
* **internal:** copy pubsub Message and PublishResult to internal/pubsub ([#3351](https://www.github.com/googleapis/google-cloud-go/issues/3351)) ([82521ee](https://www.github.com/googleapis/google-cloud-go/commit/82521ee5038735c1663525658d27e4df00ec90be))
* **internal/gapicgen:** support adding context to regen ([#3174](https://www.github.com/googleapis/google-cloud-go/issues/3174)) ([941ab02](https://www.github.com/googleapis/google-cloud-go/commit/941ab029ba6f7f33e8b2e31e3818aeb68312a999))
* **internal/kokoro:** add ability to regen all DocFX YAML ([#3191](https://www.github.com/googleapis/google-cloud-go/issues/3191)) ([e12046b](https://www.github.com/googleapis/google-cloud-go/commit/e12046bc4431d33aee72c324e6eb5cc907a4214a))


### Bug Fixes

* **internal/godocfx:** filter out test packages from other modules ([#3197](https://www.github.com/googleapis/google-cloud-go/issues/3197)) ([1d397aa](https://www.github.com/googleapis/google-cloud-go/commit/1d397aa8b41f8f980cba1d3dcc50f11e4d4f4ca0))

## [0.72.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.71.0...v0.72.0) (2020-11-10)


### Features

* **all:** auto-regenerate gapics , refs [#3177](https://www.github.com/googleapis/google-cloud-go/issues/3177) [#3164](https://www.github.com/googleapis/google-cloud-go/issues/3164) [#3149](https://www.github.com/googleapis/google-cloud-go/issues/3149) [#3142](https://www.github.com/googleapis/google-cloud-go/issues/3142) [#3136](https://www.github.com/googleapis/google-cloud-go/issues/3136) [#3130](https://www.github.com/googleapis/google-cloud-go/issues/3130) [#3121](https://www.github.com/googleapis/google-cloud-go/issues/3121) [#3119](https://www.github.com/googleapis/google-cloud-go/issues/3119)


### Bug Fixes

* **all:** Update hand-written clients to not use WithEndpoint override ([#3111](https://www.github.com/googleapis/google-cloud-go/issues/3111)) ([f0cfd05](https://www.github.com/googleapis/google-cloud-go/commit/f0cfd0532f5204ff16f7bae406efa72603d16f44))
* **internal/godocfx:** rename README files to pkg-readme ([#3185](https://www.github.com/googleapis/google-cloud-go/issues/3185)) ([d3a8571](https://www.github.com/googleapis/google-cloud-go/commit/d3a85719be411b692aede3331abb29b5a7b3da9a))


## [0.71.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.70.0...v0.71.0) (2020-10-30)


### Features

* **all:** auto-regenerate gapics , refs [#3115](https://www.github.com/googleapis/google-cloud-go/issues/3115) [#3106](https://www.github.com/googleapis/google-cloud-go/issues/3106) [#3102](https://www.github.com/googleapis/google-cloud-go/issues/3102) [#3083](https://www.github.com/googleapis/google-cloud-go/issues/3083) [#3073](https://www.github.com/googleapis/google-cloud-go/issues/3073) [#3057](https://www.github.com/googleapis/google-cloud-go/issues/3057) [#3044](https://www.github.com/googleapis/google-cloud-go/issues/3044)
* **billing/budgets:** start generating apiv1 ([#3099](https://www.github.com/googleapis/google-cloud-go/issues/3099)) ([e760c85](https://www.github.com/googleapis/google-cloud-go/commit/e760c859de88a6e79b6dffc653dbf75f1630d8e3))
* **internal:** auto-run godocfx on new mods ([#3069](https://www.github.com/googleapis/google-cloud-go/issues/3069)) ([49f497e](https://www.github.com/googleapis/google-cloud-go/commit/49f497eab80ce34dfb4ca41f033a5c0429ff5e42))
* **pubsublite:** Added Pub/Sub Lite clients and routing headers ([#3105](https://www.github.com/googleapis/google-cloud-go/issues/3105)) ([98668fa](https://www.github.com/googleapis/google-cloud-go/commit/98668fa5457d26ed34debee708614f027020e5bc))
* **pubsublite:** Message type and message routers ([#3077](https://www.github.com/googleapis/google-cloud-go/issues/3077)) ([179fc55](https://www.github.com/googleapis/google-cloud-go/commit/179fc550b545a5344358a243da7007ffaa7b5171))
* **pubsublite:** Pub/Sub Lite admin client ([#3036](https://www.github.com/googleapis/google-cloud-go/issues/3036)) ([749473e](https://www.github.com/googleapis/google-cloud-go/commit/749473ead30bf1872634821d3238d1299b99acc6))
* **pubsublite:** Publish settings and errors ([#3075](https://www.github.com/googleapis/google-cloud-go/issues/3075)) ([9eb9fcb](https://www.github.com/googleapis/google-cloud-go/commit/9eb9fcb79f17ad7c08c77c455ba3e8d89e3bdbf2))
* **pubsublite:** Retryable stream wrapper ([#3068](https://www.github.com/googleapis/google-cloud-go/issues/3068)) ([97cfd45](https://www.github.com/googleapis/google-cloud-go/commit/97cfd4587f2f51996bd685ff486308b70eb51900))


### Bug Fixes

* **internal/kokoro:** remove unnecessary cd ([#3071](https://www.github.com/googleapis/google-cloud-go/issues/3071)) ([c1a4c3e](https://www.github.com/googleapis/google-cloud-go/commit/c1a4c3eaffcdc3cffe0e223fcfa1f60879cd23bb))
* **pubsublite:** Disable integration tests for project id ([#3087](https://www.github.com/googleapis/google-cloud-go/issues/3087)) ([a0982f7](https://www.github.com/googleapis/google-cloud-go/commit/a0982f79d6461feabdf31363f29fed7dc5677fe7))

## [0.70.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.69.0...v0.70.0) (2020-10-19)


### Features

* **all:** auto-regenerate gapics , refs [#3047](https://www.github.com/googleapis/google-cloud-go/issues/3047) [#3035](https://www.github.com/googleapis/google-cloud-go/issues/3035) [#3025](https://www.github.com/googleapis/google-cloud-go/issues/3025)
* **managedidentities:** start generating apiv1 ([#3032](https://www.github.com/googleapis/google-cloud-go/issues/3032)) ([10ccca2](https://www.github.com/googleapis/google-cloud-go/commit/10ccca238074d24fea580a4cd8e64478818b0b44))
* **pubsublite:** Types for resource paths and topic/subscription configs ([#3026](https://www.github.com/googleapis/google-cloud-go/issues/3026)) ([6f7fa86](https://www.github.com/googleapis/google-cloud-go/commit/6f7fa86ed906258f98d996aab40184f3a46f9714))

## [0.69.1](https://www.github.com/googleapis/google-cloud-go/compare/v0.69.0...v0.69.1) (2020-10-14)

This is an empty release that was created solely to aid in pubsublite's module
carve out. See: https://github.com/golang/go/wiki/Modules#is-it-possible-to-add-a-module-to-a-multi-module-repository.

## [0.69.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.68.0...v0.69.0) (2020-10-14)


### Features

* **accessapproval:** start generating apiv1 ([#3002](https://www.github.com/googleapis/google-cloud-go/issues/3002)) ([709d6e7](https://www.github.com/googleapis/google-cloud-go/commit/709d6e76393e6ac00ff488efd83bfe873173b045))
* **all:** auto-regenerate gapics , refs [#3010](https://www.github.com/googleapis/google-cloud-go/issues/3010) [#3005](https://www.github.com/googleapis/google-cloud-go/issues/3005) [#2993](https://www.github.com/googleapis/google-cloud-go/issues/2993) [#2989](https://www.github.com/googleapis/google-cloud-go/issues/2989) [#2981](https://www.github.com/googleapis/google-cloud-go/issues/2981) [#2976](https://www.github.com/googleapis/google-cloud-go/issues/2976) [#2968](https://www.github.com/googleapis/google-cloud-go/issues/2968) [#2958](https://www.github.com/googleapis/google-cloud-go/issues/2958)
* **cmd/go-cloud-debug-agent:** mark as deprecated ([#2964](https://www.github.com/googleapis/google-cloud-go/issues/2964)) ([276ec88](https://www.github.com/googleapis/google-cloud-go/commit/276ec88b05852c33a3ba437e18d072f7ffd8fd33))
* **godocfx:** add nesting to TOC ([#2972](https://www.github.com/googleapis/google-cloud-go/issues/2972)) ([3a49b2d](https://www.github.com/googleapis/google-cloud-go/commit/3a49b2d142a353f98429235c3f380431430b4dbf))
* **internal/godocfx:** HTML-ify package summary ([#2986](https://www.github.com/googleapis/google-cloud-go/issues/2986)) ([9e64b01](https://www.github.com/googleapis/google-cloud-go/commit/9e64b018255bd8d9b31d60e8f396966251de946b))
* **internal/kokoro:** make publish_docs VERSION optional ([#2979](https://www.github.com/googleapis/google-cloud-go/issues/2979)) ([76e35f6](https://www.github.com/googleapis/google-cloud-go/commit/76e35f689cb60bd5db8e14b8c8d367c5902bcb0e))
* **websecurityscanner:** start generating apiv1 ([#3006](https://www.github.com/googleapis/google-cloud-go/issues/3006)) ([1d92e20](https://www.github.com/googleapis/google-cloud-go/commit/1d92e2062a13f62d7a96be53a7354c0cacca6a85))


### Bug Fixes

* **godocfx:** make extra files optional, filter out third_party ([#2985](https://www.github.com/googleapis/google-cloud-go/issues/2985)) ([f268921](https://www.github.com/googleapis/google-cloud-go/commit/f2689214a24b2e325d3e8f54441bb11fbef925f0))

## [0.68.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.67.0...v0.68.0) (2020-10-02)


### Features

* **all:** auto-regenerate gapics , refs [#2952](https://www.github.com/googleapis/google-cloud-go/issues/2952) [#2944](https://www.github.com/googleapis/google-cloud-go/issues/2944) [#2935](https://www.github.com/googleapis/google-cloud-go/issues/2935)

## [0.67.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.66.0...v0.67.0) (2020-09-29)


### Features

* **all:** auto-regenerate gapics , refs [#2933](https://www.github.com/googleapis/google-cloud-go/issues/2933) [#2919](https://www.github.com/googleapis/google-cloud-go/issues/2919) [#2913](https://www.github.com/googleapis/google-cloud-go/issues/2913) [#2910](https://www.github.com/googleapis/google-cloud-go/issues/2910) [#2899](https://www.github.com/googleapis/google-cloud-go/issues/2899) [#2897](https://www.github.com/googleapis/google-cloud-go/issues/2897) [#2886](https://www.github.com/googleapis/google-cloud-go/issues/2886) [#2877](https://www.github.com/googleapis/google-cloud-go/issues/2877) [#2869](https://www.github.com/googleapis/google-cloud-go/issues/2869) [#2864](https://www.github.com/googleapis/google-cloud-go/issues/2864)
* **assuredworkloads:** start generating apiv1beta1 ([#2866](https://www.github.com/googleapis/google-cloud-go/issues/2866)) ([7598c4d](https://www.github.com/googleapis/google-cloud-go/commit/7598c4dd2462e8270a2c7b1f496af58ca81ff568))
* **dialogflow/cx:** start generating apiv3beta1 ([#2875](https://www.github.com/googleapis/google-cloud-go/issues/2875)) ([37ca93a](https://www.github.com/googleapis/google-cloud-go/commit/37ca93ad69eda363d956f0174d444ed5914f5a72))
* **docfx:** add support for examples ([#2884](https://www.github.com/googleapis/google-cloud-go/issues/2884)) ([0cc0de3](https://www.github.com/googleapis/google-cloud-go/commit/0cc0de300d58be6d3b7eeb2f1baebfa6df076830))
* **godocfx:** include README in output ([#2927](https://www.github.com/googleapis/google-cloud-go/issues/2927)) ([f084690](https://www.github.com/googleapis/google-cloud-go/commit/f084690a2ea08ce73bafaaced95ad271fd01e11e))
* **talent:** start generating apiv4 ([#2871](https://www.github.com/googleapis/google-cloud-go/issues/2871)) ([5c98071](https://www.github.com/googleapis/google-cloud-go/commit/5c98071b03822c58862d1fa5442ff36d627f1a61))


### Bug Fixes

* **godocfx:** filter out other modules, sort pkgs ([#2894](https://www.github.com/googleapis/google-cloud-go/issues/2894)) ([868db45](https://www.github.com/googleapis/google-cloud-go/commit/868db45e2e6f4e9ad48432be86c849f335e1083d))
* **godocfx:** shorten function names ([#2880](https://www.github.com/googleapis/google-cloud-go/issues/2880)) ([48a0217](https://www.github.com/googleapis/google-cloud-go/commit/48a0217930750c1f4327f2622b0f2a3ec8afc0b7))
* **translate:** properly name examples ([#2892](https://www.github.com/googleapis/google-cloud-go/issues/2892)) ([c19e141](https://www.github.com/googleapis/google-cloud-go/commit/c19e1415e6fa76b7ea66a7fc67ad3ba22670a2ba)), refs [#2883](https://www.github.com/googleapis/google-cloud-go/issues/2883)

## [0.66.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.65.0...v0.66.0) (2020-09-15)


### Features

* **all:** auto-regenerate gapics , refs [#2849](https://www.github.com/googleapis/google-cloud-go/issues/2849) [#2843](https://www.github.com/googleapis/google-cloud-go/issues/2843) [#2841](https://www.github.com/googleapis/google-cloud-go/issues/2841) [#2819](https://www.github.com/googleapis/google-cloud-go/issues/2819) [#2816](https://www.github.com/googleapis/google-cloud-go/issues/2816) [#2809](https://www.github.com/googleapis/google-cloud-go/issues/2809) [#2801](https://www.github.com/googleapis/google-cloud-go/issues/2801) [#2795](https://www.github.com/googleapis/google-cloud-go/issues/2795) [#2791](https://www.github.com/googleapis/google-cloud-go/issues/2791) [#2788](https://www.github.com/googleapis/google-cloud-go/issues/2788) [#2781](https://www.github.com/googleapis/google-cloud-go/issues/2781)
* **analytics/data:** start generating apiv1alpha ([#2796](https://www.github.com/googleapis/google-cloud-go/issues/2796)) ([e93132c](https://www.github.com/googleapis/google-cloud-go/commit/e93132c77725de3c80c34d566df269eabfcfde93))
* **area120/tables:** start generating apiv1alpha1 ([#2807](https://www.github.com/googleapis/google-cloud-go/issues/2807)) ([9e5a4d0](https://www.github.com/googleapis/google-cloud-go/commit/9e5a4d0dee0d83be0c020797a2f579d9e42ef521))
* **cloudbuild:** Start generating apiv1/v3 ([#2830](https://www.github.com/googleapis/google-cloud-go/issues/2830)) ([358a536](https://www.github.com/googleapis/google-cloud-go/commit/358a5368da64cf4868551652e852ceb453504f64))
* **godocfx:** create Go DocFX YAML generator ([#2854](https://www.github.com/googleapis/google-cloud-go/issues/2854)) ([37c70ac](https://www.github.com/googleapis/google-cloud-go/commit/37c70acd91768567106ff3b2b130835998d974c5))
* **security/privateca:** start generating apiv1beta1 ([#2806](https://www.github.com/googleapis/google-cloud-go/issues/2806)) ([f985141](https://www.github.com/googleapis/google-cloud-go/commit/f9851412183989dc69733a7e61ad39a9378cd893))
* **video/transcoder:** start generating apiv1beta1 ([#2797](https://www.github.com/googleapis/google-cloud-go/issues/2797)) ([390dda8](https://www.github.com/googleapis/google-cloud-go/commit/390dda8ff2c526e325e434ad0aec778b7aa97ea4))
* **workflows:** start generating apiv1beta ([#2799](https://www.github.com/googleapis/google-cloud-go/issues/2799)) ([0e39665](https://www.github.com/googleapis/google-cloud-go/commit/0e39665ccb788caec800e2887d433ca6e0cf9901))
* **workflows/executions:** start generating apiv1beta ([#2800](https://www.github.com/googleapis/google-cloud-go/issues/2800)) ([7eaa0d1](https://www.github.com/googleapis/google-cloud-go/commit/7eaa0d184c6a2141d8bf4514b3fd20715b50a580))


### Bug Fixes

* **internal/kokoro:** install the right version of docuploader ([#2861](https://www.github.com/googleapis/google-cloud-go/issues/2861)) ([d8489c1](https://www.github.com/googleapis/google-cloud-go/commit/d8489c141b8b02e83d6426f4baebd3658ae11639))
* **internal/kokoro:** remove extra dash in doc tarball ([#2862](https://www.github.com/googleapis/google-cloud-go/issues/2862)) ([690ddcc](https://www.github.com/googleapis/google-cloud-go/commit/690ddccc5202b5a70f1afa5c518dca37b6a0861c))
* **profiler:** do not collect disabled profile types ([#2836](https://www.github.com/googleapis/google-cloud-go/issues/2836)) ([faeb498](https://www.github.com/googleapis/google-cloud-go/commit/faeb4985bf6afdcddba4553efa874642bf7f08ed)), refs [#2835](https://www.github.com/googleapis/google-cloud-go/issues/2835)


### Reverts

* **cloudbuild): "feat(cloudbuild:** Start generating apiv1/v3" ([#2840](https://www.github.com/googleapis/google-cloud-go/issues/2840)) ([3aaf755](https://www.github.com/googleapis/google-cloud-go/commit/3aaf755476dfea1700986fc086f53fc1ab756557))

## [0.65.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.64.0...v0.65.0) (2020-08-27)


### Announcements

The following changes will be included in an upcoming release and are not 
included in this one.

#### Default Deadlines

By default, non-streaming methods, like Create or Get methods, will have a
default deadline applied to the context provided at call time, unless a context
deadline is already set. Streaming methods have no default deadline and will run
indefinitely, unless the context provided at call time contains a deadline.

To opt-out of this behavior, set the environment variable
`GOOGLE_API_GO_EXPERIMENTAL_DISABLE_DEFAULT_DEADLINE` to `true` prior to
initializing a client. This opt-out mechanism will be removed in a later
release, with a notice similar to this one ahead of its removal.


### Features

* **all:** auto-regenerate gapics , refs [#2774](https://www.github.com/googleapis/google-cloud-go/issues/2774) [#2764](https://www.github.com/googleapis/google-cloud-go/issues/2764)


### Bug Fixes

* **all:** correct minor typos ([#2756](https://www.github.com/googleapis/google-cloud-go/issues/2756)) ([03d78b5](https://www.github.com/googleapis/google-cloud-go/commit/03d78b5627819cb64d1f3866f90043f709e825e1))
* **compute/metadata:** remove leading slash for Get suffix ([#2760](https://www.github.com/googleapis/google-cloud-go/issues/2760)) ([f0d605c](https://www.github.com/googleapis/google-cloud-go/commit/f0d605ccf32391a9da056a2c551158bd076c128d))

## [0.64.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.63.0...v0.64.0) (2020-08-18)


### Features

* **all:** auto-regenerate gapics , refs [#2734](https://www.github.com/googleapis/google-cloud-go/issues/2734) [#2731](https://www.github.com/googleapis/google-cloud-go/issues/2731) [#2730](https://www.github.com/googleapis/google-cloud-go/issues/2730) [#2725](https://www.github.com/googleapis/google-cloud-go/issues/2725) [#2722](https://www.github.com/googleapis/google-cloud-go/issues/2722) [#2706](https://www.github.com/googleapis/google-cloud-go/issues/2706)
* **pubsublite:** start generating v1 ([#2700](https://www.github.com/googleapis/google-cloud-go/issues/2700)) ([d2e777f](https://www.github.com/googleapis/google-cloud-go/commit/d2e777f56e08146646b3ffb7a78856795094ab4e))

## [0.63.0](https://www.github.com/googleapis/google-cloud-go/compare/v0.62.0...v0.63.0) (2020-08-05)


### Features

* **all:** auto-regenerate gapics ([#2682](https://www.github.com/googleapis/google-cloud-go/issues/2682)) ([63bfd63](https://www.github.com/googleapis/google-cloud-go/commit/63bfd638da169e0f1f4fa4a5125da2955022dc04))
* **analytics/admin:** start generating apiv1alpha ([#2670](https://www.github.com/googleapis/google-cloud-go/issues/2670)) ([268199e](https://www.github.com/googleapis/google-cloud-go/commit/268199e5350a64a83ecf198e0e0fa4863f00fa6c))
* **functions/metadata:** Special-case marshaling ([#2669](https://www.github.com/googleapis/google-cloud-go/issues/2669)) ([d8d7fc6](https://www.github.com/googleapis/google-cloud-go/commit/d8d7fc66cbc42f79bec25fb0daaf53d926e3645b))
* **gaming:** start generate apiv1 ([#2681](https://www.github.com/googleapis/google-cloud-go/issues/2681)) ([1adfd0a](https://www.github.com/googleapis/google-cloud-go/commit/1adfd0aed6b2c0e1dd0c575a5ec0f49388fa5601))
* **internal/kokoro:** add script to test compatibility with samples ([#2637](https://www.github.com/googleapis/google-cloud-go/issues/2637)) ([f2aa76a](https://www.github.com/googleapis/google-cloud-go/commit/f2aa76a0058e86c1c33bb634d2c084b58f77ab32))

## v0.62.0

### Announcements

- There was a breaking change to `cloud.google.com/go/dataproc/apiv1` that was
  merged in [this PR](https://github.com/googleapis/google-cloud-go/pull/2606).
  This fixed a broken API response for `DiagnoseCluster`. When polling on the
  Long Running Operation(LRO), the API now returns
  `(*dataprocpb.DiagnoseClusterResults, error)` whereas it only returned an
  `error` before.

### Changes

- all:
  - Updated all direct dependencies.
  - Updated contributing guidelines to suggest allowing edits from maintainers.
- billing/budgets:
  - Start generating client for apiv1beta1.
- functions:
  - Start generating client for apiv1.
- notebooks:
  - Start generating client apiv1beta1.
- profiler:
  - update proftest to support parsing floating-point backoff durations.
  - Fix the regexp used to parse backoff duration.
- Various updates to autogenerated clients.

## v0.61.0

### Changes

- all:
  - Update all direct dependencies.
- dashboard:
  - Start generating client for apiv1.
- policytroubleshooter:
  - Start generating client for apiv1.
- profiler:
  - Disable OpenCensus Telemetry for requests made by the profiler package by default. You can re-enable it using `profiler.Config.EnableOCTelemetry`.
- Various updates to autogenerated clients.

## v0.60.0

### Changes

- all:
  - Refactored examples to reduce module dependencies.
  - Update sub-modules to use cloud.google.com/go v0.59.0.
- internal:
  - Start generating client for gaming apiv1beta.
- Various updates to autogenerated clients.

## v0.59.0

### Announcements

goolgeapis/google-cloud-go has moved its source of truth to GitHub and is no longer a mirror. This means that our
contributing process has changed a bit. We will now be conducting all code reviews on GitHub which means we now accept
pull requests! If you have a version of the codebase previously checked out you may wish to update your git remote to
point to GitHub.

### Changes

- all:
  - Remove dependency on honnef.co/go/tools.
  - Update our contributing instructions now that we use GitHub for reviews.
  - Remove some un-inclusive terminology.
- compute/metadata: 
  - Pass cancelable context to DNS lookup.
- .github:
  - Update templates issue/PR templates.
- internal:
  - Bump several clients to GA.
  - Fix GoDoc badge source.
  - Several automation changes related to the move to GitHub.
  - Start generating a client for asset v1p5beta1.
- Various updates to autogenerated clients.

## v0.58.0

### Deprecation notice

- `cloud.google.com/go/monitoring/apiv3` has been deprecated due to breaking
  changes in the API. Please migrate to `cloud.google.com/go/monitoring/apiv3/v2`.

### Changes

- all:
  - The remaining uses of gtransport.Dial have been removed.
  - The `genproto` dependency has been updated to a version that makes use of
    new `protoreflect` library. For more information on these protobuf changes
    please see the following post from the official Go blog:
    https://blog.golang.org/protobuf-apiv2.
- internal:
  - Started generation of datastore admin v1 client.
  - Updated protofuf version used for generation to 3.12.X.
  - Update the release levels for several APIs.
  - Generate clients with protoc-gen-go@v1.4.1.
- monitoring:
  - Re-enable generation of monitoring/apiv3 under v2 directory (see deprecation
    notice above).
- profiler:
  - Fixed flakiness in tests.
- Various updates to autogenerated clients.

## v0.57.0

- all:
  - Update module dependency `google.golang.org/api` to `v0.21.0`.
- errorreporting:
  - Add exported SetGoogleClientInfo wrappers to manual file.
- expr/v1alpha1:
  - Deprecate client. This client will be removed in a future release.
- internal:
  - Fix possible data race in TestTracer.
  - Pin versions of tools used for generation.
  - Correct the release levels for BigQuery APIs.
  - Start generation osconfig v1.
- longrunning:
  - Add exported SetGoogleClientInfo wrappers to manual file.
- monitoring:
  - Stop generation of monitoring/apiv3 because of incoming breaking change.
- trace:
  - Add exported SetGoogleClientInfo wrappers to manual file.
- Various updates to autogenerated clients.

## v0.56.0

- secretmanager:
  - add IAM helper
- profiler:
  - try all us-west1 zones for integration tests
- internal:
  - add config to generate webrisk v1
  - add repo and commit to buildcop invocation
  - add recaptchaenterprise v1 generation config
  - update microgenerator to v0.12.5
  - add datacatalog client
  - start generating security center settings v1beta
  - start generating osconfig agentendpoint v1
  - setup generation for bigquery/connection/v1beta1
- all:
  - increase continous testing timeout to 45m
  - various updates to autogenerated clients.

## v0.55.0

- Various updates to autogenerated clients.

## v0.54.0

- all:
  - remove unused golang.org/x/exp from mod file
  - update godoc.org links to pkg.go.dev
- compute/metadata:
  - use defaultClient when http.Client is nil
  - remove subscribeClient
- iam:
  - add support for v3 policy and IAM conditions
- Various updates to autogenerated clients.

## v0.53.0

- all: most clients now use transport/grpc.DialPool rather than Dial (see #1777 for outliers).
  - Connection pooling now does not use the deprecated (and soon to be removed) gRPC load balancer API.
- profiler: remove symbolization (drops support for go1.10)
- Various updates to autogenerated clients.

## v0.52.0

- internal/gapicgen: multiple improvements related to library generation.
- compute/metadata: unset ResponseHeaderTimeout in defaultClient
- docs: fix link to KMS in README.md
- Various updates to autogenerated clients.

## v0.51.0

- secretmanager:
  - add IAM helper for generic resource IAM handle
- cloudbuild:
  - migrate to microgen in a major version
- Various updates to autogenerated clients.

## v0.50.0

- profiler:
  - Support disabling CPU profile collection.
  - Log when a profile creation attempt begins.
- compute/metadata:
  - Fix panic on malformed URLs.
  - InstanceName returns actual instance name.
- Various updates to autogenerated clients.

## v0.49.0

- functions/metadata:
  - Handle string resources in JSON unmarshaller.
- Various updates to autogenerated clients.

## v0.48.0

- Various updates to autogenerated clients

## v0.47.0

This release drops support for Go 1.9 and Go 1.10: we continue to officially
support Go 1.11, Go 1.12, and Go 1.13.

- Various updates to autogenerated clients.
- Add cloudbuild/apiv1 client.

## v0.46.3

This is an empty release that was created solely to aid in storage's module
carve-out. See: https://github.com/golang/go/wiki/Modules#is-it-possible-to-add-a-module-to-a-multi-module-repository.

## v0.46.2

This is an empty release that was created solely to aid in spanner's module
carve-out. See: https://github.com/golang/go/wiki/Modules#is-it-possible-to-add-a-module-to-a-multi-module-repository.

## v0.46.1

This is an empty release that was created solely to aid in firestore's module
carve-out. See: https://github.com/golang/go/wiki/Modules#is-it-possible-to-add-a-module-to-a-multi-module-repository.

## v0.46.0

- spanner:
  - Retry "Session not found" for read-only transactions.
  - Retry aborted PDMLs.
- spanner/spannertest:
  - Fix a bug that was causing 0X-prefixed number to be parsed incorrectly.
- storage:
  - Add HMACKeyOptions.
  - Remove *REGIONAL from StorageClass documentation. Using MULTI_REGIONAL,
    DURABLE_REDUCED_AVAILABILITY, and REGIONAL are no longer best practice
    StorageClasses but they are still acceptable values.
- trace:
  - Remove cloud.google.com/go/trace. Package cloud.google.com/go/trace has been
    marked OBSOLETE for several years: it is now no longer provided. If you
    relied on this package, please vendor it or switch to using
    https://cloud.google.com/trace/docs/setup/go (which obsoleted it).

## v0.45.1

This is an empty release that was created solely to aid in pubsub's module
carve-out. See: https://github.com/golang/go/wiki/Modules#is-it-possible-to-add-a-module-to-a-multi-module-repository.

## v0.45.0

- compute/metadata:
  - Add Email method.
- storage:
  - Fix duplicated retry logic.
  - Add ReaderObjectAttrs.StartOffset.
  - Support reading last N bytes of a file when a negative range is given, such
    as `obj.NewRangeReader(ctx, -10, -1)`.
  - Add HMACKey listing functionality.
- spanner/spannertest:
  - Support primary keys with no columns.
  - Fix MinInt64 parsing.
  - Implement deletion of key ranges.
  - Handle reads during a read-write transaction.
  - Handle returning DATE values.
- pubsub:
  - Fix Ack/Modack request size calculation.
- logging:
  - Add auto-detection of monitored resources on GAE Standard.

## v0.44.3

This is an empty release that was created solely to aid in bigtable's module
carve-out. See: https://github.com/golang/go/wiki/Modules#is-it-possible-to-add-a-module-to-a-multi-module-repository.

## v0.44.2

This is an empty release that was created solely to aid in bigquery's module
carve-out. See: https://github.com/golang/go/wiki/Modules#is-it-possible-to-add-a-module-to-a-multi-module-repository.

## v0.44.1

This is an empty release that was created solely to aid in datastore's module
carve-out. See: https://github.com/golang/go/wiki/Modules#is-it-possible-to-add-a-module-to-a-multi-module-repository.

## v0.44.0

- datastore:
  - Interface elements whose underlying types are supported, are now supported.
  - Reduce time to initial retry from 1s to 100ms.
- firestore:
  - Add Increment transformation.
- storage:
  - Allow emulator with STORAGE_EMULATOR_HOST.
  - Add methods for HMAC key management.
- pubsub:
  - Add PublishCount and PublishLatency measurements.
  - Add DefaultPublishViews and DefaultSubscribeViews for convenience of
  importing all views.
  - Add add Subscription.PushConfig.AuthenticationMethod.
- spanner:
  - Allow emulator usage with SPANNER_EMULATOR_HOST.
  - Add cloud.google.com/go/spanner/spannertest, a spanner emulator.
  - Add cloud.google.com/go/spanner/spansql which contains types and a parser
  for the Cloud Spanner SQL dialect.
- asset:
  - Add apiv1p2beta1 client.

## v0.43.0

This is an empty release that was created solely to aid in logging's module
carve-out. See: https://github.com/golang/go/wiki/Modules#is-it-possible-to-add-a-module-to-a-multi-module-repository.

## v0.42.0

- bigtable:
  - Add an admin method to update an instance and clusters.
  - Fix bttest regex matching behavior for alternations (things like `|a`).
  - Expose BlockAllFilter filter.
- bigquery:
  - Add Routines API support.
- storage:
  - Add read-only Bucket.LocationType.
- logging:
  - Add TraceSampled to Entry.
  - Fix to properly extract {Trace, Span}Id from X-Cloud-Trace-Context.
- pubsub:
  - Add Cloud Key Management to TopicConfig.
  - Change ExpirationPolicy to optional.Duration.
- automl:
  - Add apiv1beta1 client.
- iam:
  - Fix compilation problem with iam/credentials/apiv1.

## v0.41.0

- bigtable:
  - Check results from PredicateFilter in bttest, which fixes certain false matches.
- profiler:
  - debugLog checks user defined logging options before logging.
- spanner:
  - PartitionedUpdates respect query parameters.
  - StartInstance allows specifying cloud API access scopes.
- bigquery:
  - Use empty slice instead of nil for ValueSaver, fixing an issue with zero-length, repeated, nested fields causing panics.
- firestore:
  - Return same number of snapshots as doc refs (in the form of duplicate records) during GetAll.
- replay:
  - Change references to IPv4 addresses to localhost, making replay compatible with IPv6.

## v0.40.0

- all:
  - Update to protobuf-golang v1.3.1.
- datastore:
  - Attempt to decode GAE-encoded keys if initial decoding attempt fails.
  - Support integer time conversion.
- pubsub:
  - Add PublishSettings.BundlerByteLimit. If users receive pubsub.ErrOverflow,
  this value should be adjusted higher.
  - Use IPv6 compatible target in testutil.
- bigtable:
  - Fix Latin-1 regexp filters in bttest, allowing \C.
  - Expose PassAllFilter.
- profiler:
  - Add log messages for slow path in start.
  - Fix start to allow retry until success.
- firestore:
  - Add admin client.
- containeranalysis:
  - Add apiv1 client.
- grafeas:
  - Add apiv1 client.

## 0.39.0

- bigtable:
  - Implement DeleteInstance in bttest.
  - Return an error on invalid ReadRowsRequest.RowRange key ranges in bttest.
- bigquery:
  - Move RequirePartitionFilter outside of TimePartioning.
  - Expose models API.
- firestore:
  - Allow array values in create and update calls.
  - Add CollectionGroup method.
- pubsub:
  - Add ExpirationPolicy to Subscription.
- storage:
  - Add V4 signing.
- rpcreplay:
  - Match streams by first sent request. This further improves rpcreplay's
  ability to distinguish streams.
- httpreplay:
  - Set up Man-In-The-Middle config only once. This should improve proxy
  creation when multiple proxies are used in a single process.
  - Remove error on empty Content-Type, allowing requests with no Content-Type
  header but a non-empty body.
- all:
  - Fix an edge case bug in auto-generated library pagination by properly
  propagating pagetoken.

## 0.38.0

This update includes a substantial reduction in our transitive dependency list
by way of updating to opencensus@v0.21.0.

- spanner:
  - Error implements GRPCStatus, allowing status.Convert.
- bigtable:
  - Fix a bug in bttest that prevents single column queries returning results
  that match other filters.
  - Remove verbose retry logging.
- logging:
  - Ensure RequestUrl has proper UTF-8, removing the need for users to wrap and
  rune replace manually.
- recaptchaenterprise:
  - Add v1beta1 client.
- phishingprotection:
  - Add v1beta1 client.

## 0.37.4

This patch releases re-builds the go.sum. This was not possible in the
previous release.

- firestore:
  - Add sentinel value DetectProjectID for auto-detecting project ID.
  - Add OpenCensus tracing for public methods.
  - Marked stable. All future changes come with a backwards compatibility
  guarantee.
  - Removed firestore/apiv1beta1. All users relying on this low-level library
  should migrate to firestore/apiv1. Note that most users should use the
  high-level firestore package instead.
- pubsub:
  - Allow large messages in synchronous pull case.
  - Cap bundler byte limit. This should prevent OOM conditions when there are
  a very large number of message publishes occurring.
- storage:
  - Add ETag to BucketAttrs and ObjectAttrs.
- datastore:
  - Removed some non-sensical OpenCensus traces.
- webrisk:
  - Add v1 client.
- asset:
  - Add v1 client.
- cloudtasks:
  - Add v2 client.

## 0.37.3

This patch release removes github.com/golang/lint from the transitive
dependency list, resolving `go get -u` problems.

Note: this release intentionally has a broken go.sum. Please use v0.37.4.

## 0.37.2

This patch release is mostly intended to bring in v0.3.0 of
google.golang.org/api, which fixes a GCF deployment issue.

Note: we had to-date accidentally marked Redis as stable. In this release, we've
fixed it by downgrading its documentation to alpha, as it is in other languages
and docs.

- all:
  - Document context in generated libraries.

## 0.37.1

Small go.mod version bumps to bring in v0.2.0 of google.golang.org/api, which
introduces a new oauth2 url.

## 0.37.0

- spanner:
  - Add BatchDML method.
  - Reduced initial time between retries.
- bigquery:
  - Produce better error messages for InferSchema.
  - Add logical type control for avro loads.
  - Add support for the GEOGRAPHY type.
- datastore:
  - Add sentinel value DetectProjectID for auto-detecting project ID.
  - Allow flatten tag on struct pointers.
  - Fixed a bug that caused queries to panic with invalid queries. Instead they
    will now return an error.
- profiler:
  - Add ability to override GCE zone and instance.
- pubsub:
  - BEHAVIOR CHANGE: Refactor error code retry logic. RPCs should now more
    consistently retry specific error codes based on whether they're idempotent
    or non-idempotent.
- httpreplay: Fixed a bug when a non-GET request had a zero-length body causing
  the Content-Length header to be dropped.
- iot:
  - Add new apiv1 client.
- securitycenter:
  - Add new apiv1 client.
- cloudscheduler:
  - Add new apiv1 client.

## 0.36.0

- spanner:
  - Reduce minimum retry backoff from 1s to 100ms. This makes time between
    retries much faster and should improve latency.
- storage:
  - Add support for Bucket Policy Only.
- kms:
  - Add ResourceIAM helper method.
  - Deprecate KeyRingIAM and CryptoKeyIAM. Please use ResourceIAM.
- firestore:
  - Switch from v1beta1 API to v1 API.
  - Allow emulator with FIRESTORE_EMULATOR_HOST.
- bigquery:
  - Add NumLongTermBytes to Table.
  - Add TotalBytesProcessedAccuracy to QueryStatistics.
- irm:
  - Add new v1alpha2 client.
- talent:
  - Add new v4beta1 client.
- rpcreplay:
  - Fix connection to work with grpc >= 1.17.
  - It is now required for an actual gRPC server to be running for Dial to
    succeed.

## 0.35.1

- spanner:
  - Adds OpenCensus views back to public API.

## v0.35.0

- all:
  - Add go.mod and go.sum.
  - Switch usage of gax-go to gax-go/v2.
- bigquery:
  - Fix bug where time partitioning could not be removed from a table.
  - Fix panic that occurred with empty query parameters.
- bttest:
  - Fix bug where deleted rows were returned by ReadRows.
- bigtable/emulator:
  - Configure max message size to 256 MiB.
- firestore:
  - Allow non-transactional queries in transactions.
  - Allow StartAt/EndBefore on direct children at any depth.
  - QuerySnapshotIterator.Stop may be called in an error state.
  - Fix bug the prevented reset of transaction write state in between retries.
- functions/metadata:
  - Make Metadata.Resource a pointer.
- logging:
  - Make SpanID available in logging.Entry.
- metadata:
  - Wrap !200 error code in a typed err.
- profiler:
  - Add function to check if function name is within a particular file in the
    profile.
  - Set parent field in create profile request.
  - Return kubernetes client to start cluster, so client can be used to poll
    cluster.
  - Add function for checking if filename is in profile.
- pubsub:
  - Fix bug where messages expired without an initial modack in
    synchronous=true mode.
  - Receive does not retry ResourceExhausted errors.
- spanner:
  - client.Close now cancels existing requests and should be much faster for
    large amounts of sessions.
  - Correctly allow MinOpened sessions to be spun up.

## v0.34.0

- functions/metadata:
  - Switch to using JSON in context.
  - Make Resource a value.
- vision: Fix ProductSearch return type.
- datastore: Add an example for how to handle MultiError.

## v0.33.1

- compute: Removes an erroneously added go.mod.
- logging: Populate source location in fromLogEntry.

## v0.33.0

- bttest:
  - Add support for apply_label_transformer.
- expr:
  - Add expr library.
- firestore:
  - Support retrieval of missing documents.
- kms:
  - Add IAM methods.
- pubsub:
  - Clarify extension documentation.
- scheduler:
  - Add v1beta1 client.
- vision:
  - Add product search helper.
  - Add new product search client.

## v0.32.0

Note: This release is the last to support Go 1.6 and 1.8.

- bigquery:
    - Add support for removing an expiration.
    - Ignore NeverExpire in Table.Create.
    - Validate table expiration time.
- cbt:
    - Add note about not supporting arbitrary bytes.
- datastore:
    - Align key checks.
- firestore:
    - Return an error when using Start/End without providing values.
- pubsub:
    - Add pstest Close method.
    - Clarify MaxExtension documentation.
- securitycenter:
    - Add v1beta1 client.
- spanner:
    - Allow nil in mutations.
    - Improve doc of SessionPoolConfig.MaxOpened.
    - Increase session deletion timeout from 5s to 15s.

## v0.31.0

- bigtable:
    - Group mutations across multiple requests.
- bigquery:
    - Link to bigquery troubleshooting errors page in bigquery.Error comment.
- cbt:
    - Fix go generate command.
    - Document usage of both maxage + maxversions.
- datastore:
    - Passing nil keys results in ErrInvalidKey.
- firestore:
    - Clarify what Document.DataTo does with untouched struct fields.
- profile:
    - Validate service name in agent.
- pubsub:
    - Fix deadlock with pstest and ctx.Cancel.
    - Fix a possible deadlock in pstest.
- trace:
    - Update doc URL with new fragment.

Special thanks to @fastest963 for going above and beyond helping us to debug
hard-to-reproduce Pub/Sub issues.

## v0.30.0

- spanner: DML support added. See https://godoc.org/cloud.google.com/go/spanner#hdr-DML_and_Partitioned_DML for more information.
- bigtable: bttest supports row sample filter.
- functions: metadata package added for accessing Cloud Functions resource metadata.

## v0.29.0

- bigtable:
  - Add retry to all idempotent RPCs.
  - cbt supports complex GC policies.
  - Emulator supports arbitrary bytes in regex filters.
- firestore: Add ArrayUnion and ArrayRemove.
- logging: Add the ContextFunc option to supply the context used for
  asynchronous RPCs.
- profiler: Ignore NotDefinedError when fetching the instance name
- pubsub:
  - BEHAVIOR CHANGE: Receive doesn't retry if an RPC returns codes.Cancelled.
  - BEHAVIOR CHANGE: Receive retries on Unavailable intead of returning.
  - Fix deadlock.
  - Restore Ack/Nack/Modacks metrics.
  - Improve context handling in iterator.
  - Implement synchronous mode for Receive.
  - pstest: add Pull.
- spanner: Add a metric for the number of sessions currently opened.
- storage:
  - Canceling the context releases all resources.
  - Add additional RetentionPolicy attributes.
- vision/apiv1: Add LocalizeObjects method.

## v0.28.0

- bigtable:
  - Emulator returns Unimplemented for snapshot RPCs.
- bigquery:
  - Support zero-length repeated, nested fields.
- cloud assets:
  - Add v1beta client.
- datastore:
  - Don't nil out transaction ID on retry.
- firestore:
  - BREAKING CHANGE: When watching a query with Query.Snapshots, QuerySnapshotIterator.Next
  returns a QuerySnapshot which contains read time, result size, change list and the DocumentIterator
  (previously, QuerySnapshotIterator.Next returned just the DocumentIterator). See: https://godoc.org/cloud.google.com/go/firestore#Query.Snapshots.
  - Add array-contains operator.
- IAM:
  - Add iam/credentials/apiv1 client.
- pubsub:
  - Canceling the context passed to Subscription.Receive causes Receive to return when
  processing finishes on all messages currently in progress, even if new messages are arriving.
- redis:
  - Add redis/apiv1 client.
- storage:
  - Add Reader.Attrs.
  - Deprecate several Reader getter methods: please use Reader.Attrs for these instead.
  - Add ObjectHandle.Bucket and ObjectHandle.Object methods.

## v0.27.0

- bigquery:
  - Allow modification of encryption configuration and partitioning options to a table via the Update call.
  - Add a SchemaFromJSON function that converts a JSON table schema.
- bigtable:
  - Restore cbt count functionality.
- containeranalysis:
  - Add v1beta client.
- spanner:
  - Fix a case where an iterator might not be closed correctly.
- storage:
  - Add ServiceAccount method https://godoc.org/cloud.google.com/go/storage#Client.ServiceAccount.
  - Add a method to Reader that returns the parsed value of the Last-Modified header.

## v0.26.0

- bigquery:
  - Support filtering listed jobs  by min/max creation time.
  - Support data clustering (https://godoc.org/cloud.google.com/go/bigquery#Clustering).
  - Include job creator email in Job struct.
- bigtable:
  - Add `RowSampleFilter`.
  - emulator: BREAKING BEHAVIOR CHANGE: Regexps in row, family, column and value filters
    must match the entire target string to succeed. Previously, the emulator was
    succeeding on  partial matches.
    NOTE: As of this release, this change only affects the emulator when run
    from this repo (bigtable/cmd/emulator/cbtemulator.go). The version launched
    from `gcloud` will be updated in a subsequent `gcloud` release.
- dataproc: Add apiv1beta2 client.
- datastore: Save non-nil pointer fields on omitempty.
- logging: populate Entry.Trace from the HTTP X-Cloud-Trace-Context header.
- logging/logadmin:  Support writer_identity and include_children.
- pubsub:
  - Support labels on topics and subscriptions.
  - Support message storage policy for topics.
  - Use the distribution of ack times to determine when to extend ack deadlines.
    The only user-visible effect of this change should be that programs that
    call only `Subscription.Receive` need no IAM permissions other than `Pub/Sub
    Subscriber`.
- storage:
  - Support predefined ACLs.
  - Support additional ACL fields other than Entity and Role.
  - Support bucket websites.
  - Support bucket logging.


## v0.25.0

- Added [Code of Conduct](https://github.com/googleapis/google-cloud-go/blob/master/CODE_OF_CONDUCT.md)
- bigtable:
  - cbt: Support a GC policy of "never".
- errorreporting:
  - Support User.
  - Close now calls Flush.
  - Use OnError (previously ignored).
  - Pass through the RPC error as-is to OnError.
- httpreplay: A tool for recording and replaying HTTP requests
  (for the bigquery and storage clients in this repo).
- kms: v1 client added
- logging: add SourceLocation to Entry.
- storage: improve CRC checking on read.

## v0.24.0

- bigquery: Support for the NUMERIC type.
- bigtable:
  - cbt: Optionally specify columns for read/lookup
  - Support instance-level administration.
- oslogin: New client for the OS Login API.
- pubsub:
  - The package is now stable. There will be no further breaking changes.
  - Internal changes to improve Subscription.Receive behavior.
- storage: Support updating bucket lifecycle config.
- spanner: Support struct-typed parameter bindings.
- texttospeech: New client for the Text-to-Speech API.

## v0.23.0

- bigquery: Add DDL stats to query statistics.
- bigtable:
  - cbt: Add cells-per-column limit for row lookup.
  - cbt: Make it possible to combine read filters.
- dlp: v2beta2 client removed. Use the v2 client instead.
- firestore, spanner: Fix compilation errors due to protobuf changes.

## v0.22.0

- bigtable:
  - cbt: Support cells per column limit for row read.
  - bttest: Correctly handle empty RowSet.
  - Fix ReadModifyWrite operation in emulator.
  - Fix API path in GetCluster.

- bigquery:
  - BEHAVIOR CHANGE: Retry on 503 status code.
  - Add dataset.DeleteWithContents.
  - Add SchemaUpdateOptions for query jobs.
  - Add Timeline to QueryStatistics.
  - Add more stats to ExplainQueryStage.
  - Support Parquet data format.

- datastore:
  - Support omitempty for times.

- dlp:
  - **BREAKING CHANGE:** Remove v1beta1 client. Please migrate to the v2 client,
  which is now out of beta.
  - Add v2 client.

- firestore:
  - BEHAVIOR CHANGE: Treat set({}, MergeAll) as valid.

- iam:
  - Support JWT signing via SignJwt callopt.

- profiler:
  - BEHAVIOR CHANGE: PollForSerialOutput returns an error when context.Done.
  - BEHAVIOR CHANGE: Increase the initial backoff to 1 minute.
  - Avoid returning empty serial port output.

- pubsub:
  - BEHAVIOR CHANGE: Don't backoff during next retryable error once stream is healthy.
  - BEHAVIOR CHANGE: Don't backoff on EOF.
  - pstest: Support Acknowledge and ModifyAckDeadline RPCs.

- redis:
  - Add v1 beta Redis client.

- spanner:
  - Support SessionLabels.

- speech:
  - Add api v1 beta1 client.

- storage:
  - BEHAVIOR CHANGE: Retry reads when retryable error occurs.
  - Fix delete of object in requester-pays bucket.
  - Support KMS integration.

## v0.21.0

- bigquery:
  - Add OpenCensus tracing.

- firestore:
  - **BREAKING CHANGE:** If a document does not exist, return a DocumentSnapshot
    whose Exists method returns false. DocumentRef.Get and Transaction.Get
    return the non-nil DocumentSnapshot in addition to a NotFound error.
    **DocumentRef.GetAll and Transaction.GetAll return a non-nil
    DocumentSnapshot instead of nil.**
  - Add DocumentIterator.Stop. **Call Stop whenever you are done with a
    DocumentIterator.**
  - Added Query.Snapshots and DocumentRef.Snapshots, which provide realtime
    notification of updates. See https://cloud.google.com/firestore/docs/query-data/listen.
  - Canceling an RPC now always returns a grpc.Status with codes.Canceled.

- spanner:
  - Add `CommitTimestamp`, which supports inserting the commit timestamp of a
    transaction into a column.

## v0.20.0

- bigquery: Support SchemaUpdateOptions for load jobs.

- bigtable:
  - Add SampleRowKeys.
  - cbt: Support union, intersection GCPolicy.
  - Retry admin RPCS.
  - Add trace spans to retries.

- datastore: Add OpenCensus tracing.

- firestore:
  - Fix queries involving Null and NaN.
  - Allow Timestamp protobuffers for time values.

- logging: Add a WriteTimeout option.

- spanner: Support Batch API.

- storage: Add OpenCensus tracing.

## v0.19.0

- bigquery:
  - Support customer-managed encryption keys.

- bigtable:
  - Improved emulator support.
  - Support GetCluster.

- datastore:
  - Add general mutations.
  - Support pointer struct fields.
  - Support transaction options.

- firestore:
  - Add Transaction.GetAll.
  - Support document cursors.

- logging:
  - Support concurrent RPCs to the service.
  - Support per-entry resources.

- profiler:
  - Add config options to disable heap and thread profiling.
  - Read the project ID from $GOOGLE_CLOUD_PROJECT when it's set.

- pubsub:
  - BEHAVIOR CHANGE: Release flow control after ack/nack (instead of after the
    callback returns).
  - Add SubscriptionInProject.
  - Add OpenCensus instrumentation for streaming pull.

- storage:
  - Support CORS.

## v0.18.0

- bigquery:
  - Marked stable.
  - Schema inference of nullable fields supported.
  - Added TimePartitioning to QueryConfig.

- firestore: Data provided to DocumentRef.Set with a Merge option can contain
  Delete sentinels.

- logging: Clients can accept parent resources other than projects.

- pubsub:
  - pubsub/pstest: A lighweight fake for pubsub. Experimental; feedback welcome.
  - Support updating more subscription metadata: AckDeadline,
    RetainAckedMessages and RetentionDuration.

- oslogin/apiv1beta: New client for the Cloud OS Login API.

- rpcreplay: A package for recording and replaying gRPC traffic.

- spanner:
  - Add a ReadWithOptions that supports a row limit, as well as an index.
  - Support query plan and execution statistics.
  - Added [OpenCensus](http://opencensus.io) support.

- storage: Clarify checksum validation for gzipped files (it is not validated
  when the file is served uncompressed).


## v0.17.0

- firestore BREAKING CHANGES:
  - Remove UpdateMap and UpdateStruct; rename UpdatePaths to Update.
    Change
        `docref.UpdateMap(ctx, map[string]interface{}{"a.b", 1})`
    to
        `docref.Update(ctx, []firestore.Update{{Path: "a.b", Value: 1}})`

    Change
        `docref.UpdateStruct(ctx, []string{"Field"}, aStruct)`
    to
        `docref.Update(ctx, []firestore.Update{{Path: "Field", Value: aStruct.Field}})`
  - Rename MergePaths to Merge; require args to be FieldPaths
  - A value stored as an integer can be read into a floating-point field, and vice versa.
- bigtable/cmd/cbt:
  - Support deleting a column.
  - Add regex option for row read.
- spanner: Mark stable.
- storage:
  - Add Reader.ContentEncoding method.
  - Fix handling of SignedURL headers.
- bigquery:
  - If Uploader.Put is called with no rows, it returns nil without making a
    call.
  - Schema inference supports the "nullable" option in struct tags for
    non-required fields.
  - TimePartitioning supports "Field".


## v0.16.0

- Other bigquery changes:
  - `JobIterator.Next` returns `*Job`; removed `JobInfo` (BREAKING CHANGE).
  - UseStandardSQL is deprecated; set UseLegacySQL to true if you need
    Legacy SQL.
  - Uploader.Put will generate a random insert ID if you do not provide one.
  - Support time partitioning for load jobs.
  - Support dry-run queries.
  - A `Job` remembers its last retrieved status.
  - Support retrieving job configuration.
  - Support labels for jobs and tables.
  - Support dataset access lists.
  - Improve support for external data sources, including data from Bigtable and
    Google Sheets, and tables with external data.
  - Support updating a table's view configuration.
  - Fix uploading civil times with nanoseconds.

- storage:
  - Support PubSub notifications.
  - Support Requester Pays buckets.

- profiler: Support goroutine and mutex profile types.

## v0.15.0

- firestore: beta release. See the
  [announcement](https://firebase.googleblog.com/2017/10/introducing-cloud-firestore.html).

- errorreporting: The existing package has been redesigned.

- errors: This package has been removed. Use errorreporting.


## v0.14.0

- bigquery BREAKING CHANGES:
  - Standard SQL is the default for queries and views.
  - `Table.Create` takes `TableMetadata` as a second argument, instead of
    options.
  - `Dataset.Create` takes `DatasetMetadata` as a second argument.
  - `DatasetMetadata` field `ID` renamed to `FullID`
  - `TableMetadata` field `ID` renamed to `FullID`

- Other bigquery changes:
  - The client will append a random suffix to a provided job ID if you set
    `AddJobIDSuffix` to true in a job config.
  - Listing jobs is supported.
  - Better retry logic.

- vision, language, speech: clients are now stable

- monitoring: client is now beta

- profiler:
  - Rename InstanceName to Instance, ZoneName to Zone
  - Auto-detect service name and version on AppEngine.

## v0.13.0

- bigquery: UseLegacySQL options for CreateTable and QueryConfig. Use these
  options to continue using Legacy SQL after the client switches its default
  to Standard SQL.

- bigquery: Support for updating dataset labels.

- bigquery: Set DatasetIterator.ProjectID to list datasets in a project other
  than the client's. DatasetsInProject is no longer needed and is deprecated.

- bigtable: Fail ListInstances when any zones fail.

- spanner: support decoding of slices of basic types (e.g. []string, []int64,
  etc.)

- logging/logadmin: UpdateSink no longer creates a sink if it is missing
  (actually a change to the underlying service, not the client)

- profiler: Service and ServiceVersion replace Target in Config.

## v0.12.0

- pubsub: Subscription.Receive now uses streaming pull.

- pubsub: add Client.TopicInProject to access topics in a different project
  than the client.

- errors: renamed errorreporting. The errors package will be removed shortly.

- datastore: improved retry behavior.

- bigquery: support updates to dataset metadata, with etags.

- bigquery: add etag support to Table.Update (BREAKING: etag argument added).

- bigquery: generate all job IDs on the client.

- storage: support bucket lifecycle configurations.


## v0.11.0

- Clients for spanner, pubsub and video are now in beta.

- New client for DLP.

- spanner: performance and testing improvements.

- storage: requester-pays buckets are supported.

- storage, profiler, bigtable, bigquery: bug fixes and other minor improvements.

- pubsub: bug fixes and other minor improvements

## v0.10.0

- pubsub: Subscription.ModifyPushConfig replaced with Subscription.Update.

- pubsub: Subscription.Receive now runs concurrently for higher throughput.

- vision: cloud.google.com/go/vision is deprecated. Use
cloud.google.com/go/vision/apiv1 instead.

- translation: now stable.

- trace: several changes to the surface. See the link below.

### Code changes required from v0.9.0

- pubsub: Replace

    ```
    sub.ModifyPushConfig(ctx, pubsub.PushConfig{Endpoint: "https://example.com/push"})
    ```

  with

    ```
    sub.Update(ctx, pubsub.SubscriptionConfigToUpdate{
        PushConfig: &pubsub.PushConfig{Endpoint: "https://example.com/push"},
    })
    ```

- trace: traceGRPCServerInterceptor will be provided from *trace.Client.
Given an initialized `*trace.Client` named `tc`, instead of

    ```
    s := grpc.NewServer(grpc.UnaryInterceptor(trace.GRPCServerInterceptor(tc)))
    ```

  write

    ```
    s := grpc.NewServer(grpc.UnaryInterceptor(tc.GRPCServerInterceptor()))
    ```

- trace trace.GRPCClientInterceptor will also provided from *trace.Client.
Instead of

    ```
    conn, err := grpc.Dial(srv.Addr, grpc.WithUnaryInterceptor(trace.GRPCClientInterceptor()))
    ```

  write

    ```
    conn, err := grpc.Dial(srv.Addr, grpc.WithUnaryInterceptor(tc.GRPCClientInterceptor()))
    ```

- trace: We removed the deprecated `trace.EnableGRPCTracing`. Use the gRPC
interceptor as a dial option as shown below when initializing Cloud package
clients:

    ```
    c, err := pubsub.NewClient(ctx, "project-id", option.WithGRPCDialOption(grpc.WithUnaryInterceptor(tc.GRPCClientInterceptor())))
    if err != nil {
        ...
    }
    ```


## v0.9.0

- Breaking changes to some autogenerated clients.
- rpcreplay package added.

## v0.8.0

- profiler package added.
- storage:
  - Retry Objects.Insert call.
  - Add ProgressFunc to WRiter.
- pubsub: breaking changes:
  - Publish is now asynchronous ([announcement](https://groups.google.com/d/topic/google-api-go-announce/aaqRDIQ3rvU/discussion)).
  - Subscription.Pull replaced by Subscription.Receive, which takes a callback ([announcement](https://groups.google.com/d/topic/google-api-go-announce/8pt6oetAdKc/discussion)).
  - Message.Done replaced with Message.Ack and Message.Nack.

## v0.7.0

- Release of a client library for Spanner. See
the
[blog
post](https://cloudplatform.googleblog.com/2017/02/introducing-Cloud-Spanner-a-global-database-service-for-mission-critical-applications.html).
Note that although the Spanner service is beta, the Go client library is alpha.

## v0.6.0

- Beta release of BigQuery, DataStore, Logging and Storage. See the
[blog post](https://cloudplatform.googleblog.com/2016/12/announcing-new-google-cloud-client.html).

- bigquery:
  - struct support. Read a row directly into a struct with
`RowIterator.Next`, and upload a row directly from a struct with `Uploader.Put`.
You can also use field tags. See the [package documentation][cloud-bigquery-ref]
for details.

  - The `ValueList` type was removed. It is no longer necessary. Instead of
   ```go
   var v ValueList
   ... it.Next(&v) ..
   ```
   use

   ```go
   var v []Value
   ... it.Next(&v) ...
   ```

  - Previously, repeatedly calling `RowIterator.Next` on the same `[]Value` or
  `ValueList` would append to the slice. Now each call resets the size to zero first.

  - Schema inference will infer the SQL type BYTES for a struct field of
  type []byte. Previously it inferred STRING.

  - The types `uint`, `uint64` and `uintptr` are no longer supported in schema
  inference. BigQuery's integer type is INT64, and those types may hold values
  that are not correctly represented in a 64-bit signed integer.

## v0.5.0

- bigquery:
  - The SQL types DATE, TIME and DATETIME are now supported. They correspond to
    the `Date`, `Time` and `DateTime` types in the new `cloud.google.com/go/civil`
    package.
  - Support for query parameters.
  - Support deleting a dataset.
  - Values from INTEGER columns will now be returned as int64, not int. This
    will avoid errors arising from large values on 32-bit systems.
- datastore:
  - Nested Go structs encoded as Entity values, instead of a
flattened list of the embedded struct's fields. This means that you may now have twice-nested slices, eg.
    ```go
    type State struct {
      Cities  []struct{
        Populations []int
      }
    }
    ```
    See [the announcement](https://groups.google.com/forum/#!topic/google-api-go-announce/79jtrdeuJAg) for
more details.
  - Contexts no longer hold namespaces; instead you must set a key's namespace
    explicitly. Also, key functions have been changed and renamed.
  - The WithNamespace function has been removed. To specify a namespace in a Query, use the Query.Namespace method:
     ```go
     q := datastore.NewQuery("Kind").Namespace("ns")
     ```
  - All the fields of Key are exported. That means you can construct any Key with a struct literal:
     ```go
     k := &Key{Kind: "Kind",  ID: 37, Namespace: "ns"}
     ```
  - As a result of the above, the Key methods Kind, ID, d.Name, Parent, SetParent and Namespace have been removed.
  - `NewIncompleteKey` has been removed, replaced by `IncompleteKey`. Replace
      ```go
      NewIncompleteKey(ctx, kind, parent)
      ```
      with
      ```go
      IncompleteKey(kind, parent)
      ```
      and if you do use namespaces, make sure you set the namespace on the returned key.
  - `NewKey` has been removed, replaced by `NameKey` and `IDKey`. Replace
      ```go
      NewKey(ctx, kind, name, 0, parent)
      NewKey(ctx, kind, "", id, parent)
      ```
      with
      ```go
      NameKey(kind, name, parent)
      IDKey(kind, id, parent)
      ```
      and if you do use namespaces, make sure you set the namespace on the returned key.
  - The `Done` variable has been removed. Replace `datastore.Done` with `iterator.Done`, from the package `google.golang.org/api/iterator`.
  - The `Client.Close` method will have a return type of error. It will return the result of closing the underlying gRPC connection.
  - See [the announcement](https://groups.google.com/forum/#!topic/google-api-go-announce/hqXtM_4Ix-0) for
more details.

## v0.4.0

- bigquery:
  -`NewGCSReference` is now a function, not a method on `Client`.
  - `Table.LoaderFrom` now accepts a `ReaderSource`, enabling
     loading data into a table from a file or any `io.Reader`.
  * Client.Table and Client.OpenTable have been removed.
      Replace
      ```go
      client.OpenTable("project", "dataset", "table")
      ```
      with
      ```go
      client.DatasetInProject("project", "dataset").Table("table")
      ```

  * Client.CreateTable has been removed.
      Replace
      ```go
      client.CreateTable(ctx, "project", "dataset", "table")
      ```
      with
      ```go
      client.DatasetInProject("project", "dataset").Table("table").Create(ctx)
      ```

  * Dataset.ListTables have been replaced with Dataset.Tables.
      Replace
      ```go
      tables, err := ds.ListTables(ctx)
      ```
      with
      ```go
      it := ds.Tables(ctx)
      for {
          table, err := it.Next()
          if err == iterator.Done {
              break
          }
          if err != nil {
              // TODO: Handle error.
          }
          // TODO: use table.
      }
      ```

  * Client.Read has been replaced with Job.Read, Table.Read and Query.Read.
      Replace
      ```go
      it, err := client.Read(ctx, job)
      ```
      with
      ```go
      it, err := job.Read(ctx)
      ```
    and similarly for reading from tables or queries.

  * The iterator returned from the Read methods is now named RowIterator. Its
    behavior is closer to the other iterators in these libraries. It no longer
    supports the Schema method; see the next item.
      Replace
      ```go
      for it.Next(ctx) {
          var vals ValueList
          if err := it.Get(&vals); err != nil {
              // TODO: Handle error.
          }
          // TODO: use vals.
      }
      if err := it.Err(); err != nil {
          // TODO: Handle error.
      }
      ```
      with
      ```
      for {
          var vals ValueList
          err := it.Next(&vals)
          if err == iterator.Done {
              break
          }
          if err != nil {
              // TODO: Handle error.
          }
          // TODO: use vals.
      }
      ```
      Instead of the `RecordsPerRequest(n)` option, write
      ```go
      it.PageInfo().MaxSize = n
      ```
      Instead of the `StartIndex(i)` option, write
      ```go
      it.StartIndex = i
      ```

  * ValueLoader.Load now takes a Schema in addition to a slice of Values.
      Replace
      ```go
      func (vl *myValueLoader) Load(v []bigquery.Value)
      ```
      with
      ```go
      func (vl *myValueLoader) Load(v []bigquery.Value, s bigquery.Schema)
      ```


  * Table.Patch is replace by Table.Update.
      Replace
      ```go
      p := table.Patch()
      p.Description("new description")
      metadata, err := p.Apply(ctx)
      ```
      with
      ```go
      metadata, err := table.Update(ctx, bigquery.TableMetadataToUpdate{
          Description: "new description",
      })
      ```

  * Client.Copy is replaced by separate methods for each of its four functions.
    All options have been replaced by struct fields.

    * To load data from Google Cloud Storage into a table, use Table.LoaderFrom.

      Replace
      ```go
      client.Copy(ctx, table, gcsRef)
      ```
      with
      ```go
      table.LoaderFrom(gcsRef).Run(ctx)
      ```
      Instead of passing options to Copy, set fields on the Loader:
      ```go
      loader := table.LoaderFrom(gcsRef)
      loader.WriteDisposition = bigquery.WriteTruncate
      ```

    * To extract data from a table into Google Cloud Storage, use
      Table.ExtractorTo. Set fields on the returned Extractor instead of
      passing options.

      Replace
      ```go
      client.Copy(ctx, gcsRef, table)
      ```
      with
      ```go
      table.ExtractorTo(gcsRef).Run(ctx)
      ```

    * To copy data into a table from one or more other tables, use
      Table.CopierFrom. Set fields on the returned Copier instead of passing options.

      Replace
      ```go
      client.Copy(ctx, dstTable, srcTable)
      ```
      with
      ```go
      dst.Table.CopierFrom(srcTable).Run(ctx)
      ```

    * To start a query job, create a Query and call its Run method. Set fields
    on the query instead of passing options.

      Replace
      ```go
      client.Copy(ctx, table, query)
      ```
      with
      ```go
      query.Run(ctx)
      ```

  * Table.NewUploader has been renamed to Table.Uploader. Instead of options,
    configure an Uploader by setting its fields.
      Replace
      ```go
      u := table.NewUploader(bigquery.UploadIgnoreUnknownValues())
      ```
      with
      ```go
      u := table.NewUploader(bigquery.UploadIgnoreUnknownValues())
      u.IgnoreUnknownValues = true
      ```

- pubsub: remove `pubsub.Done`. Use `iterator.Done` instead, where `iterator` is the package
`google.golang.org/api/iterator`.

## v0.3.0

- storage:
  * AdminClient replaced by methods on Client.
      Replace
      ```go
      adminClient.CreateBucket(ctx, bucketName, attrs)
      ```
      with
      ```go
      client.Bucket(bucketName).Create(ctx, projectID, attrs)
      ```

  * BucketHandle.List replaced by BucketHandle.Objects.
      Replace
      ```go
      for query != nil {
          objs, err := bucket.List(d.ctx, query)
          if err != nil { ... }
          query = objs.Next
          for _, obj := range objs.Results {
              fmt.Println(obj)
          }
      }
      ```
      with
      ```go
      iter := bucket.Objects(d.ctx, query)
      for {
          obj, err := iter.Next()
          if err == iterator.Done {
              break
          }
          if err != nil { ... }
          fmt.Println(obj)
      }
      ```
      (The `iterator` package is at `google.golang.org/api/iterator`.)

      Replace `Query.Cursor` with `ObjectIterator.PageInfo().Token`.

      Replace `Query.MaxResults` with `ObjectIterator.PageInfo().MaxSize`.


  * ObjectHandle.CopyTo replaced by ObjectHandle.CopierFrom.
      Replace
      ```go
      attrs, err := src.CopyTo(ctx, dst, nil)
      ```
      with
      ```go
      attrs, err := dst.CopierFrom(src).Run(ctx)
      ```

      Replace
      ```go
      attrs, err := src.CopyTo(ctx, dst, &storage.ObjectAttrs{ContextType: "text/html"})
      ```
      with
      ```go
      c := dst.CopierFrom(src)
      c.ContextType = "text/html"
      attrs, err := c.Run(ctx)
      ```

  * ObjectHandle.ComposeFrom replaced by ObjectHandle.ComposerFrom.
      Replace
      ```go
      attrs, err := dst.ComposeFrom(ctx, []*storage.ObjectHandle{src1, src2}, nil)
      ```
      with
      ```go
      attrs, err := dst.ComposerFrom(src1, src2).Run(ctx)
      ```

  * ObjectHandle.Update's ObjectAttrs argument replaced by ObjectAttrsToUpdate.
      Replace
      ```go
      attrs, err := obj.Update(ctx, &storage.ObjectAttrs{ContextType: "text/html"})
      ```
      with
      ```go
      attrs, err := obj.Update(ctx, storage.ObjectAttrsToUpdate{ContextType: "text/html"})
      ```

  * ObjectHandle.WithConditions replaced by ObjectHandle.If.
      Replace
      ```go
      obj.WithConditions(storage.Generation(gen), storage.IfMetaGenerationMatch(mgen))
      ```
      with
      ```go
      obj.Generation(gen).If(storage.Conditions{MetagenerationMatch: mgen})
      ```

      Replace
      ```go
      obj.WithConditions(storage.IfGenerationMatch(0))
      ```
      with
      ```go
      obj.If(storage.Conditions{DoesNotExist: true})
      ```

  * `storage.Done` replaced by `iterator.Done` (from package `google.golang.org/api/iterator`).

- Package preview/logging deleted. Use logging instead.

## v0.2.0

- Logging client replaced with preview version (see below).

- New clients for some of Google's Machine Learning APIs: Vision, Speech, and
Natural Language.

- Preview version of a new [Stackdriver Logging][cloud-logging] client in
[`cloud.google.com/go/preview/logging`](https://godoc.org/cloud.google.com/go/preview/logging).
This client uses gRPC as its transport layer, and supports log reading, sinks
and metrics. It will replace the current client at `cloud.google.com/go/logging` shortly.
