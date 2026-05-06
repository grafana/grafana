## Decimal v1.4.0
#### BREAKING
- Drop support for Go version older than 1.10 [#361](https://github.com/shopspring/decimal/pull/361)

#### FEATURES
- Add implementation of natural logarithm [#339](https://github.com/shopspring/decimal/pull/339) [#357](https://github.com/shopspring/decimal/pull/357)
- Add improved implementation of power operation [#358](https://github.com/shopspring/decimal/pull/358)
- Add Compare method which forwards calls to Cmp [#346](https://github.com/shopspring/decimal/pull/346)
- Add NewFromBigRat constructor [#288](https://github.com/shopspring/decimal/pull/288)
- Add NewFromUint64 constructor [#352](https://github.com/shopspring/decimal/pull/352)

#### ENHANCEMENTS
- Migrate to Github Actions [#245](https://github.com/shopspring/decimal/pull/245) [#340](https://github.com/shopspring/decimal/pull/340)
- Fix examples for RoundDown, RoundFloor, RoundUp, and RoundCeil [#285](https://github.com/shopspring/decimal/pull/285) [#328](https://github.com/shopspring/decimal/pull/328) [#341](https://github.com/shopspring/decimal/pull/341)
- Use Godoc standard to mark deprecated Equals and StringScaled methods [#342](https://github.com/shopspring/decimal/pull/342)
- Removed unnecessary min function for RescalePair method [#265](https://github.com/shopspring/decimal/pull/265)
- Avoid reallocation of initial slice in MarshalBinary (GobEncode) [#355](https://github.com/shopspring/decimal/pull/355)
- Optimize NumDigits method [#301](https://github.com/shopspring/decimal/pull/301) [#356](https://github.com/shopspring/decimal/pull/356)
- Optimize BigInt method [#359](https://github.com/shopspring/decimal/pull/359)
- Support scanning uint64 [#131](https://github.com/shopspring/decimal/pull/131) [#364](https://github.com/shopspring/decimal/pull/364)
- Add docs section with alternative libraries [#363](https://github.com/shopspring/decimal/pull/363)

#### BUGFIXES
- Fix incorrect calculation of decimal modulo [#258](https://github.com/shopspring/decimal/pull/258) [#317](https://github.com/shopspring/decimal/pull/317)
- Allocate new(big.Int) in Copy method to deeply clone it [#278](https://github.com/shopspring/decimal/pull/278)
- Fix overflow edge case in QuoRem method [#322](https://github.com/shopspring/decimal/pull/322)

## Decimal v1.3.1

#### ENHANCEMENTS
- Reduce memory allocation in case of initialization from big.Int [#252](https://github.com/shopspring/decimal/pull/252)

#### BUGFIXES
- Fix binary marshalling of decimal zero value  [#253](https://github.com/shopspring/decimal/pull/253)

## Decimal v1.3.0

#### FEATURES
- Add NewFromFormattedString initializer [#184](https://github.com/shopspring/decimal/pull/184)
- Add NewNullDecimal initializer [#234](https://github.com/shopspring/decimal/pull/234)
- Add implementation of natural exponent function (Taylor, Hull-Abraham) [#229](https://github.com/shopspring/decimal/pull/229)
- Add RoundUp, RoundDown, RoundCeil, RoundFloor methods [#196](https://github.com/shopspring/decimal/pull/196) [#202](https://github.com/shopspring/decimal/pull/202) [#220](https://github.com/shopspring/decimal/pull/220)
- Add XML support for NullDecimal [#192](https://github.com/shopspring/decimal/pull/192)
- Add IsInteger method [#179](https://github.com/shopspring/decimal/pull/179)
- Add Copy helper method [#123](https://github.com/shopspring/decimal/pull/123)
- Add InexactFloat64 helper method [#205](https://github.com/shopspring/decimal/pull/205)
- Add CoefficientInt64 helper method [#244](https://github.com/shopspring/decimal/pull/244)

#### ENHANCEMENTS
- Performance optimization of NewFromString init method [#198](https://github.com/shopspring/decimal/pull/198)
- Performance optimization of Abs and Round methods [#240](https://github.com/shopspring/decimal/pull/240)
- Additional tests (CI) for ppc64le architecture [#188](https://github.com/shopspring/decimal/pull/188)

#### BUGFIXES
- Fix rounding in FormatFloat fallback path (roundShortest method, fix taken from Go main repository) [#161](https://github.com/shopspring/decimal/pull/161)
- Add slice range checks to UnmarshalBinary method [#232](https://github.com/shopspring/decimal/pull/232)

## Decimal v1.2.0

#### BREAKING
- Drop support for Go version older than 1.7 [#172](https://github.com/shopspring/decimal/pull/172)

#### FEATURES
- Add NewFromInt and NewFromInt32 initializers [#72](https://github.com/shopspring/decimal/pull/72)
- Add support for Go modules [#157](https://github.com/shopspring/decimal/pull/157)
- Add BigInt, BigFloat helper methods [#171](https://github.com/shopspring/decimal/pull/171)

#### ENHANCEMENTS
- Memory usage optimization [#160](https://github.com/shopspring/decimal/pull/160)
- Updated travis CI golang versions [#156](https://github.com/shopspring/decimal/pull/156)
- Update documentation [#173](https://github.com/shopspring/decimal/pull/173)
- Improve code quality [#174](https://github.com/shopspring/decimal/pull/174)

#### BUGFIXES
- Revert remove insignificant digits [#159](https://github.com/shopspring/decimal/pull/159)
- Remove 15 interval for RoundCash [#166](https://github.com/shopspring/decimal/pull/166)
