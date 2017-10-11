// Copyright (c) 2012, Sean Treadway, SoundCloud Ltd.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
// Source code and contact info at http://github.com/streadway/amqp

package amqp

import (
	"encoding/hex"
	"io"
	"testing"
)

type pipe struct {
	r *io.PipeReader
	w *io.PipeWriter
}

func (p pipe) Read(b []byte) (int, error) {
	return p.r.Read(b)
}

func (p pipe) Write(b []byte) (int, error) {
	return p.w.Write(b)
}

func (p pipe) Close() error {
	p.r.Close()
	p.w.Close()
	return nil
}

type logIO struct {
	t      *testing.T
	prefix string
	proxy  io.ReadWriteCloser
}

func (me *logIO) Read(p []byte) (n int, err error) {
	me.t.Logf("%s reading %d\n", me.prefix, len(p))
	n, err = me.proxy.Read(p)
	if err != nil {
		me.t.Logf("%s read %x: %v\n", me.prefix, p[0:n], err)
	} else {
		me.t.Logf("%s read:\n%s\n", me.prefix, hex.Dump(p[0:n]))
		//fmt.Printf("%s read:\n%s\n", me.prefix, hex.Dump(p[0:n]))
	}
	return
}

func (me *logIO) Write(p []byte) (n int, err error) {
	me.t.Logf("%s writing %d\n", me.prefix, len(p))
	n, err = me.proxy.Write(p)
	if err != nil {
		me.t.Logf("%s write %d, %x: %v\n", me.prefix, len(p), p[0:n], err)
	} else {
		me.t.Logf("%s write %d:\n%s", me.prefix, len(p), hex.Dump(p[0:n]))
		//fmt.Printf("%s write %d:\n%s", me.prefix, len(p), hex.Dump(p[0:n]))
	}
	return
}

func (me *logIO) Close() (err error) {
	err = me.proxy.Close()
	if err != nil {
		me.t.Logf("%s close : %v\n", me.prefix, err)
	} else {
		me.t.Logf("%s close\n", me.prefix, err)
	}
	return
}
