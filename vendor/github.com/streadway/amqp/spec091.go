// Copyright (c) 2012, Sean Treadway, SoundCloud Ltd.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
// Source code and contact info at http://github.com/streadway/amqp

/* GENERATED FILE - DO NOT EDIT */
/* Rebuild from the spec/gen.go tool */

package amqp

import (
	"encoding/binary"
	"fmt"
	"io"
)

// Error codes that can be sent from the server during a connection or
// channel exception or used by the client to indicate a class of error like
// ErrCredentials.  The text of the error is likely more interesting than
// these constants.
const (
	frameMethod        = 1
	frameHeader        = 2
	frameBody          = 3
	frameHeartbeat     = 8
	frameMinSize       = 4096
	frameEnd           = 206
	replySuccess       = 200
	ContentTooLarge    = 311
	NoRoute            = 312
	NoConsumers        = 313
	ConnectionForced   = 320
	InvalidPath        = 402
	AccessRefused      = 403
	NotFound           = 404
	ResourceLocked     = 405
	PreconditionFailed = 406
	FrameError         = 501
	SyntaxError        = 502
	CommandInvalid     = 503
	ChannelError       = 504
	UnexpectedFrame    = 505
	ResourceError      = 506
	NotAllowed         = 530
	NotImplemented     = 540
	InternalError      = 541
)

func isSoftExceptionCode(code int) bool {
	switch code {
	case 311:
		return true
	case 312:
		return true
	case 313:
		return true
	case 403:
		return true
	case 404:
		return true
	case 405:
		return true
	case 406:
		return true

	}
	return false
}

type connectionStart struct {
	VersionMajor     byte
	VersionMinor     byte
	ServerProperties Table
	Mechanisms       string
	Locales          string
}

func (me *connectionStart) id() (uint16, uint16) {
	return 10, 10
}

func (me *connectionStart) wait() bool {
	return true
}

func (me *connectionStart) write(w io.Writer) (err error) {

	if err = binary.Write(w, binary.BigEndian, me.VersionMajor); err != nil {
		return
	}
	if err = binary.Write(w, binary.BigEndian, me.VersionMinor); err != nil {
		return
	}

	if err = writeTable(w, me.ServerProperties); err != nil {
		return
	}

	if err = writeLongstr(w, me.Mechanisms); err != nil {
		return
	}
	if err = writeLongstr(w, me.Locales); err != nil {
		return
	}

	return
}

func (me *connectionStart) read(r io.Reader) (err error) {

	if err = binary.Read(r, binary.BigEndian, &me.VersionMajor); err != nil {
		return
	}
	if err = binary.Read(r, binary.BigEndian, &me.VersionMinor); err != nil {
		return
	}

	if me.ServerProperties, err = readTable(r); err != nil {
		return
	}

	if me.Mechanisms, err = readLongstr(r); err != nil {
		return
	}
	if me.Locales, err = readLongstr(r); err != nil {
		return
	}

	return
}

type connectionStartOk struct {
	ClientProperties Table
	Mechanism        string
	Response         string
	Locale           string
}

func (me *connectionStartOk) id() (uint16, uint16) {
	return 10, 11
}

func (me *connectionStartOk) wait() bool {
	return true
}

func (me *connectionStartOk) write(w io.Writer) (err error) {

	if err = writeTable(w, me.ClientProperties); err != nil {
		return
	}

	if err = writeShortstr(w, me.Mechanism); err != nil {
		return
	}

	if err = writeLongstr(w, me.Response); err != nil {
		return
	}

	if err = writeShortstr(w, me.Locale); err != nil {
		return
	}

	return
}

func (me *connectionStartOk) read(r io.Reader) (err error) {

	if me.ClientProperties, err = readTable(r); err != nil {
		return
	}

	if me.Mechanism, err = readShortstr(r); err != nil {
		return
	}

	if me.Response, err = readLongstr(r); err != nil {
		return
	}

	if me.Locale, err = readShortstr(r); err != nil {
		return
	}

	return
}

type connectionSecure struct {
	Challenge string
}

func (me *connectionSecure) id() (uint16, uint16) {
	return 10, 20
}

func (me *connectionSecure) wait() bool {
	return true
}

func (me *connectionSecure) write(w io.Writer) (err error) {

	if err = writeLongstr(w, me.Challenge); err != nil {
		return
	}

	return
}

func (me *connectionSecure) read(r io.Reader) (err error) {

	if me.Challenge, err = readLongstr(r); err != nil {
		return
	}

	return
}

type connectionSecureOk struct {
	Response string
}

func (me *connectionSecureOk) id() (uint16, uint16) {
	return 10, 21
}

func (me *connectionSecureOk) wait() bool {
	return true
}

func (me *connectionSecureOk) write(w io.Writer) (err error) {

	if err = writeLongstr(w, me.Response); err != nil {
		return
	}

	return
}

func (me *connectionSecureOk) read(r io.Reader) (err error) {

	if me.Response, err = readLongstr(r); err != nil {
		return
	}

	return
}

type connectionTune struct {
	ChannelMax uint16
	FrameMax   uint32
	Heartbeat  uint16
}

func (me *connectionTune) id() (uint16, uint16) {
	return 10, 30
}

func (me *connectionTune) wait() bool {
	return true
}

func (me *connectionTune) write(w io.Writer) (err error) {

	if err = binary.Write(w, binary.BigEndian, me.ChannelMax); err != nil {
		return
	}

	if err = binary.Write(w, binary.BigEndian, me.FrameMax); err != nil {
		return
	}

	if err = binary.Write(w, binary.BigEndian, me.Heartbeat); err != nil {
		return
	}

	return
}

func (me *connectionTune) read(r io.Reader) (err error) {

	if err = binary.Read(r, binary.BigEndian, &me.ChannelMax); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &me.FrameMax); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &me.Heartbeat); err != nil {
		return
	}

	return
}

type connectionTuneOk struct {
	ChannelMax uint16
	FrameMax   uint32
	Heartbeat  uint16
}

func (me *connectionTuneOk) id() (uint16, uint16) {
	return 10, 31
}

func (me *connectionTuneOk) wait() bool {
	return true
}

func (me *connectionTuneOk) write(w io.Writer) (err error) {

	if err = binary.Write(w, binary.BigEndian, me.ChannelMax); err != nil {
		return
	}

	if err = binary.Write(w, binary.BigEndian, me.FrameMax); err != nil {
		return
	}

	if err = binary.Write(w, binary.BigEndian, me.Heartbeat); err != nil {
		return
	}

	return
}

func (me *connectionTuneOk) read(r io.Reader) (err error) {

	if err = binary.Read(r, binary.BigEndian, &me.ChannelMax); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &me.FrameMax); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &me.Heartbeat); err != nil {
		return
	}

	return
}

type connectionOpen struct {
	VirtualHost string
	reserved1   string
	reserved2   bool
}

func (me *connectionOpen) id() (uint16, uint16) {
	return 10, 40
}

func (me *connectionOpen) wait() bool {
	return true
}

