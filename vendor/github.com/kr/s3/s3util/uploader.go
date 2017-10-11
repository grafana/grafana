package s3util

import (
	"bytes"
	"encoding/xml"
	"github.com/kr/s3"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"syscall"
	"time"
)

// defined by amazon
const (
	minPartSize = 5 * 1024 * 1024
	maxPartSize = 1<<31 - 1 // for 32-bit use; amz max is 5GiB
	maxObjSize  = 5 * 1024 * 1024 * 1024 * 1024
	maxNPart    = 10000
)

const (
	concurrency = 5
	nTry        = 2
)

type part struct {
	r   io.ReadSeeker
	len int64

	// read by xml encoder
	PartNumber int
	ETag       string
}

type uploader struct {
	s3       s3.Service
	keys     s3.Keys
	url      string
	client   *http.Client
	UploadId string // written by xml decoder

	bufsz  int64
	buf    []byte
	off    int
	ch     chan *part
	part   int
	closed bool
	err    error
	wg     sync.WaitGroup

	xml struct {
		XMLName string `xml:"CompleteMultipartUpload"`
		Part    []*part
	}
}

// Create creates an S3 object at url and sends multipart upload requests as
// data is written.
//
// If h is not nil, each of its entries is added to the HTTP request header.
// If c is nil, Create uses DefaultConfig.
func Create(url string, h http.Header, c *Config) (io.WriteCloser, error) {
	if c == nil {
		c = DefaultConfig
	}
	return newUploader(url, h, c)
}

// Sends an S3 multipart upload initiation request.
// See http://docs.amazonwebservices.com/AmazonS3/latest/dev/mpuoverview.html.
// This initial request returns an UploadId that we use to identify
// subsequent PUT requests.
func newUploader(url string, h http.Header, c *Config) (u *uploader, err error) {
	u = new(uploader)
	u.s3 = *c.Service
	u.url = url
	u.keys = *c.Keys
	u.client = c.Client
	if u.client == nil {
		u.client = http.DefaultClient
	}
	u.bufsz = minPartSize
	r, err := http.NewRequest("POST", url+"?uploads", nil)
	if err != nil {
		return nil, err
	}
	r.Header.Set("Date", time.Now().UTC().Format(http.TimeFormat))
	for k := range h {
		for _, v := range h[k] {
			r.Header.Add(k, v)
		}
	}
	u.s3.Sign(r, u.keys)
	resp, err := u.client.Do(r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, newRespError(resp)
	}
	err = xml.NewDecoder(resp.Body).Decode(u)
	if err != nil {
		return nil, err
	}
	u.ch = make(chan *part)
	for i := 0; i < concurrency; i++ {
		go u.worker()
	}
	return u, nil
}

func (u *uploader) Write(p []byte) (n int, err error) {
	if u.closed {
		return 0, syscall.EINVAL
	}
	if u.err != nil {
		return 0, u.err
	}
	for n < len(p) {
		if cap(u.buf) == 0 {
			u.buf = make([]byte, int(u.bufsz))
			// Increase part size (1.001x).
			// This lets us reach the max object size (5TiB) while
			// still doing minimal buffering for small objects.
			u.bufsz = min(u.bufsz+u.bufsz/1000, maxPartSize)
		}
		r := copy(u.buf[u.off:], p[n:])
		u.off += r
		n += r
		if u.off == len(u.buf) {
			u.flush()
		}
	}
	return n, nil
}

func (u *uploader) flush() {
	u.wg.Add(1)
	u.part++
	p := &part{bytes.NewReader(u.buf[:u.off]), int64(u.off), u.part, ""}
	u.xml.Part = append(u.xml.Part, p)
	u.ch <- p
	u.buf, u.off = nil, 0
}

func (u *uploader) worker() {
	for p := range u.ch {
		u.retryUploadPart(p)
	}
}

// Calls putPart up to nTry times to recover from transient errors.
func (u *uploader) retryUploadPart(p *part) {
	defer u.wg.Done()
	defer func() { p.r = nil }() // free the large buffer
	var err error
	for i := 0; i < nTry; i++ {
		p.r.Seek(0, 0)
		err = u.putPart(p)
		if err == nil {
			return
		}
	}
	u.err = err
}

// Uploads part p, reading its contents from p.r.
// Stores the ETag in p.ETag.
func (u *uploader) putPart(p *part) error {
	v := url.Values{}
	v.Set("partNumber", strconv.Itoa(p.PartNumber))
	v.Set("uploadId", u.UploadId)
	req, err := http.NewRequest("PUT", u.url+"?"+v.Encode(), p.r)
	if err != nil {
		return err
	}
	req.ContentLength = p.len
	req.Header.Set("Date", time.Now().UTC().Format(http.TimeFormat))
	u.s3.Sign(req, u.keys)
	resp, err := u.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return newRespError(resp)
	}
	s := resp.Header.Get("etag") // includes quote chars for some reason
	if len(s) < 2 {
		return fmt.Errorf("received invalid etag %q", s)
	}
	p.ETag = s[1 : len(s)-1]
	return nil
}

func (u *uploader) Close() error {
	if u.closed {
		return syscall.EINVAL
	}
	if cap(u.buf) > 0 {
		u.flush()
	}
	u.wg.Wait()
	close(u.ch)
	u.closed = true
	if u.err != nil {
		u.abort()
		return u.err
	}

	body, err := xml.Marshal(u.xml)
	if err != nil {
		return err
	}
	b := bytes.NewBuffer(body)
	v := url.Values{}
	v.Set("uploadId", u.UploadId)
	req, err := http.NewRequest("POST", u.url+"?"+v.Encode(), b)
	if err != nil {
		return err
	}
	req.Header.Set("Date", time.Now().UTC().Format(http.TimeFormat))
	u.s3.Sign(req, u.keys)
	resp, err := u.client.Do(req)
	if err != nil {
		return err
	}
	if resp.StatusCode != 200 {
		return newRespError(resp)
	}
	resp.Body.Close()
	return nil
}

func (u *uploader) abort() {
	// TODO(kr): devise a reasonable way to report an error here in addition
	// to the error that caused the abort.
	v := url.Values{}
	v.Set("uploadId", u.UploadId)
	s := u.url + "?" + v.Encode()
	req, err := http.NewRequest("DELETE", s, nil)
	if err != nil {
		return
	}
	req.Header.Set("Date", time.Now().UTC().Format(http.TimeFormat))
	u.s3.Sign(req, u.keys)
	resp, err := u.client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return
	}
}

func min(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}
