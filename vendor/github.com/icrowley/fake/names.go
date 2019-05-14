package fake

func randGender() string {
	g := "male"
	if r.Intn(2) == 0 {
		g = "female"
	}
	return g
}

func firstName(gender string) string {
	return lookup(lang, gender+"_first_names", true)
}

// MaleFirstName generates male first name
func MaleFirstName() string {
	return firstName("male")
}

// FemaleFirstName generates female first name
func FemaleFirstName() string {
	return firstName("female")
}

// FirstName generates first name
func FirstName() string {
	return firstName(randGender())
}

func lastName(gender string) string {
	return lookup(lang, gender+"_last_names", true)
}

// MaleLastName generates male last name
func MaleLastName() string {
	return lastName("male")
}

// FemaleLastName generates female last name
func FemaleLastName() string {
	return lastName("female")
}

// LastName generates last name
func LastName() string {
	return lastName(randGender())
}

func patronymic(gender string) string {
	return lookup(lang, gender+"_patronymics", false)
}

// MalePatronymic generates male patronymic
func MalePatronymic() string {
	return patronymic("male")
}

// FemalePatronymic generates female patronymic
func FemalePatronymic() string {
	return patronymic("female")
}

// Patronymic generates patronymic
func Patronymic() string {
	return patronymic(randGender())
}

func prefix(gender string) string {
	return lookup(lang, gender+"_name_prefixes", false)
}

func suffix(gender string) string {
	return lookup(lang, gender+"_name_suffixes", false)
}

func fullNameWithPrefix(gender string) string {
	return join(prefix(gender), firstName(gender), lastName(gender))
}

// MaleFullNameWithPrefix generates prefixed male full name
// if prefixes for the given language are available
func MaleFullNameWithPrefix() string {
	return fullNameWithPrefix("male")
}

// FemaleFullNameWithPrefix generates prefixed female full name
// if prefixes for the given language are available
func FemaleFullNameWithPrefix() string {
	return fullNameWithPrefix("female")
}

// FullNameWithPrefix generates prefixed full name
// if prefixes for the given language are available
func FullNameWithPrefix() string {
	return fullNameWithPrefix(randGender())
}

func fullNameWithSuffix(gender string) string {
	return join(firstName(gender), lastName(gender), suffix(gender))
}

// MaleFullNameWithSuffix generates suffixed male full name
// if suffixes for the given language are available
func MaleFullNameWithSuffix() string {
	return fullNameWithPrefix("male")
}

// FemaleFullNameWithSuffix generates suffixed female full name
// if suffixes for the given language are available
func FemaleFullNameWithSuffix() string {
	return fullNameWithPrefix("female")
}

// FullNameWithSuffix generates suffixed full name
// if suffixes for the given language are available
func FullNameWithSuffix() string {
	return fullNameWithPrefix(randGender())
}

func fullName(gender string) string {
	switch r.Intn(10) {
	case 0:
		return fullNameWithPrefix(gender)
	case 1:
		return fullNameWithSuffix(gender)
	default:
		return join(firstName(gender), lastName(gender))
	}
}

// MaleFullName generates male full name
// it can occasionally include prefix or suffix
func MaleFullName() string {
	return fullName("male")
}

// FemaleFullName generates female full name
// it can occasionally include prefix or suffix
func FemaleFullName() string {
	return fullName("female")
}

// FullName generates full name
// it can occasionally include prefix or suffix
func FullName() string {
	return fullName(randGender())
}
