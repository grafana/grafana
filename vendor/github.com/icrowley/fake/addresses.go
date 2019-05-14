package fake

import "strconv"

// Continent generates random continent
func Continent() string {
	return lookup(lang, "continents", true)
}

// Country generates random country
func Country() string {
	return lookup(lang, "countries", true)
}

// City generates random city
func City() string {
	city := lookup(lang, "cities", true)
	switch r.Intn(5) {
	case 0:
		return join(cityPrefix(), city)
	case 1:
		return join(city, citySuffix())
	default:
		return city
	}
}

func cityPrefix() string {
	return lookup(lang, "city_prefixes", false)
}

func citySuffix() string {
	return lookup(lang, "city_suffixes", false)
}

// State generates random state
func State() string {
	return lookup(lang, "states", false)
}

// StateAbbrev generates random state abbreviation
func StateAbbrev() string {
	return lookup(lang, "state_abbrevs", false)
}

// Street generates random street name
func Street() string {
	street := lookup(lang, "streets", true)
	return join(street, streetSuffix())
}

// StreetAddress generates random street name along with building number
func StreetAddress() string {
	return join(Street(), strconv.Itoa(r.Intn(100)))
}

func streetSuffix() string {
	return lookup(lang, "street_suffixes", true)
}

// Zip generates random zip code using one of the formats specifies in zip_format file
func Zip() string {
	return generate(lang, "zips", true)
}

// Phone generates random phone number using one of the formats format specified in phone_format file
func Phone() string {
	return generate(lang, "phones", true)
}