func (me *connectionOpen) write(w io.Writer) (err error) {
	var bits byte

	if err = writeShortstr(w, me.VirtualHost); err != nil {
		return
	}
	if err = writeShortstr(w, me.reserved1); err != nil {
		return
	}

	if me.reserved2 {
		bits |= 1 << 0
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	return
}

func (me *connectionOpen) read(r io.Reader) (err error) {
	var bits byte

	if me.VirtualHost, err = readShortstr(r); err != nil {
		return
	}
	if me.reserved1, err = readShortstr(r); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.reserved2 = (bits&(1<<0) > 0)

	return
}

type connectionOpenOk struct {
	reserved1 string
}

func (me *connectionOpenOk) id() (uint16, uint16) {
	return 10, 41
}

func (me *connectionOpenOk) wait() bool {
	return true
}

func (me *connectionOpenOk) write(w io.Writer) (err error) {

	if err = writeShortstr(w, me.reserved1); err != nil {
		return
	}

	return
}

func (me *connectionOpenOk) read(r io.Reader) (err error) {

	if me.reserved1, err = readShortstr(r); err != nil {
		return
	}

	return
}

type connectionClose struct {
	ReplyCode uint16
	ReplyText string
	ClassId   uint16
	MethodId  uint16
}

func (me *connectionClose) id() (uint16, uint16) {
	return 10, 50
}

func (me *connectionClose) wait() bool {
	return true
}

func (me *connectionClose) write(w io.Writer) (err error) {

	if err = binary.Write(w, binary.BigEndian, me.ReplyCode); err != nil {
		return
	}

	if err = writeShortstr(w, me.ReplyText); err != nil {
		return
	}

	if err = binary.Write(w, binary.BigEndian, me.ClassId); err != nil {
		return
	}
	if err = binary.Write(w, binary.BigEndian, me.MethodId); err != nil {
		return
	}

	return
}

func (me *connectionClose) read(r io.Reader) (err error) {

	if err = binary.Read(r, binary.BigEndian, &me.ReplyCode); err != nil {
		return
	}

	if me.ReplyText, err = readShortstr(r); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &me.ClassId); err != nil {
		return
	}
	if err = binary.Read(r, binary.BigEndian, &me.MethodId); err != nil {
		return
	}

	return
}

type connectionCloseOk struct {
}

func (me *connectionCloseOk) id() (uint16, uint16) {
	return 10, 51
}

func (me *connectionCloseOk) wait() bool {
	return true
}

func (me *connectionCloseOk) write(w io.Writer) (err error) {

	return
}

func (me *connectionCloseOk) read(r io.Reader) (err error) {

	return
}

type connectionBlocked struct {
	Reason string
}

func (me *connectionBlocked) id() (uint16, uint16) {
	return 10, 60
}

func (me *connectionBlocked) wait() bool {
	return false
}

func (me *connectionBlocked) write(w io.Writer) (err error) {

	if err = writeShortstr(w, me.Reason); err != nil {
		return
	}

	return
}

func (me *connectionBlocked) read(r io.Reader) (err error) {

	if me.Reason, err = readShortstr(r); err != nil {
		return
	}

	return
}

type connectionUnblocked struct {
}

func (me *connectionUnblocked) id() (uint16, uint16) {
	return 10, 61
}

func (me *connectionUnblocked) wait() bool {
	return false
}

func (me *connectionUnblocked) write(w io.Writer) (err error) {

	return
}

func (me *connectionUnblocked) read(r io.Reader) (err error) {

	return
}

type channelOpen struct {
	reserved1 string
}

func (me *channelOpen) id() (uint16, uint16) {
	return 20, 10
}

func (me *channelOpen) wait() bool {
	return true
}

func (me *channelOpen) write(w io.Writer) (err error) {

	if err = writeShortstr(w, me.reserved1); err != nil {
		return
	}

	return
}

func (me *channelOpen) read(r io.Reader) (err error) {

	if me.reserved1, err = readShortstr(r); err != nil {
		return
	}

	return
}

type channelOpenOk struct {
	reserved1 string
}

func (me *channelOpenOk) id() (uint16, uint16) {
	return 20, 11
}

func (me *channelOpenOk) wait() bool {
	return true
}

func (me *channelOpenOk) write(w io.Writer) (err error) {

	if err = writeLongstr(w, me.reserved1); err != nil {
		return
	}

	return
}

func (me *channelOpenOk) read(r io.Reader) (err error) {

	if me.reserved1, err = readLongstr(r); err != nil {
		return
	}

	return
}

type channelFlow struct {
	Active bool
}

func (me *channelFlow) id() (uint16, uint16) {
	return 20, 20
}

func (me *channelFlow) wait() bool {
	return true
}

func (me *channelFlow) write(w io.Writer) (err error) {
	var bits byte

	if me.Active {
		bits |= 1 << 0
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	return
}

func (me *channelFlow) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.Active = (bits&(1<<0) > 0)

	return
}

type channelFlowOk struct {
	Active bool
}

func (me *channelFlowOk) id() (uint16, uint16) {
	return 20, 21
}

func (me *channelFlowOk) wait() bool {
	return false
}

func (me *channelFlowOk) write(w io.Writer) (err error) {
	var bits byte

	if me.Active {
		bits |= 1 << 0
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	return
}

func (me *channelFlowOk) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.Active = (bits&(1<<0) > 0)

	return
}

type channelClose struct {
	ReplyCode uint16
	ReplyText string
	ClassId   uint16
	MethodId  uint16
}

func (me *channelClose) id() (uint16, uint16) {
	return 20, 40
}

func (me *channelClose) wait() bool {
	return true
}

func (me *channelClose) write(w io.Writer) (err error) {

	if err = binary.Write(w, binary.BigEndian, me.ReplyCode); err != nil {
		return
	}

	if err = writeShortstr(w, me.ReplyText); err != nil {
		return
	}

	if err = binary.Write(w, binary.BigEndian, me.ClassId); err != nil {
		return
	}
	if err = binary.Write(w, binary.BigEndian, me.MethodId); err != nil {
		return
	}

	return
}

func (me *channelClose) read(r io.Reader) (err error) {

	if err = binary.Read(r, binary.BigEndian, &me.ReplyCode); err != nil {
		return
	}

	if me.ReplyText, err = readShortstr(r); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &me.ClassId); err != nil {
		return
	}
	if err = binary.Read(r, binary.BigEndian, &me.MethodId); err != nil {
		return
	}

	return
}

type channelCloseOk struct {
}

func (me *channelCloseOk) id() (uint16, uint16) {
	return 20, 41
}

func (me *channelCloseOk) wait() bool {
	return true
}

func (me *channelCloseOk) write(w io.Writer) (err error) {

	return
}

func (me *channelCloseOk) read(r io.Reader) (err error) {

	return
}

type exchangeDeclare struct {
	reserved1  uint16
	Exchange   string
	Type       string
	Passive    bool
	Durable    bool
	AutoDelete bool
	Internal   bool
	NoWait     bool
	Arguments  Table
}

