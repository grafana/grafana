# Changes


## [1.55.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.54.0...storage/v1.55.0) (2025-05-29)


### Features

* **storage/control:** Add Client Libraries Storage IntelligenceConfig ([2aaada3](https://github.com/googleapis/google-cloud-go/commit/2aaada3fb7a9d3eaacec3351019e225c4038646b))
* **storage/internal:** Add IpFilter to Bucket ([#12309](https://github.com/googleapis/google-cloud-go/issues/12309)) ([d8ae687](https://github.com/googleapis/google-cloud-go/commit/d8ae6874a54b48fce49968664f14db63c055c6e2))
* **storage/internal:** Add Object.Retention message ([d8ae687](https://github.com/googleapis/google-cloud-go/commit/d8ae6874a54b48fce49968664f14db63c055c6e2))


### Bug Fixes

* **storage:** Add EnableNewAuthLibrary internalOption to HTTP newClient ([#12320](https://github.com/googleapis/google-cloud-go/issues/12320)) ([0036073](https://github.com/googleapis/google-cloud-go/commit/0036073affee5451894654a983fba6b2638433cb))
* **storage:** Migrate oauth2/google usages to cloud.google.com/go/auth ([#11191](https://github.com/googleapis/google-cloud-go/issues/11191)) ([3a22349](https://github.com/googleapis/google-cloud-go/commit/3a22349c1ba6a192d70269f77e5804a9957aa572))
* **storage:** Omit check on MultiRangeDownloader ([#12342](https://github.com/googleapis/google-cloud-go/issues/12342)) ([774621c](https://github.com/googleapis/google-cloud-go/commit/774621c5baa5110f57fe79d817143416bd671d1e))
* **storage:** Retry url.Error and net.OpErrors when they wrap an io.EOF ([#12289](https://github.com/googleapis/google-cloud-go/issues/12289)) ([080f6b0](https://github.com/googleapis/google-cloud-go/commit/080f6b05c5e8bd5baaef71ed47f8d54c695f63d3))


### Documentation

* **storage/internal:** Add explicit Optional annotations to fields that have always been treated as optional ([d8ae687](https://github.com/googleapis/google-cloud-go/commit/d8ae6874a54b48fce49968664f14db63c055c6e2))
* **storage/internal:** Add note that Bucket.project output format is always project number format ([d8ae687](https://github.com/googleapis/google-cloud-go/commit/d8ae6874a54b48fce49968664f14db63c055c6e2))
* **storage/internal:** Add note that managedFolders are supported for GetIamPolicy and SetIamPolicy ([d8ae687](https://github.com/googleapis/google-cloud-go/commit/d8ae6874a54b48fce49968664f14db63c055c6e2))

## [1.54.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.53.0...storage/v1.54.0) (2025-05-12)


### Features

* **storage:** Add experimental ZB API option ([#12214](https://github.com/googleapis/google-cloud-go/issues/12214)) ([f669982](https://github.com/googleapis/google-cloud-go/commit/f669982de2abf64759eccf5c38bd669488b9cf6a))


### Bug Fixes

* **storage:** Fix append writer hang ([#12201](https://github.com/googleapis/google-cloud-go/issues/12201)) ([7ce2a2a](https://github.com/googleapis/google-cloud-go/commit/7ce2a2ad3ae9deff28c73c1bcc2e7001770464eb))
* **storage:** Retry unwrapped EOFs ([#12202](https://github.com/googleapis/google-cloud-go/issues/12202)) ([b2d42bd](https://github.com/googleapis/google-cloud-go/commit/b2d42bda6a398f3aa00030b6e99bbcb40f132ff7))

## [1.53.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.52.0...storage/v1.53.0) (2025-05-02)


### Features

* **storage/control:** Add Anywhere cache control APIs ([83ae06c](https://github.com/googleapis/google-cloud-go/commit/83ae06c3ec7d190e38856ba4cfd8a13f08356b4d))


### Bug Fixes

* **storage:** Fix append edge cases ([#12074](https://github.com/googleapis/google-cloud-go/issues/12074)) ([0eee1f9](https://github.com/googleapis/google-cloud-go/commit/0eee1f99a7dc0d1bfc36fa43d78933cae47962ee))
* **storage:** Fix retries for redirection errors. ([#12093](https://github.com/googleapis/google-cloud-go/issues/12093)) ([3e177e7](https://github.com/googleapis/google-cloud-go/commit/3e177e755f5bf6aa96e8712cc4adcba7eb6f04f6))
* **storage:** Handle gRPC deadlines in tests. ([#12092](https://github.com/googleapis/google-cloud-go/issues/12092)) ([30b7cd2](https://github.com/googleapis/google-cloud-go/commit/30b7cd27771ccbd49b70ee106da36362ba8f1e87))
* **storage:** Update offset on resumable upload retry ([#12086](https://github.com/googleapis/google-cloud-go/issues/12086)) ([6ce8fe5](https://github.com/googleapis/google-cloud-go/commit/6ce8fe5aec0ec7916eda4d1405cab5f5f65a5de8))
* **storage:** Validate Bidi option for MRD ([#12033](https://github.com/googleapis/google-cloud-go/issues/12033)) ([d9018cf](https://github.com/googleapis/google-cloud-go/commit/d9018cf640a9ac25e2b23b75b3bcfa734379ab09))


### Documentation

* **storage/control:** Added comments for Anywhere cache messages ([83ae06c](https://github.com/googleapis/google-cloud-go/commit/83ae06c3ec7d190e38856ba4cfd8a13f08356b4d))

## [1.52.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.51.0...storage/v1.52.0) (2025-04-22)


### Features

* **storage/control:** Add Anywhere cache control APIs ([#11807](https://github.com/googleapis/google-cloud-go/issues/11807)) ([12bfa98](https://github.com/googleapis/google-cloud-go/commit/12bfa984f87099dbfbd5abf3436e440e62b04bad))
* **storage:** Add CurrentState function to determine state of stream in MRD ([#11688](https://github.com/googleapis/google-cloud-go/issues/11688)) ([14e8e13](https://github.com/googleapis/google-cloud-go/commit/14e8e132d9d5808d1ca789792e7e39f0857991da))
* **storage:** Add OwnerEntity to bucketAttrs ([#11857](https://github.com/googleapis/google-cloud-go/issues/11857)) ([4cd4a0c](https://github.com/googleapis/google-cloud-go/commit/4cd4a0ca1f6132ea6ed9df7b27310a3238a9c3fd))
* **storage:** Takeover appendable object ([#11977](https://github.com/googleapis/google-cloud-go/issues/11977)) ([513b937](https://github.com/googleapis/google-cloud-go/commit/513b937420b945c4a76e20711f305c6ad8a77812))
* **storage:** Unfinalized appendable objects. ([#11647](https://github.com/googleapis/google-cloud-go/issues/11647)) ([52c0218](https://github.com/googleapis/google-cloud-go/commit/52c02183fabf43fcba3893f493140ac28a7836d1))


### Bug Fixes

* **storage:** Fix Attrs for append takeover ([#11989](https://github.com/googleapis/google-cloud-go/issues/11989)) ([6db35b1](https://github.com/googleapis/google-cloud-go/commit/6db35b10567b7f1463bfef722b0fd72257190ee7))
* **storage:** Fix panic when Flush called early ([#11934](https://github.com/googleapis/google-cloud-go/issues/11934)) ([7d0b8a7](https://github.com/googleapis/google-cloud-go/commit/7d0b8a75ae55731ae765c01f24920f9f11038f44))
* **storage:** Fix unfinalized write size ([#12016](https://github.com/googleapis/google-cloud-go/issues/12016)) ([6217f8f](https://github.com/googleapis/google-cloud-go/commit/6217f8fd3cd8680a7e6b7b46fc9b7bda6ee6292e))
* **storage:** Force first message on next sendBuffer when nothing sent on current ([#11871](https://github.com/googleapis/google-cloud-go/issues/11871)) ([a1a2292](https://github.com/googleapis/google-cloud-go/commit/a1a22927d6a4399e7392787bccb9707bc9e8f149))
* **storage:** Populate Writer.Attrs after Flush() ([#12021](https://github.com/googleapis/google-cloud-go/issues/12021)) ([8e56f74](https://github.com/googleapis/google-cloud-go/commit/8e56f745e7f2175660838f96c1a12a46841cac40))
* **storage:** Remove check for FinalizeOnClose ([#11992](https://github.com/googleapis/google-cloud-go/issues/11992)) ([2664b8c](https://github.com/googleapis/google-cloud-go/commit/2664b8cec00a606001184cb17c074fd0e79e66b8))
* **storage:** Wrap read response parsing errors ([#11951](https://github.com/googleapis/google-cloud-go/issues/11951)) ([d2e6583](https://github.com/googleapis/google-cloud-go/commit/d2e658387b80ec8a3e41e048a9d520b8dd13dd00))


## [1.51.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.50.0...storage/v1.51.0) (2025-03-07)


### Features

* **storage/append:** Support appends in w1r3. ([#11483](https://github.com/googleapis/google-cloud-go/issues/11483)) ([48bb391](https://github.com/googleapis/google-cloud-go/commit/48bb39154479a2cf2d379316e0915f39d7b7a518))
* **storage:** Benchmark with experimental MRD. ([#11501](https://github.com/googleapis/google-cloud-go/issues/11501)) ([7b49152](https://github.com/googleapis/google-cloud-go/commit/7b491520a693d258d3370a19c43c9dff6c8558c7))
* **storage:** Implement RetryChunkDeadline for grpc writes ([#11476](https://github.com/googleapis/google-cloud-go/issues/11476)) ([03575d7](https://github.com/googleapis/google-cloud-go/commit/03575d74f5241cc714e4d3ac63635569a34f5633))
* **storage:** Specify benchmark integrity check. ([#11465](https://github.com/googleapis/google-cloud-go/issues/11465)) ([da18845](https://github.com/googleapis/google-cloud-go/commit/da188453e0254c49a01d28788d0849a2d0e98e0c))
* **storage:** Use ReadHandle for faster re-connect ([#11510](https://github.com/googleapis/google-cloud-go/issues/11510)) ([cac52f7](https://github.com/googleapis/google-cloud-go/commit/cac52f79a73d46774d33d76e3075c0a5b3e0b9f3))
* **storage:** Wrap NotFound errors for buckets and objects ([#11519](https://github.com/googleapis/google-cloud-go/issues/11519)) ([0dd7d3d](https://github.com/googleapis/google-cloud-go/commit/0dd7d3d62e54c6c3bca395fcca8450ad3347a5a0))


### Bug Fixes

* **storage/append:** Report progress for appends. ([#11503](https://github.com/googleapis/google-cloud-go/issues/11503)) ([96dbb6c](https://github.com/googleapis/google-cloud-go/commit/96dbb6c12398fb3cbffab2bf61836bef2f704f66))
* **storage:** Add a safety check for readhandle ([#11549](https://github.com/googleapis/google-cloud-go/issues/11549)) ([c9edb37](https://github.com/googleapis/google-cloud-go/commit/c9edb379ece70f065650702c9240ee540ca2f610))
* **storage:** Add universe domain to defaultSignBytesFunc ([#11521](https://github.com/googleapis/google-cloud-go/issues/11521)) ([511608b](https://github.com/googleapis/google-cloud-go/commit/511608b8e8554aa06f9fe2e2e4f51ead0f484031))
* **storage:** Clone the defaultRetry to avoid modifying it directly ([#11533](https://github.com/googleapis/google-cloud-go/issues/11533)) ([7f8d69d](https://github.com/googleapis/google-cloud-go/commit/7f8d69dcd6a7b1ad6c1df8d9fe8dfb5fe0947479))
* **storage:** Fix adding multiple range on stream with same read id ([#11584](https://github.com/googleapis/google-cloud-go/issues/11584)) ([0bb3434](https://github.com/googleapis/google-cloud-go/commit/0bb3434e0e12563ff21ef72ad2e52ad7eb61d66e))
* **storage:** Modify the callback of mrd to return length of data read instead of limit. ([#11687](https://github.com/googleapis/google-cloud-go/issues/11687)) ([9e359f0](https://github.com/googleapis/google-cloud-go/commit/9e359f0089f744c32d12bf77889d69a4db155357))
* **storage:** Propagate ctx from invoke to grpc upload reqs ([#11475](https://github.com/googleapis/google-cloud-go/issues/11475)) ([9ad9d76](https://github.com/googleapis/google-cloud-go/commit/9ad9d7665ca2f4cfdcee75f5e683084ac49536a6))
* **storage:** Remove duplicate routing header ([#11534](https://github.com/googleapis/google-cloud-go/issues/11534)) ([8eeb59c](https://github.com/googleapis/google-cloud-go/commit/8eeb59cbfb16d8f379f7aa4c6f11e53cebbd38a6))
* **storage:** Return sentinel ErrObjectNotExist for copy and compose ([#11369](https://github.com/googleapis/google-cloud-go/issues/11369)) ([74d0c10](https://github.com/googleapis/google-cloud-go/commit/74d0c1096f897ca3c15646f3049ea540bed0a6a0)), refs [#10760](https://github.com/googleapis/google-cloud-go/issues/10760)
* **storage:** Wait for XML read req to finish to avoid data races ([#11527](https://github.com/googleapis/google-cloud-go/issues/11527)) ([782e12a](https://github.com/googleapis/google-cloud-go/commit/782e12a11c1dfe6d831f5d0b9b5f4409993e4d9e))

## [1.50.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.49.0...storage/v1.50.0) (2025-01-09)


### Features

* **storage/internal:** Add new appendable Object to BidiWrite API ([2e4feb9](https://github.com/googleapis/google-cloud-go/commit/2e4feb938ce9ab023c8aa6bd1dbdf36fe589213a))
* **storage/internal:** Add new preview BidiReadObject API ([2e4feb9](https://github.com/googleapis/google-cloud-go/commit/2e4feb938ce9ab023c8aa6bd1dbdf36fe589213a))
* **storage:** Add support for gRPC bi-directional multi-range reads. This API is in private preview and not generally and is not yet available for general use. ([#11377](https://github.com/googleapis/google-cloud-go/issues/11377)) ([b4d86a5](https://github.com/googleapis/google-cloud-go/commit/b4d86a52bd319a602115cdb710a743c71494a88b))
* **storage:** Add support for ReadHandle, a gRPC feature that allows for accelerated resumption of streams when one is interrupted. ReadHandle requires the bi-directional read API, which is in private preview and is not yet available for general use. ([#11377](https://github.com/googleapis/google-cloud-go/issues/11377)) ([b4d86a5](https://github.com/googleapis/google-cloud-go/commit/b4d86a52bd319a602115cdb710a743c71494a88b))
* **storage:** Support appendable semantics for writes in gRPC. This API is in preview. ([#11377](https://github.com/googleapis/google-cloud-go/issues/11377)) ([b4d86a5](https://github.com/googleapis/google-cloud-go/commit/b4d86a52bd319a602115cdb710a743c71494a88b))
* **storage:** Refactor gRPC writer flow ([#11377](https://github.com/googleapis/google-cloud-go/issues/11377)) ([b4d86a5](https://github.com/googleapis/google-cloud-go/commit/b4d86a52bd319a602115cdb710a743c71494a88b))


### Bug Fixes

* **storage:** Add mutex around uses of mrd variables ([#11405](https://github.com/googleapis/google-cloud-go/issues/11405)) ([54bfc32](https://github.com/googleapis/google-cloud-go/commit/54bfc32db7a0ff40a493de4d466f21ad624de04e))
* **storage:** Return the appropriate error for method not supported ([#11416](https://github.com/googleapis/google-cloud-go/issues/11416)) ([56d704e](https://github.com/googleapis/google-cloud-go/commit/56d704e3037840aeb87b22cc83f2b6088c79bcee))


### Documentation

* **storage/internal:** Add IAM information to RPC comments for reference documentation ([2e4feb9](https://github.com/googleapis/google-cloud-go/commit/2e4feb938ce9ab023c8aa6bd1dbdf36fe589213a))
* **storage:** Add preview comment to NewMultiRangeDownloader ([#11420](https://github.com/googleapis/google-cloud-go/issues/11420)) ([4ec1d66](https://github.com/googleapis/google-cloud-go/commit/4ec1d66ee180e800606568e8693a282645ec7369))

## [1.49.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.48.0...storage/v1.49.0) (2024-12-21)


### Features

* **storage/internal:** Add finalize_time field in Object metadata ([46fc993](https://github.com/googleapis/google-cloud-go/commit/46fc993a3195203a230e2831bee456baaa9f7b1c))
* **storage/internal:** Add MoveObject RPC ([46fc993](https://github.com/googleapis/google-cloud-go/commit/46fc993a3195203a230e2831bee456baaa9f7b1c))
* **storage:** Add ObjectHandle.Move method ([#11302](https://github.com/googleapis/google-cloud-go/issues/11302)) ([a3cb8c4](https://github.com/googleapis/google-cloud-go/commit/a3cb8c4fc48883b54d4e830ae5f5ef4f1a3b8ca3))
* **storage:** Return file metadata on read ([#11212](https://github.com/googleapis/google-cloud-go/issues/11212)) ([d49263b](https://github.com/googleapis/google-cloud-go/commit/d49263b2ab614cad801e26b4a169eafe08d4a2a0))


### Bug Fixes

* **storage/dataflux:** Address deadlock when reading from ranges ([#11303](https://github.com/googleapis/google-cloud-go/issues/11303)) ([32cbf56](https://github.com/googleapis/google-cloud-go/commit/32cbf561590541eb0387787bf729be6ddf68e4ee))
* **storage:** Disable allow non-default credentials flag ([#11337](https://github.com/googleapis/google-cloud-go/issues/11337)) ([145ddf4](https://github.com/googleapis/google-cloud-go/commit/145ddf4f6123d9561856d2b6adeefdfae462b3f7))
* **storage:** Monitored resource detection ([#11197](https://github.com/googleapis/google-cloud-go/issues/11197)) ([911bcd8](https://github.com/googleapis/google-cloud-go/commit/911bcd8b1816256482bd52e85da7eaf00c315293))
* **storage:** Update golang.org/x/net to v0.33.0 ([e9b0b69](https://github.com/googleapis/google-cloud-go/commit/e9b0b69644ea5b276cacff0a707e8a5e87efafc9))

## [1.48.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.47.0...storage/v1.48.0) (2024-12-05)


### Features

* **storage/dataflux:** Run worksteal listing parallel to sequential listing ([#10966](https://github.com/googleapis/google-cloud-go/issues/10966)) ([3005f5a](https://github.com/googleapis/google-cloud-go/commit/3005f5a86c18254e569b8b1782bf014aa62f33cc))
* **storage:** Add Writer.ChunkTransferTimeout ([#11111](https://github.com/googleapis/google-cloud-go/issues/11111)) ([fd1db20](https://github.com/googleapis/google-cloud-go/commit/fd1db203d0de898891b9920aacb141ea39228609))
* **storage:** Allow non default service account ([#11137](https://github.com/googleapis/google-cloud-go/issues/11137)) ([19f01c3](https://github.com/googleapis/google-cloud-go/commit/19f01c3c48ed1272c8fc0af9e5f69646cb662808))


### Bug Fixes

* **storage:** Add backoff to gRPC write retries ([#11200](https://github.com/googleapis/google-cloud-go/issues/11200)) ([a7db927](https://github.com/googleapis/google-cloud-go/commit/a7db927da9cf4c6cf242a5db83e44a16d75a8291))
* **storage:** Correct direct connectivity check ([#11152](https://github.com/googleapis/google-cloud-go/issues/11152)) ([a75c8b0](https://github.com/googleapis/google-cloud-go/commit/a75c8b0f72c38d9a85c908715c3e37eb5cffb131))
* **storage:** Disable soft delete policy using 0 retentionDurationSeconds ([#11226](https://github.com/googleapis/google-cloud-go/issues/11226)) ([f087721](https://github.com/googleapis/google-cloud-go/commit/f087721b7b20ad28ded1d0a84756a8bbaa2bb95a))
* **storage:** Retry SignBlob call for URL signing ([#11154](https://github.com/googleapis/google-cloud-go/issues/11154)) ([f198452](https://github.com/googleapis/google-cloud-go/commit/f198452fd2b29e779e9080ba79d7e873eb0c32ef))

## [1.47.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.46.0...storage/v1.47.0) (2024-11-14)


### Features

* **storage:** Introduce dp detector based on grpc metrics ([#11100](https://github.com/googleapis/google-cloud-go/issues/11100)) ([60c2323](https://github.com/googleapis/google-cloud-go/commit/60c2323102b623e042fc508e2b1bb830a03f9577))


### Bug Fixes

* **storage:** Bump auth dep ([#11135](https://github.com/googleapis/google-cloud-go/issues/11135)) ([9620a51](https://github.com/googleapis/google-cloud-go/commit/9620a51b2c6904d8d93e124494bc297fb98553d2))

## [1.46.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.45.0...storage/v1.46.0) (2024-10-31) 

### Features

* **storage:** Add grpc metrics experimental options ([#10984](https://github.com/googleapis/google-cloud-go/issues/10984)) ([5b7397b](https://github.com/googleapis/google-cloud-go/commit/5b7397b169176f030049e1511859a883422c774e))


### Bug Fixes

* **storage:** Skip only specific transport tests. ([#11016](https://github.com/googleapis/google-cloud-go/issues/11016)) ([d40fbff](https://github.com/googleapis/google-cloud-go/commit/d40fbff9c1984aeed0224a4ac93eb95c5af17126))
* **storage:** Update google.golang.org/api to v0.203.0 ([8bb87d5](https://github.com/googleapis/google-cloud-go/commit/8bb87d56af1cba736e0fe243979723e747e5e11e))
* **storage:** WARNING: On approximately Dec 1, 2024, an update to Protobuf will change service registration function signatures to use an interface instead of a concrete type in generated .pb.go files. This change is expected to affect very few if any users of this client library. For more information, see https://togithub.com/googleapis/google-cloud-go/issues/11020. ([2b8ca4b](https://github.com/googleapis/google-cloud-go/commit/2b8ca4b4127ce3025c7a21cc7247510e07cc5625))


### Miscellaneous Chores

* **storage/internal:** Remove notification, service account, and hmac RPCS. These API have been migrated to Storage Control and are available via the JSON API. ([#11008](https://github.com/googleapis/google-cloud-go/issues/11008)) ([e0759f4](https://github.com/googleapis/google-cloud-go/commit/e0759f46639b4c542e5b49e4dc81340d8e123370)) 

## [1.45.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.44.0...storage/v1.45.0) (2024-10-17)


### Features

* **storage/internal:** Adds support for restore token ([70d82fe](https://github.com/googleapis/google-cloud-go/commit/70d82fe93f60f1075298a077ce1616f9ae7e13fe))
* **storage:** Adding bucket-specific dynamicDelay ([#10987](https://github.com/googleapis/google-cloud-go/issues/10987)) ([a807a7e](https://github.com/googleapis/google-cloud-go/commit/a807a7e7f9fb002374407622c126102c5e61af82))
* **storage:** Dynamic read request stall timeout ([#10958](https://github.com/googleapis/google-cloud-go/issues/10958)) ([a09f00e](https://github.com/googleapis/google-cloud-go/commit/a09f00eeecac82af98ae769bab284ee58a3a66cb))


### Documentation

* **storage:** Remove preview wording from NewGRPCClient ([#11002](https://github.com/googleapis/google-cloud-go/issues/11002)) ([40c3a5b](https://github.com/googleapis/google-cloud-go/commit/40c3a5b9c4cd4db2f1695e180419197b6a03ed7f))

## [1.44.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.43.0...storage/v1.44.0) (2024-10-03)


### Features

* **storage/dataflux:** Add dataflux interface ([#10748](https://github.com/googleapis/google-cloud-go/issues/10748)) ([cb7b0a1](https://github.com/googleapis/google-cloud-go/commit/cb7b0a1b285de9d4182155a123747419232dd35f))
* **storage/dataflux:** Add range_splitter [#10748](https://github.com/googleapis/google-cloud-go/issues/10748) ([#10899](https://github.com/googleapis/google-cloud-go/issues/10899)) ([d49da26](https://github.com/googleapis/google-cloud-go/commit/d49da26be7dc52fad37c392c2876f62b1a5625a2))
* **storage/dataflux:** Add worksteal algorithm to fast-listing ([#10913](https://github.com/googleapis/google-cloud-go/issues/10913)) ([015b52c](https://github.com/googleapis/google-cloud-go/commit/015b52c345df75408be3edcfda96d37145794f9f))
* **storage/internal:** Add managed folder to testIamPermissions method ([2f0aec8](https://github.com/googleapis/google-cloud-go/commit/2f0aec894179304d234be6c792d82cf4336b6d0a))
* **storage/transfermanager:** Add option to StripPrefix on directory download ([#10894](https://github.com/googleapis/google-cloud-go/issues/10894)) ([607534c](https://github.com/googleapis/google-cloud-go/commit/607534cdd5edf2d15d3de891cf6a0b6cbaa7d545))
* **storage/transfermanager:** Add SkipIfExists option ([#10893](https://github.com/googleapis/google-cloud-go/issues/10893)) ([7daa1bd](https://github.com/googleapis/google-cloud-go/commit/7daa1bdc78844adac80f6378b1f6f2dd415b80a8))
* **storage/transfermanager:** Checksum full object downloads ([#10569](https://github.com/googleapis/google-cloud-go/issues/10569)) ([c366c90](https://github.com/googleapis/google-cloud-go/commit/c366c908534ef09442f1f3e8a4f74bd545a474fb))
* **storage:** Add direct google access side-effect imports by default ([#10757](https://github.com/googleapis/google-cloud-go/issues/10757)) ([9ad8324](https://github.com/googleapis/google-cloud-go/commit/9ad83248a7049c82580bc45d9685c329811bce88))
* **storage:** Add full object checksum to reader.Attrs ([#10538](https://github.com/googleapis/google-cloud-go/issues/10538)) ([245d2ea](https://github.com/googleapis/google-cloud-go/commit/245d2eaddb4862da7c8d1892d5d462bf390adb2b))
* **storage:** Add support for Go 1.23 iterators ([84461c0](https://github.com/googleapis/google-cloud-go/commit/84461c0ba464ec2f951987ba60030e37c8a8fc18))
* **storage:** Add update time in bucketAttrs ([#10710](https://github.com/googleapis/google-cloud-go/issues/10710)) ([5f06ae1](https://github.com/googleapis/google-cloud-go/commit/5f06ae1a331c46ded47c96c205b3f1be92d64d29)), refs [#9361](https://github.com/googleapis/google-cloud-go/issues/9361)
* **storage:** GA gRPC client  ([#10859](https://github.com/googleapis/google-cloud-go/issues/10859)) ([c7a55a2](https://github.com/googleapis/google-cloud-go/commit/c7a55a26c645905317fe27505d503c338f50ee34))
* **storage:** Introduce gRPC client-side metrics ([#10639](https://github.com/googleapis/google-cloud-go/issues/10639)) ([437bcb1](https://github.com/googleapis/google-cloud-go/commit/437bcb1e0b514959648eed36ba3963aa4fbeffc8))
* **storage:** Support IncludeFoldersAsPrefixes for gRPC ([#10767](https://github.com/googleapis/google-cloud-go/issues/10767)) ([65bcc59](https://github.com/googleapis/google-cloud-go/commit/65bcc59a6c0753f8fbd66c8792bc69300e95ec62))


### Bug Fixes

* **storage/transfermanager:** Correct Attrs.StartOffset for sharded downloads ([#10512](https://github.com/googleapis/google-cloud-go/issues/10512)) ([01a5cbb](https://github.com/googleapis/google-cloud-go/commit/01a5cbba6d9d9f425f045b58fa16d8c85804c29c))
* **storage:** Add retryalways policy to encryption test ([#10644](https://github.com/googleapis/google-cloud-go/issues/10644)) ([59cfd12](https://github.com/googleapis/google-cloud-go/commit/59cfd12ce5650279c99787da4a273db1e3253c76)), refs [#10567](https://github.com/googleapis/google-cloud-go/issues/10567)
* **storage:** Add unknown host to retriable errors ([#10619](https://github.com/googleapis/google-cloud-go/issues/10619)) ([4ec0452](https://github.com/googleapis/google-cloud-go/commit/4ec0452a393341b1036ac6e1e7287843f097d978))
* **storage:** Bump dependencies ([2ddeb15](https://github.com/googleapis/google-cloud-go/commit/2ddeb1544a53188a7592046b98913982f1b0cf04))
* **storage:** Bump google.golang.org/grpc@v1.64.1 ([8ecc4e9](https://github.com/googleapis/google-cloud-go/commit/8ecc4e9622e5bbe9b90384d5848ab816027226c5))
* **storage:** Check for grpc NotFound error in HMAC test ([#10645](https://github.com/googleapis/google-cloud-go/issues/10645)) ([3c8e88a](https://github.com/googleapis/google-cloud-go/commit/3c8e88a085bab3142dfff6ef9a8e49c29a5c877d))
* **storage:** Disable grpc metrics using emulator ([#10870](https://github.com/googleapis/google-cloud-go/issues/10870)) ([35ad73d](https://github.com/googleapis/google-cloud-go/commit/35ad73d3be5485ac592e2ef1ea6c0854f1eff4a0))
* **storage:** Retry gRPC DEADLINE_EXCEEDED errors ([#10635](https://github.com/googleapis/google-cloud-go/issues/10635)) ([0018415](https://github.com/googleapis/google-cloud-go/commit/0018415295a5fd964b923db6a4785e9eed46a2e2))
* **storage:** Update dependencies ([257c40b](https://github.com/googleapis/google-cloud-go/commit/257c40bd6d7e59730017cf32bda8823d7a232758))
* **storage:** Update google.golang.org/api to v0.191.0 ([5b32644](https://github.com/googleapis/google-cloud-go/commit/5b32644eb82eb6bd6021f80b4fad471c60fb9d73))


### Performance Improvements

* **storage:** GRPC zerocopy codec ([#10888](https://github.com/googleapis/google-cloud-go/issues/10888)) ([aeba28f](https://github.com/googleapis/google-cloud-go/commit/aeba28ffffcd82ac5540e45247112bdacc5c530d))


### Documentation

* **storage/internal:** Clarify possible objectAccessControl roles ([2f0aec8](https://github.com/googleapis/google-cloud-go/commit/2f0aec894179304d234be6c792d82cf4336b6d0a))
* **storage/internal:** Update dual-region bucket link ([2f0aec8](https://github.com/googleapis/google-cloud-go/commit/2f0aec894179304d234be6c792d82cf4336b6d0a))

## [1.43.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.42.0...storage/v1.43.0) (2024-07-03)


### Features

* **storage/transfermanager:** Add DownloadDirectory  ([#10430](https://github.com/googleapis/google-cloud-go/issues/10430)) ([0d0e5dd](https://github.com/googleapis/google-cloud-go/commit/0d0e5dd5214769cc2c197991c2ece1303bd600de))
* **storage/transfermanager:** Automatically shard downloads ([#10379](https://github.com/googleapis/google-cloud-go/issues/10379)) ([05816f9](https://github.com/googleapis/google-cloud-go/commit/05816f9fafd3132c371da37f3a879bb9e8e7e604))


### Bug Fixes

* **storage/transfermanager:** WaitAndClose waits for Callbacks to finish ([#10504](https://github.com/googleapis/google-cloud-go/issues/10504)) ([0e81002](https://github.com/googleapis/google-cloud-go/commit/0e81002b3a5e560c874d814d28a35a102311d9ef)), refs [#10502](https://github.com/googleapis/google-cloud-go/issues/10502)
* **storage:** Allow empty soft delete on Create ([#10394](https://github.com/googleapis/google-cloud-go/issues/10394)) ([d8bd2c1](https://github.com/googleapis/google-cloud-go/commit/d8bd2c1ffc4f27503a74ded438d8bfbdd7707c63)), refs [#10380](https://github.com/googleapis/google-cloud-go/issues/10380)
* **storage:** Bump google.golang.org/api@v0.187.0 ([8fa9e39](https://github.com/googleapis/google-cloud-go/commit/8fa9e398e512fd8533fd49060371e61b5725a85b))
* **storage:** Retry broken pipe error ([#10374](https://github.com/googleapis/google-cloud-go/issues/10374)) ([2f4daa1](https://github.com/googleapis/google-cloud-go/commit/2f4daa11acf9d3f260fa888333090359c4d9198e)), refs [#9178](https://github.com/googleapis/google-cloud-go/issues/9178)


### Documentation

* **storage/control:** Remove allowlist note from Folders RPCs ([d6c543c](https://github.com/googleapis/google-cloud-go/commit/d6c543c3969016c63e158a862fc173dff60fb8d9))

## [1.42.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.41.0...storage/v1.42.0) (2024-06-10)


### Features

* **storage:** Add new package transfermanager. This package is intended for parallel uploads and downloads, and is in preview. It is not stable, and is likely to change. ([#10045](https://github.com/googleapis/google-cloud-go/issues/10045)) ([cde5cbb](https://github.com/googleapis/google-cloud-go/commit/cde5cbba3145d5a702683656a42158621234fe71))
* **storage:** Add bucket HierarchicalNamespace ([#10315](https://github.com/googleapis/google-cloud-go/issues/10315)) ([b92406c](https://github.com/googleapis/google-cloud-go/commit/b92406ccfadfdcee379e86d6f78c901d772401a9)), refs [#10146](https://github.com/googleapis/google-cloud-go/issues/10146)
* **storage:** Add BucketName to BucketHandle ([#10127](https://github.com/googleapis/google-cloud-go/issues/10127)) ([203cc59](https://github.com/googleapis/google-cloud-go/commit/203cc599e5e2f2f821dc75b47c5a4c9073333f05))


### Bug Fixes

* **storage:** Set invocation headers on xml reads ([#10250](https://github.com/googleapis/google-cloud-go/issues/10250)) ([c87e1ab](https://github.com/googleapis/google-cloud-go/commit/c87e1ab6f9618b8b3f4d0005ac159abd87b0daaf))


### Documentation

* **storage:** Update autoclass doc ([#10135](https://github.com/googleapis/google-cloud-go/issues/10135)) ([e4b2737](https://github.com/googleapis/google-cloud-go/commit/e4b2737ddc16d3bf8139a6def7326ac905f62acd))

## [1.41.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.40.0...storage/v1.41.0) (2024-05-13)


### Features

* **storage/control:** Make Managed Folders operations public ([264a6dc](https://github.com/googleapis/google-cloud-go/commit/264a6dcddbffaec987dce1dc00f6550c263d2df7))
* **storage:** Support for soft delete policies and restore ([#9520](https://github.com/googleapis/google-cloud-go/issues/9520)) ([985deb2](https://github.com/googleapis/google-cloud-go/commit/985deb2bdd1c79944cdd960bd3fbfa38cbfa1c91))


### Bug Fixes

* **storage/control:** An existing resource pattern value `projects/{project}/buckets/{bucket}/managedFolders/{managedFolder=**}` to resource definition `storage.googleapis.com/ManagedFolder` is removed ([3e25053](https://github.com/googleapis/google-cloud-go/commit/3e250530567ee81ed4f51a3856c5940dbec35289))
* **storage:** Add internaloption.WithDefaultEndpointTemplate ([3b41408](https://github.com/googleapis/google-cloud-go/commit/3b414084450a5764a0248756e95e13383a645f90))
* **storage:** Bump x/net to v0.24.0 ([ba31ed5](https://github.com/googleapis/google-cloud-go/commit/ba31ed5fda2c9664f2e1cf972469295e63deb5b4))
* **storage:** Disable gax retries for gRPC ([#9747](https://github.com/googleapis/google-cloud-go/issues/9747)) ([bbfc0ac](https://github.com/googleapis/google-cloud-go/commit/bbfc0acc272f21bf1f558ea23648183d5a11cda5))
* **storage:** More strongly match regex ([#9706](https://github.com/googleapis/google-cloud-go/issues/9706)) ([3cfc8eb](https://github.com/googleapis/google-cloud-go/commit/3cfc8eb418e064d734bf3d8708162062dbbe988f)), refs [#9705](https://github.com/googleapis/google-cloud-go/issues/9705)
* **storage:** Retry net.OpError on connection reset ([#10154](https://github.com/googleapis/google-cloud-go/issues/10154)) ([54fab10](https://github.com/googleapis/google-cloud-go/commit/54fab107f98b4f79c9df2959a05b981be0a613c1)), refs [#9478](https://github.com/googleapis/google-cloud-go/issues/9478)
* **storage:** Wrap error when MaxAttempts is hit ([#9767](https://github.com/googleapis/google-cloud-go/issues/9767)) ([9cb262b](https://github.com/googleapis/google-cloud-go/commit/9cb262bb65a162665bfb8bed0022615131bae1f2)), refs [#9720](https://github.com/googleapis/google-cloud-go/issues/9720)


### Documentation

* **storage/control:** Update storage control documentation and add PHP for publishing ([1d757c6](https://github.com/googleapis/google-cloud-go/commit/1d757c66478963d6cbbef13fee939632c742759c))

## [1.40.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.39.1...storage/v1.40.0) (2024-03-29)


### Features

* **storage:** Implement io.WriterTo in Reader ([#9659](https://github.com/googleapis/google-cloud-go/issues/9659)) ([8264a96](https://github.com/googleapis/google-cloud-go/commit/8264a962d1c21d52e8fca50af064c5535c3708d3))
* **storage:** New storage control client ([#9631](https://github.com/googleapis/google-cloud-go/issues/9631)) ([1f4d279](https://github.com/googleapis/google-cloud-go/commit/1f4d27957743878976d6b4549cc02a5bb894d330))


### Bug Fixes

* **storage:** Retry errors from last recv on uploads ([#9616](https://github.com/googleapis/google-cloud-go/issues/9616)) ([b6574aa](https://github.com/googleapis/google-cloud-go/commit/b6574aa42ebad0532c2749b6ece879b932f95cb9))
* **storage:** Update protobuf dep to v1.33.0 ([30b038d](https://github.com/googleapis/google-cloud-go/commit/30b038d8cac0b8cd5dd4761c87f3f298760dd33a))


### Performance Improvements

* **storage:** Remove protobuf's copy of data on unmarshalling ([#9526](https://github.com/googleapis/google-cloud-go/issues/9526)) ([81281c0](https://github.com/googleapis/google-cloud-go/commit/81281c04e503fd83301baf88cc352c77f5d476ca))

## [1.39.1](https://github.com/googleapis/google-cloud-go/compare/storage/v1.39.0...storage/v1.39.1) (2024-03-11)


### Bug Fixes

* **storage:** Add object validation case and test ([#9521](https://github.com/googleapis/google-cloud-go/issues/9521)) ([386bef3](https://github.com/googleapis/google-cloud-go/commit/386bef319b4678beaa926ddfe4edef190f11b68d))

## [1.39.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.38.0...storage/v1.39.0) (2024-02-29)


### Features

* **storage:** Make it possible to disable Content-Type sniffing ([#9431](https://github.com/googleapis/google-cloud-go/issues/9431)) ([0676670](https://github.com/googleapis/google-cloud-go/commit/067667058c06689b64401be11858d84441584039))

## [1.38.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.37.0...storage/v1.38.0) (2024-02-12)


### Features

* **storage:** Support auto-detection of access ID for external_account creds ([#9208](https://github.com/googleapis/google-cloud-go/issues/9208)) ([b958d44](https://github.com/googleapis/google-cloud-go/commit/b958d44589f2b6b226ea3bef23829ac75a0aa6a6))
* **storage:** Support custom hostname for VirtualHostedStyle SignedURLs ([#9348](https://github.com/googleapis/google-cloud-go/issues/9348)) ([7eec40e](https://github.com/googleapis/google-cloud-go/commit/7eec40e4cf82c53e5bf02bd2c14e0b25043da6d0))
* **storage:** Support universe domains ([#9344](https://github.com/googleapis/google-cloud-go/issues/9344)) ([29a7498](https://github.com/googleapis/google-cloud-go/commit/29a7498b8eb0d00fdb5acd7ee8ce0e5a2a8c11ce))


### Bug Fixes

* **storage:** Fix v4 url signing for hosts that specify ports ([#9347](https://github.com/googleapis/google-cloud-go/issues/9347)) ([f127b46](https://github.com/googleapis/google-cloud-go/commit/f127b4648f861c1ba44f41a280a62652620c04c2))


### Documentation

* **storage:** Indicate that gRPC is incompatible with universe domains ([#9386](https://github.com/googleapis/google-cloud-go/issues/9386)) ([e8bd85b](https://github.com/googleapis/google-cloud-go/commit/e8bd85bbce12d5f7ab87fa49d166a6a0d84bd12d))

## [1.37.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.36.0...storage/v1.37.0) (2024-01-24)


### Features

* **storage:** Add maxAttempts RetryOption ([#9215](https://github.com/googleapis/google-cloud-go/issues/9215)) ([e348cc5](https://github.com/googleapis/google-cloud-go/commit/e348cc5340e127b530e8ee4664fd995e6f038b2c))
* **storage:** Support IncludeFoldersAsPrefixes ([#9211](https://github.com/googleapis/google-cloud-go/issues/9211)) ([98c9d71](https://github.com/googleapis/google-cloud-go/commit/98c9d7157306de5134547a67c084c248484c9a51))


### Bug Fixes

* **storage:** Migrate deprecated proto dep ([#9232](https://github.com/googleapis/google-cloud-go/issues/9232)) ([ebbb610](https://github.com/googleapis/google-cloud-go/commit/ebbb610e0f58035fd01ad7893971382d8bbd092f)), refs [#9189](https://github.com/googleapis/google-cloud-go/issues/9189)

## [1.36.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.35.1...storage/v1.36.0) (2023-12-14)


### Features

* **storage:** Add object retention feature ([#9072](https://github.com/googleapis/google-cloud-go/issues/9072)) ([16ecfd1](https://github.com/googleapis/google-cloud-go/commit/16ecfd150ff1982f03d207a80a82e934d1013874))


### Bug Fixes

* **storage:** Do not inhibit the dead code elimination. ([#8543](https://github.com/googleapis/google-cloud-go/issues/8543)) ([ca2493f](https://github.com/googleapis/google-cloud-go/commit/ca2493f43c299bbaed5f7e5b70f66cc763ff9802))
* **storage:** Set flush and get_state to false on the last write in gRPC ([#9013](https://github.com/googleapis/google-cloud-go/issues/9013)) ([c1e9fe5](https://github.com/googleapis/google-cloud-go/commit/c1e9fe5f4166a71e55814ccf126926ec0e0e7945))

## [1.35.1](https://github.com/googleapis/google-cloud-go/compare/storage/v1.35.0...storage/v1.35.1) (2023-11-09)


### Bug Fixes

* **storage:** Rename aux.go to auxiliary.go fixing windows build ([ba23673](https://github.com/googleapis/google-cloud-go/commit/ba23673da7707c31292e4aa29d65b7ac1446d4a6))

## [1.35.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.34.1...storage/v1.35.0) (2023-11-09)


### Features

* **storage:** Change gRPC writes to use bi-directional streams ([#8930](https://github.com/googleapis/google-cloud-go/issues/8930)) ([3e23a36](https://github.com/googleapis/google-cloud-go/commit/3e23a364b1a20c4fda7aef257e4136586ec769a4))

## [1.34.1](https://github.com/googleapis/google-cloud-go/compare/storage/v1.34.0...storage/v1.34.1) (2023-11-01)


### Bug Fixes

* **storage:** Bump google.golang.org/api to v0.149.0 ([8d2ab9f](https://github.com/googleapis/google-cloud-go/commit/8d2ab9f320a86c1c0fab90513fc05861561d0880))

## [1.34.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.33.0...storage/v1.34.0) (2023-10-31)


### Features

* **storage/internal:** Add match_glob field to ListObjectsRequest ([#8618](https://github.com/googleapis/google-cloud-go/issues/8618)) ([e9ae601](https://github.com/googleapis/google-cloud-go/commit/e9ae6018983ae09781740e4ff939e6e365863dbb))
* **storage/internal:** Add terminal_storage_class fields to Autoclass message ([57fc1a6](https://github.com/googleapis/google-cloud-go/commit/57fc1a6de326456eb68ef25f7a305df6636ed386))
* **storage/internal:** Adds the RestoreObject operation ([56ce871](https://github.com/googleapis/google-cloud-go/commit/56ce87195320634b07ae0b012efcc5f2b3813fb0))
* **storage:** Support autoclass v2.1 ([#8721](https://github.com/googleapis/google-cloud-go/issues/8721)) ([fe1e195](https://github.com/googleapis/google-cloud-go/commit/fe1e19590a252c6adc6ca6c51a69b6e561e143b8))
* **storage:** Support MatchGlob for gRPC ([#8670](https://github.com/googleapis/google-cloud-go/issues/8670)) ([3df0287](https://github.com/googleapis/google-cloud-go/commit/3df0287f88d5e2c4526e9e6b8dc2a4ca54f88918)), refs [#7727](https://github.com/googleapis/google-cloud-go/issues/7727)


### Bug Fixes

* **storage:** Drop stream reference after closing it for gRPC writes ([#8872](https://github.com/googleapis/google-cloud-go/issues/8872)) ([525abde](https://github.com/googleapis/google-cloud-go/commit/525abdee433864d4d456f1f1fff5599017b557ff))
* **storage:** Update golang.org/x/net to v0.17.0 ([174da47](https://github.com/googleapis/google-cloud-go/commit/174da47254fefb12921bbfc65b7829a453af6f5d))
* **storage:** Update grpc-go to v1.56.3 ([343cea8](https://github.com/googleapis/google-cloud-go/commit/343cea8c43b1e31ae21ad50ad31d3b0b60143f8c))
* **storage:** Update grpc-go to v1.59.0 ([81a97b0](https://github.com/googleapis/google-cloud-go/commit/81a97b06cb28b25432e4ece595c55a9857e960b7))

## [1.33.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.32.0...storage/v1.33.0) (2023-09-07)


### Features

* **storage:** Export gRPC client constructor ([#8509](https://github.com/googleapis/google-cloud-go/issues/8509)) ([1a928ae](https://github.com/googleapis/google-cloud-go/commit/1a928ae205f2325cb5206304af4d609dc3c1447a))

## [1.32.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.31.0...storage/v1.32.0) (2023-08-15)


### Features

* **storage:** Add support for custom headers ([#8294](https://github.com/googleapis/google-cloud-go/issues/8294)) ([313fd4a](https://github.com/googleapis/google-cloud-go/commit/313fd4a60380d36c5ecaead3e968dbc84d044a0b))
* **storage:** Add trace span to Writer ([#8375](https://github.com/googleapis/google-cloud-go/issues/8375)) ([f7ac85b](https://github.com/googleapis/google-cloud-go/commit/f7ac85bec2806d351529714bd7744a91a9fdefdd)), refs [#6144](https://github.com/googleapis/google-cloud-go/issues/6144)
* **storage:** Support single-shot uploads in gRPC ([#8348](https://github.com/googleapis/google-cloud-go/issues/8348)) ([7de4a7d](https://github.com/googleapis/google-cloud-go/commit/7de4a7da31ab279a343b1592b15a126cda03e5e7)), refs [#7798](https://github.com/googleapis/google-cloud-go/issues/7798)
* **storage:** Trace span covers life of a Reader ([#8390](https://github.com/googleapis/google-cloud-go/issues/8390)) ([8de30d7](https://github.com/googleapis/google-cloud-go/commit/8de30d752eec2fed2ea4c127482d3e213f9050e2))


### Bug Fixes

* **storage:** Fix AllObjects condition in gRPC ([#8184](https://github.com/googleapis/google-cloud-go/issues/8184)) ([2b99e4f](https://github.com/googleapis/google-cloud-go/commit/2b99e4f39be20fe21e8bc5c1ec1c0e758222c46e)), refs [#6205](https://github.com/googleapis/google-cloud-go/issues/6205)
* **storage:** Fix gRPC generation/condition issues ([#8396](https://github.com/googleapis/google-cloud-go/issues/8396)) ([ca68ff5](https://github.com/googleapis/google-cloud-go/commit/ca68ff54b680732b59b223655070d0f6abccefee))
* **storage:** Same method name and Trace Span name ([#8150](https://github.com/googleapis/google-cloud-go/issues/8150)) ([e277213](https://github.com/googleapis/google-cloud-go/commit/e2772133896bb94097b5d1f090f1bcafd136f2ed))
* **storage:** Update gRPC retry codes ([#8202](https://github.com/googleapis/google-cloud-go/issues/8202)) ([afdf772](https://github.com/googleapis/google-cloud-go/commit/afdf772fc6a90b3010eee9d70ab65e22e276f53f))

## [1.31.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.30.1...storage/v1.31.0) (2023-06-27)


### Features

* **storage/internal:** Add ctype=CORD for ChecksummedData.content ([ca94e27](https://github.com/googleapis/google-cloud-go/commit/ca94e2724f9e2610b46aefd0a3b5ddc06102e91b))
* **storage:** Add support for MatchGlob ([#8097](https://github.com/googleapis/google-cloud-go/issues/8097)) ([9426a5a](https://github.com/googleapis/google-cloud-go/commit/9426a5a45d4c2fd07f84261f6d602680e79cdc48)), refs [#7727](https://github.com/googleapis/google-cloud-go/issues/7727) [#7728](https://github.com/googleapis/google-cloud-go/issues/7728)
* **storage:** Respect WithEndpoint for SignedURLs and PostPolicy ([#8113](https://github.com/googleapis/google-cloud-go/issues/8113)) ([f918f23](https://github.com/googleapis/google-cloud-go/commit/f918f23a3cda4fbc8d709e32b914ead8b735d664))
* **storage:** Update all direct dependencies ([b340d03](https://github.com/googleapis/google-cloud-go/commit/b340d030f2b52a4ce48846ce63984b28583abde6))


### Bug Fixes

* **storage:** Fix CreateBucket logic for gRPC ([#8165](https://github.com/googleapis/google-cloud-go/issues/8165)) ([8424e7e](https://github.com/googleapis/google-cloud-go/commit/8424e7e145a117c91006318fa924a8b2643c1c7e)), refs [#8162](https://github.com/googleapis/google-cloud-go/issues/8162)
* **storage:** Fix reads with "./" in object names [XML] ([#8017](https://github.com/googleapis/google-cloud-go/issues/8017)) ([6b7b21f](https://github.com/googleapis/google-cloud-go/commit/6b7b21f8a334b6ad3a25e1f66ae1265b4d1f0995))
* **storage:** Fix routing header for writes ([#8159](https://github.com/googleapis/google-cloud-go/issues/8159)) ([42a59f5](https://github.com/googleapis/google-cloud-go/commit/42a59f5a23ab9b4743ab032ad92304922c801d93)), refs [#8142](https://github.com/googleapis/google-cloud-go/issues/8142) [#8143](https://github.com/googleapis/google-cloud-go/issues/8143) [#8144](https://github.com/googleapis/google-cloud-go/issues/8144) [#8145](https://github.com/googleapis/google-cloud-go/issues/8145) [#8149](https://github.com/googleapis/google-cloud-go/issues/8149)
* **storage:** REST query UpdateMask bug ([df52820](https://github.com/googleapis/google-cloud-go/commit/df52820b0e7721954809a8aa8700b93c5662dc9b))
* **storage:** Update grpc to v1.55.0 ([1147ce0](https://github.com/googleapis/google-cloud-go/commit/1147ce02a990276ca4f8ab7a1ab65c14da4450ef))


### Documentation

* **storage/internal:** Clarifications about behavior of DeleteObject RPC ([3f1ed9c](https://github.com/googleapis/google-cloud-go/commit/3f1ed9c63fb115f47607a3ab478842fe5ba0df11))
* **storage/internal:** Clarified the behavior of supplying bucket.name field in CreateBucket to reflect actual implementation ([ebae64d](https://github.com/googleapis/google-cloud-go/commit/ebae64d53397ec5dfe851f098754eaa1f5df7cb1))
* **storage/internal:** Revert ChecksummedData message definition not to specify ctype=CORD, because it would be a breaking change. ([ef61e47](https://github.com/googleapis/google-cloud-go/commit/ef61e4799280a355b960da8ae240ceb2efbe71ac))
* **storage/internal:** Update routing annotations for CancelResumableWriteRequest and QueryWriteStatusRequest ([4900851](https://github.com/googleapis/google-cloud-go/commit/49008518e168fe6f7891b907d6fc14eecdef758c))
* **storage/internal:** Updated ChecksummedData message definition to specify ctype=CORD, and removed incorrect earlier attempt that set that annotation in the ReadObjectResponse message definition ([ef61e47](https://github.com/googleapis/google-cloud-go/commit/ef61e4799280a355b960da8ae240ceb2efbe71ac))
* **storage:** WithXMLReads should mention XML instead of JSON API ([#7881](https://github.com/googleapis/google-cloud-go/issues/7881)) ([36f56c8](https://github.com/googleapis/google-cloud-go/commit/36f56c80c456ca74ffc03df76844ce15980ced82))

## [1.30.1](https://github.com/googleapis/google-cloud-go/compare/storage/v1.30.0...storage/v1.30.1) (2023-03-21)


### Bug Fixes

* **storage:** Retract versions with Copier bug ([#7583](https://github.com/googleapis/google-cloud-go/issues/7583)) ([9c10b6f](https://github.com/googleapis/google-cloud-go/commit/9c10b6f8a54cb8447260148b5e4a9b5160281020))
  * Versions v1.25.0-v1.27.0 are retracted due to [#6857](https://github.com/googleapis/google-cloud-go/issues/6857).
* **storage:** SignedURL v4 allows headers with colons in value ([#7603](https://github.com/googleapis/google-cloud-go/issues/7603)) ([6b50f9b](https://github.com/googleapis/google-cloud-go/commit/6b50f9b368f5b271ade1706c342865cef46712e6))

## [1.30.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.29.0...storage/v1.30.0) (2023-03-15)


### Features

* **storage/internal:** Update routing annotation for CreateBucketRequest docs: Add support for end-to-end checksumming in the gRPC WriteObject flow feat!: BREAKING CHANGE - renaming Notification to NotificationConfig ([2fef56f](https://github.com/googleapis/google-cloud-go/commit/2fef56f75a63dc4ff6e0eea56c7b26d4831c8e27))
* **storage:** Json downloads ([#7158](https://github.com/googleapis/google-cloud-go/issues/7158)) ([574a86c](https://github.com/googleapis/google-cloud-go/commit/574a86c614445f8c3f5a54446820df774c31cd47))
* **storage:** Update iam and longrunning deps ([91a1f78](https://github.com/googleapis/google-cloud-go/commit/91a1f784a109da70f63b96414bba8a9b4254cddd))


### Bug Fixes

* **storage:** Specify credentials with STORAGE_EMULATOR_HOST ([#7271](https://github.com/googleapis/google-cloud-go/issues/7271)) ([940ae15](https://github.com/googleapis/google-cloud-go/commit/940ae15f725ff384e345e627feb03d22e1fd8db5))

## [1.29.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.28.1...storage/v1.29.0) (2023-01-19)


### Features

* **storage:** Add ComponentCount as part of ObjectAttrs ([#7230](https://github.com/googleapis/google-cloud-go/issues/7230)) ([a19bca6](https://github.com/googleapis/google-cloud-go/commit/a19bca60704b4fbb674cf51d828580aa653c8210))
* **storage:** Add REST client ([06a54a1](https://github.com/googleapis/google-cloud-go/commit/06a54a16a5866cce966547c51e203b9e09a25bc0))


### Documentation

* **storage/internal:** Corrected typos and spellings ([7357077](https://github.com/googleapis/google-cloud-go/commit/735707796d81d7f6f32fc3415800c512fe62297e))

## [1.28.1](https://github.com/googleapis/google-cloud-go/compare/storage/v1.28.0...storage/v1.28.1) (2022-12-02)


### Bug Fixes

* **storage:** downgrade some dependencies ([7540152](https://github.com/googleapis/google-cloud-go/commit/754015236d5af7c82a75da218b71a87b9ead6eb5))

## [1.28.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.27.0...storage/v1.28.0) (2022-11-03)


### Features

* **storage/internal:** Add routing annotations ([ce3f945](https://github.com/googleapis/google-cloud-go/commit/ce3f9458e511eca0910992763232abbcd64698f1))
* **storage:** Add Autoclass support ([#6828](https://github.com/googleapis/google-cloud-go/issues/6828)) ([f7c7f41](https://github.com/googleapis/google-cloud-go/commit/f7c7f41e4d7fcffe05860e1114cb20f40c869da8))


### Bug Fixes

* **storage:** Fix read-write race in Writer.Write ([#6817](https://github.com/googleapis/google-cloud-go/issues/6817)) ([4766d3e](https://github.com/googleapis/google-cloud-go/commit/4766d3e1004119b93c6bd352024b5bf3404252eb))
* **storage:** Fix request token passing for Copier.Run ([#6863](https://github.com/googleapis/google-cloud-go/issues/6863)) ([faaab06](https://github.com/googleapis/google-cloud-go/commit/faaab066d8e509dc440bcbc87391557ecee7dbf2)), refs [#6857](https://github.com/googleapis/google-cloud-go/issues/6857)


### Documentation

* **storage:** Update broken links for SignURL and PostPolicy ([#6779](https://github.com/googleapis/google-cloud-go/issues/6779)) ([776138b](https://github.com/googleapis/google-cloud-go/commit/776138bc06a1e5fd45acbf8f9d36e9dc6ce31dd3))

## [1.27.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.26.0...storage/v1.27.0) (2022-09-22)


### Features

* **storage:** Find GoogleAccessID when using impersonated creds ([#6591](https://github.com/googleapis/google-cloud-go/issues/6591)) ([a2d16a7](https://github.com/googleapis/google-cloud-go/commit/a2d16a7a778c85d13217fc67955ec5dac1da34e8))

## [1.26.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.25.0...storage/v1.26.0) (2022-08-29)


### Features

* **storage:** export ShouldRetry ([#6370](https://github.com/googleapis/google-cloud-go/issues/6370)) ([0da9ab0](https://github.com/googleapis/google-cloud-go/commit/0da9ab0831540569dc04c0a23437b084b1564e15)), refs [#6362](https://github.com/googleapis/google-cloud-go/issues/6362)


### Bug Fixes

* **storage:** allow to use age=0 in OLM conditions ([#6204](https://github.com/googleapis/google-cloud-go/issues/6204)) ([c85704f](https://github.com/googleapis/google-cloud-go/commit/c85704f4284626ce728cb48f3b130f2ce2a0165e))

## [1.25.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.24.0...storage/v1.25.0) (2022-08-11)


### Features

* **storage/internal:** Add routing annotations ([8a8ba85](https://github.com/googleapis/google-cloud-go/commit/8a8ba85311f85701c97fd7c10f1d88b738ce423f))
* **storage:** refactor to use transport-agnostic interface ([#6465](https://github.com/googleapis/google-cloud-go/issues/6465)) ([d03c3e1](https://github.com/googleapis/google-cloud-go/commit/d03c3e15a79fe9afa1232d9c8bd4c484a9bb927e))

## [1.24.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.23.0...storage/v1.24.0) (2022-07-20)


### Features

* **storage:** add Custom Placement Config Dual Region Support  ([#6294](https://github.com/googleapis/google-cloud-go/issues/6294)) ([5a8c607](https://github.com/googleapis/google-cloud-go/commit/5a8c607e3a9a3265887e27cb13f8943f3e3fa23d))

## [1.23.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.22.1...storage/v1.23.0) (2022-06-23)


### Features

* **storage:** add support for OLM Prefix/Suffix ([#5929](https://github.com/googleapis/google-cloud-go/issues/5929)) ([ec21d10](https://github.com/googleapis/google-cloud-go/commit/ec21d10d6d1b01aa97a52560319775041707690d))
* **storage:** support AbortIncompleteMultipartUpload LifecycleAction ([#5812](https://github.com/googleapis/google-cloud-go/issues/5812)) ([fdec929](https://github.com/googleapis/google-cloud-go/commit/fdec929b9da6e01dda0ab3c72544d44d6bd82bd4)), refs [#5795](https://github.com/googleapis/google-cloud-go/issues/5795)


### Bug Fixes

* **storage:** allow for  Age *int64 type and int64 type ([#6230](https://github.com/googleapis/google-cloud-go/issues/6230)) ([cc7acb8](https://github.com/googleapis/google-cloud-go/commit/cc7acb8bffb31828e9e96d4834a65f9728494473))

### [1.22.1](https://github.com/googleapis/google-cloud-go/compare/storage/v1.22.0...storage/v1.22.1) (2022-05-19)


### Bug Fixes

* **storage:** bump genproto, remove deadcode ([#6059](https://github.com/googleapis/google-cloud-go/issues/6059)) ([bb10f9f](https://github.com/googleapis/google-cloud-go/commit/bb10f9faca57dc3b987e0fb601090887b3507f07))
* **storage:** remove field that no longer exists ([#6061](https://github.com/googleapis/google-cloud-go/issues/6061)) ([ee150cf](https://github.com/googleapis/google-cloud-go/commit/ee150cfd194463ddfcb59898cfb0237e47777973))

## [1.22.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.21.0...storage/v1.22.0) (2022-03-31)


### Features

* **storage:** allow specifying includeTrailingDelimiter ([#5617](https://github.com/googleapis/google-cloud-go/issues/5617)) ([a34503b](https://github.com/googleapis/google-cloud-go/commit/a34503bc0f0b95399285e8db66976b227e3b0072))
* **storage:** set versionClient to module version ([55f0d92](https://github.com/googleapis/google-cloud-go/commit/55f0d92bf112f14b024b4ab0076c9875a17423c9))


### Bug Fixes

* **storage:** respect STORAGE_EMULATOR_HOST in signedURL ([#5673](https://github.com/googleapis/google-cloud-go/issues/5673)) ([1c249ae](https://github.com/googleapis/google-cloud-go/commit/1c249ae5b4980cf53fa74635943ca8bf6a96a341))

## [1.21.0](https://github.com/googleapis/google-cloud-go/compare/storage/v1.20.0...storage/v1.21.0) (2022-02-17)


### Features

* **storage:** add better version metadata to calls ([#5507](https://github.com/googleapis/google-cloud-go/issues/5507)) ([13fe0bc](https://github.com/googleapis/google-cloud-go/commit/13fe0bc0d8acbffd46b59ab69b25449f1cbd6a88)), refs [#2749](https://github.com/googleapis/google-cloud-go/issues/2749)
* **storage:** add Writer.ChunkRetryDeadline ([#5482](https://github.com/googleapis/google-cloud-go/issues/5482)) ([498a746](https://github.com/googleapis/google-cloud-go/commit/498a746769fa43958b92af8875b927879947128e))

## [1.20.0](https://www.github.com/googleapis/google-cloud-go/compare/storage/v1.19.0...storage/v1.20.0) (2022-02-04)


### Features

* **storage/internal:** Update definition of RewriteObjectRequest to bring to parity with JSON API support ([#5447](https://www.github.com/googleapis/google-cloud-go/issues/5447)) ([7d175ef](https://www.github.com/googleapis/google-cloud-go/commit/7d175ef12b7b3e75585427f5dd2aab4a175e92d6))

## [1.19.0](https://www.github.com/googleapis/google-cloud-go/compare/storage/v1.18.2...storage/v1.19.0) (2022-01-25)


### Features

* **storage:** add fully configurable and idempotency-aware retry strategy ([#5384](https://www.github.com/googleapis/google-cloud-go/issues/5384), [#5185](https://www.github.com/googleapis/google-cloud-go/issues/5185), [#5170](https://www.github.com/googleapis/google-cloud-go/issues/5170), [#5223](https://www.github.com/googleapis/google-cloud-go/issues/5223), [#5221](https://www.github.com/googleapis/google-cloud-go/issues/5221), [#5193](https://www.github.com/googleapis/google-cloud-go/issues/5193), [#5159](https://www.github.com/googleapis/google-cloud-go/issues/5159), [#5165](https://www.github.com/googleapis/google-cloud-go/issues/5165), [#5166](https://www.github.com/googleapis/google-cloud-go/issues/5166), [#5210](https://www.github.com/googleapis/google-cloud-go/issues/5210), [#5172](https://www.github.com/googleapis/google-cloud-go/issues/5172), [#5314](https://www.github.com/googleapis/google-cloud-go/issues/5314))
  * This release contains changes to fully align this library's retry strategy
    with best practices as described in the
    Cloud Storage [docs](https://cloud.google.com/storage/docs/retry-strategy).
  * The library will now retry only idempotent operations by default. This means
    that for certain operations, including object upload, compose, rewrite,
    update, and delete, requests will not be retried by default unless
    [idempotency conditions](https://cloud.google.com/storage/docs/retry-strategy#idempotency)
    for the request have been met.
  * The library now has methods to configure aspects of retry policy for
    API calls, including which errors are retried, the timing of the
    exponential backoff, and how idempotency is taken into account.
  * If you wish to re-enable retries for a non-idempotent request, use the
    [RetryAlways](https://pkg.go.dev/cloud.google.com/go/storage@main#RetryAlways)
    policy.
  * For full details on how to configure retries, see the
    [package docs](https://pkg.go.dev/cloud.google.com/go/storage@main#hdr-Retrying_failed_requests)
    and the
    [Cloud Storage docs](https://cloud.google.com/storage/docs/retry-strategy)
* **storage:** GenerateSignedPostPolicyV4 can use existing creds to authenticate ([#5105](https://www.github.com/googleapis/google-cloud-go/issues/5105)) ([46489f4](https://www.github.com/googleapis/google-cloud-go/commit/46489f4c8a634068a3e7cf2fd5e5ca11b555c0a8))
* **storage:** post policy can be signed with a fn that takes raw bytes ([#5079](https://www.github.com/googleapis/google-cloud-go/issues/5079)) ([25d1278](https://www.github.com/googleapis/google-cloud-go/commit/25d1278cab539fbfdd8563ed6b297e30d3fe555c))
* **storage:** add rpo (turbo replication) support ([#5003](https://www.github.com/googleapis/google-cloud-go/issues/5003)) ([3bd5995](https://www.github.com/googleapis/google-cloud-go/commit/3bd59958e0c06d2655b67fcb5410668db3c52af0))

### Bug Fixes

* **storage:** fix nil check in gRPC Reader ([#5376](https://www.github.com/googleapis/google-cloud-go/issues/5376)) ([5e7d722](https://www.github.com/googleapis/google-cloud-go/commit/5e7d722d18a62b28ba98169b3bdbb49401377264))

### [1.18.2](https://www.github.com/googleapis/google-cloud-go/compare/storage/v1.18.1...storage/v1.18.2) (2021-10-18)


### Bug Fixes

* **storage:** upgrade genproto ([#4993](https://www.github.com/googleapis/google-cloud-go/issues/4993)) ([5ca462d](https://www.github.com/googleapis/google-cloud-go/commit/5ca462d99fe851b7cddfd70108798e2fa959bdfd)), refs [#4991](https://www.github.com/googleapis/google-cloud-go/issues/4991)

### [1.18.1](https://www.github.com/googleapis/google-cloud-go/compare/storage/v1.18.0...storage/v1.18.1) (2021-10-14)


### Bug Fixes

* **storage:** don't assume auth from a client option ([#4982](https://www.github.com/googleapis/google-cloud-go/issues/4982)) ([e17334d](https://www.github.com/googleapis/google-cloud-go/commit/e17334d1fe7645d89d14ae7148313498b984dfbb))

## [1.18.0](https://www.github.com/googleapis/google-cloud-go/compare/storage/v1.17.0...storage/v1.18.0) (2021-10-11)


### Features

* **storage:** returned wrapped error for timeouts ([#4802](https://www.github.com/googleapis/google-cloud-go/issues/4802)) ([0e102a3](https://www.github.com/googleapis/google-cloud-go/commit/0e102a385dc67a06f6b444b3a93e6998428529be)), refs [#4197](https://www.github.com/googleapis/google-cloud-go/issues/4197)
* **storage:** SignedUrl can use existing creds to authenticate ([#4604](https://www.github.com/googleapis/google-cloud-go/issues/4604)) ([b824c89](https://www.github.com/googleapis/google-cloud-go/commit/b824c897e6941270747b612f6d36a8d6ae081315))


### Bug Fixes

* **storage:** update PAP to use inherited instead of unspecified ([#4909](https://www.github.com/googleapis/google-cloud-go/issues/4909)) ([dac26b1](https://www.github.com/googleapis/google-cloud-go/commit/dac26b1af2f2972f12775341173bcc5f982438b8))

## [1.17.0](https://www.github.com/googleapis/google-cloud-go/compare/storage/v1.16.1...storage/v1.17.0) (2021-09-28)


### Features

* **storage:** add projectNumber field to bucketAttrs. ([#4805](https://www.github.com/googleapis/google-cloud-go/issues/4805)) ([07343af](https://www.github.com/googleapis/google-cloud-go/commit/07343afc15085b164cc41d202d13f9d46f5c0d02))


### Bug Fixes

* **storage:** align retry idempotency (part 1) ([#4715](https://www.github.com/googleapis/google-cloud-go/issues/4715)) ([ffa903e](https://www.github.com/googleapis/google-cloud-go/commit/ffa903eeec61aa3869e5220e2f09371127b5c393))

### [1.16.1](https://www.github.com/googleapis/google-cloud-go/compare/storage/v1.16.0...storage/v1.16.1) (2021-08-30)


### Bug Fixes

* **storage/internal:** Update encryption_key fields to "bytes" type. fix: Improve date/times and field name clarity in lifecycle conditions. ([a52baa4](https://www.github.com/googleapis/google-cloud-go/commit/a52baa456ed8513ec492c4b573c191eb61468758))
* **storage:** accept emulator env var without scheme ([#4616](https://www.github.com/googleapis/google-cloud-go/issues/4616)) ([5f8cbb9](https://www.github.com/googleapis/google-cloud-go/commit/5f8cbb98070109e2a34409ac775ed63b94d37efd))
* **storage:** preserve supplied endpoint's scheme ([#4609](https://www.github.com/googleapis/google-cloud-go/issues/4609)) ([ee2756f](https://www.github.com/googleapis/google-cloud-go/commit/ee2756fb0a335d591464a770c9fa4f8fe0ba2e01))
* **storage:** remove unnecessary variable ([#4608](https://www.github.com/googleapis/google-cloud-go/issues/4608)) ([27fc784](https://www.github.com/googleapis/google-cloud-go/commit/27fc78456fb251652bdf5cdb493734a7e1e643e1))
* **storage:** retry LockRetentionPolicy ([#4439](https://www.github.com/googleapis/google-cloud-go/issues/4439)) ([09879ea](https://www.github.com/googleapis/google-cloud-go/commit/09879ea80cb67f9bfd8fc9384b0fda335567cba9)), refs [#4437](https://www.github.com/googleapis/google-cloud-go/issues/4437)
* **storage:** revise Reader to send XML preconditions ([#4479](https://www.github.com/googleapis/google-cloud-go/issues/4479)) ([e36b29a](https://www.github.com/googleapis/google-cloud-go/commit/e36b29a3d43bce5c1c044f7daf6e1db00b0a49e0)), refs [#4470](https://www.github.com/googleapis/google-cloud-go/issues/4470)

## [1.16.0](https://www.github.com/googleapis/google-cloud-go/compare/storage/v1.15.0...storage/v1.16.0) (2021-06-28)


### Features

* **storage:** support PublicAccessPrevention ([#3608](https://www.github.com/googleapis/google-cloud-go/issues/3608)) ([99bc782](https://www.github.com/googleapis/google-cloud-go/commit/99bc782fb50a47602b45278384ef5d5b5da9263b)), refs [#3203](https://www.github.com/googleapis/google-cloud-go/issues/3203)


### Bug Fixes

* **storage:** fix Writer.ChunkSize validation ([#4255](https://www.github.com/googleapis/google-cloud-go/issues/4255)) ([69c2e9d](https://www.github.com/googleapis/google-cloud-go/commit/69c2e9dc6303e1a004d3104a8178532fa738e742)), refs [#4167](https://www.github.com/googleapis/google-cloud-go/issues/4167)
* **storage:** try to reopen for failed Reads ([#4226](https://www.github.com/googleapis/google-cloud-go/issues/4226)) ([564102b](https://www.github.com/googleapis/google-cloud-go/commit/564102b335dbfb558bec8af883e5f898efb5dd10)), refs [#3040](https://www.github.com/googleapis/google-cloud-go/issues/3040)

## [1.15.0](https://www.github.com/googleapis/google-cloud-go/compare/storage/v1.13.0...storage/v1.15.0) (2021-04-21)


### Features

* **transport** Bump dependency on google.golang.org/api to pick up HTTP/2
  config updates (see [googleapis/google-api-go-client#882](https://github.com/googleapis/google-api-go-client/pull/882)).

### Bug Fixes

* **storage:** retry io.ErrUnexpectedEOF ([#3957](https://www.github.com/googleapis/google-cloud-go/issues/3957)) ([f6590cd](https://www.github.com/googleapis/google-cloud-go/commit/f6590cdc26c8479be5df48949fa59f879e0c24fc))


## v1.14.0

- Updates to various dependencies.

## [1.13.0](https://www.github.com/googleapis/google-cloud-go/compare/storage/v1.12.0...v1.13.0) (2021-02-03)


### Features

* **storage:** add missing StorageClass in BucketAttrsToUpdate ([#3038](https://www.github.com/googleapis/google-cloud-go/issues/3038)) ([2fa1b72](https://www.github.com/googleapis/google-cloud-go/commit/2fa1b727f8a7b20aa62fe0990530744f6c109be0))
* **storage:** add projection parameter for BucketHandle.Objects() ([#3549](https://www.github.com/googleapis/google-cloud-go/issues/3549)) ([9b9c3dc](https://www.github.com/googleapis/google-cloud-go/commit/9b9c3dce3ee10af5b6c4d070821bf47a861efd5b))


### Bug Fixes

* **storage:** fix endpoint selection logic ([#3172](https://www.github.com/googleapis/google-cloud-go/issues/3172)) ([99edf0d](https://www.github.com/googleapis/google-cloud-go/commit/99edf0d211a9e617f2586fbc83b6f9630da3c537))

## v1.12.0
- V4 signed URL fixes:
  - Fix encoding of spaces in query parameters.
  - Add fields that were missing from PostPolicyV4 policy conditions.
- Fix Query to correctly list prefixes as well as objects when SetAttrSelection
  is used.

## v1.11.0
- Add support for CustomTime and NoncurrentTime object lifecycle management
  features.

## v1.10.0
- Bump dependency on google.golang.org/api to capture changes to retry logic
  which will make retries on writes more resilient.
- Improve documentation for Writer.ChunkSize.
- Fix a bug in lifecycle to allow callers to clear lifecycle rules on a bucket.

## v1.9.0
- Add retry for transient network errors on most operations (with the exception
  of writes).
- Bump dependency for google.golang.org/api to capture a change in the default
  HTTP transport which will improve performance for reads under heavy load.
- Add CRC32C checksum validation option to Composer.

## v1.8.0
- Add support for V4 signed post policies.

## v1.7.0
- V4 signed URL support:
  - Add support for bucket-bound domains and virtual hosted style URLs.
  - Add support for query parameters in the signature.
  - Fix text encoding to align with standards.
- Add the object name to query parameters for write calls.
- Fix retry behavior when reading files with Content-Encoding gzip.
- Fix response header in reader.
- New code examples:
   - Error handling for `ObjectHandle` preconditions.
   - Existence checks for buckets and objects.

## v1.6.0

- Updated option handling:
  - Don't drop custom scopes (#1756)
  - Don't drop port in provided endpoint (#1737)

## v1.5.0

- Honor WithEndpoint client option for reads as well as writes.
- Add archive storage class to docs.
- Make fixes to storage benchwrapper.

## v1.4.0

- When listing objects in a bucket, allow callers to specify which attributes
  are queried. This allows for performance optimization.

## v1.3.0

- Use `storage.googleapis.com/storage/v1` by default for GCS requests
  instead of `www.googleapis.com/storage/v1`.

## v1.2.1

- Fixed a bug where UniformBucketLevelAccess and BucketPolicyOnly were not
  being sent in all cases.

## v1.2.0

- Add support for UniformBucketLevelAccess. This configures access checks
  to use only bucket-level IAM policies.
  See: https://godoc.org/cloud.google.com/go/storage#UniformBucketLevelAccess.
- Fix userAgent to use correct version.

## v1.1.2

- Fix memory leak in BucketIterator and ObjectIterator.

## v1.1.1

- Send BucketPolicyOnly even when it's disabled.

## v1.1.0

- Performance improvements for ObjectIterator and BucketIterator.
- Fix Bucket.ObjectIterator size calculation checks.
- Added HMACKeyOptions to all the methods which allows for options such as
  UserProject to be set per invocation and optionally be used.

## v1.0.0

This is the first tag to carve out storage as its own module. See:
https://github.com/golang/go/wiki/Modules#is-it-possible-to-add-a-module-to-a-multi-module-repository.
