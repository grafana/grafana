package gofpdf

/*
 * Copyright (c) 2015 Kurt Jung (Gmail: kurt.w.jung),
 *   Marcus Downing, Jan Slabon (Setasign)
 *
 * Permission to use, copy, modify, and distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

import (
	"encoding/gob"
	"sort"
)

// CreateTemplate defines a new template using the current page size.
func (f *Fpdf) CreateTemplate(fn func(*Tpl)) Template {
	return newTpl(PointType{0, 0}, f.curPageSize, f.defOrientation, f.unitStr, f.fontDirStr, fn, f)
}

// CreateTemplateCustom starts a template, using the given bounds.
func (f *Fpdf) CreateTemplateCustom(corner PointType, size SizeType, fn func(*Tpl)) Template {
	return newTpl(corner, size, f.defOrientation, f.unitStr, f.fontDirStr, fn, f)
}

// CreateTemplate creates a template that is not attached to any document.
//
// This function is deprecated; it incorrectly assumes that a page with a width
// smaller than its height is oriented in portrait mode, otherwise it assumes
// landscape mode. This causes problems when placing the template in a master
// document where this condition does not apply. CreateTpl() is a similar
// function that lets you specify the orientation to avoid this problem.
func CreateTemplate(corner PointType, size SizeType, unitStr, fontDirStr string, fn func(*Tpl)) Template {
	orientationStr := "p"
	if size.Wd > size.Ht {
		orientationStr = "l"
	}

	return CreateTpl(corner, size, orientationStr, unitStr, fontDirStr, fn)
}

// CreateTpl creates a template not attached to any document
func CreateTpl(corner PointType, size SizeType, orientationStr, unitStr, fontDirStr string, fn func(*Tpl)) Template {
	return newTpl(corner, size, orientationStr, unitStr, fontDirStr, fn, nil)
}

// UseTemplate adds a template to the current page or another template,
// using the size and position at which it was originally written.
func (f *Fpdf) UseTemplate(t Template) {
	if t == nil {
		f.SetErrorf("template is nil")
		return
	}
	corner, size := t.Size()
	f.UseTemplateScaled(t, corner, size)
}

// UseTemplateScaled adds a template to the current page or another template,
// using the given page coordinates.
func (f *Fpdf) UseTemplateScaled(t Template, corner PointType, size SizeType) {
	if t == nil {
		f.SetErrorf("template is nil")
		return
	}

	// You have to add at least a page first
	if f.page <= 0 {
		f.SetErrorf("cannot use a template without first adding a page")
		return
	}

	// make a note of the fact that we actually use this template, as well as any other templates,
	// images or fonts it uses
	f.templates[t.ID()] = t
	for _, tt := range t.Templates() {
		f.templates[tt.ID()] = tt
	}

	// Create a list of existing image SHA-1 hashes.
	existingImages := map[string]bool{}
	for _, image := range f.images {
		existingImages[image.i] = true
	}

	// Add each template image to $f, unless already present.
	for name, ti := range t.Images() {
		if _, found := existingImages[ti.i]; found {
			continue
		}
		name = sprintf("t%s-%s", t.ID(), name)
		f.images[name] = ti
	}

	// template data
	_, templateSize := t.Size()
	scaleX := size.Wd / templateSize.Wd
	scaleY := size.Ht / templateSize.Ht
	tx := corner.X * f.k
	ty := (f.curPageSize.Ht - corner.Y - size.Ht) * f.k

	f.outf("q %.4f 0 0 %.4f %.4f %.4f cm", scaleX, scaleY, tx, ty) // Translate
	f.outf("/TPL%s Do Q", t.ID())
}

// Template is an object that can be written to, then used and re-used any number of times within a document.
type Template interface {
	ID() string
	Size() (PointType, SizeType)
	Bytes() []byte
	Images() map[string]*ImageInfoType
	Templates() []Template
	NumPages() int
	FromPage(int) (Template, error)
	FromPages() []Template
	Serialize() ([]byte, error)
	gob.GobDecoder
	gob.GobEncoder
}

func (f *Fpdf) templateFontCatalog() {
	var keyList []string
	var font fontDefType
	var key string
	f.out("/Font <<")
	for key = range f.fonts {
		keyList = append(keyList, key)
	}
	if f.catalogSort {
		sort.Strings(keyList)
	}
	for _, key = range keyList {
		font = f.fonts[key]
		f.outf("/F%s %d 0 R", font.i, font.N)
	}
	f.out(">>")
}

// putTemplates writes the templates to the PDF
func (f *Fpdf) putTemplates() {
	filter := ""
	if f.compress {
		filter = "/Filter /FlateDecode "
	}

	templates := sortTemplates(f.templates, f.catalogSort)
	var t Template
	for _, t = range templates {
		corner, size := t.Size()

		f.newobj()
		f.templateObjects[t.ID()] = f.n
		f.outf("<<%s/Type /XObject", filter)
		f.out("/Subtype /Form")
		f.out("/Formtype 1")
		f.outf("/BBox [%.2f %.2f %.2f %.2f]", corner.X*f.k, corner.Y*f.k, (corner.X+size.Wd)*f.k, (corner.Y+size.Ht)*f.k)
		if corner.X != 0 || corner.Y != 0 {
			f.outf("/Matrix [1 0 0 1 %.5f %.5f]", -corner.X*f.k*2, corner.Y*f.k*2)
		}

		// Template's resource dictionary
		f.out("/Resources ")
		f.out("<</ProcSet [/PDF /Text /ImageB /ImageC /ImageI]")

		f.templateFontCatalog()

		tImages := t.Images()
		tTemplates := t.Templates()
		if len(tImages) > 0 || len(tTemplates) > 0 {
			f.out("/XObject <<")
			{
				var key string
				var keyList []string
				var ti *ImageInfoType
				for key = range tImages {
					keyList = append(keyList, key)
				}
				if gl.catalogSort {
					sort.Strings(keyList)
				}
				for _, key = range keyList {
					// for _, ti := range tImages {
					ti = tImages[key]
					f.outf("/I%s %d 0 R", ti.i, ti.n)
				}
			}
			for _, tt := range tTemplates {
				id := tt.ID()
				if objID, ok := f.templateObjects[id]; ok {
					f.outf("/TPL%s %d 0 R", id, objID)
				}
			}
			f.out(">>")
		}

		f.out(">>")

		//  Write the template's byte stream
		buffer := t.Bytes()
		// fmt.Println("Put template bytes", string(buffer[:]))
		if f.compress {
			buffer = sliceCompress(buffer)
		}
		f.outf("/Length %d >>", len(buffer))
		f.putstream(buffer)
		f.out("endobj")
	}
}

func templateKeyList(mp map[string]Template, sort bool) (keyList []string) {
	var key string
	for key = range mp {
		keyList = append(keyList, key)
	}
	if sort {
		gensort(len(keyList),
			func(a, b int) bool {
				return keyList[a] < keyList[b]
			},
			func(a, b int) {
				keyList[a], keyList[b] = keyList[b], keyList[a]
			})
	}
	return
}

// sortTemplates puts templates in a suitable order based on dependices
func sortTemplates(templates map[string]Template, catalogSort bool) []Template {
	chain := make([]Template, 0, len(templates)*2)

	// build a full set of dependency chains
	var keyList []string
	var key string
	var t Template
	keyList = templateKeyList(templates, catalogSort)
	for _, key = range keyList {
		t = templates[key]
		tlist := templateChainDependencies(t)
		for _, tt := range tlist {
			if tt != nil {
				chain = append(chain, tt)
			}
		}
	}

	// reduce that to make a simple list
	sorted := make([]Template, 0, len(templates))
chain:
	for _, t := range chain {
		for _, already := range sorted {
			if t == already {
				continue chain
			}
		}
		sorted = append(sorted, t)
	}

	return sorted
}

//  templateChainDependencies is a recursive function for determining the full chain of template dependencies
func templateChainDependencies(template Template) []Template {
	requires := template.Templates()
	chain := make([]Template, len(requires)*2)
	for _, req := range requires {
		chain = append(chain, templateChainDependencies(req)...)
	}
	chain = append(chain, template)
	return chain
}

// < 0002640  31 20 31 32 20 30 20 52  0a 2f 54 50 4c 32 20 31  |1 12 0 R./TPL2 1|
// < 0002650  35 20 30 20 52 0a 2f 54  50 4c 31 20 31 34 20 30  |5 0 R./TPL1 14 0|

// > 0002640  31 20 31 32 20 30 20 52  0a 2f 54 50 4c 31 20 31  |1 12 0 R./TPL1 1|
// > 0002650  34 20 30 20 52 0a 2f 54  50 4c 32 20 31 35 20 30  |4 0 R./TPL2 15 0|
