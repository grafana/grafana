package gofakeit

// Name will generate a random First and Last Name
func Name() string {
	return getRandValue([]string{"person", "first"}) + " " + getRandValue([]string{"person", "last"})
}

// FirstName will generate a random first name
func FirstName() string {
	return getRandValue([]string{"person", "first"})
}

// LastName will generate a random last name
func LastName() string {
	return getRandValue([]string{"person", "last"})
}

// NamePrefix will generate a random name prefix
func NamePrefix() string {
	return getRandValue([]string{"person", "prefix"})
}

// NameSuffix will generate a random name suffix
func NameSuffix() string {
	return getRandValue([]string{"person", "suffix"})
}
