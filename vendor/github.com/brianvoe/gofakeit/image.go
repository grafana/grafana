package gofakeit

import "strconv"

// ImageURL will generate a random Image Based Upon Height And Width. https://picsum.photos/
func ImageURL(width int, height int) string {
	return "https://picsum.photos/" + strconv.Itoa(width) + "/" + strconv.Itoa(height)
}
