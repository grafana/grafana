package imaging

import (
	"image"
)

// Histogram returns a normalized histogram of an image.
//
// Resulting histogram is represented as an array of 256 floats, where
// histogram[i] is a probability of a pixel being of a particular luminance i.
func Histogram(img image.Image) [256]float64 {
	src := toNRGBA(img)
	width := src.Bounds().Max.X
	height := src.Bounds().Max.Y

	var histogram [256]float64
	var total float64

	if width == 0 || height == 0 {
		return histogram
	}

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			i := y*src.Stride + x*4

			r := src.Pix[i+0]
			g := src.Pix[i+1]
			b := src.Pix[i+2]

			y := 0.299*float32(r) + 0.587*float32(g) + 0.114*float32(b)

			histogram[int(y+0.5)]++
			total++
		}
	}

	for i := 0; i < 256; i++ {
		histogram[i] = histogram[i] / total
	}

	return histogram
}
