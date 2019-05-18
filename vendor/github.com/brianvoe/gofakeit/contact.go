package gofakeit

import (
	"strings"
)

// ContactInfo struct full of contact info
type ContactInfo struct {
	Phone string
	Email string
}

// Contact will generate a struct with information randomly populated contact information
func Contact() *ContactInfo {
	return &ContactInfo{
		Phone: Phone(),
		Email: Email(),
	}
}

// Phone will generate a random phone number string
func Phone() string {
	return replaceWithNumbers("##########")
}

// PhoneFormatted will generate a random phone number string
func PhoneFormatted() string {
	return replaceWithNumbers(getRandValue([]string{"contact", "phone"}))
}

// Email will generate a random email string
func Email() string {
	var email string

	email = getRandValue([]string{"person", "first"}) + getRandValue([]string{"person", "last"})
	email += "@"
	email += getRandValue([]string{"person", "last"}) + "." + getRandValue([]string{"internet", "domain_suffix"})

	return strings.ToLower(email)
}
