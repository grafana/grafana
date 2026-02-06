# gofpdi
[![MIT
licensed](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/phpdave11/gofpdi/master/LICENSE)
[![Report](https://goreportcard.com/badge/github.com/phpdave11/gofpdi)](https://goreportcard.com/report/github.com/phpdave11/gofpdi)
[![GoDoc](https://img.shields.io/badge/godoc-gofpdi-blue.svg)](https://godoc.org/github.com/phpdave11/gofpdi)

## Go Free PDF Document Importer

gofpdi allows you to import an existing PDF into a new PDF.  The following PDF generation libraries are supported:

- [gopdf](https://github.com/signintech/gopdf)

- [gofpdf](https://github.com/phpdave11/gofpdf)

## Acknowledgments
This package’s code is derived from the [fpdi](https://github.com/Setasign/FPDI/tree/1.6.x-legacy) library created by [Jan Slabon](https://github.com/JanSlabon).
[mrtsbt](https://github.com/mrtsbt) added support for reading a PDF from an `io.ReadSeeker` stream and also added support for using gofpdi concurrently.  [Asher Tuggle](https://github.com/awesomeunleashed) added support for reading PDFs that have split xref tables.

## Examples

### gopdf example

```go
package main

import (
        "github.com/signintech/gopdf"
        "io"
        "net/http"
        "os"
)

func main() {
        var err error

        // Download a Font
        fontUrl := "https://github.com/google/fonts/raw/master/ofl/daysone/DaysOne-Regular.ttf"
        if err = DownloadFile("example-font.ttf", fontUrl); err != nil {
                panic(err)
        }

        // Download a PDF
        fileUrl := "https://tcpdf.org/files/examples/example_012.pdf"
        if err = DownloadFile("example-pdf.pdf", fileUrl); err != nil {
                panic(err)
        }

        pdf := gopdf.GoPdf{}
        pdf.Start(gopdf.Config{PageSize: gopdf.Rect{W: 595.28, H: 841.89}}) //595.28, 841.89 = A4

        pdf.AddPage()

        err = pdf.AddTTFFont("daysone", "example-font.ttf")
        if err != nil {
                panic(err)
        }

        err = pdf.SetFont("daysone", "", 20)
        if err != nil {
                panic(err)
        }

        // Color the page
        pdf.SetLineWidth(0.1)
        pdf.SetFillColor(124, 252, 0) //setup fill color
        pdf.RectFromUpperLeftWithStyle(50, 100, 400, 600, "FD")
        pdf.SetFillColor(0, 0, 0)

        pdf.SetX(50)
        pdf.SetY(50)
        pdf.Cell(nil, "Import existing PDF into GoPDF Document")

        // Import page 1
        tpl1 := pdf.ImportPage("example-pdf.pdf", 1, "/MediaBox")

        // Draw pdf onto page
        pdf.UseImportedTemplate(tpl1, 50, 100, 400, 0)

        pdf.WritePdf("example.pdf")

}

// DownloadFile will download a url to a local file. It's efficient because it will
// write as it downloads and not load the whole file into memory.
func DownloadFile(filepath string, url string) error {
        // Get the data
        resp, err := http.Get(url)
        if err != nil {
                return err
        }
        defer resp.Body.Close()

        // Create the file
        out, err := os.Create(filepath)
        if err != nil {
                return err
        }
        defer out.Close()

        // Write the body to file
        _, err = io.Copy(out, resp.Body)
        return err
}
```

Generated PDF: [example.pdf](https://github.com/signintech/gopdf/files/3144466/example.pdf)

Screenshot of PDF:

![example](https://user-images.githubusercontent.com/9421180/57180557-4c1dbd80-6e4f-11e9-8f47-9d40217805be.jpg)

### gofpdf example #1 - import PDF from file

```go
package main

import (
	"github.com/phpdave11/gofpdf"
	"github.com/phpdave11/gofpdf/contrib/gofpdi"
	"io"
	"net/http"
	"os"
)

func main() {
	var err error

	pdf := gofpdf.New("P", "mm", "A4", "")

	// Download a PDF
	fileUrl := "https://tcpdf.org/files/examples/example_026.pdf"
	if err = DownloadFile("example-pdf.pdf", fileUrl); err != nil {
		panic(err)
	}

	// Import example-pdf.pdf with gofpdi free pdf document importer
	tpl1 := gofpdi.ImportPage(pdf, "example-pdf.pdf", 1, "/MediaBox")

	pdf.AddPage()

	pdf.SetFillColor(200, 700, 220)
	pdf.Rect(20, 50, 150, 215, "F")

	// Draw imported template onto page
	gofpdi.UseImportedTemplate(pdf, tpl1, 20, 50, 150, 0)

	pdf.SetFont("Helvetica", "", 20)
	pdf.Cell(0, 0, "Import existing PDF into gofpdf document with gofpdi")

	err = pdf.OutputFileAndClose("example.pdf")
	if err != nil {
		panic(err)
	}
}

// DownloadFile will download a url to a local file. It's efficient because it will
// write as it downloads and not load the whole file into memory.
func DownloadFile(filepath string, url string) error {
	// Get the data
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Create the file
	out, err := os.Create(filepath)
	if err != nil {
		return err
	}
	defer out.Close()

	// Write the body to file
	_, err = io.Copy(out, resp.Body)
	return err
}
```

Generated PDF:  [example.pdf](https://github.com/phpdave11/gofpdf/files/3178770/example.pdf)

Screenshot of PDF:
![example](https://user-images.githubusercontent.com/9421180/57713804-ca8d1300-7638-11e9-9f8e-e3f803374803.jpg)



### gofpdf example #2 - import PDF from stream

```go
package main

import (
    "bytes"
    "github.com/phpdave11/gofpdf"
    "github.com/phpdave11/gofpdf/contrib/gofpdi"
    "io"
    "io/ioutil"
    "net/http"
)

func main() {
    var err error

    pdf := gofpdf.New("P", "mm", "A4", "")

    // Download a PDF into memory                                                                                                                     
    res, err := http.Get("https://tcpdf.org/files/examples/example_038.pdf")
    if err != nil {
        panic(err)
    }
    pdfBytes, err := ioutil.ReadAll(res.Body)
    res.Body.Close()
    if err != nil {
        panic(err)
    }

    // convert []byte to io.ReadSeeker                                                                                                                
    rs := io.ReadSeeker(bytes.NewReader(pdfBytes))

    // Import in-memory PDF stream with gofpdi free pdf document importer                                                                             
    tpl1 := gofpdi.ImportPageFromStream(pdf, &rs, 1, "/TrimBox")

    pdf.AddPage()

    pdf.SetFillColor(200, 700, 220)
    pdf.Rect(20, 50, 150, 215, "F")

    // Draw imported template onto page                                                                                                               
    gofpdi.UseImportedTemplate(pdf, tpl1, 20, 50, 150, 0)

    pdf.SetFont("Helvetica", "", 20)
    pdf.Cell(0, 0, "Import PDF stream into gofpdf document with gofpdi")

    err = pdf.OutputFileAndClose("example.pdf")
    if err != nil {
        panic(err)
    }
}
```

Generated PDF:

[example.pdf](https://github.com/phpdave11/gofpdi/files/3483219/example.pdf)

Screenshot of PDF:

![example.jpg](https://user-images.githubusercontent.com/9421180/62728726-18b87500-b9e2-11e9-885c-7c68b7ac6222.jpg)
