# Changes


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
