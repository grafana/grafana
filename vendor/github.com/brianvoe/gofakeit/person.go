package gofakeit

import "strconv"

// SSN will generate a random Social Security Number
func SSN() string {
	return strconv.Itoa(randIntRange(100000000, 999999999))
}

// Gender will generate a random gender string
func Gender() string {
	if Bool() == true {
		return "male"
	}

	return "female"
}

// PersonInfo is a struct of person information
type PersonInfo struct {
	FirstName  string
	LastName   string
	Gender     string
	SSN        string
	Image      string
	Job        *JobInfo
	Address    *AddressInfo
	Contact    *ContactInfo
	CreditCard *CreditCardInfo
}

// Person will generate a struct with person information
func Person() *PersonInfo {
	return &PersonInfo{
		FirstName:  FirstName(),
		LastName:   LastName(),
		Gender:     Gender(),
		SSN:        SSN(),
		Image:      ImageURL(300, 300) + "/people",
		Job:        Job(),
		Address:    Address(),
		Contact:    Contact(),
		CreditCard: CreditCard(),
	}
}
