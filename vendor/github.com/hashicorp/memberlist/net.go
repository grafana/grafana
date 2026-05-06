// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package memberlist

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"fmt"
	"hash/crc32"
	"io"
	"math"
	"net"
	"sync/atomic"
	"time"

	"github.com/hashicorp/go-metrics/compat"
	"github.com/hashicorp/go-msgpack/v2/codec"
)

// This is the minimum and maximum protocol version that we can
// _understand_. We're allowed to speak at any version within this
// range. This range is inclusive.
const (
	ProtocolVersionMin uint8 = 1

	// Version 3 added support for TCP pings but we kept the default
	// protocol version at 2 to ease transition to this new feature.
	// A memberlist speaking version 2 of the protocol will attempt
	// to TCP ping another memberlist who understands version 3 or
	// greater.
	//
	// Version 4 added support for nacks as part of indirect probes.
	// A memberlist speaking version 2 of the protocol will expect
	// nacks from another memberlist who understands version 4 or
	// greater, and likewise nacks will be sent to memberlists who
	// understand version 4 or greater.
	ProtocolVersion2Compatible = 2

	ProtocolVersionMax = 5
)

// messageType is an integer ID of a type of message that can be received
// on network channels from other members.
type messageType uint8

// The list of available message types.
//
// WARNING: ONLY APPEND TO THIS LIST! The numeric values are part of the
// protocol itself.
const (
	pingMsg messageType = iota
	indirectPingMsg
	ackRespMsg
	suspectMsg
	aliveMsg
	deadMsg
	pushPullMsg
	compoundMsg
	userMsg // User mesg, not handled by us
	compressMsg
	encryptMsg
	nackRespMsg
	hasCrcMsg
	errMsg
)

const (
	// hasLabelMsg has a deliberately high value so that you can disambiguate
	// it from the encryptionVersion header which is either 0/1 right now and
	// also any of the existing messageTypes
	hasLabelMsg messageType = 244
)

// compressionType is used to specify the compression algorithm
type compressionType uint8

const (
	lzwAlgo compressionType = iota
)

const (
	MetaMaxSize            = 512 // Maximum size for node meta data
	compoundHeaderOverhead = 2   // Assumed header overhead
	compoundOverhead       = 2   // Assumed overhead per entry in compoundHeader
	userMsgOverhead        = 1
	blockingWarning        = 10 * time.Millisecond // Warn if a UDP packet takes this long to process
	maxPushStateBytes      = 20 * 1024 * 1024
	maxPushPullRequests    = 128 // Maximum number of concurrent push/pull requests
)

// ping request sent directly to node
type ping struct {
	SeqNo uint32

	// Node is sent so the target can verify they are
	// the intended recipient. This is to protect again an agent
	// restart with a new name.
	Node string

	SourceAddr []byte `codec:",omitempty"` // Source address, used for a direct reply
	SourcePort uint16 `codec:",omitempty"` // Source port, used for a direct reply
	SourceNode string `codec:",omitempty"` // Source name, used for a direct reply
}

// indirect ping sent to an indirect node
type indirectPingReq struct {
	SeqNo  uint32
	Target []byte
	Port   uint16

	// Node is sent so the target can verify they are
	// the intended recipient. This is to protect against an agent
	// restart with a new name.
	Node string

	Nack bool // true if we'd like a nack back

	SourceAddr []byte `codec:",omitempty"` // Source address, used for a direct reply
	SourcePort uint16 `codec:",omitempty"` // Source port, used for a direct reply
	SourceNode string `codec:",omitempty"` // Source name, used for a direct reply
}

// ack response is sent for a ping
type ackResp struct {
	SeqNo   uint32
	Payload []byte
}

// nack response is sent for an indirect ping when the pinger doesn't hear from
// the ping-ee within the configured timeout. This lets the original node know
// that the indirect ping attempt happened but didn't succeed.
type nackResp struct {
	SeqNo uint32
}

// err response is sent to relay the error from the remote end
type errResp struct {
	Error string
}

// suspect is broadcast when we suspect a node is dead
type suspect struct {
	Incarnation uint32
	Node        string
	From        string // Include who is suspecting
}

// alive is broadcast when we know a node is alive.
// Overloaded for nodes joining
type alive struct {
	Incarnation uint32
	Node        string
	Addr        []byte
	Port        uint16
	Meta        []byte

	// The versions of the protocol/delegate that are being spoken, order:
	// pmin, pmax, pcur, dmin, dmax, dcur
	Vsn []uint8
}

// dead is broadcast when we confirm a node is dead
// Overloaded for nodes leaving
type dead struct {
	Incarnation uint32
	Node        string
	From        string // Include who is suspecting
}

// pushPullHeader is used to inform the
// otherside how many states we are transferring
type pushPullHeader struct {
	Nodes        int
	UserStateLen int  // Encodes the byte lengh of user state
	Join         bool // Is this a join request or a anti-entropy run
}

// userMsgHeader is used to encapsulate a userMsg
type userMsgHeader struct {
	UserMsgLen int // Encodes the byte lengh of user state
}

// pushNodeState is used for pushPullReq when we are
// transferring out node states
type pushNodeState struct {
	Name        string
	Addr        []byte
	Port        uint16
	Meta        []byte
	Incarnation uint32
	State       NodeStateType
	Vsn         []uint8 // Protocol versions
}

// compress is used to wrap an underlying payload
// using a specified compression algorithm
type compress struct {
	Algo compressionType
	Buf  []byte
}

// msgHandoff is used to transfer a message between goroutines
type msgHandoff struct {
	msgType messageType
	buf     []byte
	from    net.Addr
}

