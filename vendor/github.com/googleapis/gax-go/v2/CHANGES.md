# Changelog

## [2.15.0](https://github.com/googleapis/gax-go/compare/v2.14.2...v2.15.0) (2025-07-09)


### Features

* **apierror:** improve gRPC status code mapping for HTTP errors ([#431](https://github.com/googleapis/gax-go/issues/431)) ([c207f2a](https://github.com/googleapis/gax-go/commit/c207f2a19ab91d3baee458b57d4aa992519025c7))

## [2.14.2](https://github.com/googleapis/gax-go/compare/v2.14.1...v2.14.2) (2025-05-12)


### Documentation

* **v2:** Fix Backoff doc to accurately explain Multiplier ([#423](https://github.com/googleapis/gax-go/issues/423)) ([16d1791](https://github.com/googleapis/gax-go/commit/16d17917121ea9f5d84ba52b5c7c7f2ec0f9e784)), refs [#422](https://github.com/googleapis/gax-go/issues/422)

## [2.14.1](https://github.com/googleapis/gax-go/compare/v2.14.0...v2.14.1) (2024-12-19)


### Bug Fixes

* update golang.org/x/net to v0.33.0 ([#391](https://github.com/googleapis/gax-go/issues/391)) ([547a5b4](https://github.com/googleapis/gax-go/commit/547a5b43aa6f376f71242da9f18e65fbdfb342f6))


### Documentation

* fix godoc to refer to the proper envvar ([#387](https://github.com/googleapis/gax-go/issues/387)) ([dc6baf7](https://github.com/googleapis/gax-go/commit/dc6baf75c1a737233739630b5af6c9759f08abcd))

## [2.14.0](https://github.com/googleapis/gax-go/compare/v2.13.0...v2.14.0) (2024-11-13)


### Features

* **internallog:** add a logging support package ([#380](https://github.com/googleapis/gax-go/issues/380)) ([c877470](https://github.com/googleapis/gax-go/commit/c87747098135631a3de5865ed03aaf2c79fd9319))

## [2.13.0](https://github.com/googleapis/gax-go/compare/v2.12.5...v2.13.0) (2024-07-22)


### Features

* **iterator:** add package to help work with new iter.Seq types ([#358](https://github.com/googleapis/gax-go/issues/358)) ([6bccdaa](https://github.com/googleapis/gax-go/commit/6bccdaac011fe6fd147e4eb533a8e6520b7d4acc))

## [2.12.5](https://github.com/googleapis/gax-go/compare/v2.12.4...v2.12.5) (2024-06-18)


### Bug Fixes

* **v2/apierror:** fix (*APIError).Error() for unwrapped Status ([#351](https://github.com/googleapis/gax-go/issues/351)) ([22c16e7](https://github.com/googleapis/gax-go/commit/22c16e7bff5402bdc4c25063771cdd01c650b500)), refs [#350](https://github.com/googleapis/gax-go/issues/350)

## [2.12.4](https://github.com/googleapis/gax-go/compare/v2.12.3...v2.12.4) (2024-05-03)


### Bug Fixes

* provide unmarshal options for streams ([#343](https://github.com/googleapis/gax-go/issues/343)) ([ddf9a90](https://github.com/googleapis/gax-go/commit/ddf9a90bf180295d49875e15cb80b2136a49dbaf))

## [2.12.3](https://github.com/googleapis/gax-go/compare/v2.12.2...v2.12.3) (2024-03-14)


### Bug Fixes

* bump protobuf dep to v1.33 ([#333](https://github.com/googleapis/gax-go/issues/333)) ([2892b22](https://github.com/googleapis/gax-go/commit/2892b22c1ae8a70dec3448d82e634643fe6c1be2))

## [2.12.2](https://github.com/googleapis/gax-go/compare/v2.12.1...v2.12.2) (2024-02-23)


### Bug Fixes

* **v2/callctx:** fix SetHeader race by cloning header map ([#326](https://github.com/googleapis/gax-go/issues/326)) ([534311f](https://github.com/googleapis/gax-go/commit/534311f0f163d101f30657736c0e6f860e9c39dc))

## [2.12.1](https://github.com/googleapis/gax-go/compare/v2.12.0...v2.12.1) (2024-02-13)


### Bug Fixes

* add XGoogFieldMaskHeader constant ([#321](https://github.com/googleapis/gax-go/issues/321)) ([666ee08](https://github.com/googleapis/gax-go/commit/666ee08931041b7fed56bed7132649785b2d3dfe))

## [2.12.0](https://github.com/googleapis/gax-go/compare/v2.11.0...v2.12.0) (2023-06-26)


### Features

* **v2/callctx:** add new callctx package ([#291](https://github.com/googleapis/gax-go/issues/291)) ([11503ed](https://github.com/googleapis/gax-go/commit/11503ed98df4ae1bbdedf91ff64d47e63f187d68))
* **v2:** add BuildHeaders and InsertMetadataIntoOutgoingContext to header  ([#290](https://github.com/googleapis/gax-go/issues/290)) ([6a4b89f](https://github.com/googleapis/gax-go/commit/6a4b89f5551a40262e7c3caf2e1bdc7321b76ea1))

## [2.11.0](https://github.com/googleapis/gax-go/compare/v2.10.0...v2.11.0) (2023-06-13)


### Features

* **v2:** add GoVersion package variable ([#283](https://github.com/googleapis/gax-go/issues/283)) ([26553cc](https://github.com/googleapis/gax-go/commit/26553ccadb4016b189881f52e6c253b68bb3e3d5))


### Bug Fixes

* **v2:** handle space in non-devel go version ([#288](https://github.com/googleapis/gax-go/issues/288)) ([fd7bca0](https://github.com/googleapis/gax-go/commit/fd7bca029a1c5e63def8f0a5fd1ec3f725d92f75))

## [2.10.0](https://github.com/googleapis/gax-go/compare/v2.9.1...v2.10.0) (2023-05-30)


### Features

* update dependencies ([#280](https://github.com/googleapis/gax-go/issues/280)) ([4514281](https://github.com/googleapis/gax-go/commit/4514281058590f3637c36bfd49baa65c4d3cfb21))

## [2.9.1](https://github.com/googleapis/gax-go/compare/v2.9.0...v2.9.1) (2023-05-23)


### Bug Fixes

* **v2:** drop cloud lro test dep ([#276](https://github.com/googleapis/gax-go/issues/276)) ([c67eeba](https://github.com/googleapis/gax-go/commit/c67eeba0f10a3294b1d93c1b8fbe40211a55ae5f)), refs [#270](https://github.com/googleapis/gax-go/issues/270)

## [2.9.0](https://github.com/googleapis/gax-go/compare/v2.8.0...v2.9.0) (2023-05-22)


### Features

* **apierror:** add method to return HTTP status code conditionally ([#274](https://github.com/googleapis/gax-go/issues/274)) ([5874431](https://github.com/googleapis/gax-go/commit/587443169acd10f7f86d1989dc8aaf189e645e98)), refs [#229](https://github.com/googleapis/gax-go/issues/229)


### Documentation

* add ref to usage with clients ([#272](https://github.com/googleapis/gax-go/issues/272)) ([ea4d72d](https://github.com/googleapis/gax-go/commit/ea4d72d514beba4de450868b5fb028601a29164e)), refs [#228](https://github.com/googleapis/gax-go/issues/228)

## [2.8.0](https://github.com/googleapis/gax-go/compare/v2.7.1...v2.8.0) (2023-03-15)


### Features

* **v2:** add WithTimeout option ([#259](https://github.com/googleapis/gax-go/issues/259)) ([9a8da43](https://github.com/googleapis/gax-go/commit/9a8da43693002448b1e8758023699387481866d1))

## [2.7.1](https://github.com/googleapis/gax-go/compare/v2.7.0...v2.7.1) (2023-03-06)


### Bug Fixes

* **v2/apierror:** return Unknown GRPCStatus when err source is HTTP ([#260](https://github.com/googleapis/gax-go/issues/260)) ([043b734](https://github.com/googleapis/gax-go/commit/043b73437a240a91229207fb3ee52a9935a36f23)), refs [#254](https://github.com/googleapis/gax-go/issues/254)

## [2.7.0](https://github.com/googleapis/gax-go/compare/v2.6.0...v2.7.0) (2022-11-02)


### Features

* update google.golang.org/api to latest ([#240](https://github.com/googleapis/gax-go/issues/240)) ([f690a02](https://github.com/googleapis/gax-go/commit/f690a02c806a2903bdee943ede3a58e3a331ebd6))
* **v2/apierror:** add apierror.FromWrappingError ([#238](https://github.com/googleapis/gax-go/issues/238)) ([9dbd96d](https://github.com/googleapis/gax-go/commit/9dbd96d59b9d54ceb7c025513aa8c1a9d727382f))

## [2.6.0](https://github.com/googleapis/gax-go/compare/v2.5.1...v2.6.0) (2022-10-13)


### Features

* **v2:** copy DetermineContentType functionality ([#230](https://github.com/googleapis/gax-go/issues/230)) ([2c52a70](https://github.com/googleapis/gax-go/commit/2c52a70bae965397f740ed27d46aabe89ff249b3))

## [2.5.1](https://github.com/googleapis/gax-go/compare/v2.5.0...v2.5.1) (2022-08-04)


### Bug Fixes

* **v2:** resolve bad genproto pseudoversion in go.mod ([#218](https://github.com/googleapis/gax-go/issues/218)) ([1379b27](https://github.com/googleapis/gax-go/commit/1379b27e9846d959f7e1163b9ef298b3c92c8d23))

## [2.5.0](https://github.com/googleapis/gax-go/compare/v2.4.0...v2.5.0) (2022-08-04)


### Features

* add ExtractProtoMessage to apierror ([#213](https://github.com/googleapis/gax-go/issues/213)) ([a6ce70c](https://github.com/googleapis/gax-go/commit/a6ce70c725c890533a9de6272d3b5ba2e336d6bb))

## [2.4.0](https://github.com/googleapis/gax-go/compare/v2.3.0...v2.4.0) (2022-05-09)


### Features

* **v2:** add OnHTTPCodes CallOption ([#188](https://github.com/googleapis/gax-go/issues/188)) ([ba7c534](https://github.com/googleapis/gax-go/commit/ba7c5348363ab6c33e1cee3c03c0be68a46ca07c))


### Bug Fixes

* **v2/apierror:** use errors.As in FromError ([#189](https://github.com/googleapis/gax-go/issues/189)) ([f30f05b](https://github.com/googleapis/gax-go/commit/f30f05be583828f4c09cca4091333ea88ff8d79e))


### Miscellaneous Chores

* **v2:** bump release-please processing ([#192](https://github.com/googleapis/gax-go/issues/192)) ([56172f9](https://github.com/googleapis/gax-go/commit/56172f971d1141d7687edaac053ad3470af76719))
