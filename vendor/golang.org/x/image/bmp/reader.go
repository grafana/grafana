// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package bmp implements a BMP image decoder and encoder.
//
// The BMP specification is at http://www.digicamsoft.com/bmp/bmp.html.
package bmp // import "golang.org/x/image/bmp"

import (
	"errors"
	"image"
	"image/color"
	"io"
)

// ErrUnsupported means that the input BMP image uses a valid but unsupported
// feature.
var ErrUnsupported = errors.New("bmp: unsupported BMP image")

func readUint16(b []byte) uint16 {
	return uint16(b[0]) | uint16(b[1])<<8
}

func readUint32(b []byte) uint32 {
	return uint32(b[0]) | uint32(b[1])<<8 | uint32(b[2])<<16 | uint32(b[3])<<24
}

// decodePaletted reads an 8 bit-per-pixel BMP image from r.
// If topDown is false, the image rows will be read bottom-up.
func decodePaletted(r io.Reader, c image.Config, topDown bool) (image.Image, error) {
	paletted := image.NewPaletted(image.Rect(0, 0, c.Width, c.Height), c.ColorModel.(color.Palette))
	if c.Width == 0 || c.Height == 0 {
		return paletted, nil
	}
	var tmp [4]byte
	y0, y1, yDelta := c.Height-1, -1, -1
	if topDown {
		y0, y1, yDelta = 0, c.Height, +1
	}
	for y := y0; y != y1; y += yDelta {
		p := paletted.Pix[y*paletted.Stride : y*paletted.Stride+c.Width]
		if _, err := io.ReadFull(r, p); err != nil {
			return nil, err
		}
		// Each row is 4-byte aligned.
		if c.Width%4 != 0 {
			_, err := io.ReadFull(r, tmp[:4-c.Width%4])
			if err != nil {
				return nil, err
			}
		}
	}
	return paletted, nil
}

// decodeRGB reads a 24 bit-per-pixel BMP image from r.
// If topDown is false, the image rows will be read bottom-up.
func decodeRGB(r io.Reader, c image.Config, topDown bool) (image.Image, error) {
	rgba := image.NewRGBA(image.Rect(0, 0, c.Width, c.Height))
	if c.Width == 0 || c.Height == 0 {
		return rgba, nil
	}
	// There are 3 bytes per pixel, and each row is 4-byte aligned.
	b := make([]byte, (3*c.Width+3)&^3)
	y0, y1, yDelta := c.Height-1, -1, -1
	if topDown {
		y0, y1, yDelta = 0, c.Height, +1
	}
	for y := y0; y != y1; y += yDelta {
		if _, err := io.ReadFull(r, b); err != nil {
			return nil, err
		}
		p := rgba.Pix[y*rgba.Stride : y*rgba.Stride+c.Width*4]
		for i, j := 0, 0; i < len(p); i, j = i+4, j+3 {
			// BMP images are stored in BGR order rather than RGB order.
			p[i+0] = b[j+2]
			p[i+1] = b[j+1]
			p[i+2] = b[j+0]
			p[i+3] = 0xFF
		}
	}
	return rgba, nil
}

// decodeNRGBA reads a 32 bit-per-pixel BMP image from r.
// If topDown is false, the image rows will be read bottom-up.
func decodeNRGBA(r io.Reader, c image.Config, topDown bool) (image.Image, error) {
	rgba := image.NewNRGBA(image.Rect(0, 0, c.Width, c.Height))
	if c.Width == 0 || c.Height == 0 {
		return rgba, nil
	}
	y0, y1, yDelta := c.Height-1, -1, -1
	if topDown {
		y0, y1, yDelta = 0, c.Height, +1
	}
	for y := y0; y != y1; y += yDelta {
		p := rgba.Pix[y*rgba.Stride : y*rgba.Stride+c.Width*4]
		if _, err := io.ReadFull(r, p); err != nil {
			return nil, err
		}
		for i := 0; i < len(p); i += 4 {
			// BMP images are stored in BGRA order rather than RGBA order.
			p[i+0], p[i+2] = p[i+2], p[i+0]
		}
	}
	return rgba, nil
}

// Decode reads a BMP image from r and returns it as an image.Image.
// Limitation: The file must be 8, 24 or 32 bits per pixel.
func Decode(r io.Reader) (image.Image, error) {
	c, bpp, topDown, err := decodeConfig(r)
	if err != nil {
		return nil, err
	}
	switch bpp {
	case 8:
		return decodePaletted(r, c, topDown)
	case 24:
		return decodeRGB(r, c, topDown)
	case 32:
		return decodeNRGBA(r, c, topDown)
	}
	panic("unreachable")
}

// DecodeConfig returns the color model and dimensions of a BMP image without
// decoding the entire image.
// Limitation: The file must be 8, 24 or 32 bits per pixel.
func DecodeConfig(r io.Reader) (image.Config, error) {
	config, _, _, err := decodeConfig(r)
	return config, err
}

func decodeConfig(r io.Reader) (config image.Config, bitsPerPixel int, topDown bool, err error) {
	// We only support those BMP images that are a BITMAPFILEHEADER
	// immediately followed by a BITMAPINFOHEADER.
	const (
		fileHeaderLen = 14
		infoHeaderLen = 40
	)
	var b [1024]byte
	if _, err := io.ReadFull(r, b[:fileHeaderLen+infoHeaderLen]); err != nil {
		return image.Config{}, 0, false, err
	}
	if string(b[:2]) != "BM" {
		return image.Config{}, 0, false, errors.New("bmp: invalid format")
	}
	offset := readUint32(b[10:14])
	if readUint32(b[14:18]) != infoHeaderLen {
		return image.Config{}, 0, false, ErrUnsupported
	}
	width := int(int32(readUint32(b[18:22])))
	height := int(int32(readUint32(b[22:26])))
	if height < 0 {
		height, topDown = -height, true
	}
	if width < 0 || height < 0 {
		return image.Config{}, 0, false, ErrUnsupported
	}
	// We only support 1 plane, 8 or 24 bits per pixel and no compression.
	planes, bpp, compression := readUint16(b[26:28]), readUint16(b[28:30]), readUint32(b[30:34])
	if planes != 1 || compression != 0 {
		return image.Config{}, 0, false, ErrUnsupported
	}
	switch bpp {
	case 8:
		if offset != fileHeaderLen+infoHeaderLen+256*4 {
			return image.Config{}, 0, false, ErrUnsupported
		}
		_, err = io.ReadFull(r, b[:256*4])
		if err != nil {
			return image.Config{}, 0, false, err
		}
		pcm := make(color.Palette, 256)
		for i := range pcm {
			// BMP images are stored in BGR order rather than RGB order.
			// Every 4th byte is padding.
			pcm[i] = color.RGBA{b[4*i+2], b[4*i+1], b[4*i+0], 0xFF}
		}
		return image.Config{ColorModel: pcm, Width: width, Height: height}, 8, topDown, nil
	case 24:
		if offset != fileHeaderLen+infoHeaderLen {
			return image.Config{}, 0, false, ErrUnsupported
		}
		return image.Config{ColorModel: color.RGBAModel, Width: width, Height: height}, 24, topDown, nil
	case 32:
		if offset != fileHeaderLen+infoHeaderLen {
			return image.Config{}, 0, false, ErrUnsupported
		}
		return image.Config{ColorModel: color.RGBAModel, Width: width, Height: height}, 32, topDown, nil
	}
	return image.Config{}, 0, false, ErrUnsupported
}

func init() {
	image.RegisterFormat("bmp", "BM????\x00\x00\x00\x00", Decode, DecodeConfig)
}
