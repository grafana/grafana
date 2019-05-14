package fake

// Day generates day of the month
func Day() int {
	return r.Intn(31) + 1
}

// WeekDay generates name ot the week day
func WeekDay() string {
	return lookup(lang, "weekdays", true)
}

// WeekDayShort generates abbreviated name of the week day
func WeekDayShort() string {
	return lookup(lang, "weekdays_short", true)
}

// WeekdayNum generates number of the day of the week
func WeekdayNum() int {
	return r.Intn(7) + 1
}

// Month generates month name
func Month() string {
	return lookup(lang, "months", true)
}

// MonthShort generates abbreviated month name
func MonthShort() string {
	return lookup(lang, "months_short", true)
}

// MonthNum generates month number (from 1 to 12)
func MonthNum() int {
	return r.Intn(12) + 1
}

// Year generates year using the given boundaries
func Year(from, to int) int {
	n := r.Intn(to-from) + 1
	return from + n
}