func (me *exchangeDeclare) id() (uint16, uint16) {
	return 40, 10
}

func (me *exchangeDeclare) wait() bool {
	return true && !me.NoWait
}

func (me *exchangeDeclare) write(w io.Writer) (err error) {
	var bits byte

	if err = binary.Write(w, binary.BigEndian, me.reserved1); err != nil {
		return
	}

	if err = writeShortstr(w, me.Exchange); err != nil {
		return
	}
	if err = writeShortstr(w, me.Type); err != nil {
		return
	}

	if me.Passive {
		bits |= 1 << 0
	}

	if me.Durable {
		bits |= 1 << 1
	}

	if me.AutoDelete {
		bits |= 1 << 2
	}

	if me.Internal {
		bits |= 1 << 3
	}

	if me.NoWait {
		bits |= 1 << 4
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	if err = writeTable(w, me.Arguments); err != nil {
		return
	}

	return
}

func (me *exchangeDeclare) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &me.reserved1); err != nil {
		return
	}

	if me.Exchange, err = readShortstr(r); err != nil {
		return
	}
	if me.Type, err = readShortstr(r); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.Passive = (bits&(1<<0) > 0)
	me.Durable = (bits&(1<<1) > 0)
	me.AutoDelete = (bits&(1<<2) > 0)
	me.Internal = (bits&(1<<3) > 0)
	me.NoWait = (bits&(1<<4) > 0)

	if me.Arguments, err = readTable(r); err != nil {
		return
	}

	return
}

type exchangeDeclareOk struct {
}

func (me *exchangeDeclareOk) id() (uint16, uint16) {
	return 40, 11
}

func (me *exchangeDeclareOk) wait() bool {
	return true
}

func (me *exchangeDeclareOk) write(w io.Writer) (err error) {

	return
}

func (me *exchangeDeclareOk) read(r io.Reader) (err error) {

	return
}

type exchangeDelete struct {
	reserved1 uint16
	Exchange  string
	IfUnused  bool
	NoWait    bool
}

func (me *exchangeDelete) id() (uint16, uint16) {
	return 40, 20
}

func (me *exchangeDelete) wait() bool {
	return true && !me.NoWait
}

func (me *exchangeDelete) write(w io.Writer) (err error) {
	var bits byte

	if err = binary.Write(w, binary.BigEndian, me.reserved1); err != nil {
		return
	}

	if err = writeShortstr(w, me.Exchange); err != nil {
		return
	}

	if me.IfUnused {
		bits |= 1 << 0
	}

	if me.NoWait {
		bits |= 1 << 1
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	return
}

func (me *exchangeDelete) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &me.reserved1); err != nil {
		return
	}

	if me.Exchange, err = readShortstr(r); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.IfUnused = (bits&(1<<0) > 0)
	me.NoWait = (bits&(1<<1) > 0)

	return
}

type exchangeDeleteOk struct {
}

func (me *exchangeDeleteOk) id() (uint16, uint16) {
	return 40, 21
}

func (me *exchangeDeleteOk) wait() bool {
	return true
}

func (me *exchangeDeleteOk) write(w io.Writer) (err error) {

	return
}

func (me *exchangeDeleteOk) read(r io.Reader) (err error) {

	return
}

type exchangeBind struct {
	reserved1   uint16
	Destination string
	Source      string
	RoutingKey  string
	NoWait      bool
	Arguments   Table
}

func (me *exchangeBind) id() (uint16, uint16) {
	return 40, 30
}

func (me *exchangeBind) wait() bool {
	return true && !me.NoWait
}

func (me *exchangeBind) write(w io.Writer) (err error) {
	var bits byte

	if err = binary.Write(w, binary.BigEndian, me.reserved1); err != nil {
		return
	}

	if err = writeShortstr(w, me.Destination); err != nil {
		return
	}
	if err = writeShortstr(w, me.Source); err != nil {
		return
	}
	if err = writeShortstr(w, me.RoutingKey); err != nil {
		return
	}

	if me.NoWait {
		bits |= 1 << 0
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	if err = writeTable(w, me.Arguments); err != nil {
		return
	}

	return
}

func (me *exchangeBind) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &me.reserved1); err != nil {
		return
	}

	if me.Destination, err = readShortstr(r); err != nil {
		return
	}
	if me.Source, err = readShortstr(r); err != nil {
		return
	}
	if me.RoutingKey, err = readShortstr(r); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.NoWait = (bits&(1<<0) > 0)

	if me.Arguments, err = readTable(r); err != nil {
		return
	}

	return
}

type exchangeBindOk struct {
}

func (me *exchangeBindOk) id() (uint16, uint16) {
	return 40, 31
}

func (me *exchangeBindOk) wait() bool {
	return true
}

func (me *exchangeBindOk) write(w io.Writer) (err error) {

	return
}

func (me *exchangeBindOk) read(r io.Reader) (err error) {

	return
}

type exchangeUnbind struct {
	reserved1   uint16
	Destination string
	Source      string
	RoutingKey  string
	NoWait      bool
	Arguments   Table
}

func (me *exchangeUnbind) id() (uint16, uint16) {
	return 40, 40
}

func (me *exchangeUnbind) wait() bool {
	return true && !me.NoWait
}

func (me *exchangeUnbind) write(w io.Writer) (err error) {
	var bits byte

	if err = binary.Write(w, binary.BigEndian, me.reserved1); err != nil {
		return
	}

	if err = writeShortstr(w, me.Destination); err != nil {
		return
	}
	if err = writeShortstr(w, me.Source); err != nil {
		return
	}
	if err = writeShortstr(w, me.RoutingKey); err != nil {
		return
	}

	if me.NoWait {
		bits |= 1 << 0
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	if err = writeTable(w, me.Arguments); err != nil {
		return
	}

	return
}

func (me *exchangeUnbind) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &me.reserved1); err != nil {
		return
	}

	if me.Destination, err = readShortstr(r); err != nil {
		return
	}
	if me.Source, err = readShortstr(r); err != nil {
		return
	}
	if me.RoutingKey, err = readShortstr(r); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.NoWait = (bits&(1<<0) > 0)

	if me.Arguments, err = readTable(r); err != nil {
		return
	}

	return
}

type exchangeUnbindOk struct {
}

func (me *exchangeUnbindOk) id() (uint16, uint16) {
	return 40, 51
}

func (me *exchangeUnbindOk) wait() bool {
	return true
}

func (me *exchangeUnbindOk) write(w io.Writer) (err error) {

	return
}

func (me *exchangeUnbindOk) read(r io.Reader) (err error) {

	return
}

type queueDeclare struct {
	reserved1  uint16
	Queue      string
	Passive    bool
	Durable    bool
	Exclusive  bool
	AutoDelete bool
	NoWait     bool
	Arguments  Table
}

func (me *queueDeclare) id() (uint16, uint16) {
	return 50, 10
}

func (me *queueDeclare) wait() bool {
	return true && !me.NoWait
}

