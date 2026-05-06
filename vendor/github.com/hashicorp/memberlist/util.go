// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package memberlist

import (
	"bytes"
	"compress/lzw"
	"encoding/binary"
	"fmt"
	"io"
	"math"
	"math/rand"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/hashicorp/go-msgpack/v2/codec"
	"github.com/sean-/seed"
)

// pushPullScale is the minimum number of nodes
// before we start scaling the push/pull timing. The scale
// effect is the log2(Nodes) - log2(pushPullScale). This means
// that the 33rd node will cause us to double the interval,
// while the 65th will triple it.
const pushPullScaleThreshold = 32

const (
	// Constant litWidth 2-8
	lzwLitWidth = 8
)

func init() {
	seed.Init()
}

// Decode reverses the encode operation on a byte slice input
func decode(buf []byte, out interface{}) error {
	r := bytes.NewReader(buf)
	hd := codec.MsgpackHandle{}
	dec := codec.NewDecoder(r, &hd)
	return dec.Decode(out)
}

// Encode writes an encoded object to a new bytes buffer
func encode(msgType messageType, in interface{}, msgpackUseNewTimeFormat bool) (*bytes.Buffer, error) {
	buf := bytes.NewBuffer(nil)
	buf.WriteByte(uint8(msgType))
	hd := codec.MsgpackHandle{
		BasicHandle: codec.BasicHandle{
			TimeNotBuiltin: !msgpackUseNewTimeFormat,
		},
	}
	enc := codec.NewEncoder(buf, &hd)
	err := enc.Encode(in)
	return buf, err
}

// Returns a random offset between 0 and n
func randomOffset(n int) int {
	if n == 0 {
		return 0
	}
	return int(rand.Uint32() % uint32(n))
}

// suspicionTimeout computes the timeout that should be used when
// a node is suspected
func suspicionTimeout(suspicionMult, n int, interval time.Duration) time.Duration {
	nodeScale := math.Max(1.0, math.Log10(math.Max(1.0, float64(n))))
	// multiply by 1000 to keep some precision because time.Duration is an int64 type
	timeout := time.Duration(suspicionMult) * time.Duration(nodeScale*1000) * interval / 1000
	return timeout
}

// retransmitLimit computes the limit of retransmissions
func retransmitLimit(retransmitMult, n int) int {
	nodeScale := math.Ceil(math.Log10(float64(n + 1)))
	limit := retransmitMult * int(nodeScale)
	return limit
}

// shuffleNodes randomly shuffles the input nodes using the Fisher-Yates shuffle
func shuffleNodes(nodes []*nodeState) {
	n := len(nodes)
	rand.Shuffle(n, func(i, j int) {
		nodes[i], nodes[j] = nodes[j], nodes[i]
	})
}

// pushPushScale is used to scale the time interval at which push/pull
// syncs take place. It is used to prevent network saturation as the
// cluster size grows
func pushPullScale(interval time.Duration, n int) time.Duration {
	// Don't scale until we cross the threshold
	if n <= pushPullScaleThreshold {
		return interval
	}

	multiplier := math.Ceil(math.Log2(float64(n))-math.Log2(pushPullScaleThreshold)) + 1.0
	return time.Duration(multiplier) * interval
}

// moveDeadNodes moves dead and left nodes that that have not changed during the gossipToTheDeadTime interval
// to the end of the slice and returns the index of the first moved node.
func moveDeadNodes(nodes []*nodeState, gossipToTheDeadTime time.Duration) int {
	numDead := 0
	n := len(nodes)
	for i := 0; i < n-numDead; i++ {
		if !nodes[i].DeadOrLeft() {
			continue
		}

		// Respect the gossip to the dead interval
		if time.Since(nodes[i].StateChange) <= gossipToTheDeadTime {
			continue
		}

		// Move this node to the end
		nodes[i], nodes[n-numDead-1] = nodes[n-numDead-1], nodes[i]
		numDead++
		i--
	}
	return n - numDead
}

// kRandomNodes is used to select up to k random Nodes, excluding any nodes where
// the exclude function returns true. It is possible that less than k nodes are
// returned.
func kRandomNodes(k int, nodes []*nodeState, exclude func(*nodeState) bool) []Node {
	n := len(nodes)
	kNodes := make([]Node, 0, k)
OUTER:
	// Probe up to 3*n times, with large n this is not necessary
	// since k << n, but with small n we want search to be
	// exhaustive
	for i := 0; i < 3*n && len(kNodes) < k; i++ {
		// Get random nodeState
		idx := randomOffset(n)
		state := nodes[idx]

		// Give the filter a shot at it.
		if exclude != nil && exclude(state) {
			continue OUTER
		}

		// Check if we have this node already
		for j := 0; j < len(kNodes); j++ {
			if state.Node.Name == kNodes[j].Name {
				continue OUTER
			}
		}

		// Append the node
		kNodes = append(kNodes, state.Node)
	}
	return kNodes
}

