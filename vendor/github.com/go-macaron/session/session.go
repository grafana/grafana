// Copyright 2013 Beego Authors
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

// Package session a middleware that provides the session management of Macaron.
package session

import (
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"gopkg.in/macaron.v1"
)

const _VERSION = "0.3.0"

func Version() string {
	return _VERSION
}

// RawStore is the interface that operates the session data.
type RawStore interface {
	// Set sets value to given key in session.
	Set(interface{}, interface{}) error
	// Get gets value by given key in session.
	Get(interface{}) interface{}
	// Delete deletes a key from session.
	Delete(interface{}) error
	// ID returns current session ID.
	ID() string
	// Release releases session resource and save data to provider.
	Release() error
	// Flush deletes all session data.
	Flush() error
}

// Store is the interface that contains all data for one session process with specific ID.
type Store interface {
	RawStore
	// Read returns raw session store by session ID.
	Read(string) (RawStore, error)
	// Destory deletes a session.
	Destory(*macaron.Context) error
	// RegenerateId regenerates a session store from old session ID to new one.
	RegenerateId(*macaron.Context) (RawStore, error)
	// Count counts and returns number of sessions.
	Count() int
	// GC calls GC to clean expired sessions.
	GC()
}

type store struct {
	RawStore
	*Manager
}

var _ Store = &store{}

// Options represents a struct for specifying configuration options for the session middleware.
type Options struct {
	// Name of provider. Default is "memory".
	Provider string
	// Provider configuration, it's corresponding to provider.
	ProviderConfig string
	// Cookie name to save session ID. Default is "MacaronSession".
	CookieName string
	// Cookie path to store. Default is "/".
	CookiePath string
	// GC interval time in seconds. Default is 3600.
	Gclifetime int64
	// Max life time in seconds. Default is whatever GC interval time is.
	Maxlifetime int64
	// Use HTTPS only. Default is false.
	Secure bool
	// Cookie life time. Default is 0.
	CookieLifeTime int
	// Cookie domain name. Default is empty.
	Domain string
	// Session ID length. Default is 16.
	IDLength int
	// Configuration section name. Default is "session".
	Section string
}

func prepareOptions(options []Options) Options {
	var opt Options
	if len(options) > 0 {
		opt = options[0]
	}
	if len(opt.Section) == 0 {
		opt.Section = "session"
	}
	sec := macaron.Config().Section(opt.Section)

	if len(opt.Provider) == 0 {
		opt.Provider = sec.Key("PROVIDER").MustString("memory")
	}
	if len(opt.ProviderConfig) == 0 {
		opt.ProviderConfig = sec.Key("PROVIDER_CONFIG").MustString("data/sessions")
	}
	if len(opt.CookieName) == 0 {
		opt.CookieName = sec.Key("COOKIE_NAME").MustString("MacaronSession")
	}
	if len(opt.CookiePath) == 0 {
		opt.CookiePath = sec.Key("COOKIE_PATH").MustString("/")
	}
	if opt.Gclifetime == 0 {
		opt.Gclifetime = sec.Key("GC_INTERVAL_TIME").MustInt64(3600)
	}
	if opt.Maxlifetime == 0 {
		opt.Maxlifetime = sec.Key("MAX_LIFE_TIME").MustInt64(opt.Gclifetime)
	}
	if !opt.Secure {
		opt.Secure = sec.Key("SECURE").MustBool()
	}
	if opt.CookieLifeTime == 0 {
		opt.CookieLifeTime = sec.Key("COOKIE_LIFE_TIME").MustInt()
	}
	if len(opt.Domain) == 0 {
		opt.Domain = sec.Key("DOMAIN").String()
	}
	if opt.IDLength == 0 {
		opt.IDLength = sec.Key("ID_LENGTH").MustInt(16)
	}

	return opt
}

