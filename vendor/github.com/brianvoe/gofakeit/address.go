package gofakeit

import (
	"errors"
	"math/rand"
	"strings"
)

// AddressInfo is a struct full of address information
type AddressInfo struct {
	Address   string
	Street    string
	City      string
	State     string
	Zip       string
	Country   string
	Latitude  float64
	Longitude float64
}

// Address will generate a struct of address information
func Address() *AddressInfo {
	street := Street()
	city := City()
	state := State()
	zip := Zip()

	return &AddressInfo{
		Address:   street + ", " + city + ", " + state + " " + zip,
		Street:    street,
		City:      city,
		State:     state,
		Zip:       zip,
		Country:   Country(),
		Latitude:  Latitude(),
		Longitude: Longitude(),
	}
}

// Street will generate a random address street string
func Street() (street string) {
	switch randInt := randIntRange(1, 2); randInt {
	case 1:
		street = StreetNumber() + " " + StreetPrefix() + " " + StreetName() + StreetSuffix()
	case 2:
		street = StreetNumber() + " " + StreetName() + StreetSuffix()
	}

	return
}

// StreetNumber will generate a random address street number string
func StreetNumber() string {
	return strings.TrimLeft(replaceWithNumbers(getRandValue([]string{"address", "number"})), "0")
}

// StreetPrefix will generate a random address street prefix string
func StreetPrefix() string {
	return getRandValue([]string{"address", "street_prefix"})
}

// StreetName will generate a random address street name string
func StreetName() string {
	return getRandValue([]string{"address", "street_name"})
}

// StreetSuffix will generate a random address street suffix string
func StreetSuffix() string {
	return getRandValue([]string{"address", "street_suffix"})
}

// City will generate a random city string
func City() (city string) {
	switch randInt := randIntRange(1, 3); randInt {
	case 1:
		city = FirstName() + StreetSuffix()
	case 2:
		city = LastName() + StreetSuffix()
	case 3:
		city = StreetPrefix() + " " + LastName()
	}

	return
}

// State will generate a random state string
func State() string {
	return getRandValue([]string{"address", "state"})
}

// StateAbr will generate a random abbreviated state string
func StateAbr() string {
	return getRandValue([]string{"address", "state_abr"})
}

// Zip will generate a random Zip code string
func Zip() string {
	return replaceWithNumbers(getRandValue([]string{"address", "zip"}))
}

// Country will generate a random country string
func Country() string {
	return getRandValue([]string{"address", "country"})
}

// CountryAbr will generate a random abbreviated country string
func CountryAbr() string {
	return getRandValue([]string{"address", "country_abr"})
}

// Latitude will generate a random latitude float64
func Latitude() float64 { return (rand.Float64() * 180) - 90 }

// LatitudeInRange will generate a random latitude within the input range
func LatitudeInRange(min, max float64) (float64, error) {
	if min > max || min < -90 || min > 90 || max < -90 || max > 90 {
		return 0, errors.New("input range is invalid")
	}
	return randFloat64Range(min, max), nil
}

// Longitude will generate a random longitude float64
func Longitude() float64 { return (rand.Float64() * 360) - 180 }

// LongitudeInRange will generate a random longitude within the input range
func LongitudeInRange(min, max float64) (float64, error) {
	if min > max || min < -180 || min > 180 || max < -180 || max > 180 {
		return 0, errors.New("input range is invalid")
	}
	return randFloat64Range(min, max), nil
}
