// +build ignore

package main

import (
	"archive/zip"
	"bufio"
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

func main() {
	site := "https://www.sqlite.org/download.html"
	fmt.Printf("scraping %v\n", site)
	doc, err := goquery.NewDocument(site)
	if err != nil {
		log.Fatal(err)
	}
	var url string
	doc.Find("a").Each(func(_ int, s *goquery.Selection) {
		if url == "" && strings.HasPrefix(s.Text(), "sqlite-amalgamation-") {
			url = "https://www.sqlite.org/2017/" + s.Text()
		}
	})
	if url == "" {
		return
	}
	fmt.Printf("downloading %v\n", url)
	resp, err := http.Get(url)
	if err != nil {
		log.Fatal(err)
	}

	b, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		resp.Body.Close()
		log.Fatal(err)
	}

	fmt.Printf("extracting %v\n", path.Base(url))
	r, err := zip.NewReader(bytes.NewReader(b), resp.ContentLength)
	if err != nil {
		resp.Body.Close()
		log.Fatal(err)
	}
	resp.Body.Close()

	for _, zf := range r.File {
		var f *os.File
		switch path.Base(zf.Name) {
		case "sqlite3.c":
			f, err = os.Create("sqlite3-binding.c")
		case "sqlite3.h":
			f, err = os.Create("sqlite3-binding.h")
		case "sqlite3ext.h":
			f, err = os.Create("sqlite3ext.h")
		default:
			continue
		}
		if err != nil {
			log.Fatal(err)
		}
		zr, err := zf.Open()
		if err != nil {
			log.Fatal(err)
		}

		_, err = io.WriteString(f, "#ifndef USE_LIBSQLITE3\n")
		if err != nil {
			zr.Close()
			f.Close()
			log.Fatal(err)
		}
		scanner := bufio.NewScanner(zr)
		for scanner.Scan() {
			text := scanner.Text()
			if text == `#include "sqlite3.h"` {
				text = `#include "sqlite3-binding.h"`
			}
			_, err = fmt.Fprintln(f, text)
			if err != nil {
				break
			}
		}
		err = scanner.Err()
		if err != nil {
			zr.Close()
			f.Close()
			log.Fatal(err)
		}
		_, err = io.WriteString(f, "#else // USE_LIBSQLITE3\n // If users really want to link against the system sqlite3 we\n// need to make this file a noop.\n #endif")
		if err != nil {
			zr.Close()
			f.Close()
			log.Fatal(err)
		}
		zr.Close()
		f.Close()
		fmt.Printf("extracted %v\n", filepath.Base(f.Name()))
	}
}
