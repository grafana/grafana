package mssql

import (
	"encoding/binary"
	"errors"
	"io"
	"sync"
)

type packetType uint8

type header struct {
	PacketType packetType
	Status     uint8
	Size       uint16
	Spid       uint16
	PacketNo   uint8
	Pad        uint8
}

// bufpool provides buffers which are used for reading and writing in the tdsBuffer instances
var bufpool = sync.Pool{
	New: func() interface{} {
		b := make([]byte, 1<<16)
		// If the return value is not a pointer, any conversion from interface{} will
		// involve an allocation.
		return &b
	},
}

// tdsBuffer reads and writes TDS packets of data to the transport.
// The write and read buffers are separate to make sending attn signals
// possible without locks. Currently attn signals are only sent during
// reads, not writes.
type tdsBuffer struct {
	transport io.ReadWriteCloser

	packetSize int

	// bufClose is responsible for returning the buffer back to the pool
	bufClose func()

	// Write fields.
	wbuf        []byte
	wpos        int
	wPacketSeq  byte
	wPacketType packetType

	// Read fields.
	rbuf        []byte
	rpos        int
	rsize       int
	final       bool
	rPacketType packetType

	// afterFirst is assigned to right after tdsBuffer is created and
	// before the first use. It is executed after the first packet is
	// written and then removed.
	afterFirst func()
}

func newTdsBuffer(bufsize uint16, transport io.ReadWriteCloser) *tdsBuffer {

	// pull an existing buf if one is available or get and add a new buf to the bufpool
	buf := bufpool.Get().(*[]byte)

	return &tdsBuffer{
		packetSize: int(bufsize),
		wbuf:       (*buf)[:1<<15],
		rbuf:       (*buf)[1<<15:],
		bufClose:   func() { bufpool.Put(buf) },
		rpos:       8,
		transport:  transport,
	}
}

func (rw *tdsBuffer) ResizeBuffer(packetSize int) {
	rw.packetSize = packetSize
}

func (w *tdsBuffer) PackageSize() int {
	return w.packetSize
}

func (w *tdsBuffer) flush() (err error) {
	// Write packet size.
	w.wbuf[0] = byte(w.wPacketType)
	binary.BigEndian.PutUint16(w.wbuf[2:], uint16(w.wpos))
	w.wbuf[6] = w.wPacketSeq

	// Write packet into underlying transport.
	if _, err = w.transport.Write(w.wbuf[:w.wpos]); err != nil {
		return err
	}
	// It is possible to create a whole new buffer after a flush.
	// Useful for debugging. Normally reuse the buffer.
	// w.wbuf = make([]byte, 1<<16)

	// Execute afterFirst hook if it is set.
	if w.afterFirst != nil {
		w.afterFirst()
		w.afterFirst = nil
	}

	w.wpos = 8
	w.wPacketSeq++
	return nil
}

func (w *tdsBuffer) Write(p []byte) (total int, err error) {
	for {
		copied := copy(w.wbuf[w.wpos:w.packetSize], p)
		w.wpos += copied
		total += copied
		if copied == len(p) {
			return
		}
		if err = w.flush(); err != nil {
			return
		}
		p = p[copied:]
	}
}

func (w *tdsBuffer) WriteByte(b byte) error {
	if int(w.wpos) == len(w.wbuf) || w.wpos == w.packetSize {
		if err := w.flush(); err != nil {
			return err
		}
	}
	w.wbuf[w.wpos] = b
	w.wpos += 1
	return nil
}

func (w *tdsBuffer) BeginPacket(packetType packetType, resetSession bool) {
	status := byte(0)
	if resetSession {
		switch packetType {
		// Reset session can only be set on the following packet types.
		case packSQLBatch, packRPCRequest, packTransMgrReq:
			status = 0x8
		}
	}
	w.wbuf[1] = status // Packet is incomplete. This byte is set again in FinishPacket.
	w.wpos = 8
	w.wPacketSeq = 1
	w.wPacketType = packetType
}

func (w *tdsBuffer) FinishPacket() error {
	w.wbuf[1] |= 1 // Mark this as the last packet in the message.
	return w.flush()
}

var headerSize = binary.Size(header{})

