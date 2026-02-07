package internal

import (
	"bytes"
	"encoding/gob"

	"github.com/zeebo/xxh3"
)

const BlockBufferSize = 4 * 1024 * 1024

type DataBlock[V any] struct {
	Type          uint8 // 1: meta&timerwheel, 2: window, 3: probation, 4: protected
	SecondaryType uint8
	CheckSum      uint64
	Index         uint64 // helper filed, usage depends on Type/SecondaryType
	Data          []byte
	clean         bool
	buffer        *bytes.Buffer // used in entryDecoder
	// datablock should share single blockEncoder
	// but use separate entryEncoder
	blockEncoder *gob.Encoder
	entryEncoder *gob.Encoder
}

func NewBlock[V any](tp uint8, buffer *bytes.Buffer, blockEncoder *gob.Encoder) *DataBlock[V] {
	return &DataBlock[V]{
		Type:         tp,
		buffer:       buffer,
		blockEncoder: blockEncoder,
		entryEncoder: gob.NewEncoder(buffer),
		clean:        true,
	}
}

func (b *DataBlock[V]) Save() error {
	if b.clean {
		return nil
	}
	b.clean = true
	data := b.buffer.Bytes()
	b.CheckSum = xxh3.Hash(data)
	b.Data = data
	return b.blockEncoder.Encode(b)
}

func (b *DataBlock[V]) Write(item V) (full bool, err error) {
	err = b.entryEncoder.Encode(item)
	if err != nil {
		return false, err
	}
	b.clean = false
	if b.buffer.Len() >= BlockBufferSize {
		b.clean = true
		data := b.buffer.Bytes()
		b.CheckSum = xxh3.Hash(data)
		b.Data = data
		err = b.blockEncoder.Encode(b)
		return true, err
	}
	return false, nil
}

func (b *DataBlock[V]) MarkDirty() {
	b.clean = false
}
