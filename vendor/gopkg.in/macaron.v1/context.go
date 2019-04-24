// Copyright 2014 The Macaron Authors
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

package macaron

import (
	"crypto/sha256"
	"encoding/hex"
	"html/template"
	"io"
	"io/ioutil"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/Unknwon/com"
	"github.com/go-macaron/inject"
	"golang.org/x/crypto/pbkdf2"
)

// Locale reprents a localization interface.
type Locale interface {
	Language() string
	Tr(string, ...interface{}) string
}

// RequestBody represents a request body.
type RequestBody struct {
	reader io.ReadCloser
}

// Bytes reads and returns content of request body in bytes.
func (rb *RequestBody) Bytes() ([]byte, error) {
	return ioutil.ReadAll(rb.reader)
}

// String reads and returns content of request body in string.
func (rb *RequestBody) String() (string, error) {
	data, err := rb.Bytes()
	return string(data), err
}

// ReadCloser returns a ReadCloser for request body.
func (rb *RequestBody) ReadCloser() io.ReadCloser {
	return rb.reader
}

// Request represents an HTTP request received by a server or to be sent by a client.
type Request struct {
	*http.Request
}

func (r *Request) Body() *RequestBody {
	return &RequestBody{r.Request.Body}
}

// ContextInvoker is an inject.FastInvoker wrapper of func(ctx *Context).
type ContextInvoker func(ctx *Context)

func (invoke ContextInvoker) Invoke(params []interface{}) ([]reflect.Value, error) {
	invoke(params[0].(*Context))
	return nil, nil
}

// Context represents the runtime context of current request of Macaron instance.
// It is the integration of most frequently used middlewares and helper methods.
type Context struct {
	inject.Injector
	handlers []Handler
	action   Handler
	index    int

	*Router
	Req    Request
	Resp   ResponseWriter
	params Params
	Render
	Locale
	Data map[string]interface{}
}

func (c *Context) handler() Handler {
	if c.index < len(c.handlers) {
		return c.handlers[c.index]
	}
	if c.index == len(c.handlers) {
		return c.action
	}
	panic("invalid index for context handler")
}

func (c *Context) Next() {
	c.index += 1
	c.run()
}

func (c *Context) Written() bool {
	return c.Resp.Written()
}

func (c *Context) run() {
	for c.index <= len(c.handlers) {
		vals, err := c.Invoke(c.handler())
		if err != nil {
			panic(err)
		}
		c.index += 1

		// if the handler returned something, write it to the http response
		if len(vals) > 0 {
			ev := c.GetVal(reflect.TypeOf(ReturnHandler(nil)))
			handleReturn := ev.Interface().(ReturnHandler)
			handleReturn(c, vals)
		}

		if c.Written() {
			return
		}
	}
}

// RemoteAddr returns more real IP address.
func (ctx *Context) RemoteAddr() string {
	addr := ctx.Req.Header.Get("X-Real-IP")
	if len(addr) == 0 {
		addr = ctx.Req.Header.Get("X-Forwarded-For")
		if addr == "" {
			addr = ctx.Req.RemoteAddr
			if i := strings.LastIndex(addr, ":"); i > -1 {
				addr = addr[:i]
			}
		}
	}
	return addr
}

func (ctx *Context) renderHTML(status int, setName, tplName string, data ...interface{}) {
	if len(data) <= 0 {
		ctx.Render.HTMLSet(status, setName, tplName, ctx.Data)
	} else if len(data) == 1 {
		ctx.Render.HTMLSet(status, setName, tplName, data[0])
	} else {
		ctx.Render.HTMLSet(status, setName, tplName, data[0], data[1].(HTMLOptions))
	}
}

// HTML calls Render.HTML but allows less arguments.
func (ctx *Context) HTML(status int, name string, data ...interface{}) {
	ctx.renderHTML(status, DEFAULT_TPL_SET_NAME, name, data...)
}

// HTML calls Render.HTMLSet but allows less arguments.
func (ctx *Context) HTMLSet(status int, setName, tplName string, data ...interface{}) {
	ctx.renderHTML(status, setName, tplName, data...)
}

func (ctx *Context) Redirect(location string, status ...int) {
	code := http.StatusFound
	if len(status) == 1 {
		code = status[0]
	}

	http.Redirect(ctx.Resp, ctx.Req.Request, location, code)
}

// Maximum amount of memory to use when parsing a multipart form.
// Set this to whatever value you prefer; default is 10 MB.
var MaxMemory = int64(1024 * 1024 * 10)

func (ctx *Context) parseForm() {
	if ctx.Req.Form != nil {
		return
	}

	contentType := ctx.Req.Header.Get(_CONTENT_TYPE)
	if (ctx.Req.Method == "POST" || ctx.Req.Method == "PUT") &&
		len(contentType) > 0 && strings.Contains(contentType, "multipart/form-data") {
		ctx.Req.ParseMultipartForm(MaxMemory)
	} else {
		ctx.Req.ParseForm()
	}
}

// Query querys form parameter.
func (ctx *Context) Query(name string) string {
	ctx.parseForm()
	return ctx.Req.Form.Get(name)
}

