package gofakeit

// MimeType will generate a random mime file type
func MimeType() string {
	return getRandValue([]string{"file", "mime_type"})
}

// Extension will generate a random file extension
func Extension() string {
	return getRandValue([]string{"file", "extension"})
}
