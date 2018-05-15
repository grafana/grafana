package imaging

import (
	"image"
	"sync"
)

// Histogram returns a normalized histogram of an image.
//
// Resulting histogram is represented as an array of 256 floats, where
// histogram[i] is a probability of a pixel being of a particular luminance i.
func Histogram(img image.Image) [256]float64 {
	var mu sync.Mutex
	var histogram [256]float64
	var total float64

	src := newScanner(img)
	if src.w == 0 || src.h == 0 {
		return histogram
	}

	parallel(0, src.h, func(ys <-chan int) {
		var tmpHistogram [256]float64
		var tmpTotal float64
		scanLine := make([]uint8, src.w*4)
		for y := range ys {
			src.scan(0, y, src.w, y+1, scanLine)
			i := 0
			for x := 0; x < src.w; x++ {
				r := scanLine[i+0]
				g := scanLine[i+1]
				b := scanLine[i+2]
				y := 0.299*float32(r) + 0.587*float32(g) + 0.114*float32(b)
				tmpHistogram[int(y+0.5)]++
				tmpTotal++
				i += 4
			}
		}
		mu.Lock()
		for i := 0; i < 256; i++ {
			histogram[i] += tmpHistogram[i]
		}
		total += tmpTotal
		mu.Unlock()
	})

	for i := 0; i < 256; i++ {
		histogram[i] = histogram[i] / total
	}
	return histogram
}