func (me *queueDeclare) write(w io.Writer) (err error) {
	var bits byte

	if err = binary.Write(w, binary.BigEndian, me.reserved1); err != nil {
		return
	}

	if err = writeShortstr(w, me.Queue); err != nil {
		return
	}

	if me.Passive {
		bits |= 1 << 0
	}

	if me.Durable {
		bits |= 1 << 1
	}

	if me.Exclusive {
		bits |= 1 << 2
	}

	if me.AutoDelete {
		bits |= 1 << 3
	}

	if me.NoWait {
		bits |= 1 << 4
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	if err = writeTable(w, me.Arguments); err != nil {
		return
	}

	return
}

func (me *queueDeclare) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &me.reserved1); err != nil {
		return
	}

	if me.Queue, err = readShortstr(r); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.Passive = (bits&(1<<0) > 0)
	me.Durable = (bits&(1<<1) > 0)
	me.Exclusive = (bits&(1<<2) > 0)
	me.AutoDelete = (bits&(1<<3) > 0)
	me.NoWait = (bits&(1<<4) > 0)

	if me.Arguments, err = readTable(r); err != nil {
		return
	}

	return
}

type queueDeclareOk struct {
	Queue         string
	MessageCount  uint32
	ConsumerCount uint32
}

func (me *queueDeclareOk) id() (uint16, uint16) {
	return 50, 11
}

func (me *queueDeclareOk) wait() bool {
	return true
}

func (me *queueDeclareOk) write(w io.Writer) (err error) {

	if err = writeShortstr(w, me.Queue); err != nil {
		return
	}

	if err = binary.Write(w, binary.BigEndian, me.MessageCount); err != nil {
		return
	}
	if err = binary.Write(w, binary.BigEndian, me.ConsumerCount); err != nil {
		return
	}

	return
}

func (me *queueDeclareOk) read(r io.Reader) (err error) {

	if me.Queue, err = readShortstr(r); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &me.MessageCount); err != nil {
		return
	}
	if err = binary.Read(r, binary.BigEndian, &me.ConsumerCount); err != nil {
		return
	}

	return
}

type queueBind struct {
	reserved1  uint16
	Queue      string
	Exchange   string
	RoutingKey string
	NoWait     bool
	Arguments  Table
}

func (me *queueBind) id() (uint16, uint16) {
	return 50, 20
}

func (me *queueBind) wait() bool {
	return true && !me.NoWait
}

func (me *queueBind) write(w io.Writer) (err error) {
	var bits byte

	if err = binary.Write(w, binary.BigEndian, me.reserved1); err != nil {
		return
	}

	if err = writeShortstr(w, me.Queue); err != nil {
		return
	}
	if err = writeShortstr(w, me.Exchange); err != nil {
		return
	}
	if err = writeShortstr(w, me.RoutingKey); err != nil {
		return
	}

	if me.NoWait {
		bits |= 1 << 0
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	if err = writeTable(w, me.Arguments); err != nil {
		return
	}

	return
}

func (me *queueBind) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &me.reserved1); err != nil {
		return
	}

	if me.Queue, err = readShortstr(r); err != nil {
		return
	}
	if me.Exchange, err = readShortstr(r); err != nil {
		return
	}
	if me.RoutingKey, err = readShortstr(r); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.NoWait = (bits&(1<<0) > 0)

	if me.Arguments, err = readTable(r); err != nil {
		return
	}

	return
}

type queueBindOk struct {
}

func (me *queueBindOk) id() (uint16, uint16) {
	return 50, 21
}

func (me *queueBindOk) wait() bool {
	return true
}

func (me *queueBindOk) write(w io.Writer) (err error) {

	return
}

func (me *queueBindOk) read(r io.Reader) (err error) {

	return
}

type queueUnbind struct {
	reserved1  uint16
	Queue      string
	Exchange   string
	RoutingKey string
	Arguments  Table
}

func (me *queueUnbind) id() (uint16, uint16) {
	return 50, 50
}

func (me *queueUnbind) wait() bool {
	return true
}

func (me *queueUnbind) write(w io.Writer) (err error) {

	if err = binary.Write(w, binary.BigEndian, me.reserved1); err != nil {
		return
	}

	if err = writeShortstr(w, me.Queue); err != nil {
		return
	}
	if err = writeShortstr(w, me.Exchange); err != nil {
		return
	}
	if err = writeShortstr(w, me.RoutingKey); err != nil {
		return
	}

	if err = writeTable(w, me.Arguments); err != nil {
		return
	}

	return
}

func (me *queueUnbind) read(r io.Reader) (err error) {

	if err = binary.Read(r, binary.BigEndian, &me.reserved1); err != nil {
		return
	}

	if me.Queue, err = readShortstr(r); err != nil {
		return
	}
	if me.Exchange, err = readShortstr(r); err != nil {
		return
	}
	if me.RoutingKey, err = readShortstr(r); err != nil {
		return
	}

	if me.Arguments, err = readTable(r); err != nil {
		return
	}

	return
}

type queueUnbindOk struct {
}

func (me *queueUnbindOk) id() (uint16, uint16) {
	return 50, 51
}

func (me *queueUnbindOk) wait() bool {
	return true
}

func (me *queueUnbindOk) write(w io.Writer) (err error) {

	return
}

func (me *queueUnbindOk) read(r io.Reader) (err error) {

	return
}

type queuePurge struct {
	reserved1 uint16
	Queue     string
	NoWait    bool
}

func (me *queuePurge) id() (uint16, uint16) {
	return 50, 30
}

func (me *queuePurge) wait() bool {
	return true && !me.NoWait
}

func (me *queuePurge) write(w io.Writer) (err error) {
	var bits byte

	if err = binary.Write(w, binary.BigEndian, me.reserved1); err != nil {
		return
	}

	if err = writeShortstr(w, me.Queue); err != nil {
		return
	}

	if me.NoWait {
		bits |= 1 << 0
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	return
}

func (me *queuePurge) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &me.reserved1); err != nil {
		return
	}

	if me.Queue, err = readShortstr(r); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.NoWait = (bits&(1<<0) > 0)

	return
}

type queuePurgeOk struct {
	MessageCount uint32
}

func (me *queuePurgeOk) id() (uint16, uint16) {
	return 50, 31
}

func (me *queuePurgeOk) wait() bool {
	return true
}

func (me *queuePurgeOk) write(w io.Writer) (err error) {

	if err = binary.Write(w, binary.BigEndian, me.MessageCount); err != nil {
		return
	}

	return
}

func (me *queuePurgeOk) read(r io.Reader) (err error) {

	if err = binary.Read(r, binary.BigEndian, &me.MessageCount); err != nil {
		return
	}

	return
}

type queueDelete struct {
	reserved1 uint16
	Queue     string
	IfUnused  bool
	IfEmpty   bool
	NoWait    bool
}

func (me *queueDelete) id() (uint16, uint16) {
	return 50, 40
}

func (me *queueDelete) wait() bool {
	return true && !me.NoWait
}

