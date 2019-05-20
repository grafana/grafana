package data

// Payment contains payment information
var Payment = map[string][]string{
	"card_type": {"Visa", "MasterCard", "American Express", "Discover"},
	"number": {
		// Visa
		"4###############",
		"4###############",
		// Mastercard
		"222100##########",
		"272099##########",
		// American Express
		"34#############",
		"37#############",
		// Discover
		"65##############",
		"65##############",
	},
}
