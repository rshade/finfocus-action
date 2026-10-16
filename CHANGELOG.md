# Changelog

## [2.1.0](https://github.com/rshade/finfocus-action/compare/v2.0.0...v2.1.0) (2026-10-05)


### Added

* filter and group cost comments ([#106](https://github.com/rshade/finfocus-action/issues/106)) ([0dab1f4](https://github.com/rshade/finfocus-action/commit/0dab1f4bdc686ed130c3e417b6dd01620d2302c7)), closes [#20](https://github.com/rshade/finfocus-action/issues/20)

## [2.0.0](https://github.com/rshade/finfocus-action/compare/v1.2.2...v2.0.0) (2026-10-05)


### ⚠ BREAKING CHANGES

* **analyze:** removed the inputs budget-alert-threshold, fail-on-budget-health, show-budget-forecast, budget-scopes and fail-on-budget-scope-breach, and the outputs budget-health-score, budget-forecast, budget-runway-days, budget-status and budget-scopes-status. The budget-amount, budget-currency, budget-period and budget-alerts inputs are now written to config as cost.budgets.global (finfocus ignored the previous top-level budget key).

### Added

* **analyze:** add cost estimate what-if input and comment section (AC-4.1) ([d881699](https://github.com/rshade/finfocus-action/commit/d88169938e9c6c9438cf730ae4307c92960d29d5))
* **analyze:** support terraform state input for cost projected (AC-4.2) ([471faf5](https://github.com/rshade/finfocus-action/commit/471faf59f89db6b8afb210ffdfe8121a5ed9e69e))
* **comment:** list resources finfocus could not price (AC-4.4) ([e0d31e1](https://github.com/rshade/finfocus-action/commit/e0d31e121aa473d5475aff92cfcd68321d4c7866))
* expose finfocus v0.4 cluster, scoring, and state-only ([#103](https://github.com/rshade/finfocus-action/issues/103)) ([c445cb7](https://github.com/rshade/finfocus-action/commit/c445cb7644d34a21435af86cfd38b8cd5426ef01)), closes [#89](https://github.com/rshade/finfocus-action/issues/89)


### Fixed

* **analyze:** remove dead budget status calls and unusable features (AC-3.2) ([d636181](https://github.com/rshade/finfocus-action/commit/d6361818812fe75347d389a96ebe2d2a9e7a4298))
* **ci:** make contract script executable (AC-1.2) ([fde192f](https://github.com/rshade/finfocus-action/commit/fde192f843ed88d18c584bb665e999fd3aec81f4))
* **comment:** read the v0.4.1 diff shape without any casts (AC-4.4) ([5f753d2](https://github.com/rshade/finfocus-action/commit/5f753d2640f31007b1a3d48ff4ca6a4d9dafadf9))
* **contract:** run finfocus from scratch dir to avoid repo artifacts (AC-1.1) ([9f0fd05](https://github.com/rshade/finfocus-action/commit/9f0fd05359c848bf524b1c9afc37df1ebefa879b))
* **guardrails:** parse finfocus error envelope on non-zero exit (AC-2.1) ([fbd1411](https://github.com/rshade/finfocus-action/commit/fbd1411ccee918f2f97c44bf9de8c0d19ab9e272))
* **guardrails:** use --pulumi-json and action-owned --exit-code 10 (AC-2.2) ([fc1ee8e](https://github.com/rshade/finfocus-action/commit/fc1ee8e1402f64f8d05b6b043b2ed6541bbe989e))
* **install:** resolve latest to the newest v* release (AC-2.4) ([feefeda](https://github.com/rshade/finfocus-action/commit/feefeda70d1eb97bc53f1ce0b14e82559574c788))


### Documentation

* document removed inputs, drop stale test counts and lint config (AC-3.2) ([642313a](https://github.com/rshade/finfocus-action/commit/642313aaaaacea8b5b66ef478cf9b7e1032d2afb))
* fill spec-gap log for run 1 (AC-4.2) ([fe353b0](https://github.com/rshade/finfocus-action/commit/fe353b01de5b0b7c4543cb604571682c3e6bc7c3))
* mark AC-2.4 done in TASKS.md (AC-2.4) ([cf212c7](https://github.com/rshade/finfocus-action/commit/cf212c7aaaca764a93917a3fe49ed343660ea8ac))
* record budget source findings for v0.4.0 (AC-3.1) ([970964f](https://github.com/rshade/finfocus-action/commit/970964f1e9ec558fbe7563619471860bf730b079))
* state tested finfocus range and latest caveat (AC-2.4) ([91c7ca9](https://github.com/rshade/finfocus-action/commit/91c7ca9eae3117e1c98e887fc4d57eef1c068714))

## [1.2.2](https://github.com/rshade/finfocus-action/compare/finfocus-action-v1.2.1...finfocus-action-v1.2.2) (2026-02-09)


### Fixed

* **ci:** commit dist/ to main and simplify release workflow ([#71](https://github.com/rshade/finfocus-action/issues/71)) ([c513366](https://github.com/rshade/finfocus-action/commit/c513366b28ac1da0e20bbeeae0154ae0d29c3b63)), closes [#58](https://github.com/rshade/finfocus-action/issues/58)

## [1.2.1](https://github.com/rshade/finfocus-action/compare/finfocus-action-v1.2.0...finfocus-action-v1.2.1) (2026-02-07)


### Fixed

* **ci:** use npm install instead of npm ci in update-tags job ([#67](https://github.com/rshade/finfocus-action/issues/67)) ([0481f70](https://github.com/rshade/finfocus-action/commit/0481f70125c21d3b7872c29b31b22dc42346a80c))

## [1.2.0](https://github.com/rshade/finfocus-action/compare/finfocus-action-v1.1.0...finfocus-action-v1.2.0) (2026-02-05)


### Added

* **budget:** support scoped budgets (per-provider, per-type, per-tag) ([#59](https://github.com/rshade/finfocus-action/issues/59)) ([f822ce7](https://github.com/rshade/finfocus-action/commit/f822ce709490eda88f691cbeb5a4a9fe1210f133)), closes [#47](https://github.com/rshade/finfocus-action/issues/47)


### Fixed

* **ci:** prevent changelog duplication by building dist into release PR ([#61](https://github.com/rshade/finfocus-action/issues/61)) ([de0869e](https://github.com/rshade/finfocus-action/commit/de0869e63e9110d541cf5a5f6d21e23852434899)), closes [#58](https://github.com/rshade/finfocus-action/issues/58)
* **deps:** update dependency @actions/exec to v3 ([#41](https://github.com/rshade/finfocus-action/issues/41)) ([d2c4935](https://github.com/rshade/finfocus-action/commit/d2c4935cb80d88b8e4b7a10813d01b6c83eafa7a))
* **formatter:** calculate achievable savings excluding mutually exclu… ([#57](https://github.com/rshade/finfocus-action/issues/57)) ([a1da5b9](https://github.com/rshade/finfocus-action/commit/a1da5b9c3525f4a5f65aebeedd88d28919185b74))

## [1.1.0](https://github.com/rshade/finfocus-action/compare/finfocus-action-v1.0.0...finfocus-action-v1.1.0) (2026-02-03)


### Features

* **actual-costs:** add historical cost tracking with actual cost data ([#25](https://github.com/rshade/finfocus-action/issues/25)) ([0137ff6](https://github.com/rshade/finfocus-action/commit/0137ff6b83fd4d1835ad66fbaed789bbe7945d04)), closes [#16](https://github.com/rshade/finfocus-action/issues/16)
* add extensive debugging logs for troubleshooting ([2a5a7a1](https://github.com/rshade/finfocus-action/commit/2a5a7a1a80c66ca2f6f7b3c454097355619a3246))
* adding include-recommendations, total-savings to output ([8a7d1e5](https://github.com/rshade/finfocus-action/commit/8a7d1e5999b6b99ddbb91005c14b248c381895fa))
* **budget:** implement calculateBudgetStatus for budget tracking ([5588305](https://github.com/rshade/finfocus-action/commit/558830591478da75fdaf314f80574ee0484b8efe))
* **budget:** integrate budget health suite from finfocus v0.2.5 ([#54](https://github.com/rshade/finfocus-action/issues/54)) ([dc32758](https://github.com/rshade/finfocus-action/commit/dc3275824d4f61d1ad76d366749439cfdc21a00d))
* **core:** enhance action logic and integrate speckit commands ([54fc891](https://github.com/rshade/finfocus-action/commit/54fc891063e81dbdc149c3e70daafb27d1c71f39))
* **core:** enhance action logic and integrate speckit commands ([29ed15f](https://github.com/rshade/finfocus-action/commit/29ed15feab5c9fc29f8fc47dba3d33e9bf282c94))
* **core:** initial implementation of finfocus-action ([7415785](https://github.com/rshade/finfocus-action/commit/7415785120efa691a91c77a4ecb9baa2c8f6d8d2))
* **core:** initial implementation of finfocus-action ([1da9b4e](https://github.com/rshade/finfocus-action/commit/1da9b4e50b67b6e0269c746e0bf0ffd0e2121eba)), closes [#1](https://github.com/rshade/finfocus-action/issues/1)
* default recommendations and sustainability to true ([2bbfa3a](https://github.com/rshade/finfocus-action/commit/2bbfa3a07d43a4741d8c7f8efb6f57daa68ac888))
* **formatter:** add TUI-style budget display with box-drawing characters ([#34](https://github.com/rshade/finfocus-action/issues/34)) ([a123393](https://github.com/rshade/finfocus-action/commit/a123393afb4b0d7b5b299e0f204c95fed42aeffa)), closes [#18](https://github.com/rshade/finfocus-action/issues/18)
* **recommendations:** add cost optimization recommendations to PR co… ([#24](https://github.com/rshade/finfocus-action/issues/24)) ([43228f1](https://github.com/rshade/finfocus-action/commit/43228f15bf510b96577bf22157c9d912c967427e))
* **sustainability:** add carbon footprint and sustainability metrics ([#28](https://github.com/rshade/finfocus-action/issues/28)) ([84f61f0](https://github.com/rshade/finfocus-action/commit/84f61f0d6fdbe3904d47f302917e19cf3ffeb392)), closes [#17](https://github.com/rshade/finfocus-action/issues/17)


### Bug Fixes

* adding log_level to actions ([1cac53e](https://github.com/rshade/finfocus-action/commit/1cac53e306387de09af94341dd348d76e2130c42))
* adding underscore ([0e9b40e](https://github.com/rshade/finfocus-action/commit/0e9b40ee28c01d9ea0ad63bcb94efb43b6c7cfa2))
* analyzer mode ([67728be](https://github.com/rshade/finfocus-action/commit/67728beef8de45bd76b7ab172c76e7692a612de0))
* appending analyzer to pulumi yaml ([58b827c](https://github.com/rshade/finfocus-action/commit/58b827c714c83d5ead5ec451dbc61a84e2206fa1))
* configuring jess correctly ([727a705](https://github.com/rshade/finfocus-action/commit/727a705929b199579def2acdddeb3064a25f67b7))
* configuring jest correctly ([c32a908](https://github.com/rshade/finfocus-action/commit/c32a908150b495abecace0613059e740dcd830f7))
* disable debug logging ([cea5cf5](https://github.com/rshade/finfocus-action/commit/cea5cf54c57f988e14500d7f63cf6246d08a1e2b))
* fixing boolean inputs ([551e857](https://github.com/rshade/finfocus-action/commit/551e857e89cf7d02c2b8ac434286219a6aebd053))
* fixing lint issues ([2a6fb72](https://github.com/rshade/finfocus-action/commit/2a6fb723e1af92e7047af7f79ca7c88a8afeb986))
* moving log level to warn ([d249a74](https://github.com/rshade/finfocus-action/commit/d249a74d0a17d898027b3d70b70bed50f5c23470))
* plugin loading is fixed ([5711934](https://github.com/rshade/finfocus-action/commit/5711934d6c9b4b8d3bdedbcf01ae6c7ba3d2e84e))
* updating code for test failures ([7183757](https://github.com/rshade/finfocus-action/commit/7183757b4c953f5c1dbcc06a46a59e0fb9fc1c8e))
* updating node version and release please ([b69675f](https://github.com/rshade/finfocus-action/commit/b69675f476af25c67260a0dae52126ffaa08c6fd))
* updating peer dependencies in package-lock.json ([30b0c9c](https://github.com/rshade/finfocus-action/commit/30b0c9ca8a896d0e1f7a9625b14b59b9bc4498a5))
* updating projected cost path ([7df72a3](https://github.com/rshade/finfocus-action/commit/7df72a35531e781b69f800b1dbf9c9cde68ea396))