// encryptionVersion returns the encryption version to use
func (m *Memberlist) encryptionVersion() encryptionVersion {
	switch m.ProtocolVersion() {
	case 1:
		return 0
	default:
		return 1
	}
}

// streamListen is a long running goroutine that pulls incoming streams from the
// transport and hands them off for processing.
func (m *Memberlist) streamListen() {
	for {
		select {
		case conn := <-m.transport.StreamCh():
			go m.handleConn(conn)

		case <-m.shutdownCh:
			return
		}
	}
}

// handleConn handles a single incoming stream connection from the transport.
func (m *Memberlist) handleConn(conn net.Conn) {
	defer conn.Close()
	m.logger.Printf("[DEBUG] memberlist: Stream connection %s", LogConn(conn))

	metrics.IncrCounterWithLabels([]string{"memberlist", "tcp", "accept"}, 1, m.metricLabels)

	conn.SetDeadline(time.Now().Add(m.config.TCPTimeout))

	var (
		streamLabel string
		err         error
	)
	conn, streamLabel, err = RemoveLabelHeaderFromStream(conn)
	if err != nil {
		m.logger.Printf("[ERR] memberlist: failed to receive and remove the stream label header: %s %s", err, LogConn(conn))
		return
	}

	if m.config.SkipInboundLabelCheck {
		if streamLabel != "" {
			m.logger.Printf("[ERR] memberlist: unexpected double stream label header: %s", LogConn(conn))
			return
		}
		// Set this from config so that the auth data assertions work below.
		streamLabel = m.config.Label
	}

	if m.config.Label != streamLabel {
		m.logger.Printf("[ERR] memberlist: discarding stream with unacceptable label %q: %s", streamLabel, LogConn(conn))
		return
	}

	msgType, bufConn, dec, err := m.readStream(conn, streamLabel)
	if err != nil {
		if err != io.EOF {
			m.logger.Printf("[ERR] memberlist: failed to receive: %s %s", err, LogConn(conn))

			resp := errResp{err.Error()}
			out, err := encode(errMsg, &resp, m.config.MsgpackUseNewTimeFormat)
			if err != nil {
				m.logger.Printf("[ERR] memberlist: Failed to encode error response: %s", err)
				return
			}

			err = m.rawSendMsgStream(conn, out.Bytes(), streamLabel)
			if err != nil {
				m.logger.Printf("[ERR] memberlist: Failed to send error: %s %s", err, LogConn(conn))
				return
			}
		}
		return
	}

	switch msgType {
	case userMsg:
		if err := m.readUserMsg(bufConn, dec); err != nil {
			m.logger.Printf("[ERR] memberlist: Failed to receive user message: %s %s", err, LogConn(conn))
		}
	case pushPullMsg:
		// Increment counter of pending push/pulls
		numConcurrent := atomic.AddUint32(&m.pushPullReq, 1)
		defer atomic.AddUint32(&m.pushPullReq, ^uint32(0))

		// Check if we have too many open push/pull requests
		if numConcurrent >= maxPushPullRequests {
			m.logger.Printf("[ERR] memberlist: Too many pending push/pull requests")
			return
		}

		join, remoteNodes, userState, err := m.readRemoteState(bufConn, dec)
		if err != nil {
			m.logger.Printf("[ERR] memberlist: Failed to read remote state: %s %s", err, LogConn(conn))
			return
		}

		if err := m.sendLocalState(conn, join, streamLabel); err != nil {
			m.logger.Printf("[ERR] memberlist: Failed to push local state: %s %s", err, LogConn(conn))
			return
		}

		if err := m.mergeRemoteState(join, remoteNodes, userState); err != nil {
			m.logger.Printf("[ERR] memberlist: Failed push/pull merge: %s %s", err, LogConn(conn))
			return
		}
	case pingMsg:
		var p ping
		if err := dec.Decode(&p); err != nil {
			m.logger.Printf("[ERR] memberlist: Failed to decode ping: %s %s", err, LogConn(conn))
			return
		}

		if p.Node != "" && p.Node != m.config.Name {
			m.logger.Printf("[WARN] memberlist: Got ping for unexpected node %s %s", p.Node, LogConn(conn))
			return
		}

		ack := ackResp{p.SeqNo, nil}
		out, err := encode(ackRespMsg, &ack, m.config.MsgpackUseNewTimeFormat)
		if err != nil {
			m.logger.Printf("[ERR] memberlist: Failed to encode ack: %s", err)
			return
		}

		err = m.rawSendMsgStream(conn, out.Bytes(), streamLabel)
		if err != nil {
			m.logger.Printf("[ERR] memberlist: Failed to send ack: %s %s", err, LogConn(conn))
			return
		}
	default:
		m.logger.Printf("[ERR] memberlist: Received invalid msgType (%d) %s", msgType, LogConn(conn))
	}
}

// packetListen is a long running goroutine that pulls packets out of the
// transport and hands them off for processing.
func (m *Memberlist) packetListen() {
	for {
		select {
		case packet := <-m.transport.PacketCh():
			m.ingestPacket(packet.Buf, packet.From, packet.Timestamp)

		case <-m.shutdownCh:
			return
		}
	}
}