// makeCompoundMessages takes a list of messages and packs
// them into one or multiple messages based on the limitations
// of compound messages (255 messages each).
func makeCompoundMessages(msgs [][]byte) []*bytes.Buffer {
	const maxMsgs = 255
	bufs := make([]*bytes.Buffer, 0, (len(msgs)+(maxMsgs-1))/maxMsgs)

	for ; len(msgs) > maxMsgs; msgs = msgs[maxMsgs:] {
		bufs = append(bufs, makeCompoundMessage(msgs[:maxMsgs]))
	}
	if len(msgs) > 0 {
		bufs = append(bufs, makeCompoundMessage(msgs))
	}

	return bufs
}

// makeCompoundMessage takes a list of messages and generates
// a single compound message containing all of them
func makeCompoundMessage(msgs [][]byte) *bytes.Buffer {
	// Create a local buffer
	buf := bytes.NewBuffer(nil)

	// Write out the type
	buf.WriteByte(uint8(compoundMsg))

	// Write out the number of message
	buf.WriteByte(uint8(len(msgs)))

	// Add the message lengths
	for _, m := range msgs {
		binary.Write(buf, binary.BigEndian, uint16(len(m)))
	}

	// Append the messages
	for _, m := range msgs {
		buf.Write(m)
	}

	return buf
}

// decodeCompoundMessage splits a compound message and returns
// the slices of individual messages. Also returns the number
// of truncated messages and any potential error
func decodeCompoundMessage(buf []byte) (trunc int, parts [][]byte, err error) {
	if len(buf) < 1 {
		err = fmt.Errorf("missing compound length byte")
		return
	}
	numParts := int(buf[0])
	buf = buf[1:]

	// Check we have enough bytes
	if len(buf) < numParts*2 {
		err = fmt.Errorf("truncated len slice")
		return
	}

	// Decode the lengths
	lengths := make([]uint16, numParts)
	for i := 0; i < numParts; i++ {
		lengths[i] = binary.BigEndian.Uint16(buf[i*2 : i*2+2])
	}
	buf = buf[numParts*2:]

	// Split each message
	for idx, msgLen := range lengths {
		if len(buf) < int(msgLen) {
			trunc = numParts - idx
			return
		}

		// Extract the slice, seek past on the buffer
		slice := buf[:msgLen]
		buf = buf[msgLen:]
		parts = append(parts, slice)
	}
	return
}

// compressPayload takes an opaque input buffer, compresses it
// and wraps it in a compress{} message that is encoded.
func compressPayload(inp []byte, msgpackUseNewTimeFormat bool) (*bytes.Buffer, error) {
	var buf bytes.Buffer
	compressor := lzw.NewWriter(&buf, lzw.LSB, lzwLitWidth)

	_, err := compressor.Write(inp)
	if err != nil {
		return nil, err
	}

	// Ensure we flush everything out
	if err := compressor.Close(); err != nil {
		return nil, err
	}

	// Create a compressed message
	c := compress{
		Algo: lzwAlgo,
		Buf:  buf.Bytes(),
	}
	return encode(compressMsg, &c, msgpackUseNewTimeFormat)
}

// decompressPayload is used to unpack an encoded compress{}
// message and return its payload uncompressed
func decompressPayload(msg []byte) ([]byte, error) {
	// Decode the message
	var c compress
	if err := decode(msg, &c); err != nil {
		return nil, err
	}
	return decompressBuffer(&c)
}

// decompressBuffer is used to decompress the buffer of
// a single compress message, handling multiple algorithms
func decompressBuffer(c *compress) ([]byte, error) {
	// Verify the algorithm
	if c.Algo != lzwAlgo {
		return nil, fmt.Errorf("Cannot decompress unknown algorithm %d", c.Algo)
	}

	// Create a uncompressor
	uncomp := lzw.NewReader(bytes.NewReader(c.Buf), lzw.LSB, lzwLitWidth)
	defer uncomp.Close()

	// Read all the data
	var b bytes.Buffer
	_, err := io.Copy(&b, uncomp)
	if err != nil {
		return nil, err
	}

	// Return the uncompressed bytes
	return b.Bytes(), nil
}

// joinHostPort returns the host:port form of an address, for use with a
// transport.
func joinHostPort(host string, port uint16) string {
	return net.JoinHostPort(host, strconv.Itoa(int(port)))
}

// hasPort is given a string of the form "host", "host:port", "ipv6::address",
// or "[ipv6::address]:port", and returns true if the string includes a port.
func hasPort(s string) bool {
	// IPv6 address in brackets.
	if strings.LastIndex(s, "[") == 0 {
		return strings.LastIndex(s, ":") > strings.LastIndex(s, "]")
	}

	// Otherwise the presence of a single colon determines if there's a port
	// since IPv6 addresses outside of brackets (count > 1) can't have a
	// port.
	return strings.Count(s, ":") == 1
}

// ensurePort makes sure the given string has a port number on it, otherwise it
// appends the given port as a default.
func ensurePort(s string, port int) string {
	if hasPort(s) {
		return s
	}

	// If this is an IPv6 address, the join call will add another set of
	// brackets, so we have to trim before we add the default port.
	s = strings.Trim(s, "[]")
	s = net.JoinHostPort(s, strconv.Itoa(port))
	return s
}
