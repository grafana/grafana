![alt text](https://raw.githubusercontent.com/brianvoe/gofakeit/master/logo.png)

# gofakeit [![Go Report Card](https://goreportcard.com/badge/github.com/brianvoe/gofakeit)](https://goreportcard.com/report/github.com/brianvoe/gofakeit) [![Build Status](https://travis-ci.org/brianvoe/gofakeit.svg?branch=master)](https://travis-ci.org/brianvoe/gofakeit) [![codecov.io](https://codecov.io/github/brianvoe/gofakeit/branch/master/graph/badge.svg)](https://codecov.io/github/brianvoe/gofakeit) [![GoDoc](https://godoc.org/github.com/brianvoe/gofakeit?status.svg)](https://godoc.org/github.com/brianvoe/gofakeit) [![license](http://img.shields.io/badge/license-MIT-green.svg?style=flat)](https://raw.githubusercontent.com/brianvoe/gofakeit/master/LICENSE.txt)
Random data generator written in go

<a href="https://www.buymeacoffee.com/brianvoe" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: auto !important;width: auto !important;" ></a>

### Features
- Every function has an example and a benchmark,
[see benchmarks](https://github.com/brianvoe/gofakeit/blob/master/BENCHMARKS.md)
- Zero dependencies
- Randomizes user defined structs
- Numerous functions for regular use

### 120+ Functions!!!
If there is something that is generic enough missing from this package [add an issue](https://github.com/brianvoe/gofakeit/issues) and let me know what you need.
Most of the time i'll add it!

## Person
```go
Person() *PersonInfo
Name() string
NamePrefix() string
NameSuffix() string
FirstName() string
LastName() string
Gender() string
SSN() string
Contact() *ContactInfo
Email() string
Phone() string
PhoneFormatted() string
Username() string
Password(lower bool, upper bool, numeric bool, special bool, space bool, num int) string
```

## Address
```go
Address() *AddressInfo
City() string
Country() string
CountryAbr() string
State() string
StateAbr() string
StatusCode() string
Street() string
StreetName() string
StreetNumber() string
StreetPrefix() string
StreetSuffix() string
Zip() string
Latitude() float64
LatitudeInRange() (float64, error)
Longitude() float64
LongitudeInRange() (float64, error)
```

## Beer
```go
BeerAlcohol() string
BeerBlg() string
BeerHop() string
BeerIbu() string
BeerMalt() string
BeerName() string
BeerStyle() string
BeerYeast() string
```

## Cars
```go
Vehicle() *VehicleInfo
CarMaker() string
CarModel() string
VehicleType() string
FuelType() string
TransmissionGearType() string
```

## Words
```go
Word() string
Sentence(wordCount int) string
Paragraph(paragraphCount int, sentenceCount int, wordCount int, separator string) string
Question() string
Quote() string
```

## Misc
```go
Struct(v interface{})
Generate() string
Bool() bool
UUID() string
```

## Colors
```go
Color() string
HexColor() string
RGBColor() string
SafeColor() string
```

## Internet
```go
URL() string
ImageURL(width int, height int) string
DomainName() string
DomainSuffix() string
IPv4Address() string
IPv6Address() string
SimpleStatusCode() int
LogLevel(logType string) string
HTTPMethod() string
UserAgent() string
ChromeUserAgent() string
FirefoxUserAgent() string
OperaUserAgent() string
SafariUserAgent() string
```

## Date/Time
```go
Date() time.Time
DateRange(start, end time.Time) time.Time
NanoSecond() int
Second() int
Minute() int
Hour() int
Month() string
Day() int
WeekDay() string
Year() int
TimeZone() string
TimeZoneAbv() string
TimeZoneFull() string
TimeZoneOffset() float32
```

## Payment
```go
Price(min, max float64) float64
CreditCard() *CreditCardInfo
CreditCardCvv() string
CreditCardExp() string
CreditCardNumber() int
CreditCardNumberLuhn() int
CreditCardType() string
Currency() *CurrencyInfo
CurrencyLong() string
CurrencyShort() string
```

## Company
```go
BS() string
BuzzWord() string
Company() string
CompanySuffix() string
Job() *JobInfo
JobDescriptor() string
JobLevel() string
JobTitle() string
```

## Hacker
```go
HackerAbbreviation() string
HackerAdjective() string
HackerIngverb() string
HackerNoun() string
HackerPhrase() string
HackerVerb() string
```

## Hipster
```go
HipsterWord() string
HipsterSentence(wordCount int) string
HipsterParagraph(paragraphCount int, sentenceCount int, wordCount int, separator string) string
```

## File
```go
Extension() string
MimeType() string
```

## Numbers
```go
Number(min int, max int) int
Numerify(str string) string
Int8() int8
Int16() int16
Int32() int32
Int64() int64
Uint8() uint8
Uint16() uint16
Uint32() uint32
Uint64() uint64
Float32() float32
Float32Range(min, max float32) float32
Float64() float64
Float64Range(min, max float64) float64
ShuffleInts(a []int)
```

## String
```go
Digit() string
Letter() string
Lexify(str string) string
RandString(a []string) string
ShuffleStrings(a []string)
```

## Documentation
[![GoDoc](https://godoc.org/github.com/brianvoe/gofakeit?status.svg)](https://godoc.org/github.com/brianvoe/gofakeit)

## Example
```go
import "github.com/brianvoe/gofakeit"

gofakeit.Name() // Markus Moen
gofakeit.Email() // alaynawuckert@kozey.biz
gofakeit.Phone() // (570)245-7485
gofakeit.BS() // front-end
gofakeit.BeerName() // Duvel
gofakeit.Color() // MediumOrchid
gofakeit.Company() // Moen, Pagac and Wuckert
gofakeit.CreditCardNumber() // 4287271570245748
gofakeit.HackerPhrase() // Connecting the array won't do anything, we need to generate the haptic COM driver!
gofakeit.JobTitle() // Director
gofakeit.Password(true, true, true, true, true, 32) // WV10MzLxq2DX79w1omH97_0ga59j8!kj
gofakeit.CurrencyShort() // USD
// 120+ more!!!

// Create structs with random injected data
type Foo struct {
	Bar     string
	Baz     string
	Int     int
	Pointer *int
	Skip    *string `fake:"skip"` // Set to "skip" to not generate data for
}
var f Foo
gofakeit.Struct(&f)
fmt.Printf("f.Bar:%s\n", f.Bar) // f.Bar:hrukpttuezptneuvunh
fmt.Printf("f.Baz:%s\n", f.Baz) // f.Baz:uksqvgzadxlgghejkmv
fmt.Printf("f.Int:%d\n", f.Int) // f.Int:-7825289004089916589
fmt.Printf("f.Pointer:%d\n", *f.Pointer) // f.Pointer:-343806609094473732
fmt.Printf("f.Skip:%v\n", f.Skip) // f.Skip:<nil>
```