func (m *Memberlist) ingestPacket(buf []byte, from net.Addr, timestamp time.Time) {
	var (
		packetLabel string
		err         error
	)
	buf, packetLabel, err = RemoveLabelHeaderFromPacket(buf)
	if err != nil {
		m.logger.Printf("[ERR] memberlist: %v %s", err, LogAddress(from))
		return
	}

	if m.config.SkipInboundLabelCheck {
		if packetLabel != "" {
			m.logger.Printf("[ERR] memberlist: unexpected double packet label header: %s", LogAddress(from))
			return
		}
		// Set this from config so that the auth data assertions work below.
		packetLabel = m.config.Label
	}

	if m.config.Label != packetLabel {
		m.logger.Printf("[ERR] memberlist: discarding packet with unacceptable label %q: %s", packetLabel, LogAddress(from))
		return
	}

	// Check if encryption is enabled
	if m.config.EncryptionEnabled() {
		// Decrypt the payload
		authData := []byte(packetLabel)
		plain, err := decryptPayload(m.config.Keyring.GetKeys(), buf, authData)
		if err != nil {
			if !m.config.GossipVerifyIncoming {
				// Treat the message as plaintext
				plain = buf
			} else {
				m.logger.Printf("[ERR] memberlist: Decrypt packet failed: %v %s", err, LogAddress(from))
				return
			}
		}

		// Continue processing the plaintext buffer
		buf = plain
	}

	// See if there's a checksum included to verify the contents of the message
	if len(buf) >= 5 && messageType(buf[0]) == hasCrcMsg {
		crc := crc32.ChecksumIEEE(buf[5:])
		expected := binary.BigEndian.Uint32(buf[1:5])
		if crc != expected {
			m.logger.Printf("[WARN] memberlist: Got invalid checksum for UDP packet: %x, %x", crc, expected)
			return
		}
		m.handleCommand(buf[5:], from, timestamp)
	} else {
		m.handleCommand(buf, from, timestamp)
	}
}

func (m *Memberlist) handleCommand(buf []byte, from net.Addr, timestamp time.Time) {
	if len(buf) < 1 {
		m.logger.Printf("[ERR] memberlist: missing message type byte %s", LogAddress(from))
		return
	}
	// Decode the message type
	msgType := messageType(buf[0])
	buf = buf[1:]

	// Switch on the msgType
	switch msgType {
	case compoundMsg:
		m.handleCompound(buf, from, timestamp)
	case compressMsg:
		m.handleCompressed(buf, from, timestamp)

	case pingMsg:
		m.handlePing(buf, from)
	case indirectPingMsg:
		m.handleIndirectPing(buf, from)
	case ackRespMsg:
		m.handleAck(buf, from, timestamp)
	case nackRespMsg:
		m.handleNack(buf, from)

	case suspectMsg:
		fallthrough
	case aliveMsg:
		fallthrough
	case deadMsg:
		fallthrough
	case userMsg:
		// Determine the message queue, prioritize alive
		queue := m.lowPriorityMsgQueue
		if msgType == aliveMsg {
			queue = m.highPriorityMsgQueue
		}

		// Check for overflow and append if not full
		m.msgQueueLock.Lock()
		if queue.Len() >= m.config.HandoffQueueDepth {
			m.logger.Printf("[WARN] memberlist: handler queue full, dropping message (%d) %s", msgType, LogAddress(from))
		} else {
			queue.PushBack(msgHandoff{msgType, buf, from})
		}
		m.msgQueueLock.Unlock()

		// Notify of pending message
		select {
		case m.handoffCh <- struct{}{}:
		default:
		}

	default:
		m.logger.Printf("[ERR] memberlist: msg type (%d) not supported %s", msgType, LogAddress(from))
	}
}

// getNextMessage returns the next message to process in priority order, using LIFO
func (m *Memberlist) getNextMessage() (msgHandoff, bool) {
	m.msgQueueLock.Lock()
	defer m.msgQueueLock.Unlock()

	if el := m.highPriorityMsgQueue.Back(); el != nil {
		m.highPriorityMsgQueue.Remove(el)
		msg := el.Value.(msgHandoff)
		return msg, true
	} else if el := m.lowPriorityMsgQueue.Back(); el != nil {
		m.lowPriorityMsgQueue.Remove(el)
		msg := el.Value.(msgHandoff)
		return msg, true
	}
	return msgHandoff{}, false
}

// packetHandler is a long running goroutine that processes messages received
// over the packet interface, but is decoupled from the listener to avoid
// blocking the listener which may cause ping/ack messages to be delayed.
func (m *Memberlist) packetHandler() {
	for {
		select {
		case <-m.handoffCh:
			for {
				msg, ok := m.getNextMessage()
				if !ok {
					break
				}
				msgType := msg.msgType
				buf := msg.buf
				from := msg.from

				switch msgType {
				case suspectMsg:
					m.handleSuspect(buf, from)
				case aliveMsg:
					m.handleAlive(buf, from)
				case deadMsg:
					m.handleDead(buf, from)
				case userMsg:
					m.handleUser(buf, from)
				default:
					m.logger.Printf("[ERR] memberlist: Message type (%d) not supported %s (packet handler)", msgType, LogAddress(from))
				}
			}

		case <-m.shutdownCh:
			return
		}
	}
}

func (m *Memberlist) handleCompound(buf []byte, from net.Addr, timestamp time.Time) {
	// Decode the parts
	trunc, parts, err := decodeCompoundMessage(buf)
	if err != nil {
		m.logger.Printf("[ERR] memberlist: Failed to decode compound request: %s %s", err, LogAddress(from))
		return
	}

	// Log any truncation
	if trunc > 0 {
		m.logger.Printf("[WARN] memberlist: Compound request had %d truncated messages %s", trunc, LogAddress(from))
	}

	// Handle each message
	for _, part := range parts {
		m.handleCommand(part, from, timestamp)
	}
}