// Sessioner is a middleware that maps a session.SessionStore service into the Macaron handler chain.
// An single variadic session.Options struct can be optionally provided to configure.
func Sessioner(options ...Options) macaron.Handler {
	opt := prepareOptions(options)
	manager, err := NewManager(opt.Provider, opt)
	if err != nil {
		panic(err)
	}
	go manager.startGC()

	return func(ctx *macaron.Context) {
		sess, err := manager.Start(ctx)
		if err != nil {
			panic("session(start): " + err.Error())
		}

		// Get flash.
		vals, _ := url.ParseQuery(ctx.GetCookie("macaron_flash"))
		if len(vals) > 0 {
			f := &Flash{Values: vals}
			f.ErrorMsg = f.Get("error")
			f.SuccessMsg = f.Get("success")
			f.InfoMsg = f.Get("info")
			f.WarningMsg = f.Get("warning")
			ctx.Data["Flash"] = f
			ctx.SetCookie("macaron_flash", "", -1, opt.CookiePath)
		}

		f := &Flash{ctx, url.Values{}, "", "", "", ""}
		ctx.Resp.Before(func(macaron.ResponseWriter) {
			if flash := f.Encode(); len(flash) > 0 {
				ctx.SetCookie("macaron_flash", flash, 0, opt.CookiePath)
			}
		})

		ctx.Map(f)
		s := store{
			RawStore: sess,
			Manager:  manager,
		}

		ctx.MapTo(s, (*Store)(nil))

		ctx.Next()

		if err = sess.Release(); err != nil {
			panic("session(release): " + err.Error())
		}
	}
}

// Provider is the interface that provides session manipulations.
type Provider interface {
	// Init initializes session provider.
	Init(gclifetime int64, config string) error
	// Read returns raw session store by session ID.
	Read(sid string) (RawStore, error)
	// Exist returns true if session with given ID exists.
	Exist(sid string) bool
	// Destory deletes a session by session ID.
	Destory(sid string) error
	// Regenerate regenerates a session store from old session ID to new one.
	Regenerate(oldsid, sid string) (RawStore, error)
	// Count counts and returns number of sessions.
	Count() int
	// GC calls GC to clean expired sessions.
	GC()
}

var providers = make(map[string]Provider)

// Register registers a provider.
func Register(name string, provider Provider) {
	if provider == nil {
		panic("session: cannot register provider with nil value")
	}
	if _, dup := providers[name]; dup {
		panic(fmt.Errorf("session: cannot register provider '%s' twice", name))
	}
	providers[name] = provider
}

//    _____
//   /     \ _____    ____ _____     ____   ___________
//  /  \ /  \\__  \  /    \\__  \   / ___\_/ __ \_  __ \
// /    Y    \/ __ \|   |  \/ __ \_/ /_/  >  ___/|  | \/
// \____|__  (____  /___|  (____  /\___  / \___  >__|
//         \/     \/     \/     \//_____/      \/

// Manager represents a struct that contains session provider and its configuration.
type Manager struct {
	provider Provider
	opt      Options
}

// NewManager creates and returns a new session manager by given provider name and configuration.
// It panics when given provider isn't registered.
func NewManager(name string, opt Options) (*Manager, error) {
	p, ok := providers[name]
	if !ok {
		return nil, fmt.Errorf("session: unknown provider '%s'(forgotten import?)", name)
	}
	return &Manager{p, opt}, p.Init(opt.Maxlifetime, opt.ProviderConfig)
}

// sessionId generates a new session ID with rand string, unix nano time, remote addr by hash function.
func (m *Manager) sessionId() string {
	return hex.EncodeToString(generateRandomKey(m.opt.IDLength / 2))
}

// Start starts a session by generating new one
// or retrieve existence one by reading session ID from HTTP request if it's valid.
func (m *Manager) Start(ctx *macaron.Context) (RawStore, error) {
	sid := ctx.GetCookie(m.opt.CookieName)
	if len(sid) > 0 && m.provider.Exist(sid) {
		return m.provider.Read(sid)
	}

	sid = m.sessionId()
	sess, err := m.provider.Read(sid)
	if err != nil {
		return nil, err
	}

	cookie := &http.Cookie{
		Name:     m.opt.CookieName,
		Value:    sid,
		Path:     m.opt.CookiePath,
		HttpOnly: true,
		Secure:   m.opt.Secure,
		Domain:   m.opt.Domain,
	}
	if m.opt.CookieLifeTime >= 0 {
		cookie.MaxAge = m.opt.CookieLifeTime
	}
	http.SetCookie(ctx.Resp, cookie)
	ctx.Req.AddCookie(cookie)
	return sess, nil
}