func (me *queueDelete) write(w io.Writer) (err error) {
	var bits byte

	if err = binary.Write(w, binary.BigEndian, me.reserved1); err != nil {
		return
	}

	if err = writeShortstr(w, me.Queue); err != nil {
		return
	}

	if me.IfUnused {
		bits |= 1 << 0
	}

	if me.IfEmpty {
		bits |= 1 << 1
	}

	if me.NoWait {
		bits |= 1 << 2
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	return
}

func (me *queueDelete) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &me.reserved1); err != nil {
		return
	}

	if me.Queue, err = readShortstr(r); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.IfUnused = (bits&(1<<0) > 0)
	me.IfEmpty = (bits&(1<<1) > 0)
	me.NoWait = (bits&(1<<2) > 0)

	return
}

type queueDeleteOk struct {
	MessageCount uint32
}

func (me *queueDeleteOk) id() (uint16, uint16) {
	return 50, 41
}

func (me *queueDeleteOk) wait() bool {
	return true
}

func (me *queueDeleteOk) write(w io.Writer) (err error) {

	if err = binary.Write(w, binary.BigEndian, me.MessageCount); err != nil {
		return
	}

	return
}

func (me *queueDeleteOk) read(r io.Reader) (err error) {

	if err = binary.Read(r, binary.BigEndian, &me.MessageCount); err != nil {
		return
	}

	return
}

type basicQos struct {
	PrefetchSize  uint32
	PrefetchCount uint16
	Global        bool
}

func (me *basicQos) id() (uint16, uint16) {
	return 60, 10
}

func (me *basicQos) wait() bool {
	return true
}

func (me *basicQos) write(w io.Writer) (err error) {
	var bits byte

	if err = binary.Write(w, binary.BigEndian, me.PrefetchSize); err != nil {
		return
	}

	if err = binary.Write(w, binary.BigEndian, me.PrefetchCount); err != nil {
		return
	}

	if me.Global {
		bits |= 1 << 0
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	return
}

func (me *basicQos) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &me.PrefetchSize); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &me.PrefetchCount); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.Global = (bits&(1<<0) > 0)

	return
}

type basicQosOk struct {
}

func (me *basicQosOk) id() (uint16, uint16) {
	return 60, 11
}

func (me *basicQosOk) wait() bool {
	return true
}

func (me *basicQosOk) write(w io.Writer) (err error) {

	return
}

func (me *basicQosOk) read(r io.Reader) (err error) {

	return
}

type basicConsume struct {
	reserved1   uint16
	Queue       string
	ConsumerTag string
	NoLocal     bool
	NoAck       bool
	Exclusive   bool
	NoWait      bool
	Arguments   Table
}

func (me *basicConsume) id() (uint16, uint16) {
	return 60, 20
}

func (me *basicConsume) wait() bool {
	return true && !me.NoWait
}

func (me *basicConsume) write(w io.Writer) (err error) {
	var bits byte

	if err = binary.Write(w, binary.BigEndian, me.reserved1); err != nil {
		return
	}

	if err = writeShortstr(w, me.Queue); err != nil {
		return
	}
	if err = writeShortstr(w, me.ConsumerTag); err != nil {
		return
	}

	if me.NoLocal {
		bits |= 1 << 0
	}

	if me.NoAck {
		bits |= 1 << 1
	}

	if me.Exclusive {
		bits |= 1 << 2
	}

	if me.NoWait {
		bits |= 1 << 3
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	if err = writeTable(w, me.Arguments); err != nil {
		return
	}

	return
}

func (me *basicConsume) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &me.reserved1); err != nil {
		return
	}

	if me.Queue, err = readShortstr(r); err != nil {
		return
	}
	if me.ConsumerTag, err = readShortstr(r); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.NoLocal = (bits&(1<<0) > 0)
	me.NoAck = (bits&(1<<1) > 0)
	me.Exclusive = (bits&(1<<2) > 0)
	me.NoWait = (bits&(1<<3) > 0)

	if me.Arguments, err = readTable(r); err != nil {
		return
	}

	return
}

type basicConsumeOk struct {
	ConsumerTag string
}

func (me *basicConsumeOk) id() (uint16, uint16) {
	return 60, 21
}

func (me *basicConsumeOk) wait() bool {
	return true
}

func (me *basicConsumeOk) write(w io.Writer) (err error) {

	if err = writeShortstr(w, me.ConsumerTag); err != nil {
		return
	}

	return
}

func (me *basicConsumeOk) read(r io.Reader) (err error) {

	if me.ConsumerTag, err = readShortstr(r); err != nil {
		return
	}

	return
}

type basicCancel struct {
	ConsumerTag string
	NoWait      bool
}

func (me *basicCancel) id() (uint16, uint16) {
	return 60, 30
}

func (me *basicCancel) wait() bool {
	return true && !me.NoWait
}

func (me *basicCancel) write(w io.Writer) (err error) {
	var bits byte

	if err = writeShortstr(w, me.ConsumerTag); err != nil {
		return
	}

	if me.NoWait {
		bits |= 1 << 0
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	return
}

func (me *basicCancel) read(r io.Reader) (err error) {
	var bits byte

	if me.ConsumerTag, err = readShortstr(r); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.NoWait = (bits&(1<<0) > 0)

	return
}

type basicCancelOk struct {
	ConsumerTag string
}

func (me *basicCancelOk) id() (uint16, uint16) {
	return 60, 31
}

func (me *basicCancelOk) wait() bool {
	return true
}

func (me *basicCancelOk) write(w io.Writer) (err error) {

	if err = writeShortstr(w, me.ConsumerTag); err != nil {
		return
	}

	return
}

func (me *basicCancelOk) read(r io.Reader) (err error) {

	if me.ConsumerTag, err = readShortstr(r); err != nil {
		return
	}

	return
}

type basicPublish struct {
	reserved1  uint16
	Exchange   string
	RoutingKey string
	Mandatory  bool
	Immediate  bool
	Properties properties
	Body       []byte
}

func (me *basicPublish) id() (uint16, uint16) {
	return 60, 40
}

func (me *basicPublish) wait() bool {
	return false
}

func (me *basicPublish) getContent() (properties, []byte) {
	return me.Properties, me.Body
}

func (me *basicPublish) setContent(props properties, body []byte) {
	me.Properties, me.Body = props, body
}

func (me *basicPublish) write(w io.Writer) (err error) {
	var bits byte

	if err = binary.Write(w, binary.BigEndian, me.reserved1); err != nil {
		return
	}

	if err = writeShortstr(w, me.Exchange); err != nil {
		return
	}
	if err = writeShortstr(w, me.RoutingKey); err != nil {
		return
	}

	if me.Mandatory {
		bits |= 1 << 0
	}

	if me.Immediate {
		bits |= 1 << 1
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	return
}

func (me *basicPublish) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &me.reserved1); err != nil {
		return
	}

	if me.Exchange, err = readShortstr(r); err != nil {
		return
	}
	if me.RoutingKey, err = readShortstr(r); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.Mandatory = (bits&(1<<0) > 0)
	me.Immediate = (bits&(1<<1) > 0)

	return
}