func (m *Memberlist) handlePing(buf []byte, from net.Addr) {
	var p ping
	if err := decode(buf, &p); err != nil {
		m.logger.Printf("[ERR] memberlist: Failed to decode ping request: %s %s", err, LogAddress(from))
		return
	}
	// If node is provided, verify that it is for us
	if p.Node != "" && p.Node != m.config.Name {
		m.logger.Printf("[WARN] memberlist: Got ping for unexpected node '%s' %s", p.Node, LogAddress(from))
		return
	}
	var ack ackResp
	ack.SeqNo = p.SeqNo
	if m.config.Ping != nil {
		ack.Payload = m.config.Ping.AckPayload()
	}

	addr := ""
	if len(p.SourceAddr) > 0 && p.SourcePort > 0 {
		addr = joinHostPort(net.IP(p.SourceAddr).String(), p.SourcePort)
	} else {
		addr = from.String()
	}

	a := Address{
		Addr: addr,
		Name: p.SourceNode,
	}
	if err := m.encodeAndSendMsg(a, ackRespMsg, &ack); err != nil {
		m.logger.Printf("[ERR] memberlist: Failed to send ack: %s %s", err, LogAddress(from))
	}
}

func (m *Memberlist) handleIndirectPing(buf []byte, from net.Addr) {
	var ind indirectPingReq
	if err := decode(buf, &ind); err != nil {
		m.logger.Printf("[ERR] memberlist: Failed to decode indirect ping request: %s %s", err, LogAddress(from))
		return
	}

	// For proto versions < 2, there is no port provided. Mask old
	// behavior by using the configured port.
	if m.ProtocolVersion() < 2 || ind.Port == 0 {
		ind.Port = uint16(m.config.BindPort)
	}

	// Send a ping to the correct host.
	localSeqNo := m.nextSeqNo()
	selfAddr, selfPort := m.getAdvertise()
	ping := ping{
		SeqNo: localSeqNo,
		Node:  ind.Node,
		// The outbound message is addressed FROM us.
		SourceAddr: selfAddr,
		SourcePort: selfPort,
		SourceNode: m.config.Name,
	}

	// Forward the ack back to the requestor. If the request encodes an origin
	// use that otherwise assume that the other end of the UDP socket is
	// usable.
	indAddr := ""
	if len(ind.SourceAddr) > 0 && ind.SourcePort > 0 {
		indAddr = joinHostPort(net.IP(ind.SourceAddr).String(), ind.SourcePort)
	} else {
		indAddr = from.String()
	}

	// Setup a response handler to relay the ack
	cancelCh := make(chan struct{})
	respHandler := func(payload []byte, timestamp time.Time) {
		// Try to prevent the nack if we've caught it in time.
		close(cancelCh)

		ack := ackResp{ind.SeqNo, nil}
		a := Address{
			Addr: indAddr,
			Name: ind.SourceNode,
		}
		if err := m.encodeAndSendMsg(a, ackRespMsg, &ack); err != nil {
			m.logger.Printf("[ERR] memberlist: Failed to forward ack: %s %s", err, LogStringAddress(indAddr))
		}
	}
	m.setAckHandler(localSeqNo, respHandler, m.config.ProbeTimeout)

	// Send the ping.
	addr := joinHostPort(net.IP(ind.Target).String(), ind.Port)
	a := Address{
		Addr: addr,
		Name: ind.Node,
	}
	if err := m.encodeAndSendMsg(a, pingMsg, &ping); err != nil {
		m.logger.Printf("[ERR] memberlist: Failed to send indirect ping: %s %s", err, LogStringAddress(indAddr))
	}

	// Setup a timer to fire off a nack if no ack is seen in time.
	if ind.Nack {
		go func() {
			select {
			case <-cancelCh:
				return
			case <-time.After(m.config.ProbeTimeout):
				nack := nackResp{ind.SeqNo}
				a := Address{
					Addr: indAddr,
					Name: ind.SourceNode,
				}
				if err := m.encodeAndSendMsg(a, nackRespMsg, &nack); err != nil {
					m.logger.Printf("[ERR] memberlist: Failed to send nack: %s %s", err, LogStringAddress(indAddr))
				}
			}
		}()
	}
}

func (m *Memberlist) handleAck(buf []byte, from net.Addr, timestamp time.Time) {
	var ack ackResp
	if err := decode(buf, &ack); err != nil {
		m.logger.Printf("[ERR] memberlist: Failed to decode ack response: %s %s", err, LogAddress(from))
		return
	}
	m.invokeAckHandler(ack, timestamp)
}

func (m *Memberlist) handleNack(buf []byte, from net.Addr) {
	var nack nackResp
	if err := decode(buf, &nack); err != nil {
		m.logger.Printf("[ERR] memberlist: Failed to decode nack response: %s %s", err, LogAddress(from))
		return
	}
	m.invokeNackHandler(nack)
}

func (m *Memberlist) handleSuspect(buf []byte, from net.Addr) {
	var sus suspect
	if err := decode(buf, &sus); err != nil {
		m.logger.Printf("[ERR] memberlist: Failed to decode suspect message: %s %s", err, LogAddress(from))
		return
	}
	m.suspectNode(&sus)
}

// ensureCanConnect return the IP from a RemoteAddress
// return error if this client must not connect
func (m *Memberlist) ensureCanConnect(from net.Addr) error {
	if !m.config.IPMustBeChecked() {
		return nil
	}
	source := from.String()
	if source == "pipe" {
		return nil
	}
	host, _, err := net.SplitHostPort(source)
	if err != nil {
		return err
	}

	ip := net.ParseIP(host)
	if ip == nil {
		return fmt.Errorf("Cannot parse IP from %s", host)
	}
	return m.config.IPAllowed(ip)
}

