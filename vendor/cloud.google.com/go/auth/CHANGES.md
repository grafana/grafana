# Changelog

## [0.16.1](https://github.com/googleapis/google-cloud-go/compare/auth/v0.16.0...auth/v0.16.1) (2025-04-23)


### Bug Fixes

* **auth:** Clone detectopts before assigning TokenBindingType ([#11881](https://github.com/googleapis/google-cloud-go/issues/11881)) ([2167b02](https://github.com/googleapis/google-cloud-go/commit/2167b020fdc43b517c2b6ecca264a10e357ea035))

## [0.16.0](https://github.com/googleapis/google-cloud-go/compare/auth/v0.15.0...auth/v0.16.0) (2025-04-14)


### Features

* **auth/credentials:** Return X.509 certificate chain as subject token ([#11948](https://github.com/googleapis/google-cloud-go/issues/11948)) ([d445a3f](https://github.com/googleapis/google-cloud-go/commit/d445a3f66272ffd5c39c4939af9bebad4582631c)), refs [#11757](https://github.com/googleapis/google-cloud-go/issues/11757)
* **auth:** Configure DirectPath bound credentials from AllowedHardBoundTokens ([#11665](https://github.com/googleapis/google-cloud-go/issues/11665)) ([0fc40bc](https://github.com/googleapis/google-cloud-go/commit/0fc40bcf4e4673704df0973e9fa65957395d7bb4))


### Bug Fixes

* **auth:** Allow non-default SA credentials for DP ([#11828](https://github.com/googleapis/google-cloud-go/issues/11828)) ([3a996b4](https://github.com/googleapis/google-cloud-go/commit/3a996b4129e6d0a34dfda6671f535d5aefb26a82))
* **auth:** Restore calling DialContext ([#11930](https://github.com/googleapis/google-cloud-go/issues/11930)) ([9ec9a29](https://github.com/googleapis/google-cloud-go/commit/9ec9a29494e93197edbaf45aba28984801e9770a)), refs [#11118](https://github.com/googleapis/google-cloud-go/issues/11118)

## [0.15.0](https://github.com/googleapis/google-cloud-go/compare/auth/v0.14.1...auth/v0.15.0) (2025-02-19)


### Features

* **auth:** Add hard-bound token request to compute token provider. ([#11588](https://github.com/googleapis/google-cloud-go/issues/11588)) ([0e608bb](https://github.com/googleapis/google-cloud-go/commit/0e608bb5ac3d694c8ad36ca4340071d3a2c78699))

## [0.14.1](https://github.com/googleapis/google-cloud-go/compare/auth/v0.14.0...auth/v0.14.1) (2025-01-24)


### Documentation

* **auth:** Add warning about externally-provided credentials ([#11462](https://github.com/googleapis/google-cloud-go/issues/11462)) ([49fb6ff](https://github.com/googleapis/google-cloud-go/commit/49fb6ff4d754895f82c9c4d502fc7547d3b5a941))

## [0.14.0](https://github.com/googleapis/google-cloud-go/compare/auth/v0.13.0...auth/v0.14.0) (2025-01-08)


### Features

* **auth:** Add universe domain support to idtoken ([#11059](https://github.com/googleapis/google-cloud-go/issues/11059)) ([72add7e](https://github.com/googleapis/google-cloud-go/commit/72add7e9f8f455af695e8ef79212a4bd3122fb3a))


### Bug Fixes

* **auth/oauth2adapt:** Update golang.org/x/net to v0.33.0 ([e9b0b69](https://github.com/googleapis/google-cloud-go/commit/e9b0b69644ea5b276cacff0a707e8a5e87efafc9))
* **auth:** Fix copy of delegates in impersonate.NewIDTokenCredentials ([#11386](https://github.com/googleapis/google-cloud-go/issues/11386)) ([ff7ef8e](https://github.com/googleapis/google-cloud-go/commit/ff7ef8e7ade7171bce3e4f30ff10a2e9f6c27ca0)), refs [#11379](https://github.com/googleapis/google-cloud-go/issues/11379)
* **auth:** Update golang.org/x/net to v0.33.0 ([e9b0b69](https://github.com/googleapis/google-cloud-go/commit/e9b0b69644ea5b276cacff0a707e8a5e87efafc9))

## [0.13.0](https://github.com/googleapis/google-cloud-go/compare/auth/v0.12.1...auth/v0.13.0) (2024-12-13)


### Features

* **auth:** Add logging support ([#11079](https://github.com/googleapis/google-cloud-go/issues/11079)) ([c80e31d](https://github.com/googleapis/google-cloud-go/commit/c80e31df5ecb33a810be3dfb9d9e27ac531aa91d))
* **auth:** Pass logger from auth layer to metadata package ([#11288](https://github.com/googleapis/google-cloud-go/issues/11288)) ([b552efd](https://github.com/googleapis/google-cloud-go/commit/b552efd6ab34e5dfded18438e0fbfd925805614f))


### Bug Fixes

* **auth:** Check compute cred type before non-default flag for DP ([#11255](https://github.com/googleapis/google-cloud-go/issues/11255)) ([4347ca1](https://github.com/googleapis/google-cloud-go/commit/4347ca141892be8ae813399b4b437662a103bc90))

## [0.12.1](https://github.com/googleapis/google-cloud-go/compare/auth/v0.12.0...auth/v0.12.1) (2024-12-10)


### Bug Fixes

* **auth:** Correct typo in link ([#11160](https://github.com/googleapis/google-cloud-go/issues/11160)) ([af6fb46](https://github.com/googleapis/google-cloud-go/commit/af6fb46d7cd694ddbe8c9d63bc4cdcd62b9fb2c1))

## [0.12.0](https://github.com/googleapis/google-cloud-go/compare/auth/v0.11.0...auth/v0.12.0) (2024-12-04)


### Features

* **auth:** Add support for providing custom certificate URL ([#11006](https://github.com/googleapis/google-cloud-go/issues/11006)) ([ebf3657](https://github.com/googleapis/google-cloud-go/commit/ebf36579724afb375d3974cf1da38f703e3b7dbc)), refs [#11005](https://github.com/googleapis/google-cloud-go/issues/11005)


### Bug Fixes

* **auth:** Ensure endpoints are present in Validator ([#11209](https://github.com/googleapis/google-cloud-go/issues/11209)) ([106cd53](https://github.com/googleapis/google-cloud-go/commit/106cd53309facaef1b8ea78376179f523f6912b9)), refs [#11006](https://github.com/googleapis/google-cloud-go/issues/11006) [#11190](https://github.com/googleapis/google-cloud-go/issues/11190) [#11189](https://github.com/googleapis/google-cloud-go/issues/11189) [#11188](https://github.com/googleapis/google-cloud-go/issues/11188)

## [0.11.0](https://github.com/googleapis/google-cloud-go/compare/auth/v0.10.2...auth/v0.11.0) (2024-11-21)


### Features

* **auth:** Add universe domain support to mTLS ([#11159](https://github.com/googleapis/google-cloud-go/issues/11159)) ([117748b](https://github.com/googleapis/google-cloud-go/commit/117748ba1cfd4ae62a6a4feb7e30951cb2bc9344))

## [0.10.2](https://github.com/googleapis/google-cloud-go/compare/auth/v0.10.1...auth/v0.10.2) (2024-11-12)


### Bug Fixes

* **auth:** Restore use of grpc.Dial ([#11118](https://github.com/googleapis/google-cloud-go/issues/11118)) ([2456b94](https://github.com/googleapis/google-cloud-go/commit/2456b943b7b8aaabd4d8bfb7572c0f477ae0db45)), refs [#7556](https://github.com/googleapis/google-cloud-go/issues/7556)

## [0.10.1](https://github.com/googleapis/google-cloud-go/compare/auth/v0.10.0...auth/v0.10.1) (2024-11-06)


### Bug Fixes

* **auth:** Restore Application Default Credentials support to idtoken ([#11083](https://github.com/googleapis/google-cloud-go/issues/11083)) ([8771f2e](https://github.com/googleapis/google-cloud-go/commit/8771f2ea9807ab822083808e0678392edff3b4f2))
* **auth:** Skip impersonate universe domain check if empty ([#11086](https://github.com/googleapis/google-cloud-go/issues/11086)) ([87159c1](https://github.com/googleapis/google-cloud-go/commit/87159c1059d4a18d1367ce62746a838a94964ab6))

## [0.10.0](https://github.com/googleapis/google-cloud-go/compare/auth/v0.9.9...auth/v0.10.0) (2024-10-30)


### Features

* **auth:** Add universe domain support to credentials/impersonate ([#10953](https://github.com/googleapis/google-cloud-go/issues/10953)) ([e06cb64](https://github.com/googleapis/google-cloud-go/commit/e06cb6499f7eda3aef08ab18ff197016f667684b))

## [0.9.9](https://github.com/googleapis/google-cloud-go/compare/auth/v0.9.8...auth/v0.9.9) (2024-10-22)


### Bug Fixes

* **auth:** Fallback cert lookups for missing files ([#11013](https://github.com/googleapis/google-cloud-go/issues/11013)) ([bd76695](https://github.com/googleapis/google-cloud-go/commit/bd766957ec238b7c40ddbabb369e612dc9b07313)), refs [#10844](https://github.com/googleapis/google-cloud-go/issues/10844)
* **auth:** Replace MDS endpoint universe_domain with universe-domain ([#11000](https://github.com/googleapis/google-cloud-go/issues/11000)) ([6a1586f](https://github.com/googleapis/google-cloud-go/commit/6a1586f2ce9974684affaea84e7b629313b4d114))

## [0.9.8](https://github.com/googleapis/google-cloud-go/compare/auth/v0.9.7...auth/v0.9.8) (2024-10-09)


### Bug Fixes

* **auth:** Restore OpenTelemetry handling in transports ([#10968](https://github.com/googleapis/google-cloud-go/issues/10968)) ([08c6d04](https://github.com/googleapis/google-cloud-go/commit/08c6d04901c1a20e219b2d86df41dbaa6d7d7b55)), refs [#10962](https://github.com/googleapis/google-cloud-go/issues/10962)
* **auth:** Try talk to plaintext S2A if credentials can not be found for mTLS-S2A ([#10941](https://github.com/googleapis/google-cloud-go/issues/10941)) ([0f0bf2d](https://github.com/googleapis/google-cloud-go/commit/0f0bf2d18c97dd8b65bcf0099f0802b5631c6287))

## [0.9.7](https://github.com/googleapis/google-cloud-go/compare/auth/v0.9.6...auth/v0.9.7) (2024-10-01)


### Bug Fixes

* **auth:** Restore support for non-default service accounts for DirectPath ([#10937](https://github.com/googleapis/google-cloud-go/issues/10937)) ([a38650e](https://github.com/googleapis/google-cloud-go/commit/a38650edbf420223077498cafa537aec74b37aad)), refs [#10907](https://github.com/googleapis/google-cloud-go/issues/10907)

## [0.9.6](https://github.com/googleapis/google-cloud-go/compare/auth/v0.9.5...auth/v0.9.6) (2024-09-30)


### Bug Fixes

* **auth:** Make aws credentials provider retrieve fresh credentials ([#10920](https://github.com/googleapis/google-cloud-go/issues/10920)) ([250fbf8](https://github.com/googleapis/google-cloud-go/commit/250fbf87d858d865e399a241b7e537c4ff0c3dd8))

## [0.9.5](https://github.com/googleapis/google-cloud-go/compare/auth/v0.9.4...auth/v0.9.5) (2024-09-25)


### Bug Fixes

* **auth:** Restore support for GOOGLE_CLOUD_UNIVERSE_DOMAIN env ([#10915](https://github.com/googleapis/google-cloud-go/issues/10915)) ([94caaaa](https://github.com/googleapis/google-cloud-go/commit/94caaaa061362d0e00ef6214afcc8a0a3e7ebfb2))
* **auth:** Skip directpath credentials overwrite when it's not on GCE ([#10833](https://github.com/googleapis/google-cloud-go/issues/10833)) ([7e5e8d1](https://github.com/googleapis/google-cloud-go/commit/7e5e8d10b761b0a6e43e19a028528db361bc07b1))
* **auth:** Use new context for non-blocking token refresh ([#10919](https://github.com/googleapis/google-cloud-go/issues/10919)) ([cf7102d](https://github.com/googleapis/google-cloud-go/commit/cf7102d33a21be1e5a9d47a49456b3a57c43b350))

## [0.9.4](https://github.com/googleapis/google-cloud-go/compare/auth/v0.9.3...auth/v0.9.4) (2024-09-11)


### Bug Fixes

* **auth:** Enable self-signed JWT for non-GDU universe domain ([#10831](https://github.com/googleapis/google-cloud-go/issues/10831)) ([f9869f7](https://github.com/googleapis/google-cloud-go/commit/f9869f7903cfd34d1b97c25d0dc5669d2c5138e6))

## [0.9.3](https://github.com/googleapis/google-cloud-go/compare/auth/v0.9.2...auth/v0.9.3) (2024-09-03)


### Bug Fixes

* **auth:** Choose quota project envvar over file when both present ([#10807](https://github.com/googleapis/google-cloud-go/issues/10807)) ([2d8dd77](https://github.com/googleapis/google-cloud-go/commit/2d8dd7700eff92d4b95027be55e26e1e7aa79181)), refs [#10804](https://github.com/googleapis/google-cloud-go/issues/10804)

## [0.9.2](https://github.com/googleapis/google-cloud-go/compare/auth/v0.9.1...auth/v0.9.2) (2024-08-30)


### Bug Fixes

* **auth:** Handle non-Transport DefaultTransport ([#10733](https://github.com/googleapis/google-cloud-go/issues/10733)) ([98d91dc](https://github.com/googleapis/google-cloud-go/commit/98d91dc8316b247498fab41ab35e57a0446fe556)), refs [#10742](https://github.com/googleapis/google-cloud-go/issues/10742)
* **auth:** Make sure quota option takes precedence over env/file ([#10797](https://github.com/googleapis/google-cloud-go/issues/10797)) ([f1b050d](https://github.com/googleapis/google-cloud-go/commit/f1b050d56d804b245cab048c2980d32b0eaceb4e)), refs [#10795](https://github.com/googleapis/google-cloud-go/issues/10795)


### Documentation

* **auth:** Fix Go doc comment link ([#10751](https://github.com/googleapis/google-cloud-go/issues/10751)) ([015acfa](https://github.com/googleapis/google-cloud-go/commit/015acfab4d172650928bb1119bc2cd6307b9a437))

## [0.9.1](https://github.com/googleapis/google-cloud-go/compare/auth/v0.9.0...auth/v0.9.1) (2024-08-22)


### Bug Fixes

* **auth:** Setting expireEarly to default when the value is 0 ([#10732](https://github.com/googleapis/google-cloud-go/issues/10732)) ([5e67869](https://github.com/googleapis/google-cloud-go/commit/5e67869a31e9e8ecb4eeebd2cfa11a761c3b1948))

## [0.9.0](https://github.com/googleapis/google-cloud-go/compare/auth/v0.8.1...auth/v0.9.0) (2024-08-16)


### Features

* **auth:** Auth library can talk to S2A over mTLS ([#10634](https://github.com/googleapis/google-cloud-go/issues/10634)) ([5250a13](https://github.com/googleapis/google-cloud-go/commit/5250a13ec95b8d4eefbe0158f82857ff2189cb45))

## [0.8.1](https://github.com/googleapis/google-cloud-go/compare/auth/v0.8.0...auth/v0.8.1) (2024-08-13)


### Bug Fixes

* **auth:** Make default client creation more lenient ([#10669](https://github.com/googleapis/google-cloud-go/issues/10669)) ([1afb9ee](https://github.com/googleapis/google-cloud-go/commit/1afb9ee1ee9de9810722800018133304a0ca34d1)), refs [#10638](https://github.com/googleapis/google-cloud-go/issues/10638)

## [0.8.0](https://github.com/googleapis/google-cloud-go/compare/auth/v0.7.3...auth/v0.8.0) (2024-08-07)


### Features

* **auth:** Adds support for X509 workload identity federation ([#10373](https://github.com/googleapis/google-cloud-go/issues/10373)) ([5d07505](https://github.com/googleapis/google-cloud-go/commit/5d075056cbe27bb1da4072a26070c41f8999eb9b))

## [0.7.3](https://github.com/googleapis/google-cloud-go/compare/auth/v0.7.2...auth/v0.7.3) (2024-08-01)


### Bug Fixes

* **auth/oauth2adapt:** Update dependencies ([257c40b](https://github.com/googleapis/google-cloud-go/commit/257c40bd6d7e59730017cf32bda8823d7a232758))
* **auth:** Disable automatic universe domain check for MDS ([#10620](https://github.com/googleapis/google-cloud-go/issues/10620)) ([7cea5ed](https://github.com/googleapis/google-cloud-go/commit/7cea5edd5a0c1e6bca558696f5607879141910e8))
* **auth:** Update dependencies ([257c40b](https://github.com/googleapis/google-cloud-go/commit/257c40bd6d7e59730017cf32bda8823d7a232758))

## [0.7.2](https://github.com/googleapis/google-cloud-go/compare/auth/v0.7.1...auth/v0.7.2) (2024-07-22)


### Bug Fixes

* **auth:** Use default client for universe metadata lookup ([#10551](https://github.com/googleapis/google-cloud-go/issues/10551)) ([d9046fd](https://github.com/googleapis/google-cloud-go/commit/d9046fdd1435d1ce48f374806c1def4cb5ac6cd3)), refs [#10544](https://github.com/googleapis/google-cloud-go/issues/10544)

## [0.7.1](https://github.com/googleapis/google-cloud-go/compare/auth/v0.7.0...auth/v0.7.1) (2024-07-10)


### Bug Fixes

* **auth:** Bump google.golang.org/grpc@v1.64.1 ([8ecc4e9](https://github.com/googleapis/google-cloud-go/commit/8ecc4e9622e5bbe9b90384d5848ab816027226c5))

## [0.7.0](https://github.com/googleapis/google-cloud-go/compare/auth/v0.6.1...auth/v0.7.0) (2024-07-09)


### Features

* **auth:** Add workload X509 cert provider as a default cert provider ([#10479](https://github.com/googleapis/google-cloud-go/issues/10479)) ([c51ee6c](https://github.com/googleapis/google-cloud-go/commit/c51ee6cf65ce05b4d501083e49d468c75ac1ea63))


### Bug Fixes

* **auth/oauth2adapt:** Bump google.golang.org/api@v0.187.0 ([8fa9e39](https://github.com/googleapis/google-cloud-go/commit/8fa9e398e512fd8533fd49060371e61b5725a85b))
* **auth:** Bump google.golang.org/api@v0.187.0 ([8fa9e39](https://github.com/googleapis/google-cloud-go/commit/8fa9e398e512fd8533fd49060371e61b5725a85b))
* **auth:** Check len of slices, not non-nil ([#10483](https://github.com/googleapis/google-cloud-go/issues/10483)) ([0a966a1](https://github.com/googleapis/google-cloud-go/commit/0a966a183e5f0e811977216d736d875b7233e942))

## [0.6.1](https://github.com/googleapis/google-cloud-go/compare/auth/v0.6.0...auth/v0.6.1) (2024-07-01)


### Bug Fixes

* **auth:** Support gRPC API keys ([#10460](https://github.com/googleapis/google-cloud-go/issues/10460)) ([daa6646](https://github.com/googleapis/google-cloud-go/commit/daa6646d2af5d7fb5b30489f4934c7db89868c7c))
* **auth:** Update http and grpc transports to support token exchange over mTLS ([#10397](https://github.com/googleapis/google-cloud-go/issues/10397)) ([c6dfdcf](https://github.com/googleapis/google-cloud-go/commit/c6dfdcf893c3f971eba15026c12db0a960ae81f2))

## [0.6.0](https://github.com/googleapis/google-cloud-go/compare/auth/v0.5.2...auth/v0.6.0) (2024-06-25)


### Features

* **auth:** Add non-blocking token refresh for compute MDS ([#10263](https://github.com/googleapis/google-cloud-go/issues/10263)) ([9ac350d](https://github.com/googleapis/google-cloud-go/commit/9ac350da11a49b8e2174d3fc5b1a5070fec78b4e))


### Bug Fixes

* **auth:** Return error if envvar detected file returns an error ([#10431](https://github.com/googleapis/google-cloud-go/issues/10431)) ([e52b9a7](https://github.com/googleapis/google-cloud-go/commit/e52b9a7c45468827f5d220ab00965191faeb9d05))

## [0.5.2](https://github.com/googleapis/google-cloud-go/compare/auth/v0.5.1...auth/v0.5.2) (2024-06-24)


### Bug Fixes

* **auth:** Fetch initial token when CachedTokenProviderOptions.DisableAutoRefresh is true ([#10415](https://github.com/googleapis/google-cloud-go/issues/10415)) ([3266763](https://github.com/googleapis/google-cloud-go/commit/32667635ca2efad05cd8c087c004ca07d7406913)), refs [#10414](https://github.com/googleapis/google-cloud-go/issues/10414)

## [0.5.1](https://github.com/googleapis/google-cloud-go/compare/auth/v0.5.0...auth/v0.5.1) (2024-05-31)


### Bug Fixes

* **auth:** Pass through client to 2LO and 3LO flows ([#10290](https://github.com/googleapis/google-cloud-go/issues/10290)) ([685784e](https://github.com/googleapis/google-cloud-go/commit/685784ea84358c15e9214bdecb307d37aa3b6d2f))

## [0.5.0](https://github.com/googleapis/google-cloud-go/compare/auth/v0.4.2...auth/v0.5.0) (2024-05-28)


### Features

* **auth:** Adds X509 workload certificate provider ([#10233](https://github.com/googleapis/google-cloud-go/issues/10233)) ([17a9db7](https://github.com/googleapis/google-cloud-go/commit/17a9db73af35e3d1a7a25ac4fd1377a103de6150))

## [0.4.2](https://github.com/googleapis/google-cloud-go/compare/auth/v0.4.1...auth/v0.4.2) (2024-05-16)


### Bug Fixes

* **auth:** Enable client certificates by default only for GDU ([#10151](https://github.com/googleapis/google-cloud-go/issues/10151)) ([7c52978](https://github.com/googleapis/google-cloud-go/commit/7c529786275a39b7e00525f7d5e7be0d963e9e15))
* **auth:** Handle non-Transport DefaultTransport ([#10162](https://github.com/googleapis/google-cloud-go/issues/10162)) ([fa3bfdb](https://github.com/googleapis/google-cloud-go/commit/fa3bfdb23aaa45b34394a8b61e753b3587506782)), refs [#10159](https://github.com/googleapis/google-cloud-go/issues/10159)
* **auth:** Have refresh time match docs ([#10147](https://github.com/googleapis/google-cloud-go/issues/10147)) ([bcb5568](https://github.com/googleapis/google-cloud-go/commit/bcb5568c07a54dd3d2e869d15f502b0741a609e8))
* **auth:** Update compute token fetching error with named prefix ([#10180](https://github.com/googleapis/google-cloud-go/issues/10180)) ([4573504](https://github.com/googleapis/google-cloud-go/commit/4573504828d2928bebedc875d87650ba227829ea))

## [0.4.1](https://github.com/googleapis/google-cloud-go/compare/auth/v0.4.0...auth/v0.4.1) (2024-05-09)


### Bug Fixes

* **auth:** Don't try to detect default creds it opt configured ([#10143](https://github.com/googleapis/google-cloud-go/issues/10143)) ([804632e](https://github.com/googleapis/google-cloud-go/commit/804632e7c5b0b85ff522f7951114485e256eb5bc))

## [0.4.0](https://github.com/googleapis/google-cloud-go/compare/auth/v0.3.0...auth/v0.4.0) (2024-05-07)


### Features

* **auth:** Enable client certificates by default ([#10102](https://github.com/googleapis/google-cloud-go/issues/10102)) ([9013e52](https://github.com/googleapis/google-cloud-go/commit/9013e5200a6ec0f178ed91acb255481ffb073a2c))


### Bug Fixes

* **auth:** Get s2a logic up to date ([#10093](https://github.com/googleapis/google-cloud-go/issues/10093)) ([4fe9ae4](https://github.com/googleapis/google-cloud-go/commit/4fe9ae4b7101af2a5221d6d6b2e77b479305bb06))

## [0.3.0](https://github.com/googleapis/google-cloud-go/compare/auth/v0.2.2...auth/v0.3.0) (2024-04-23)


### Features

* **auth/httptransport:** Add ability to customize transport ([#10023](https://github.com/googleapis/google-cloud-go/issues/10023)) ([72c7f6b](https://github.com/googleapis/google-cloud-go/commit/72c7f6bbec3136cc7a62788fc7186bc33ef6c3b3)), refs [#9812](https://github.com/googleapis/google-cloud-go/issues/9812) [#9814](https://github.com/googleapis/google-cloud-go/issues/9814)


### Bug Fixes

* **auth/credentials:** Error on bad file name if explicitly set ([#10018](https://github.com/googleapis/google-cloud-go/issues/10018)) ([55beaa9](https://github.com/googleapis/google-cloud-go/commit/55beaa993aaf052d8be39766afc6777c3c2a0bdd)), refs [#9809](https://github.com/googleapis/google-cloud-go/issues/9809)

## [0.2.2](https://github.com/googleapis/google-cloud-go/compare/auth/v0.2.1...auth/v0.2.2) (2024-04-19)


### Bug Fixes

* **auth:** Add internal opt to skip validation on transports ([#9999](https://github.com/googleapis/google-cloud-go/issues/9999)) ([9e20ef8](https://github.com/googleapis/google-cloud-go/commit/9e20ef89f6287d6bd03b8697d5898dc43b4a77cf)), refs [#9823](https://github.com/googleapis/google-cloud-go/issues/9823)
* **auth:** Set secure flag for gRPC conn pools ([#10002](https://github.com/googleapis/google-cloud-go/issues/10002)) ([14e3956](https://github.com/googleapis/google-cloud-go/commit/14e3956dfd736399731b5ee8d9b178ae085cf7ba)), refs [#9833](https://github.com/googleapis/google-cloud-go/issues/9833)

## [0.2.1](https://github.com/googleapis/google-cloud-go/compare/auth/v0.2.0...auth/v0.2.1) (2024-04-18)


### Bug Fixes

* **auth:** Default gRPC token type to Bearer if not set ([#9800](https://github.com/googleapis/google-cloud-go/issues/9800)) ([5284066](https://github.com/googleapis/google-cloud-go/commit/5284066670b6fe65d79089cfe0199c9660f87fc7))

## [0.2.0](https://github.com/googleapis/google-cloud-go/compare/auth/v0.1.1...auth/v0.2.0) (2024-04-15)

### Breaking Changes

In the below mentioned commits there were a few large breaking changes since the
last release of the module.

1. The `Credentials` type has been moved to the root of the module as it is
   becoming the core abstraction for the whole module.
2. Because of the above mentioned change many functions that previously
   returned a `TokenProvider` now return `Credentials`. Similarly, these
   functions have been renamed to be more specific.
3. Most places that used to take an optional `TokenProvider` now accept
   `Credentials`. You can make a `Credentials` from a `TokenProvider` using the
   constructor found in the `auth` package.
4. The `detect` package has been renamed to `credentials`. With this change some
   function signatures were also updated for better readability.
5. Derivative auth flows like `impersonate` and `downscope` have been moved to
   be under the new `credentials` package.

Although these changes are disruptive we think that they are for the best of the
long-term health of the module. We do not expect any more large breaking changes
like these in future revisions, even before 1.0.0. This version will be the
first version of the auth library that our client libraries start to use and
depend on.

### Features

* **auth/credentials/externalaccount:** Add default TokenURL ([#9700](https://github.com/googleapis/google-cloud-go/issues/9700)) ([81830e6](https://github.com/googleapis/google-cloud-go/commit/81830e6848ceefd055aa4d08f933d1154455a0f6))
* **auth:** Add downscope.Options.UniverseDomain ([#9634](https://github.com/googleapis/google-cloud-go/issues/9634)) ([52cf7d7](https://github.com/googleapis/google-cloud-go/commit/52cf7d780853594291c4e34302d618299d1f5a1d))
* **auth:** Add universe domain to grpctransport and httptransport ([#9663](https://github.com/googleapis/google-cloud-go/issues/9663)) ([67d353b](https://github.com/googleapis/google-cloud-go/commit/67d353beefe3b607c08c891876fbd95ab89e5fe3)), refs [#9670](https://github.com/googleapis/google-cloud-go/issues/9670)
* **auth:** Add UniverseDomain to DetectOptions ([#9536](https://github.com/googleapis/google-cloud-go/issues/9536)) ([3618d3f](https://github.com/googleapis/google-cloud-go/commit/3618d3f7061615c0e189f376c75abc201203b501))
* **auth:** Make package externalaccount public ([#9633](https://github.com/googleapis/google-cloud-go/issues/9633)) ([a0978d8](https://github.com/googleapis/google-cloud-go/commit/a0978d8e96968399940ebd7d092539772bf9caac))
* **auth:** Move credentials to base auth package ([#9590](https://github.com/googleapis/google-cloud-go/issues/9590)) ([1a04baf](https://github.com/googleapis/google-cloud-go/commit/1a04bafa83c27342b9308d785645e1e5423ea10d))
* **auth:** Refactor public sigs to use Credentials ([#9603](https://github.com/googleapis/google-cloud-go/issues/9603)) ([69cb240](https://github.com/googleapis/google-cloud-go/commit/69cb240c530b1f7173a9af2555c19e9a1beb56c5))


### Bug Fixes

* **auth/oauth2adapt:** Update protobuf dep to v1.33.0 ([30b038d](https://github.com/googleapis/google-cloud-go/commit/30b038d8cac0b8cd5dd4761c87f3f298760dd33a))
* **auth:** Fix uint32 conversion ([9221c7f](https://github.com/googleapis/google-cloud-go/commit/9221c7fa12cef9d5fb7ddc92f41f1d6204971c7b))
* **auth:** Port sts expires fix ([#9618](https://github.com/googleapis/google-cloud-go/issues/9618)) ([7bec97b](https://github.com/googleapis/google-cloud-go/commit/7bec97b2f51ed3ac4f9b88bf100d301da3f5d1bd))
* **auth:** Read universe_domain from all credentials files ([#9632](https://github.com/googleapis/google-cloud-go/issues/9632)) ([16efbb5](https://github.com/googleapis/google-cloud-go/commit/16efbb52e39ea4a319e5ee1e95c0e0305b6d9824))
* **auth:** Remove content-type header from idms get requests ([#9508](https://github.com/googleapis/google-cloud-go/issues/9508)) ([8589f41](https://github.com/googleapis/google-cloud-go/commit/8589f41599d265d7c3d46a3d86c9fab2329cbdd9))
* **auth:** Update protobuf dep to v1.33.0 ([30b038d](https://github.com/googleapis/google-cloud-go/commit/30b038d8cac0b8cd5dd4761c87f3f298760dd33a))

## [0.1.1](https://github.com/googleapis/google-cloud-go/compare/auth/v0.1.0...auth/v0.1.1) (2024-03-10)


### Bug Fixes

* **auth/impersonate:** Properly send default detect params ([#9529](https://github.com/googleapis/google-cloud-go/issues/9529)) ([5b6b8be](https://github.com/googleapis/google-cloud-go/commit/5b6b8bef577f82707e51f5cc5d258d5bdf90218f)), refs [#9136](https://github.com/googleapis/google-cloud-go/issues/9136)
* **auth:** Update grpc-go to v1.56.3 ([343cea8](https://github.com/googleapis/google-cloud-go/commit/343cea8c43b1e31ae21ad50ad31d3b0b60143f8c))
* **auth:** Update grpc-go to v1.59.0 ([81a97b0](https://github.com/googleapis/google-cloud-go/commit/81a97b06cb28b25432e4ece595c55a9857e960b7))

## 0.1.0 (2023-10-18)


### Features

* **auth:** Add base auth package ([#8465](https://github.com/googleapis/google-cloud-go/issues/8465)) ([6a45f26](https://github.com/googleapis/google-cloud-go/commit/6a45f26b809b64edae21f312c18d4205f96b180e))
* **auth:** Add cert support to httptransport ([#8569](https://github.com/googleapis/google-cloud-go/issues/8569)) ([37e3435](https://github.com/googleapis/google-cloud-go/commit/37e3435f8e98595eafab481bdfcb31a4c56fa993))
* **auth:** Add Credentials.UniverseDomain() ([#8654](https://github.com/googleapis/google-cloud-go/issues/8654)) ([af0aa1e](https://github.com/googleapis/google-cloud-go/commit/af0aa1ed8015bc8fe0dd87a7549ae029107cbdb8))
* **auth:** Add detect package ([#8491](https://github.com/googleapis/google-cloud-go/issues/8491)) ([d977419](https://github.com/googleapis/google-cloud-go/commit/d977419a3269f6acc193df77a2136a6eb4b4add7))
* **auth:** Add downscope package ([#8532](https://github.com/googleapis/google-cloud-go/issues/8532)) ([dda9bff](https://github.com/googleapis/google-cloud-go/commit/dda9bff8ec70e6d104901b4105d13dcaa4e2404c))
* **auth:** Add grpctransport package ([#8625](https://github.com/googleapis/google-cloud-go/issues/8625)) ([69a8347](https://github.com/googleapis/google-cloud-go/commit/69a83470bdcc7ed10c6c36d1abc3b7cfdb8a0ee5))
* **auth:** Add httptransport package ([#8567](https://github.com/googleapis/google-cloud-go/issues/8567)) ([6898597](https://github.com/googleapis/google-cloud-go/commit/6898597d2ea95d630fcd00fd15c58c75ea843bff))
* **auth:** Add idtoken package ([#8580](https://github.com/googleapis/google-cloud-go/issues/8580)) ([a79e693](https://github.com/googleapis/google-cloud-go/commit/a79e693e97e4e3e1c6742099af3dbc58866d88fe))
* **auth:** Add impersonate package ([#8578](https://github.com/googleapis/google-cloud-go/issues/8578)) ([e29ba0c](https://github.com/googleapis/google-cloud-go/commit/e29ba0cb7bd3888ab9e808087027dc5a32474c04))
* **auth:** Add support for external accounts in detect ([#8508](https://github.com/googleapis/google-cloud-go/issues/8508)) ([62210d5](https://github.com/googleapis/google-cloud-go/commit/62210d5d3e56e8e9f35db8e6ac0defec19582507))
* **auth:** Port external account changes ([#8697](https://github.com/googleapis/google-cloud-go/issues/8697)) ([5823db5](https://github.com/googleapis/google-cloud-go/commit/5823db5d633069999b58b9131a7f9cd77e82c899))


### Bug Fixes

* **auth/oauth2adapt:** Update golang.org/x/net to v0.17.0 ([174da47](https://github.com/googleapis/google-cloud-go/commit/174da47254fefb12921bbfc65b7829a453af6f5d))
* **auth:** Update golang.org/x/net to v0.17.0 ([174da47](https://github.com/googleapis/google-cloud-go/commit/174da47254fefb12921bbfc65b7829a453af6f5d))
