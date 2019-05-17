package gofakeit

// SimpleStatusCode will generate a random simple status code
func SimpleStatusCode() int {
	return getRandIntValue([]string{"status_code", "simple"})
}

// StatusCode will generate a random status code
func StatusCode() int {
	return getRandIntValue([]string{"status_code", "general"})
}
