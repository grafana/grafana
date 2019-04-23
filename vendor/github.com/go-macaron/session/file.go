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

package session

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path"
	"path/filepath"
	"sync"
	"time"

	"github.com/Unknwon/com"
)

// FileStore represents a file session store implementation.
type FileStore struct {
	p    *FileProvider
	sid  string
	lock sync.RWMutex
	data map[interface{}]interface{}
}

// NewFileStore creates and returns a file session store.
func NewFileStore(p *FileProvider, sid string, kv map[interface{}]interface{}) *FileStore {
	return &FileStore{
		p:    p,
		sid:  sid,
		data: kv,
	}
}

// Set sets value to given key in session.
func (s *FileStore) Set(key, val interface{}) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.data[key] = val
	return nil
}

// Get gets value by given key in session.
func (s *FileStore) Get(key interface{}) interface{} {
	s.lock.RLock()
	defer s.lock.RUnlock()

	return s.data[key]
}

// Delete delete a key from session.
func (s *FileStore) Delete(key interface{}) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	delete(s.data, key)
	return nil
}

// ID returns current session ID.
func (s *FileStore) ID() string {
	return s.sid
}

// Release releases resource and save data to provider.
func (s *FileStore) Release() error {
	s.p.lock.Lock()
	defer s.p.lock.Unlock()

	// Skip encoding if the data is empty
	if len(s.data) == 0 {
		return nil
	}

	data, err := EncodeGob(s.data)
	if err != nil {
		return err
	}

	return ioutil.WriteFile(s.p.filepath(s.sid), data, 0600)
}

// Flush deletes all session data.
func (s *FileStore) Flush() error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.data = make(map[interface{}]interface{})
	return nil
}

// FileProvider represents a file session provider implementation.
type FileProvider struct {
	lock        sync.RWMutex
	maxlifetime int64
	rootPath    string
}

// Init initializes file session provider with given root path.
func (p *FileProvider) Init(maxlifetime int64, rootPath string) error {
	p.lock.Lock()
	p.maxlifetime = maxlifetime
	p.rootPath = rootPath
	p.lock.Unlock()
	return nil
}

func (p *FileProvider) filepath(sid string) string {
	return path.Join(p.rootPath, string(sid[0]), string(sid[1]), sid)
}

// Read returns raw session store by session ID.
func (p *FileProvider) Read(sid string) (_ RawStore, err error) {
	filename := p.filepath(sid)
	if err = os.MkdirAll(path.Dir(filename), 0700); err != nil {
		return nil, err
	}
	p.lock.RLock()
	defer p.lock.RUnlock()

	var f *os.File
	if com.IsFile(filename) {
		f, err = os.OpenFile(filename, os.O_RDONLY, 0600)
	} else {
		f, err = os.Create(filename)
	}
	if err != nil {
		return nil, err
	}
	defer f.Close()

	if err = os.Chtimes(filename, time.Now(), time.Now()); err != nil {
		return nil, err
	}

	var kv map[interface{}]interface{}
	data, err := ioutil.ReadAll(f)
	if err != nil {
		return nil, err
	}
	if len(data) == 0 {
		kv = make(map[interface{}]interface{})
	} else {
		kv, err = DecodeGob(data)
		if err != nil {
			return nil, err
		}
	}
	return NewFileStore(p, sid, kv), nil
}

// Exist returns true if session with given ID exists.
func (p *FileProvider) Exist(sid string) bool {
	p.lock.RLock()
	defer p.lock.RUnlock()
	return com.IsFile(p.filepath(sid))
}

// Destory deletes a session by session ID.
func (p *FileProvider) Destory(sid string) error {
	p.lock.Lock()
	defer p.lock.Unlock()
	return os.Remove(p.filepath(sid))
}

func (p *FileProvider) regenerate(oldsid, sid string) (err error) {
	p.lock.Lock()
	defer p.lock.Unlock()

	filename := p.filepath(sid)
	if com.IsExist(filename) {
		return fmt.Errorf("new sid '%s' already exists", sid)
	}

	oldname := p.filepath(oldsid)
	if !com.IsFile(oldname) {
		data, err := EncodeGob(make(map[interface{}]interface{}))
		if err != nil {
			return err
		}
		if err = os.MkdirAll(path.Dir(oldname), 0700); err != nil {
			return err
		}
		if err = ioutil.WriteFile(oldname, data, 0600); err != nil {
			return err
		}
	}

	if err = os.MkdirAll(path.Dir(filename), 0700); err != nil {
		return err
	}
	if err = os.Rename(oldname, filename); err != nil {
		return err
	}
	return nil
}

// Regenerate regenerates a session store from old session ID to new one.
func (p *FileProvider) Regenerate(oldsid, sid string) (_ RawStore, err error) {
	if err := p.regenerate(oldsid, sid); err != nil {
		return nil, err
	}

	return p.Read(sid)
}

// Count counts and returns number of sessions.
func (p *FileProvider) Count() int {
	count := 0
	if err := filepath.Walk(p.rootPath, func(path string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if !fi.IsDir() {
			count++
		}
		return nil
	}); err != nil {
		log.Printf("error counting session files: %v", err)
		return 0
	}
	return count
}

// GC calls GC to clean expired sessions.
func (p *FileProvider) GC() {
	p.lock.RLock()
	defer p.lock.RUnlock()

	if !com.IsExist(p.rootPath) {
		return
	}

	if err := filepath.Walk(p.rootPath, func(path string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if !fi.IsDir() &&
			(fi.ModTime().Unix()+p.maxlifetime) < time.Now().Unix() {
			return os.Remove(path)
		}
		return nil
	}); err != nil {
		log.Printf("error garbage collecting session files: %v", err)
	}
}

func init() {
	Register("file", &FileProvider{})
}
