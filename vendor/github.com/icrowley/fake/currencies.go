package fake

// Currency generates currency name
func Currency() string {
	return lookup(lang, "currencies", true)
}

// CurrencyCode generates currency code
func CurrencyCode() string {
	return lookup(lang, "currency_codes", true)
}
