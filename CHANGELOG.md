# Changelog

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