func (m *Memberlist) handleAlive(buf []byte, from net.Addr) {
	if err := m.ensureCanConnect(from); err != nil {
		m.logger.Printf("[DEBUG] memberlist: Blocked alive message: %s %s", err, LogAddress(from))
		return
	}
	var live alive
	if err := decode(buf, &live); err != nil {
		m.logger.Printf("[ERR] memberlist: Failed to decode alive message: %s %s", err, LogAddress(from))
		return
	}
	if m.config.IPMustBeChecked() {
		innerIP := net.IP(live.Addr)
		if innerIP != nil {
			if err := m.config.IPAllowed(innerIP); err != nil {
				m.logger.Printf("[DEBUG] memberlist: Blocked alive.Addr=%s message from: %s %s", innerIP.String(), err, LogAddress(from))
				return
			}
		}
	}

	// For proto versions < 2, there is no port provided. Mask old
	// behavior by using the configured port
	if m.ProtocolVersion() < 2 || live.Port == 0 {
		live.Port = uint16(m.config.BindPort)
	}

	m.aliveNode(&live, nil, false)
}

func (m *Memberlist) handleDead(buf []byte, from net.Addr) {
	var d dead
	if err := decode(buf, &d); err != nil {
		m.logger.Printf("[ERR] memberlist: Failed to decode dead message: %s %s", err, LogAddress(from))
		return
	}
	m.deadNode(&d)
}

// handleUser is used to notify channels of incoming user data
func (m *Memberlist) handleUser(buf []byte, from net.Addr) {
	d := m.config.Delegate
	if d != nil {
		d.NotifyMsg(buf)
	}
}

// handleCompressed is used to unpack a compressed message
func (m *Memberlist) handleCompressed(buf []byte, from net.Addr, timestamp time.Time) {
	// Try to decode the payload
	payload, err := decompressPayload(buf)
	if err != nil {
		m.logger.Printf("[ERR] memberlist: Failed to decompress payload: %v %s", err, LogAddress(from))
		return
	}

	// Recursively handle the payload
	m.handleCommand(payload, from, timestamp)
}

// encodeAndSendMsg is used to combine the encoding and sending steps
func (m *Memberlist) encodeAndSendMsg(a Address, msgType messageType, msg interface{}) error {
	out, err := encode(msgType, msg, m.config.MsgpackUseNewTimeFormat)
	if err != nil {
		return err
	}
	if err := m.sendMsg(a, out.Bytes()); err != nil {
		return err
	}
	return nil
}

// sendMsg is used to send a message via packet to another host. It will
// opportunistically create a compoundMsg and piggy back other broadcasts.
func (m *Memberlist) sendMsg(a Address, msg []byte) error {
	// Check if we can piggy back any messages
	bytesAvail := m.config.UDPBufferSize - len(msg) - compoundHeaderOverhead - labelOverhead(m.config.Label)
	if m.config.EncryptionEnabled() && m.config.GossipVerifyOutgoing {
		bytesAvail -= encryptOverhead(m.encryptionVersion())
	}
	extra := m.getBroadcasts(compoundOverhead, bytesAvail)

	// Fast path if nothing to piggypack
	if len(extra) == 0 {
		return m.rawSendMsgPacket(a, nil, msg)
	}

	// Join all the messages
	msgs := make([][]byte, 0, 1+len(extra))
	msgs = append(msgs, msg)
	msgs = append(msgs, extra...)

	// Create a compound message
	compound := makeCompoundMessage(msgs)

	// Send the message
	return m.rawSendMsgPacket(a, nil, compound.Bytes())
}

// rawSendMsgPacket is used to send message via packet to another host without
// modification, other than compression or encryption if enabled.
func (m *Memberlist) rawSendMsgPacket(a Address, node *Node, msg []byte) error {
	if a.Name == "" && m.config.RequireNodeNames {
		return errNodeNamesAreRequired
	}

	// Check if we have compression enabled
	if m.config.EnableCompression {
		buf, err := compressPayload(msg, m.config.MsgpackUseNewTimeFormat)
		if err != nil {
			m.logger.Printf("[WARN] memberlist: Failed to compress payload: %v", err)
		} else {
			// Only use compression if it reduced the size
			if buf.Len() < len(msg) {
				msg = buf.Bytes()
			}
		}
	}

	// Try to look up the destination node. Note this will only work if the
	// bare ip address is used as the node name, which is not guaranteed.
	if node == nil {
		toAddr, _, err := net.SplitHostPort(a.Addr)
		if err != nil {
			m.logger.Printf("[ERR] memberlist: Failed to parse address %q: %v", a.Addr, err)
			return err
		}
		m.nodeLock.RLock()
		nodeState, ok := m.nodeMap[toAddr]
		m.nodeLock.RUnlock()
		if ok {
			node = &nodeState.Node
		}
	}

	// Add a CRC to the end of the payload if the recipient understands
	// ProtocolVersion >= 5
	if node != nil && node.PMax >= 5 {
		crc := crc32.ChecksumIEEE(msg)
		header := make([]byte, 5, 5+len(msg))
		header[0] = byte(hasCrcMsg)
		binary.BigEndian.PutUint32(header[1:], crc)
		msg = append(header, msg...)
	}

	// Check if we have encryption enabled
	if m.config.EncryptionEnabled() && m.config.GossipVerifyOutgoing {
		// Encrypt the payload
		var (
			primaryKey  = m.config.Keyring.GetPrimaryKey()
			packetLabel = []byte(m.config.Label)
			buf         bytes.Buffer
		)
		err := encryptPayload(m.encryptionVersion(), primaryKey, msg, packetLabel, &buf)
		if err != nil {
			m.logger.Printf("[ERR] memberlist: Encryption of message failed: %v", err)
			return err
		}
		msg = buf.Bytes()
	}

	metrics.IncrCounterWithLabels([]string{"memberlist", "udp", "sent"}, float32(len(msg)), m.metricLabels)
	_, err := m.transport.WriteToAddress(msg, a)
	return err
}

