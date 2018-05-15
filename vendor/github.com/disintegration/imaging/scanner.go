package imaging

import (
	"image"
	"image/color"
)

type scanner struct {
	image   image.Image
	w, h    int
	palette []color.NRGBA
}

func newScanner(img image.Image) *scanner {
	s := &scanner{
		image: img,
		w:     img.Bounds().Dx(),
		h:     img.Bounds().Dy(),
	}
	if img, ok := img.(*image.Paletted); ok {
		s.palette = make([]color.NRGBA, len(img.Palette))
		for i := 0; i < len(img.Palette); i++ {
			s.palette[i] = color.NRGBAModel.Convert(img.Palette[i]).(color.NRGBA)
		}
	}
	return s
}

// scan scans the given rectangular region of the image into dst.
func (s *scanner) scan(x1, y1, x2, y2 int, dst []uint8) {
	switch img := s.image.(type) {
	case *image.NRGBA:
		size := (x2 - x1) * 4
		j := 0
		i := y1*img.Stride + x1*4
		for y := y1; y < y2; y++ {
			copy(dst[j:j+size], img.Pix[i:i+size])
			j += size
			i += img.Stride
		}

	case *image.NRGBA64:
		j := 0
		for y := y1; y < y2; y++ {
			i := y*img.Stride + x1*8
			for x := x1; x < x2; x++ {
				dst[j+0] = img.Pix[i+0]
				dst[j+1] = img.Pix[i+2]
				dst[j+2] = img.Pix[i+4]
				dst[j+3] = img.Pix[i+6]
				j += 4
				i += 8
			}
		}

	case *image.RGBA:
		j := 0
		for y := y1; y < y2; y++ {
			i := y*img.Stride + x1*4
			for x := x1; x < x2; x++ {
				a := img.Pix[i+3]
				switch a {
				case 0:
					dst[j+0] = 0
					dst[j+1] = 0
					dst[j+2] = 0
				case 0xff:
					dst[j+0] = img.Pix[i+0]
					dst[j+1] = img.Pix[i+1]
					dst[j+2] = img.Pix[i+2]
				default:
					r16 := uint16(img.Pix[i+0])
					g16 := uint16(img.Pix[i+1])
					b16 := uint16(img.Pix[i+2])
					a16 := uint16(a)
					dst[j+0] = uint8(r16 * 0xff / a16)
					dst[j+1] = uint8(g16 * 0xff / a16)
					dst[j+2] = uint8(b16 * 0xff / a16)
				}
				dst[j+3] = a
				j += 4
				i += 4
			}
		}

	case *image.RGBA64:
		j := 0
		for y := y1; y < y2; y++ {
			i := y*img.Stride + x1*8
			for x := x1; x < x2; x++ {
				a := img.Pix[i+6]
				switch a {
				case 0:
					dst[j+0] = 0
					dst[j+1] = 0
					dst[j+2] = 0
				case 0xff:
					dst[j+0] = img.Pix[i+0]
					dst[j+1] = img.Pix[i+2]
					dst[j+2] = img.Pix[i+4]
				default:
					r32 := uint32(img.Pix[i+0])<<8 | uint32(img.Pix[i+1])
					g32 := uint32(img.Pix[i+2])<<8 | uint32(img.Pix[i+3])
					b32 := uint32(img.Pix[i+4])<<8 | uint32(img.Pix[i+5])
					a32 := uint32(img.Pix[i+6])<<8 | uint32(img.Pix[i+7])
					dst[j+0] = uint8((r32 * 0xffff / a32) >> 8)
					dst[j+1] = uint8((g32 * 0xffff / a32) >> 8)
					dst[j+2] = uint8((b32 * 0xffff / a32) >> 8)
				}
				dst[j+3] = a
				j += 4
				i += 8
			}
		}

	case *image.Gray:
		j := 0
		for y := y1; y < y2; y++ {
			i := y*img.Stride + x1
			for x := x1; x < x2; x++ {
				c := img.Pix[i]
				dst[j+0] = c
				dst[j+1] = c
				dst[j+2] = c
				dst[j+3] = 0xff
				j += 4
				i++
			}
		}

	case *image.Gray16:
		j := 0
		for y := y1; y < y2; y++ {
			i := y*img.Stride + x1*2
			for x := x1; x < x2; x++ {
				c := img.Pix[i]
				dst[j+0] = c
				dst[j+1] = c
				dst[j+2] = c
				dst[j+3] = 0xff
				j += 4
				i += 2
			}
		}

	case *image.YCbCr:
		j := 0
		x1 += img.Rect.Min.X
		x2 += img.Rect.Min.X
		y1 += img.Rect.Min.Y
		y2 += img.Rect.Min.Y
		for y := y1; y < y2; y++ {
			iy := (y-img.Rect.Min.Y)*img.YStride + (x1 - img.Rect.Min.X)
			for x := x1; x < x2; x++ {
				var ic int
				switch img.SubsampleRatio {
				case image.YCbCrSubsampleRatio444:
					ic = (y-img.Rect.Min.Y)*img.CStride + (x - img.Rect.Min.X)
				case image.YCbCrSubsampleRatio422:
					ic = (y-img.Rect.Min.Y)*img.CStride + (x/2 - img.Rect.Min.X/2)
				case image.YCbCrSubsampleRatio420:
					ic = (y/2-img.Rect.Min.Y/2)*img.CStride + (x/2 - img.Rect.Min.X/2)
				case image.YCbCrSubsampleRatio440:
					ic = (y/2-img.Rect.Min.Y/2)*img.CStride + (x - img.Rect.Min.X)
				default:
					ic = img.COffset(x, y)
				}

				yy := int(img.Y[iy])
				cb := int(img.Cb[ic]) - 128
				cr := int(img.Cr[ic]) - 128

				r := (yy<<16 + 91881*cr + 1<<15) >> 16
				if r > 0xff {
					r = 0xff
				} else if r < 0 {
					r = 0
				}

				g := (yy<<16 - 22554*cb - 46802*cr + 1<<15) >> 16
				if g > 0xff {
					g = 0xff
				} else if g < 0 {
					g = 0
				}

				b := (yy<<16 + 116130*cb + 1<<15) >> 16
				if b > 0xff {
					b = 0xff
				} else if b < 0 {
					b = 0
				}

				dst[j+0] = uint8(r)
				dst[j+1] = uint8(g)
				dst[j+2] = uint8(b)
				dst[j+3] = 0xff

				iy++
				j += 4
			}
		}

	case *image.Paletted:
		j := 0
		for y := y1; y < y2; y++ {
			i := y*img.Stride + x1
			for x := x1; x < x2; x++ {
				c := s.palette[img.Pix[i]]
				dst[j+0] = c.R
				dst[j+1] = c.G
				dst[j+2] = c.B
				dst[j+3] = c.A
				j += 4
				i++
			}
		}

	default:
		j := 0
		b := s.image.Bounds()
		x1 += b.Min.X
		x2 += b.Min.X
		y1 += b.Min.Y
		y2 += b.Min.Y
		for y := y1; y < y2; y++ {
			for x := x1; x < x2; x++ {
				r16, g16, b16, a16 := s.image.At(x, y).RGBA()
				switch a16 {
				case 0xffff:
					dst[j+0] = uint8(r16 >> 8)
					dst[j+1] = uint8(g16 >> 8)
					dst[j+2] = uint8(b16 >> 8)
					dst[j+3] = 0xff
				case 0:
					dst[j+0] = 0
					dst[j+1] = 0
					dst[j+2] = 0
					dst[j+3] = 0
				default:
					dst[j+0] = uint8(((r16 * 0xffff) / a16) >> 8)
					dst[j+1] = uint8(((g16 * 0xffff) / a16) >> 8)
					dst[j+2] = uint8(((b16 * 0xffff) / a16) >> 8)
					dst[j+3] = uint8(a16 >> 8)
				}
				j += 4
			}
		}
	}
}
