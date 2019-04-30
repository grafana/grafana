// Copyright 2013 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package bmp

import (
	"encoding/binary"
	"errors"
	"image"
	"io"
)

type header struct {
	sigBM           [2]byte
	fileSize        uint32
	resverved       [2]uint16
	pixOffset       uint32
	dibHeaderSize   uint32
	width           uint32
	height          uint32
	colorPlane      uint16
	bpp             uint16
	compression     uint32
	imageSize       uint32
	xPixelsPerMeter uint32
	yPixelsPerMeter uint32
	colorUse        uint32
	colorImportant  uint32
}

func encodePaletted(w io.Writer, pix []uint8, dx, dy, stride, step int) error {
	var padding []byte
	if dx < step {
		padding = make([]byte, step-dx)
	}
	for y := dy - 1; y >= 0; y-- {
		min := y*stride + 0
		max := y*stride + dx
		if _, err := w.Write(pix[min:max]); err != nil {
			return err
		}
		if padding != nil {
			if _, err := w.Write(padding); err != nil {
				return err
			}
		}
	}
	return nil
}

func encodeRGBA(w io.Writer, pix []uint8, dx, dy, stride, step int, opaque bool) error {
	buf := make([]byte, step)
	if opaque {
		for y := dy - 1; y >= 0; y-- {
			min := y*stride + 0
			max := y*stride + dx*4
			off := 0
			for i := min; i < max; i += 4 {
				buf[off+2] = pix[i+0]
				buf[off+1] = pix[i+1]
				buf[off+0] = pix[i+2]
				off += 3
			}
			if _, err := w.Write(buf); err != nil {
				return err
			}
		}
	} else {
		for y := dy - 1; y >= 0; y-- {
			min := y*stride + 0
			max := y*stride + dx*4
			off := 0
			for i := min; i < max; i += 4 {
				a := uint32(pix[i+3])
				if a == 0 {
					buf[off+2] = 0
					buf[off+1] = 0
					buf[off+0] = 0
					buf[off+3] = 0
					off += 4
					continue
				} else if a == 0xff {
					buf[off+2] = pix[i+0]
					buf[off+1] = pix[i+1]
					buf[off+0] = pix[i+2]
					buf[off+3] = 0xff
					off += 4
					continue
				}
				buf[off+2] = uint8(((uint32(pix[i+0]) * 0xffff) / a) >> 8)
				buf[off+1] = uint8(((uint32(pix[i+1]) * 0xffff) / a) >> 8)
				buf[off+0] = uint8(((uint32(pix[i+2]) * 0xffff) / a) >> 8)
				buf[off+3] = uint8(a)
				off += 4
			}
			if _, err := w.Write(buf); err != nil {
				return err
			}
		}
	}
	return nil
}

func encodeNRGBA(w io.Writer, pix []uint8, dx, dy, stride, step int, opaque bool) error {
	buf := make([]byte, step)
	if opaque {
		for y := dy - 1; y >= 0; y-- {
			min := y*stride + 0
			max := y*stride + dx*4
			off := 0
			for i := min; i < max; i += 4 {
				buf[off+2] = pix[i+0]
				buf[off+1] = pix[i+1]
				buf[off+0] = pix[i+2]
				off += 3
			}
			if _, err := w.Write(buf); err != nil {
				return err
			}
		}
	} else {
		for y := dy - 1; y >= 0; y-- {
			min := y*stride + 0
			max := y*stride + dx*4
			off := 0
			for i := min; i < max; i += 4 {
				buf[off+2] = pix[i+0]
				buf[off+1] = pix[i+1]
				buf[off+0] = pix[i+2]
				buf[off+3] = pix[i+3]
				off += 4
			}
			if _, err := w.Write(buf); err != nil {
				return err
			}
		}
	}
	return nil
}

