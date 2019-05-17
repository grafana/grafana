package gofakeit

import "strconv"

// Faker::Beer.blg #=> "18.5°Blg"

// BeerName will return a random beer name
func BeerName() string {
	return getRandValue([]string{"beer", "name"})
}

// BeerStyle will return a random beer style
func BeerStyle() string {
	return getRandValue([]string{"beer", "style"})
}

// BeerHop will return a random beer hop
func BeerHop() string {
	return getRandValue([]string{"beer", "hop"})
}

// BeerYeast will return a random beer yeast
func BeerYeast() string {
	return getRandValue([]string{"beer", "yeast"})
}

// BeerMalt will return a random beer malt
func BeerMalt() string {
	return getRandValue([]string{"beer", "malt"})
}

// BeerIbu will return a random beer ibu value between 10 and 100
func BeerIbu() string {
	return strconv.Itoa(randIntRange(10, 100)) + " IBU"
}

// BeerAlcohol will return a random beer alcohol level between 2.0 and 10.0
func BeerAlcohol() string {
	return strconv.FormatFloat(randFloat64Range(2.0, 10.0), 'f', 1, 64) + "%"
}

// BeerBlg will return a random beer blg between 5.0 and 20.0
func BeerBlg() string {
	return strconv.FormatFloat(randFloat64Range(5.0, 20.0), 'f', 1, 64) + "°Blg"
}