type basicReturn struct {
	ReplyCode  uint16
	ReplyText  string
	Exchange   string
	RoutingKey string
	Properties properties
	Body       []byte
}

func (me *basicReturn) id() (uint16, uint16) {
	return 60, 50
}

func (me *basicReturn) wait() bool {
	return false
}

func (me *basicReturn) getContent() (properties, []byte) {
	return me.Properties, me.Body
}

func (me *basicReturn) setContent(props properties, body []byte) {
	me.Properties, me.Body = props, body
}

func (me *basicReturn) write(w io.Writer) (err error) {

	if err = binary.Write(w, binary.BigEndian, me.ReplyCode); err != nil {
		return
	}

	if err = writeShortstr(w, me.ReplyText); err != nil {
		return
	}
	if err = writeShortstr(w, me.Exchange); err != nil {
		return
	}
	if err = writeShortstr(w, me.RoutingKey); err != nil {
		return
	}

	return
}

func (me *basicReturn) read(r io.Reader) (err error) {

	if err = binary.Read(r, binary.BigEndian, &me.ReplyCode); err != nil {
		return
	}

	if me.ReplyText, err = readShortstr(r); err != nil {
		return
	}
	if me.Exchange, err = readShortstr(r); err != nil {
		return
	}
	if me.RoutingKey, err = readShortstr(r); err != nil {
		return
	}

	return
}

type basicDeliver struct {
	ConsumerTag string
	DeliveryTag uint64
	Redelivered bool
	Exchange    string
	RoutingKey  string
	Properties  properties
	Body        []byte
}

func (me *basicDeliver) id() (uint16, uint16) {
	return 60, 60
}

func (me *basicDeliver) wait() bool {
	return false
}

func (me *basicDeliver) getContent() (properties, []byte) {
	return me.Properties, me.Body
}

func (me *basicDeliver) setContent(props properties, body []byte) {
	me.Properties, me.Body = props, body
}

func (me *basicDeliver) write(w io.Writer) (err error) {
	var bits byte

	if err = writeShortstr(w, me.ConsumerTag); err != nil {
		return
	}

	if err = binary.Write(w, binary.BigEndian, me.DeliveryTag); err != nil {
		return
	}

	if me.Redelivered {
		bits |= 1 << 0
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	if err = writeShortstr(w, me.Exchange); err != nil {
		return
	}
	if err = writeShortstr(w, me.RoutingKey); err != nil {
		return
	}

	return
}

func (me *basicDeliver) read(r io.Reader) (err error) {
	var bits byte

	if me.ConsumerTag, err = readShortstr(r); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &me.DeliveryTag); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.Redelivered = (bits&(1<<0) > 0)

	if me.Exchange, err = readShortstr(r); err != nil {
		return
	}
	if me.RoutingKey, err = readShortstr(r); err != nil {
		return
	}

	return
}

type basicGet struct {
	reserved1 uint16
	Queue     string
	NoAck     bool
}

func (me *basicGet) id() (uint16, uint16) {
	return 60, 70
}

func (me *basicGet) wait() bool {
	return true
}

func (me *basicGet) write(w io.Writer) (err error) {
	var bits byte

	if err = binary.Write(w, binary.BigEndian, me.reserved1); err != nil {
		return
	}

	if err = writeShortstr(w, me.Queue); err != nil {
		return
	}

	if me.NoAck {
		bits |= 1 << 0
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	return
}

func (me *basicGet) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &me.reserved1); err != nil {
		return
	}

	if me.Queue, err = readShortstr(r); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.NoAck = (bits&(1<<0) > 0)

	return
}

type basicGetOk struct {
	DeliveryTag  uint64
	Redelivered  bool
	Exchange     string
	RoutingKey   string
	MessageCount uint32
	Properties   properties
	Body         []byte
}

func (me *basicGetOk) id() (uint16, uint16) {
	return 60, 71
}

func (me *basicGetOk) wait() bool {
	return true
}

func (me *basicGetOk) getContent() (properties, []byte) {
	return me.Properties, me.Body
}

func (me *basicGetOk) setContent(props properties, body []byte) {
	me.Properties, me.Body = props, body
}

func (me *basicGetOk) write(w io.Writer) (err error) {
	var bits byte

	if err = binary.Write(w, binary.BigEndian, me.DeliveryTag); err != nil {
		return
	}

	if me.Redelivered {
		bits |= 1 << 0
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	if err = writeShortstr(w, me.Exchange); err != nil {
		return
	}
	if err = writeShortstr(w, me.RoutingKey); err != nil {
		return
	}

	if err = binary.Write(w, binary.BigEndian, me.MessageCount); err != nil {
		return
	}

	return
}

func (me *basicGetOk) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &me.DeliveryTag); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.Redelivered = (bits&(1<<0) > 0)

	if me.Exchange, err = readShortstr(r); err != nil {
		return
	}
	if me.RoutingKey, err = readShortstr(r); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &me.MessageCount); err != nil {
		return
	}

	return
}

type basicGetEmpty struct {
	reserved1 string
}

func (me *basicGetEmpty) id() (uint16, uint16) {
	return 60, 72
}

func (me *basicGetEmpty) wait() bool {
	return true
}

func (me *basicGetEmpty) write(w io.Writer) (err error) {

	if err = writeShortstr(w, me.reserved1); err != nil {
		return
	}

	return
}

func (me *basicGetEmpty) read(r io.Reader) (err error) {

	if me.reserved1, err = readShortstr(r); err != nil {
		return
	}

	return
}

type basicAck struct {
	DeliveryTag uint64
	Multiple    bool
}

func (me *basicAck) id() (uint16, uint16) {
	return 60, 80
}

func (me *basicAck) wait() bool {
	return false
}

func (me *basicAck) write(w io.Writer) (err error) {
	var bits byte

	if err = binary.Write(w, binary.BigEndian, me.DeliveryTag); err != nil {
		return
	}

	if me.Multiple {
		bits |= 1 << 0
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	return
}

func (me *basicAck) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &me.DeliveryTag); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.Multiple = (bits&(1<<0) > 0)

	return
}

type basicReject struct {
	DeliveryTag uint64
	Requeue     bool
}

func (me *basicReject) id() (uint16, uint16) {
	return 60, 90
}

func (me *basicReject) wait() bool {
	return false
}

func (me *basicReject) write(w io.Writer) (err error) {
	var bits byte

	if err = binary.Write(w, binary.BigEndian, me.DeliveryTag); err != nil {
		return
	}

	if me.Requeue {
		bits |= 1 << 0
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	return
}

func (me *basicReject) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &me.DeliveryTag); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.Requeue = (bits&(1<<0) > 0)

	return
}

type basicRecoverAsync struct {
	Requeue bool
}

func (me *basicRecoverAsync) id() (uint16, uint16) {
	return 60, 100
}