// Read returns raw session store by session ID.
func (m *Manager) Read(sid string) (RawStore, error) {
	return m.provider.Read(sid)
}

// Destory deletes a session by given ID.
func (m *Manager) Destory(ctx *macaron.Context) error {
	sid := ctx.GetCookie(m.opt.CookieName)
	if len(sid) == 0 {
		return nil
	}

	if err := m.provider.Destory(sid); err != nil {
		return err
	}
	cookie := &http.Cookie{
		Name:     m.opt.CookieName,
		Path:     m.opt.CookiePath,
		HttpOnly: true,
		Expires:  time.Now(),
		MaxAge:   -1,
	}
	http.SetCookie(ctx.Resp, cookie)
	return nil
}

// RegenerateId regenerates a session store from old session ID to new one.
func (m *Manager) RegenerateId(ctx *macaron.Context) (sess RawStore, err error) {
	sid := m.sessionId()
	oldsid := ctx.GetCookie(m.opt.CookieName)
	sess, err = m.provider.Regenerate(oldsid, sid)
	if err != nil {
		return nil, err
	}
	ck := &http.Cookie{
		Name:     m.opt.CookieName,
		Value:    sid,
		Path:     m.opt.CookiePath,
		HttpOnly: true,
		Secure:   m.opt.Secure,
		Domain:   m.opt.Domain,
	}
	if m.opt.CookieLifeTime >= 0 {
		ck.MaxAge = m.opt.CookieLifeTime
	}
	http.SetCookie(ctx.Resp, ck)
	ctx.Req.AddCookie(ck)
	return sess, nil
}

// Count counts and returns number of sessions.
func (m *Manager) Count() int {
	return m.provider.Count()
}

// GC starts GC job in a certain period.
func (m *Manager) GC() {
	m.provider.GC()
}

// startGC starts GC job in a certain period.
func (m *Manager) startGC() {
	m.GC()
	time.AfterFunc(time.Duration(m.opt.Gclifetime)*time.Second, func() { m.startGC() })
}

// SetSecure indicates whether to set cookie with HTTPS or not.
func (m *Manager) SetSecure(secure bool) {
	m.opt.Secure = secure
}

// ___________.____       _____    _________ ___ ___
// \_   _____/|    |     /  _  \  /   _____//   |   \
//  |    __)  |    |    /  /_\  \ \_____  \/    ~    \
//  |     \   |    |___/    |    \/        \    Y    /
//  \___  /   |_______ \____|__  /_______  /\___|_  /
//      \/            \/       \/        \/       \/

type Flash struct {
	ctx *macaron.Context
	url.Values
	ErrorMsg, WarningMsg, InfoMsg, SuccessMsg string
}

func (f *Flash) set(name, msg string, current ...bool) {
	isShow := false
	if (len(current) == 0 && macaron.FlashNow) ||
		(len(current) > 0 && current[0]) {
		isShow = true
	}

	if isShow {
		f.ctx.Data["Flash"] = f
	} else {
		f.Set(name, msg)
	}
}

func (f *Flash) Error(msg string, current ...bool) {
	f.ErrorMsg = msg
	f.set("error", msg, current...)
}

func (f *Flash) Warning(msg string, current ...bool) {
	f.WarningMsg = msg
	f.set("warning", msg, current...)
}

func (f *Flash) Info(msg string, current ...bool) {
	f.InfoMsg = msg
	f.set("info", msg, current...)
}

func (f *Flash) Success(msg string, current ...bool) {
	f.SuccessMsg = msg
	f.set("success", msg, current...)
}