// rawSendMsgStream is used to stream a message to another host without
// modification, other than applying compression and encryption if enabled.
func (m *Memberlist) rawSendMsgStream(conn net.Conn, sendBuf []byte, streamLabel string) error {
	// Check if compression is enabled
	if m.config.EnableCompression {
		compBuf, err := compressPayload(sendBuf, m.config.MsgpackUseNewTimeFormat)
		if err != nil {
			m.logger.Printf("[ERROR] memberlist: Failed to compress payload: %v", err)
		} else {
			sendBuf = compBuf.Bytes()
		}
	}

	// Check if encryption is enabled
	if m.config.EncryptionEnabled() && m.config.GossipVerifyOutgoing {
		crypt, err := m.encryptLocalState(sendBuf, streamLabel)
		if err != nil {
			m.logger.Printf("[ERROR] memberlist: Failed to encrypt local state: %v", err)
			return err
		}
		sendBuf = crypt
	}

	// Write out the entire send buffer
	metrics.IncrCounterWithLabels([]string{"memberlist", "tcp", "sent"}, float32(len(sendBuf)), m.metricLabels)

	if n, err := conn.Write(sendBuf); err != nil {
		return err
	} else if n != len(sendBuf) {
		return fmt.Errorf("only %d of %d bytes written", n, len(sendBuf))
	}

	return nil
}

// sendUserMsg is used to stream a user message to another host.
func (m *Memberlist) sendUserMsg(a Address, sendBuf []byte) error {
	if a.Name == "" && m.config.RequireNodeNames {
		return errNodeNamesAreRequired
	}

	conn, err := m.transport.DialAddressTimeout(a, m.config.TCPTimeout)
	if err != nil {
		return err
	}
	defer conn.Close()

	bufConn := bytes.NewBuffer(nil)
	if err := bufConn.WriteByte(byte(userMsg)); err != nil {
		return err
	}

	header := userMsgHeader{UserMsgLen: len(sendBuf)}
	hd := codec.MsgpackHandle{
		BasicHandle: codec.BasicHandle{
			TimeNotBuiltin: !m.config.MsgpackUseNewTimeFormat,
		},
	}
	enc := codec.NewEncoder(bufConn, &hd)
	if err := enc.Encode(&header); err != nil {
		return err
	}
	if _, err := bufConn.Write(sendBuf); err != nil {
		return err
	}

	return m.rawSendMsgStream(conn, bufConn.Bytes(), m.config.Label)
}

// sendAndReceiveState is used to initiate a push/pull over a stream with a
// remote host.
func (m *Memberlist) sendAndReceiveState(a Address, join bool) ([]pushNodeState, []byte, error) {
	if a.Name == "" && m.config.RequireNodeNames {
		return nil, nil, errNodeNamesAreRequired
	}

	// Attempt to connect
	conn, err := m.transport.DialAddressTimeout(a, m.config.TCPTimeout)
	if err != nil {
		return nil, nil, err
	}
	defer conn.Close()
	m.logger.Printf("[DEBUG] memberlist: Initiating push/pull sync with: %s %s", a.Name, conn.RemoteAddr())
	metrics.IncrCounterWithLabels([]string{"memberlist", "tcp", "connect"}, 1, m.metricLabels)

	// Send our state
	if err := m.sendLocalState(conn, join, m.config.Label); err != nil {
		return nil, nil, err
	}

	conn.SetDeadline(time.Now().Add(m.config.TCPTimeout))
	msgType, bufConn, dec, err := m.readStream(conn, m.config.Label)
	if err != nil {
		return nil, nil, err
	}

	if msgType == errMsg {
		var resp errResp
		if err := dec.Decode(&resp); err != nil {
			return nil, nil, err
		}
		return nil, nil, fmt.Errorf("remote error: %v", resp.Error)
	}

	// Quit if not push/pull
	if msgType != pushPullMsg {
		err := fmt.Errorf("received invalid msgType (%d), expected pushPullMsg (%d) %s", msgType, pushPullMsg, LogConn(conn))
		return nil, nil, err
	}

	// Read remote state
	_, remoteNodes, userState, err := m.readRemoteState(bufConn, dec)
	return remoteNodes, userState, err
}

// sendLocalState is invoked to send our local state over a stream connection.
func (m *Memberlist) sendLocalState(conn net.Conn, join bool, streamLabel string) error {
	// Setup a deadline
	conn.SetDeadline(time.Now().Add(m.config.TCPTimeout))

	// Prepare the local node state
	m.nodeLock.RLock()
	localNodes := make([]pushNodeState, len(m.nodes))
	for idx, n := range m.nodes {
		localNodes[idx].Name = n.Name
		localNodes[idx].Addr = n.Addr
		localNodes[idx].Port = n.Port
		localNodes[idx].Incarnation = n.Incarnation
		localNodes[idx].State = n.State
		localNodes[idx].Meta = n.Meta
		localNodes[idx].Vsn = []uint8{
			n.PMin, n.PMax, n.PCur,
			n.DMin, n.DMax, n.DCur,
		}
	}
	m.nodeLock.RUnlock()

	nodeStateCounts := make(map[string]int)
	nodeStateCounts[StateAlive.metricsString()] = 0
	nodeStateCounts[StateLeft.metricsString()] = 0
	nodeStateCounts[StateDead.metricsString()] = 0
	nodeStateCounts[StateSuspect.metricsString()] = 0

	for _, n := range localNodes {
		nodeStateCounts[n.State.metricsString()]++
	}

	for nodeState, cnt := range nodeStateCounts {
		metrics.SetGaugeWithLabels([]string{"memberlist", "node", "instances"},
			float32(cnt),
			append(m.metricLabels, metrics.Label{Name: "node_state", Value: nodeState}))
	}

	// Get the delegate state
	var userData []byte
	if m.config.Delegate != nil {
		userData = m.config.Delegate.LocalState(join)
	}

	// Create a bytes buffer writer
	bufConn := bytes.NewBuffer(nil)

	// Send our node state
	header := pushPullHeader{Nodes: len(localNodes), UserStateLen: len(userData), Join: join}
	hd := codec.MsgpackHandle{}
	enc := codec.NewEncoder(bufConn, &hd)

	// Begin state push
	if _, err := bufConn.Write([]byte{byte(pushPullMsg)}); err != nil {
		return err
	}

	if err := enc.Encode(&header); err != nil {
		return err
	}
	for i := 0; i < header.Nodes; i++ {
		if err := enc.Encode(&localNodes[i]); err != nil {
			return err
		}
	}

	// Write the user state as well
	if userData != nil {
		if _, err := bufConn.Write(userData); err != nil {
			return err
		}
	}

	moreBytes := binary.BigEndian.Uint32(bufConn.Bytes()[1:5])
	metrics.SetGaugeWithLabels([]string{"memberlist", "size", "local"}, float32(moreBytes), m.metricLabels)

	// Get the send buffer
	return m.rawSendMsgStream(conn, bufConn.Bytes(), streamLabel)
}