// QueryTrim querys and trims spaces form parameter.
func (ctx *Context) QueryTrim(name string) string {
	return strings.TrimSpace(ctx.Query(name))
}

// QueryStrings returns a list of results by given query name.
func (ctx *Context) QueryStrings(name string) []string {
	ctx.parseForm()

	vals, ok := ctx.Req.Form[name]
	if !ok {
		return []string{}
	}
	return vals
}

// QueryEscape returns escapred query result.
func (ctx *Context) QueryEscape(name string) string {
	return template.HTMLEscapeString(ctx.Query(name))
}

// QueryBool returns query result in bool type.
func (ctx *Context) QueryBool(name string) bool {
	v, _ := strconv.ParseBool(ctx.Query(name))
	return v
}

// QueryInt returns query result in int type.
func (ctx *Context) QueryInt(name string) int {
	return com.StrTo(ctx.Query(name)).MustInt()
}

// QueryInt64 returns query result in int64 type.
func (ctx *Context) QueryInt64(name string) int64 {
	return com.StrTo(ctx.Query(name)).MustInt64()
}

// QueryFloat64 returns query result in float64 type.
func (ctx *Context) QueryFloat64(name string) float64 {
	v, _ := strconv.ParseFloat(ctx.Query(name), 64)
	return v
}

// Params returns value of given param name.
// e.g. ctx.Params(":uid") or ctx.Params("uid")
func (ctx *Context) Params(name string) string {
	if len(name) == 0 {
		return ""
	}
	if len(name) > 1 && name[0] != ':' {
		name = ":" + name
	}
	return ctx.params[name]
}

// SetParams sets value of param with given name.
func (ctx *Context) SetParams(name, val string) {
	if name != "*" && !strings.HasPrefix(name, ":") {
		name = ":" + name
	}
	ctx.params[name] = val
}

// ReplaceAllParams replace all current params with given params
func (ctx *Context) ReplaceAllParams(params Params) {
	ctx.params = params
}

// ParamsEscape returns escapred params result.
// e.g. ctx.ParamsEscape(":uname")
func (ctx *Context) ParamsEscape(name string) string {
	return template.HTMLEscapeString(ctx.Params(name))
}

// ParamsInt returns params result in int type.
// e.g. ctx.ParamsInt(":uid")
func (ctx *Context) ParamsInt(name string) int {
	return com.StrTo(ctx.Params(name)).MustInt()
}

// ParamsInt64 returns params result in int64 type.
// e.g. ctx.ParamsInt64(":uid")
func (ctx *Context) ParamsInt64(name string) int64 {
	return com.StrTo(ctx.Params(name)).MustInt64()
}

// ParamsFloat64 returns params result in int64 type.
// e.g. ctx.ParamsFloat64(":uid")
func (ctx *Context) ParamsFloat64(name string) float64 {
	v, _ := strconv.ParseFloat(ctx.Params(name), 64)
	return v
}

// GetFile returns information about user upload file by given form field name.
func (ctx *Context) GetFile(name string) (multipart.File, *multipart.FileHeader, error) {
	return ctx.Req.FormFile(name)
}

// SaveToFile reads a file from request by field name and saves to given path.
func (ctx *Context) SaveToFile(name, savePath string) error {
	fr, _, err := ctx.GetFile(name)
	if err != nil {
		return err
	}
	defer fr.Close()

	fw, err := os.OpenFile(savePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0666)
	if err != nil {
		return err
	}
	defer fw.Close()

	_, err = io.Copy(fw, fr)
	return err
}

// SetCookie sets given cookie value to response header.
// FIXME: IE support? http://golanghome.com/post/620#reply2
func (ctx *Context) SetCookie(name string, value string, others ...interface{}) {
	cookie := http.Cookie{}
	cookie.Name = name
	cookie.Value = url.QueryEscape(value)

	if len(others) > 0 {
		switch v := others[0].(type) {
		case int:
			cookie.MaxAge = v
		case int64:
			cookie.MaxAge = int(v)
		case int32:
			cookie.MaxAge = int(v)
		}
	}

	cookie.Path = "/"
	if len(others) > 1 {
		if v, ok := others[1].(string); ok && len(v) > 0 {
			cookie.Path = v
		}
	}

	if len(others) > 2 {
		if v, ok := others[2].(string); ok && len(v) > 0 {
			cookie.Domain = v
		}
	}

	if len(others) > 3 {
		switch v := others[3].(type) {
		case bool:
			cookie.Secure = v
		default:
			if others[3] != nil {
				cookie.Secure = true
			}
		}
	}

	if len(others) > 4 {
		if v, ok := others[4].(bool); ok && v {
			cookie.HttpOnly = true
		}
	}

	if len(others) > 5 {
		if v, ok := others[5].(time.Time); ok {
			cookie.Expires = v
			cookie.RawExpires = v.Format(time.UnixDate)
		}
	}

	ctx.Resp.Header().Add("Set-Cookie", cookie.String())
}

// GetCookie returns given cookie value from request header.
func (ctx *Context) GetCookie(name string) string {
	cookie, err := ctx.Req.Cookie(name)
	if err != nil {
		return ""
	}
	val, _ := url.QueryUnescape(cookie.Value)
	return val
}

