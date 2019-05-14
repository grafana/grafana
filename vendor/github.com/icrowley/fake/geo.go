package fake

// Latitude generates latitude (from -90.0 to 90.0)
func Latitude() float32 {
	return r.Float32()*180 - 90
}

// LatitudeDegrees generates latitude degrees (from -90 to 90)
func LatitudeDegrees() int {
	return r.Intn(180) - 90
}

// LatitudeMinutes generates latitude minutes (from 0 to 60)
func LatitudeMinutes() int {
	return r.Intn(60)
}

// LatitudeSeconds generates latitude seconds (from 0 to 60)
func LatitudeSeconds() int {
	return r.Intn(60)
}

// LatitudeDirection generates latitude direction (N(orth) o S(outh))
func LatitudeDirection() string {
	if r.Intn(2) == 0 {
		return "N"
	}
	return "S"
}

// Longitude generates longitude (from -180 to 180)
func Longitude() float32 {
	return r.Float32()*360 - 180
}

// LongitudeDegrees generates longitude degrees (from -180 to 180)
func LongitudeDegrees() int {
	return r.Intn(360) - 180
}

// LongitudeMinutes generates (from 0 to 60)
func LongitudeMinutes() int {
	return r.Intn(60)
}

// LongitudeSeconds generates (from 0 to 60)
func LongitudeSeconds() int {
	return r.Intn(60)
}

// LongitudeDirection generates (W(est) or E(ast))
func LongitudeDirection() string {
	if r.Intn(2) == 0 {
		return "W"
	}
	return "E"
}