func encode(w io.Writer, m image.Image, step int) error {
	b := m.Bounds()
	buf := make([]byte, step)
	for y := b.Max.Y - 1; y >= b.Min.Y; y-- {
		off := 0
		for x := b.Min.X; x < b.Max.X; x++ {
			r, g, b, _ := m.At(x, y).RGBA()
			buf[off+2] = byte(r >> 8)
			buf[off+1] = byte(g >> 8)
			buf[off+0] = byte(b >> 8)
			off += 3
		}
		if _, err := w.Write(buf); err != nil {
			return err
		}
	}
	return nil
}

// Encode writes the image m to w in BMP format.
func Encode(w io.Writer, m image.Image) error {
	d := m.Bounds().Size()
	if d.X < 0 || d.Y < 0 {
		return errors.New("bmp: negative bounds")
	}
	h := &header{
		sigBM:         [2]byte{'B', 'M'},
		fileSize:      14 + 40,
		pixOffset:     14 + 40,
		dibHeaderSize: 40,
		width:         uint32(d.X),
		height:        uint32(d.Y),
		colorPlane:    1,
	}

	var step int
	var palette []byte
	var opaque bool
	switch m := m.(type) {
	case *image.Gray:
		step = (d.X + 3) &^ 3
		palette = make([]byte, 1024)
		for i := 0; i < 256; i++ {
			palette[i*4+0] = uint8(i)
			palette[i*4+1] = uint8(i)
			palette[i*4+2] = uint8(i)
			palette[i*4+3] = 0xFF
		}
		h.imageSize = uint32(d.Y * step)
		h.fileSize += uint32(len(palette)) + h.imageSize
		h.pixOffset += uint32(len(palette))
		h.bpp = 8

	case *image.Paletted:
		step = (d.X + 3) &^ 3
		palette = make([]byte, 1024)
		for i := 0; i < len(m.Palette) && i < 256; i++ {
			r, g, b, _ := m.Palette[i].RGBA()
			palette[i*4+0] = uint8(b >> 8)
			palette[i*4+1] = uint8(g >> 8)
			palette[i*4+2] = uint8(r >> 8)
			palette[i*4+3] = 0xFF
		}
		h.imageSize = uint32(d.Y * step)
		h.fileSize += uint32(len(palette)) + h.imageSize
		h.pixOffset += uint32(len(palette))
		h.bpp = 8
	case *image.RGBA:
		opaque = m.Opaque()
		if opaque {
			step = (3*d.X + 3) &^ 3
			h.bpp = 24
		} else {
			step = 4 * d.X
			h.bpp = 32
		}
		h.imageSize = uint32(d.Y * step)
		h.fileSize += h.imageSize
	case *image.NRGBA:
		opaque = m.Opaque()
		if opaque {
			step = (3*d.X + 3) &^ 3
			h.bpp = 24
		} else {
			step = 4 * d.X
			h.bpp = 32
		}
		h.imageSize = uint32(d.Y * step)
		h.fileSize += h.imageSize
	default:
		step = (3*d.X + 3) &^ 3
		h.imageSize = uint32(d.Y * step)
		h.fileSize += h.imageSize
		h.bpp = 24
	}

	if err := binary.Write(w, binary.LittleEndian, h); err != nil {
		return err
	}
	if palette != nil {
		if err := binary.Write(w, binary.LittleEndian, palette); err != nil {
			return err
		}
	}

	if d.X == 0 || d.Y == 0 {
		return nil
	}

	switch m := m.(type) {
	case *image.Gray:
		return encodePaletted(w, m.Pix, d.X, d.Y, m.Stride, step)
	case *image.Paletted:
		return encodePaletted(w, m.Pix, d.X, d.Y, m.Stride, step)
	case *image.RGBA:
		return encodeRGBA(w, m.Pix, d.X, d.Y, m.Stride, step, opaque)
	case *image.NRGBA:
		return encodeNRGBA(w, m.Pix, d.X, d.Y, m.Stride, step, opaque)
	}
	return encode(w, m, step)
}