func (r *tdsBuffer) readNextPacket() error {
	buf := r.rbuf[:headerSize]
	_, err := io.ReadFull(r.transport, buf)
	if err != nil {
		return err
	}
	h := header{
		PacketType: packetType(buf[0]),
		Status:     buf[1],
		Size:       binary.BigEndian.Uint16(buf[2:4]),
		Spid:       binary.BigEndian.Uint16(buf[4:6]),
		PacketNo:   buf[6],
		Pad:        buf[7],
	}
	if int(h.Size) > r.packetSize {
		return errors.New("invalid packet size, it is longer than buffer size")
	}
	if headerSize > int(h.Size) {
		return errors.New("invalid packet size, it is shorter than header size")
	}
	_, err = io.ReadFull(r.transport, r.rbuf[headerSize:h.Size])
	//s := base64.StdEncoding.EncodeToString(r.rbuf[headerSize:h.Size])
	//fmt.Print(s)
	if err != nil {
		return err
	}
	r.rpos = headerSize
	r.rsize = int(h.Size)
	r.final = h.Status != 0
	r.rPacketType = h.PacketType
	return nil
}

func (r *tdsBuffer) BeginRead() (packetType, error) {
	err := r.readNextPacket()
	if err != nil {
		return 0, err
	}
	return r.rPacketType, nil
}

func (r *tdsBuffer) ReadByte() (res byte, err error) {
	if r.rpos == r.rsize {
		if r.final {
			return 0, io.EOF
		}
		err = r.readNextPacket()
		if err != nil {
			return 0, err
		}
	}
	res = r.rbuf[r.rpos]
	r.rpos++
	return res, nil
}

func (r *tdsBuffer) byte() byte {
	b, err := r.ReadByte()
	if err != nil {
		badStreamPanic(err)
	}
	return b
}

func (r *tdsBuffer) ReadFull(buf []byte) {
	_, err := io.ReadFull(r, buf)
	if err != nil {
		badStreamPanic(err)
	}
}

func (r *tdsBuffer) uint64() uint64 {
	// have we got enough room in the buffer to read 8 bytes, if not, do a ReadFull, else read directly from r.rbuf
	if r.rpos+7 >= r.rsize {
		var buf [8]byte
		r.ReadFull(buf[:])

		return uint64(buf[0]) | uint64(buf[1])<<8 | uint64(buf[2])<<16 | uint64(buf[3])<<24 |
			uint64(buf[4])<<32 | uint64(buf[5])<<40 | uint64(buf[6])<<48 | uint64(buf[7])<<56
	}

	res := uint64(r.rbuf[r.rpos]) | uint64(r.rbuf[r.rpos+1])<<8 | uint64(r.rbuf[r.rpos+2])<<16 | uint64(r.rbuf[r.rpos+3])<<24 |
		uint64(r.rbuf[r.rpos+4])<<32 | uint64(r.rbuf[r.rpos+5])<<40 | uint64(r.rbuf[r.rpos+6])<<48 | uint64(r.rbuf[r.rpos+7])<<56

	r.rpos += 8
	return res
}

func (r *tdsBuffer) int32() int32 {
	return int32(r.uint32())
}

func (r *tdsBuffer) uint32() uint32 {
	// have we got enough room in the buffer to read 4 bytes, if not, do a ReadFull, else read directly from r.rbuf
	if r.rpos+3 >= r.rsize {
		var buf [4]byte
		r.ReadFull(buf[:])
		return uint32(buf[0]) | uint32(buf[1])<<8 | uint32(buf[2])<<16 | uint32(buf[3])<<24
	}

	res := uint32(r.rbuf[r.rpos]) | uint32(r.rbuf[r.rpos+1])<<8 | uint32(r.rbuf[r.rpos+2])<<16 | uint32(r.rbuf[r.rpos+3])<<24
	r.rpos += 4
	return res
}

func (r *tdsBuffer) uint16() uint16 {
	// have we got enough room in the buffer to read 2 bytes, if not, do a ReadFull, else read directly from r.rbuf
	if r.rpos+1 >= r.rsize {
		var buf [2]byte
		r.ReadFull(buf[:])
		return uint16(buf[0]) | uint16(buf[1])<<8
	}

	res := uint16(r.rbuf[r.rpos]) | uint16(r.rbuf[r.rpos+1])<<8
	r.rpos += 2
	return res
}

func (r *tdsBuffer) BVarChar() string {
	return readBVarCharOrPanic(r)
}

func readBVarCharOrPanic(r io.Reader) string {
	s, err := readBVarChar(r)
	if err != nil {
		badStreamPanic(err)
	}
	return s
}

func readUsVarCharOrPanic(r io.Reader) string {
	s, err := readUsVarChar(r)
	if err != nil {
		badStreamPanic(err)
	}
	return s
}

func (r *tdsBuffer) UsVarChar() string {
	return readUsVarCharOrPanic(r)
}

func (r *tdsBuffer) Read(buf []byte) (copied int, err error) {
	copied = 0
	err = nil
	if r.rpos == r.rsize {
		if r.final {
			return 0, io.EOF
		}
		err = r.readNextPacket()
		if err != nil {
			return
		}
	}
	copied = copy(buf, r.rbuf[r.rpos:r.rsize])
	r.rpos += copied
	return
}