// encryptLocalState is used to help encrypt local state before sending
func (m *Memberlist) encryptLocalState(sendBuf []byte, streamLabel string) ([]byte, error) {
	var buf bytes.Buffer

	// Write the encryptMsg byte
	buf.WriteByte(byte(encryptMsg))

	// Write the size of the message
	sizeBuf := make([]byte, 4)
	encVsn := m.encryptionVersion()
	encLen := encryptedLength(encVsn, len(sendBuf))
	binary.BigEndian.PutUint32(sizeBuf, uint32(encLen))
	buf.Write(sizeBuf)

	// Authenticated Data is:
	//
	//   [messageType; byte] [messageLength; uint32] [stream_label; optional]
	//
	dataBytes := appendBytes(buf.Bytes()[:5], []byte(streamLabel))

	// Write the encrypted cipher text to the buffer
	key := m.config.Keyring.GetPrimaryKey()
	err := encryptPayload(encVsn, key, sendBuf, dataBytes, &buf)
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// decryptRemoteState is used to help decrypt the remote state
func (m *Memberlist) decryptRemoteState(bufConn io.Reader, streamLabel string) ([]byte, error) {
	// Read in enough to determine message length
	cipherText := bytes.NewBuffer(nil)
	cipherText.WriteByte(byte(encryptMsg))
	_, err := io.CopyN(cipherText, bufConn, 4)
	if err != nil {
		return nil, err
	}

	// Ensure we aren't asked to download too much. This is to guard against
	// an attack vector where a huge amount of state is sent
	moreBytes := binary.BigEndian.Uint32(cipherText.Bytes()[1:5])
	metrics.AddSampleWithLabels([]string{"memberlist", "size", "remote"}, float32(moreBytes), m.metricLabels)

	if moreBytes > maxPushStateBytes {
		return nil, fmt.Errorf("Remote node state is larger than limit (%d)", moreBytes)

	}

	//Start reporting the size before you cross the limit
	if moreBytes > uint32(math.Floor(.6*maxPushStateBytes)) {
		m.logger.Printf("[WARN] memberlist: Remote node state size is (%d) limit is (%d)", moreBytes, maxPushStateBytes)
	}

	// Read in the rest of the payload
	_, err = io.CopyN(cipherText, bufConn, int64(moreBytes))
	if err != nil {
		return nil, err
	}

	// Decrypt the cipherText with some authenticated data
	//
	// Authenticated Data is:
	//
	//   [messageType; byte] [messageLength; uint32] [label_data; optional]
	//
	dataBytes := appendBytes(cipherText.Bytes()[:5], []byte(streamLabel))
	cipherBytes := cipherText.Bytes()[5:]

	// Decrypt the payload
	keys := m.config.Keyring.GetKeys()
	return decryptPayload(keys, cipherBytes, dataBytes)
}

// readStream is used to read messages from a stream connection, decrypting and
// decompressing the stream if necessary.
//
// The provided streamLabel if present will be authenticated during decryption
// of each message.
func (m *Memberlist) readStream(conn net.Conn, streamLabel string) (messageType, io.Reader, *codec.Decoder, error) {
	// Created a buffered reader
	var bufConn io.Reader = bufio.NewReader(conn)

	// Read the message type
	buf := [1]byte{0}
	if _, err := io.ReadFull(bufConn, buf[:]); err != nil {
		return 0, nil, nil, err
	}
	msgType := messageType(buf[0])

	// Check if the message is encrypted
	if msgType == encryptMsg {
		if !m.config.EncryptionEnabled() {
			return 0, nil, nil,
				fmt.Errorf("Remote state is encrypted and encryption is not configured")
		}

		plain, err := m.decryptRemoteState(bufConn, streamLabel)
		if err != nil {
			return 0, nil, nil, err
		}

		// Reset message type and bufConn
		msgType = messageType(plain[0])
		bufConn = bytes.NewReader(plain[1:])
	} else if m.config.EncryptionEnabled() && m.config.GossipVerifyIncoming {
		return 0, nil, nil,
			fmt.Errorf("Encryption is configured but remote state is not encrypted")
	}

	// Get the msgPack decoders
	hd := codec.MsgpackHandle{}
	dec := codec.NewDecoder(bufConn, &hd)

	// Check if we have a compressed message
	if msgType == compressMsg {
		var c compress
		if err := dec.Decode(&c); err != nil {
			return 0, nil, nil, err
		}
		decomp, err := decompressBuffer(&c)
		if err != nil {
			return 0, nil, nil, err
		}

		// Reset the message type
		msgType = messageType(decomp[0])

		// Create a new bufConn
		bufConn = bytes.NewReader(decomp[1:])

		// Create a new decoder
		dec = codec.NewDecoder(bufConn, &hd)
	}

	return msgType, bufConn, dec, nil
}

// readRemoteState is used to read the remote state from a connection
func (m *Memberlist) readRemoteState(bufConn io.Reader, dec *codec.Decoder) (bool, []pushNodeState, []byte, error) {
	// Read the push/pull header
	var header pushPullHeader
	if err := dec.Decode(&header); err != nil {
		return false, nil, nil, err
	}

	// Allocate space for the transfer
	remoteNodes := make([]pushNodeState, header.Nodes)

	// Try to decode all the states
	for i := 0; i < header.Nodes; i++ {
		if err := dec.Decode(&remoteNodes[i]); err != nil {
			return false, nil, nil, err
		}
	}

	// Read the remote user state into a buffer
	var userBuf []byte
	if header.UserStateLen > 0 {
		userBuf = make([]byte, header.UserStateLen)
		bytes, err := io.ReadAtLeast(bufConn, userBuf, header.UserStateLen)
		if err == nil && bytes != header.UserStateLen {
			err = fmt.Errorf(
				"Failed to read full user state (%d / %d)",
				bytes, header.UserStateLen)
		}
		if err != nil {
			return false, nil, nil, err
		}
	}

	// For proto versions < 2, there is no port provided. Mask old
	// behavior by using the configured port
	for idx := range remoteNodes {
		if m.ProtocolVersion() < 2 || remoteNodes[idx].Port == 0 {
			remoteNodes[idx].Port = uint16(m.config.BindPort)
		}
	}

	return header.Join, remoteNodes, userBuf, nil
}

// mergeRemoteState is used to merge the remote state with our local state
func (m *Memberlist) mergeRemoteState(join bool, remoteNodes []pushNodeState, userBuf []byte) error {
	if err := m.verifyProtocol(remoteNodes); err != nil {
		return err
	}

	// Invoke the merge delegate if any
	if join && m.config.Merge != nil {
		nodes := make([]*Node, len(remoteNodes))
		for idx, n := range remoteNodes {
			nodes[idx] = &Node{
				Name:  n.Name,
				Addr:  n.Addr,
				Port:  n.Port,
				Meta:  n.Meta,
				State: n.State,
				PMin:  n.Vsn[0],
				PMax:  n.Vsn[1],
				PCur:  n.Vsn[2],
				DMin:  n.Vsn[3],
				DMax:  n.Vsn[4],
				DCur:  n.Vsn[5],
			}
		}
		if err := m.config.Merge.NotifyMerge(nodes); err != nil {
			return err
		}
	}

	// Merge the membership state
	m.mergeState(remoteNodes)

	// Invoke the delegate for user state
	if userBuf != nil && m.config.Delegate != nil {
		m.config.Delegate.MergeRemoteState(userBuf, join)
	}
	return nil
}

// readUserMsg is used to decode a userMsg from a stream.
func (m *Memberlist) readUserMsg(bufConn io.Reader, dec *codec.Decoder) error {
	// Read the user message header
	var header userMsgHeader
	if err := dec.Decode(&header); err != nil {
		return err
	}

	// Read the user message into a buffer
	var userBuf []byte
	if header.UserMsgLen > 0 {
		userBuf = make([]byte, header.UserMsgLen)
		bytes, err := io.ReadAtLeast(bufConn, userBuf, header.UserMsgLen)
		if err == nil && bytes != header.UserMsgLen {
			err = fmt.Errorf(
				"Failed to read full user message (%d / %d)",
				bytes, header.UserMsgLen)
		}
		if err != nil {
			return err
		}

		d := m.config.Delegate
		if d != nil {
			d.NotifyMsg(userBuf)
		}
	}

	return nil
}

// sendPingAndWaitForAck makes a stream connection to the given address, sends
// a ping, and waits for an ack. All of this is done as a series of blocking
// operations, given the deadline. The bool return parameter is true if we
// we able to round trip a ping to the other node.
func (m *Memberlist) sendPingAndWaitForAck(a Address, ping ping, deadline time.Time) (bool, error) {
	if a.Name == "" && m.config.RequireNodeNames {
		return false, errNodeNamesAreRequired
	}

	conn, err := m.transport.DialAddressTimeout(a, deadline.Sub(time.Now()))
	if err != nil {
		// If the node is actually dead we expect this to fail, so we
		// shouldn't spam the logs with it. After this point, errors
		// with the connection are real, unexpected errors and should
		// get propagated up.
		return false, nil
	}
	defer conn.Close()
	conn.SetDeadline(deadline)

	out, err := encode(pingMsg, &ping, m.config.MsgpackUseNewTimeFormat)
	if err != nil {
		return false, err
	}

	if err = m.rawSendMsgStream(conn, out.Bytes(), m.config.Label); err != nil {
		return false, err
	}

	msgType, _, dec, err := m.readStream(conn, m.config.Label)
	if err != nil {
		return false, err
	}

	if msgType != ackRespMsg {
		return false, fmt.Errorf("Unexpected msgType (%d) from ping %s", msgType, LogConn(conn))
	}

	var ack ackResp
	if err = dec.Decode(&ack); err != nil {
		return false, err
	}

	if ack.SeqNo != ping.SeqNo {
		return false, fmt.Errorf("Sequence number from ack (%d) doesn't match ping (%d)", ack.SeqNo, ping.SeqNo)
	}

	return true, nil
}