func (me *basicRecoverAsync) wait() bool {
	return false
}

func (me *basicRecoverAsync) write(w io.Writer) (err error) {
	var bits byte

	if me.Requeue {
		bits |= 1 << 0
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	return
}

func (me *basicRecoverAsync) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.Requeue = (bits&(1<<0) > 0)

	return
}

type basicRecover struct {
	Requeue bool
}

func (me *basicRecover) id() (uint16, uint16) {
	return 60, 110
}

func (me *basicRecover) wait() bool {
	return true
}

func (me *basicRecover) write(w io.Writer) (err error) {
	var bits byte

	if me.Requeue {
		bits |= 1 << 0
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	return
}

func (me *basicRecover) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.Requeue = (bits&(1<<0) > 0)

	return
}

type basicRecoverOk struct {
}

func (me *basicRecoverOk) id() (uint16, uint16) {
	return 60, 111
}

func (me *basicRecoverOk) wait() bool {
	return true
}

func (me *basicRecoverOk) write(w io.Writer) (err error) {

	return
}

func (me *basicRecoverOk) read(r io.Reader) (err error) {

	return
}

type basicNack struct {
	DeliveryTag uint64
	Multiple    bool
	Requeue     bool
}

func (me *basicNack) id() (uint16, uint16) {
	return 60, 120
}

func (me *basicNack) wait() bool {
	return false
}

func (me *basicNack) write(w io.Writer) (err error) {
	var bits byte

	if err = binary.Write(w, binary.BigEndian, me.DeliveryTag); err != nil {
		return
	}

	if me.Multiple {
		bits |= 1 << 0
	}

	if me.Requeue {
		bits |= 1 << 1
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	return
}

func (me *basicNack) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &me.DeliveryTag); err != nil {
		return
	}

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.Multiple = (bits&(1<<0) > 0)
	me.Requeue = (bits&(1<<1) > 0)

	return
}

type txSelect struct {
}

func (me *txSelect) id() (uint16, uint16) {
	return 90, 10
}

func (me *txSelect) wait() bool {
	return true
}

func (me *txSelect) write(w io.Writer) (err error) {

	return
}

func (me *txSelect) read(r io.Reader) (err error) {

	return
}

type txSelectOk struct {
}

func (me *txSelectOk) id() (uint16, uint16) {
	return 90, 11
}

func (me *txSelectOk) wait() bool {
	return true
}

func (me *txSelectOk) write(w io.Writer) (err error) {

	return
}

func (me *txSelectOk) read(r io.Reader) (err error) {

	return
}

type txCommit struct {
}

func (me *txCommit) id() (uint16, uint16) {
	return 90, 20
}

func (me *txCommit) wait() bool {
	return true
}

func (me *txCommit) write(w io.Writer) (err error) {

	return
}

func (me *txCommit) read(r io.Reader) (err error) {

	return
}

type txCommitOk struct {
}

func (me *txCommitOk) id() (uint16, uint16) {
	return 90, 21
}

func (me *txCommitOk) wait() bool {
	return true
}

func (me *txCommitOk) write(w io.Writer) (err error) {

	return
}

func (me *txCommitOk) read(r io.Reader) (err error) {

	return
}

type txRollback struct {
}

func (me *txRollback) id() (uint16, uint16) {
	return 90, 30
}

func (me *txRollback) wait() bool {
	return true
}

func (me *txRollback) write(w io.Writer) (err error) {

	return
}

func (me *txRollback) read(r io.Reader) (err error) {

	return
}

type txRollbackOk struct {
}

func (me *txRollbackOk) id() (uint16, uint16) {
	return 90, 31
}

func (me *txRollbackOk) wait() bool {
	return true
}

func (me *txRollbackOk) write(w io.Writer) (err error) {

	return
}

func (me *txRollbackOk) read(r io.Reader) (err error) {

	return
}

type confirmSelect struct {
	Nowait bool
}

func (me *confirmSelect) id() (uint16, uint16) {
	return 85, 10
}

func (me *confirmSelect) wait() bool {
	return true
}

func (me *confirmSelect) write(w io.Writer) (err error) {
	var bits byte

	if me.Nowait {
		bits |= 1 << 0
	}

	if err = binary.Write(w, binary.BigEndian, bits); err != nil {
		return
	}

	return
}

func (me *confirmSelect) read(r io.Reader) (err error) {
	var bits byte

	if err = binary.Read(r, binary.BigEndian, &bits); err != nil {
		return
	}
	me.Nowait = (bits&(1<<0) > 0)

	return
}

type confirmSelectOk struct {
}

func (me *confirmSelectOk) id() (uint16, uint16) {
	return 85, 11
}

func (me *confirmSelectOk) wait() bool {
	return true
}

func (me *confirmSelectOk) write(w io.Writer) (err error) {

	return
}

func (me *confirmSelectOk) read(r io.Reader) (err error) {

	return
}