// GetCookieInt returns cookie result in int type.
func (ctx *Context) GetCookieInt(name string) int {
	return com.StrTo(ctx.GetCookie(name)).MustInt()
}

// GetCookieInt64 returns cookie result in int64 type.
func (ctx *Context) GetCookieInt64(name string) int64 {
	return com.StrTo(ctx.GetCookie(name)).MustInt64()
}

// GetCookieFloat64 returns cookie result in float64 type.
func (ctx *Context) GetCookieFloat64(name string) float64 {
	v, _ := strconv.ParseFloat(ctx.GetCookie(name), 64)
	return v
}

var defaultCookieSecret string

// SetDefaultCookieSecret sets global default secure cookie secret.
func (m *Macaron) SetDefaultCookieSecret(secret string) {
	defaultCookieSecret = secret
}

// SetSecureCookie sets given cookie value to response header with default secret string.
func (ctx *Context) SetSecureCookie(name, value string, others ...interface{}) {
	ctx.SetSuperSecureCookie(defaultCookieSecret, name, value, others...)
}

// GetSecureCookie returns given cookie value from request header with default secret string.
func (ctx *Context) GetSecureCookie(key string) (string, bool) {
	return ctx.GetSuperSecureCookie(defaultCookieSecret, key)
}

// SetSuperSecureCookie sets given cookie value to response header with secret string.
func (ctx *Context) SetSuperSecureCookie(secret, name, value string, others ...interface{}) {
	key := pbkdf2.Key([]byte(secret), []byte(secret), 1000, 16, sha256.New)
	text, err := com.AESGCMEncrypt(key, []byte(value))
	if err != nil {
		panic("error encrypting cookie: " + err.Error())
	}

	ctx.SetCookie(name, hex.EncodeToString(text), others...)
}

// GetSuperSecureCookie returns given cookie value from request header with secret string.
func (ctx *Context) GetSuperSecureCookie(secret, name string) (string, bool) {
	val := ctx.GetCookie(name)
	if val == "" {
		return "", false
	}

	text, err := hex.DecodeString(val)
	if err != nil {
		return "", false
	}

	key := pbkdf2.Key([]byte(secret), []byte(secret), 1000, 16, sha256.New)
	text, err = com.AESGCMDecrypt(key, text)
	return string(text), err == nil
}

func (ctx *Context) setRawContentHeader() {
	ctx.Resp.Header().Set("Content-Description", "Raw content")
	ctx.Resp.Header().Set("Content-Type", "text/plain")
	ctx.Resp.Header().Set("Expires", "0")
	ctx.Resp.Header().Set("Cache-Control", "must-revalidate")
	ctx.Resp.Header().Set("Pragma", "public")
}

// ServeContent serves given content to response.
func (ctx *Context) ServeContent(name string, r io.ReadSeeker, params ...interface{}) {
	modtime := time.Now()
	for _, p := range params {
		switch v := p.(type) {
		case time.Time:
			modtime = v
		}
	}

	ctx.setRawContentHeader()
	http.ServeContent(ctx.Resp, ctx.Req.Request, name, modtime, r)
}

// ServeFileContent serves given file as content to response.
func (ctx *Context) ServeFileContent(file string, names ...string) {
	var name string
	if len(names) > 0 {
		name = names[0]
	} else {
		name = path.Base(file)
	}

	f, err := os.Open(file)
	if err != nil {
		if Env == PROD {
			http.Error(ctx.Resp, "Internal Server Error", 500)
		} else {
			http.Error(ctx.Resp, err.Error(), 500)
		}
		return
	}
	defer f.Close()

	ctx.setRawContentHeader()
	http.ServeContent(ctx.Resp, ctx.Req.Request, name, time.Now(), f)
}

// ServeFile serves given file to response.
func (ctx *Context) ServeFile(file string, names ...string) {
	var name string
	if len(names) > 0 {
		name = names[0]
	} else {
		name = path.Base(file)
	}
	ctx.Resp.Header().Set("Content-Description", "File Transfer")
	ctx.Resp.Header().Set("Content-Type", "application/octet-stream")
	ctx.Resp.Header().Set("Content-Disposition", "attachment; filename="+name)
	ctx.Resp.Header().Set("Content-Transfer-Encoding", "binary")
	ctx.Resp.Header().Set("Expires", "0")
	ctx.Resp.Header().Set("Cache-Control", "must-revalidate")
	ctx.Resp.Header().Set("Pragma", "public")
	http.ServeFile(ctx.Resp, ctx.Req.Request, file)
}

// ChangeStaticPath changes static path from old to new one.
func (ctx *Context) ChangeStaticPath(oldPath, newPath string) {
	if !filepath.IsAbs(oldPath) {
		oldPath = filepath.Join(Root, oldPath)
	}
	dir := statics.Get(oldPath)
	if dir != nil {
		statics.Delete(oldPath)

		if !filepath.IsAbs(newPath) {
			newPath = filepath.Join(Root, newPath)
		}
		*dir = http.Dir(newPath)
		statics.Set(dir)
	}
}