func (me *reader) parseMethodFrame(channel uint16, size uint32) (f frame, err error) {
	mf := &methodFrame{
		ChannelId: channel,
	}

	if err = binary.Read(me.r, binary.BigEndian, &mf.ClassId); err != nil {
		return
	}

	if err = binary.Read(me.r, binary.BigEndian, &mf.MethodId); err != nil {
		return
	}

	switch mf.ClassId {

	case 10: // connection
		switch mf.MethodId {

		case 10: // connection start
			//fmt.Println("NextMethod: class:10 method:10")
			method := &connectionStart{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 11: // connection start-ok
			//fmt.Println("NextMethod: class:10 method:11")
			method := &connectionStartOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 20: // connection secure
			//fmt.Println("NextMethod: class:10 method:20")
			method := &connectionSecure{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 21: // connection secure-ok
			//fmt.Println("NextMethod: class:10 method:21")
			method := &connectionSecureOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 30: // connection tune
			//fmt.Println("NextMethod: class:10 method:30")
			method := &connectionTune{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 31: // connection tune-ok
			//fmt.Println("NextMethod: class:10 method:31")
			method := &connectionTuneOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 40: // connection open
			//fmt.Println("NextMethod: class:10 method:40")
			method := &connectionOpen{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 41: // connection open-ok
			//fmt.Println("NextMethod: class:10 method:41")
			method := &connectionOpenOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 50: // connection close
			//fmt.Println("NextMethod: class:10 method:50")
			method := &connectionClose{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 51: // connection close-ok
			//fmt.Println("NextMethod: class:10 method:51")
			method := &connectionCloseOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 60: // connection blocked
			//fmt.Println("NextMethod: class:10 method:60")
			method := &connectionBlocked{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 61: // connection unblocked
			//fmt.Println("NextMethod: class:10 method:61")
			method := &connectionUnblocked{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		default:
			return nil, fmt.Errorf("Bad method frame, unknown method %d for class %d", mf.MethodId, mf.ClassId)
		}

	case 20: // channel
		switch mf.MethodId {

		case 10: // channel open
			//fmt.Println("NextMethod: class:20 method:10")
			method := &channelOpen{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 11: // channel open-ok
			//fmt.Println("NextMethod: class:20 method:11")
			method := &channelOpenOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 20: // channel flow
			//fmt.Println("NextMethod: class:20 method:20")
			method := &channelFlow{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 21: // channel flow-ok
			//fmt.Println("NextMethod: class:20 method:21")
			method := &channelFlowOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 40: // channel close
			//fmt.Println("NextMethod: class:20 method:40")
			method := &channelClose{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 41: // channel close-ok
			//fmt.Println("NextMethod: class:20 method:41")
			method := &channelCloseOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		default:
			return nil, fmt.Errorf("Bad method frame, unknown method %d for class %d", mf.MethodId, mf.ClassId)
		}

	case 40: // exchange
		switch mf.MethodId {

		case 10: // exchange declare
			//fmt.Println("NextMethod: class:40 method:10")
			method := &exchangeDeclare{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 11: // exchange declare-ok
			//fmt.Println("NextMethod: class:40 method:11")
			method := &exchangeDeclareOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 20: // exchange delete
			//fmt.Println("NextMethod: class:40 method:20")
			method := &exchangeDelete{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 21: // exchange delete-ok
			//fmt.Println("NextMethod: class:40 method:21")
			method := &exchangeDeleteOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 30: // exchange bind
			//fmt.Println("NextMethod: class:40 method:30")
			method := &exchangeBind{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 31: // exchange bind-ok
			//fmt.Println("NextMethod: class:40 method:31")
			method := &exchangeBindOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 40: // exchange unbind
			//fmt.Println("NextMethod: class:40 method:40")
			method := &exchangeUnbind{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 51: // exchange unbind-ok
			//fmt.Println("NextMethod: class:40 method:51")
			method := &exchangeUnbindOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		default:
			return nil, fmt.Errorf("Bad method frame, unknown method %d for class %d", mf.MethodId, mf.ClassId)
		}

	case 50: // queue
		switch mf.MethodId {

		case 10: // queue declare
			//fmt.Println("NextMethod: class:50 method:10")
			method := &queueDeclare{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 11: // queue declare-ok
			//fmt.Println("NextMethod: class:50 method:11")
			method := &queueDeclareOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 20: // queue bind
			//fmt.Println("NextMethod: class:50 method:20")
			method := &queueBind{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 21: // queue bind-ok
			//fmt.Println("NextMethod: class:50 method:21")
			method := &queueBindOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 50: // queue unbind
			//fmt.Println("NextMethod: class:50 method:50")
			method := &queueUnbind{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 51: // queue unbind-ok
			//fmt.Println("NextMethod: class:50 method:51")
			method := &queueUnbindOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 30: // queue purge
			//fmt.Println("NextMethod: class:50 method:30")
			method := &queuePurge{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 31: // queue purge-ok
			//fmt.Println("NextMethod: class:50 method:31")
			method := &queuePurgeOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 40: // queue delete
			//fmt.Println("NextMethod: class:50 method:40")
			method := &queueDelete{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 41: // queue delete-ok
			//fmt.Println("NextMethod: class:50 method:41")
			method := &queueDeleteOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		default:
			return nil, fmt.Errorf("Bad method frame, unknown method %d for class %d", mf.MethodId, mf.ClassId)
		}

	case 60: // basic
		switch mf.MethodId {

		case 10: // basic qos
			//fmt.Println("NextMethod: class:60 method:10")
			method := &basicQos{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 11: // basic qos-ok
			//fmt.Println("NextMethod: class:60 method:11")
			method := &basicQosOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 20: // basic consume
			//fmt.Println("NextMethod: class:60 method:20")
			method := &basicConsume{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 21: // basic consume-ok
			//fmt.Println("NextMethod: class:60 method:21")
			method := &basicConsumeOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 30: // basic cancel
			//fmt.Println("NextMethod: class:60 method:30")
			method := &basicCancel{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 31: // basic cancel-ok
			//fmt.Println("NextMethod: class:60 method:31")
			method := &basicCancelOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 40: // basic publish
			//fmt.Println("NextMethod: class:60 method:40")
			method := &basicPublish{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 50: // basic return
			//fmt.Println("NextMethod: class:60 method:50")
			method := &basicReturn{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 60: // basic deliver
			//fmt.Println("NextMethod: class:60 method:60")
			method := &basicDeliver{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 70: // basic get
			//fmt.Println("NextMethod: class:60 method:70")
			method := &basicGet{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 71: // basic get-ok
			//fmt.Println("NextMethod: class:60 method:71")
			method := &basicGetOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 72: // basic get-empty
			//fmt.Println("NextMethod: class:60 method:72")
			method := &basicGetEmpty{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 80: // basic ack
			//fmt.Println("NextMethod: class:60 method:80")
			method := &basicAck{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 90: // basic reject
			//fmt.Println("NextMethod: class:60 method:90")
			method := &basicReject{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 100: // basic recover-async
			//fmt.Println("NextMethod: class:60 method:100")
			method := &basicRecoverAsync{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 110: // basic recover
			//fmt.Println("NextMethod: class:60 method:110")
			method := &basicRecover{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 111: // basic recover-ok
			//fmt.Println("NextMethod: class:60 method:111")
			method := &basicRecoverOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 120: // basic nack
			//fmt.Println("NextMethod: class:60 method:120")
			method := &basicNack{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		default:
			return nil, fmt.Errorf("Bad method frame, unknown method %d for class %d", mf.MethodId, mf.ClassId)
		}

	case 90: // tx
		switch mf.MethodId {

		case 10: // tx select
			//fmt.Println("NextMethod: class:90 method:10")
			method := &txSelect{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 11: // tx select-ok
			//fmt.Println("NextMethod: class:90 method:11")
			method := &txSelectOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 20: // tx commit
			//fmt.Println("NextMethod: class:90 method:20")
			method := &txCommit{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 21: // tx commit-ok
			//fmt.Println("NextMethod: class:90 method:21")
			method := &txCommitOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 30: // tx rollback
			//fmt.Println("NextMethod: class:90 method:30")
			method := &txRollback{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 31: // tx rollback-ok
			//fmt.Println("NextMethod: class:90 method:31")
			method := &txRollbackOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		default:
			return nil, fmt.Errorf("Bad method frame, unknown method %d for class %d", mf.MethodId, mf.ClassId)
		}

	case 85: // confirm
		switch mf.MethodId {

		case 10: // confirm select
			//fmt.Println("NextMethod: class:85 method:10")
			method := &confirmSelect{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		case 11: // confirm select-ok
			//fmt.Println("NextMethod: class:85 method:11")
			method := &confirmSelectOk{}
			if err = method.read(me.r); err != nil {
				return
			}
			mf.Method = method

		default:
			return nil, fmt.Errorf("Bad method frame, unknown method %d for class %d", mf.MethodId, mf.ClassId)
		}

	default:
		return nil, fmt.Errorf("Bad method frame, unknown class %d", mf.ClassId)
	}

	return mf, nil
}
