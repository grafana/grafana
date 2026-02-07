/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package badger

import (
	"bytes"
	"context"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	humanize "github.com/dustin/go-humanize"
	"google.golang.org/protobuf/proto"

	"github.com/dgraph-io/badger/v4/pb"
	"github.com/dgraph-io/badger/v4/y"
	"github.com/dgraph-io/ristretto/v2/z"
)

const batchSize = 16 << 20 // 16 MB

// maxStreamSize is the maximum allowed size of a stream batch. This is a soft limit
// as a single list that is still over the limit will have to be sent as is since it
// cannot be split further. This limit prevents the framework from creating batches
// so big that sending them causes issues (e.g running into the max size gRPC limit).
var maxStreamSize = uint64(100 << 20) // 100MB

// Stream provides a framework to concurrently iterate over a snapshot of Badger, pick up
// key-values, batch them up and call Send. Stream does concurrent iteration over many smaller key
// ranges. It does NOT send keys in lexicographical sorted order. To get keys in sorted
// order, use Iterator.
type Stream struct {
	// Prefix to only iterate over certain range of keys. If set to nil (default), Stream would
	// iterate over the entire DB.
	Prefix []byte

	// Number of goroutines to use for iterating over key ranges. Defaults to 8.
	NumGo int

	// Badger would produce log entries in Infof to indicate the progress of Stream. LogPrefix can
	// be used to help differentiate them from other activities. Default is "Badger.Stream".
	LogPrefix string

	// ChooseKey is invoked each time a new key is encountered. Note that this is not called
	// on every version of the value, only the first encountered version (i.e. the highest version
	// of the value a key has). ChooseKey can be left nil to select all keys.
	//
	// Note: Calls to ChooseKey are concurrent.
	ChooseKey func(item *Item) bool

	// MaxSize is the maximum allowed size of a stream batch. This is a soft limit
	// as a single list that is still over the limit will have to be sent as is since it
	// cannot be split further. This limit prevents the framework from creating batches
	// so big that sending them causes issues (e.g running into the max size gRPC limit).
	// If necessary, set it up before the Stream starts synchronisation
	// This is not a concurrency-safe setting
	MaxSize uint64

	// KeyToList, similar to ChooseKey, is only invoked on the highest version of the value. It
	// is upto the caller to iterate over the versions and generate zero, one or more KVs. It
	// is expected that the user would advance the iterator to go through the versions of the
	// values. However, the user MUST immediately return from this function on the first encounter
	// with a mismatching key. See example usage in ToList function. Can be left nil to use ToList
	// function by default.
	//
	// KeyToList has access to z.Allocator accessible via stream.Allocator(itr.ThreadId). This
	// allocator can be used to allocate KVs, to decrease the memory pressure on Go GC. Stream
	// framework takes care of releasing those resources after calling Send. AllocRef does
	// NOT need to be set in the returned KVList, as Stream framework would ignore that field,
	// instead using the allocator assigned to that thread id.
	//
	// Note: Calls to KeyToList are concurrent.
	KeyToList func(key []byte, itr *Iterator) (*pb.KVList, error)

	// This is the method where Stream sends the final output. All calls to Send are done by a
	// single goroutine, i.e. logic within Send method can expect single threaded execution.
	Send func(buf *z.Buffer) error

	// Read data above the sinceTs. All keys with version =< sinceTs will be ignored.
	SinceTs      uint64
	readTs       uint64
	db           *DB
	rangeCh      chan keyRange
	kvChan       chan *z.Buffer
	nextStreamId atomic.Uint32
	doneMarkers  bool
	scanned      atomic.Uint64 // used to estimate the ETA for data scan.
	numProducers atomic.Int32
}

// SendDoneMarkers when true would send out done markers on the stream. False by default.
func (st *Stream) SendDoneMarkers(done bool) {
	st.doneMarkers = done
}

// ToList is a default implementation of KeyToList. It picks up all valid versions of the key,
// skipping over deleted or expired keys.
func (st *Stream) ToList(key []byte, itr *Iterator) (*pb.KVList, error) {
	a := itr.Alloc
	ka := a.Copy(key)

	list := &pb.KVList{}
	for ; itr.Valid(); itr.Next() {
		item := itr.Item()
		if item.IsDeletedOrExpired() {
			break
		}
		if !bytes.Equal(key, item.Key()) {
			// Break out on the first encounter with another key.
			break
		}

		kv := y.NewKV(a)
		kv.Key = ka

		if err := item.Value(func(val []byte) error {
			kv.Value = a.Copy(val)
			return nil

		}); err != nil {
			return nil, err
		}
		kv.Version = item.Version()
		kv.ExpiresAt = item.ExpiresAt()
		kv.UserMeta = a.Copy([]byte{item.UserMeta()})

		list.Kv = append(list.Kv, kv)
		if st.db.opt.NumVersionsToKeep == 1 {
			break
		}

		if item.DiscardEarlierVersions() {
			break
		}
	}
	return list, nil
}

// keyRange is [start, end), including start, excluding end. Do ensure that the start,
// end byte slices are owned by keyRange struct.
func (st *Stream) produceRanges(ctx context.Context) {
	ranges := st.db.Ranges(st.Prefix, 16)
	y.AssertTrue(len(ranges) > 0)
	y.AssertTrue(ranges[0].left == nil)
	y.AssertTrue(ranges[len(ranges)-1].right == nil)
	st.db.opt.Infof("Number of ranges found: %d\n", len(ranges))

	// Sort in descending order of size.
	sort.Slice(ranges, func(i, j int) bool {
		return ranges[i].size > ranges[j].size
	})
	for i, r := range ranges {
		st.rangeCh <- *r
		st.db.opt.Infof("Sent range %d for iteration: [%x, %x) of size: %s\n",
			i, r.left, r.right, humanize.IBytes(uint64(r.size)))
	}
	close(st.rangeCh)
}

// produceKVs picks up ranges from rangeCh, generates KV lists and sends them to kvChan.
func (st *Stream) produceKVs(ctx context.Context, threadId int) error {
	st.numProducers.Add(1)
	defer st.numProducers.Add(-1)

	var txn *Txn
	if st.readTs > 0 {
		txn = st.db.NewTransactionAt(st.readTs, false)
	} else {
		txn = st.db.NewTransaction(false)
	}
	defer txn.Discard()

	// produceKVs is running iterate serially. So, we can define the outList here.
	outList := z.NewBuffer(2*batchSize, "Stream.ProduceKVs")
	defer func() {
		// The outList variable changes. So, we need to evaluate the variable in the defer. DO NOT
		// call `defer outList.Release()`.
		_ = outList.Release()
	}()

	iterate := func(kr keyRange) error {
		iterOpts := DefaultIteratorOptions
		iterOpts.AllVersions = true
		iterOpts.Prefix = st.Prefix
		iterOpts.PrefetchValues = false
		iterOpts.SinceTs = st.SinceTs
		itr := txn.NewIterator(iterOpts)
		itr.ThreadId = threadId
		defer itr.Close()

		itr.Alloc = z.NewAllocator(1<<20, "Stream.Iterate")
		defer itr.Alloc.Release()

		// This unique stream id is used to identify all the keys from this iteration.
		streamId := st.nextStreamId.Add(1)
		var scanned int

		sendIt := func() error {
			select {
			case st.kvChan <- outList:
				outList = z.NewBuffer(2*batchSize, "Stream.ProduceKVs")
				st.scanned.Add(uint64(itr.scanned - scanned))
				scanned = itr.scanned
			case <-ctx.Done():
				return ctx.Err()
			}
			return nil
		}

		var prevKey []byte
		for itr.Seek(kr.left); itr.Valid(); {
			// it.Valid would only return true for keys with the provided Prefix in iterOpts.
			item := itr.Item()
			if bytes.Equal(item.Key(), prevKey) {
				itr.Next()
				continue
			}
			prevKey = append(prevKey[:0], item.Key()...)

			// Check if we reached the end of the key range.
			if len(kr.right) > 0 && bytes.Compare(item.Key(), kr.right) >= 0 {
				break
			}

			// Check if we should pick this key.
			if st.ChooseKey != nil && !st.ChooseKey(item) {
				continue
			}

			// Now convert to key value.
			itr.Alloc.Reset()
			list, err := st.KeyToList(item.KeyCopy(nil), itr)
			if err != nil {
				st.db.opt.Warningf("While reading key: %x, got error: %v", item.Key(), err)
				continue
			}
			if list == nil || len(list.Kv) == 0 {
				continue
			}
			for _, kv := range list.Kv {
				kv.StreamId = streamId
				KVToBuffer(kv, outList)
				if outList.LenNoPadding() < batchSize {
					continue
				}
				if err := sendIt(); err != nil {
					return err
				}
			}
		}
		// Mark the stream as done.
		if st.doneMarkers {
			kv := &pb.KV{
				StreamId:   streamId,
				StreamDone: true,
			}
			KVToBuffer(kv, outList)
		}
		return sendIt()
	}

	for {
		select {
		case kr, ok := <-st.rangeCh:
			if !ok {
				// Done with the keys.
				return nil
			}
			if err := iterate(kr); err != nil {
				return err
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (st *Stream) streamKVs(ctx context.Context) error {
	onDiskSize, uncompressedSize := st.db.EstimateSize(st.Prefix)
	// Manish has seen uncompressed size to be in 20% error margin.
	uncompressedSize = uint64(float64(uncompressedSize) * 1.2)
	st.db.opt.Infof("%s Streaming about %s of uncompressed data (%s on disk)\n",
		st.LogPrefix, humanize.IBytes(uncompressedSize), humanize.IBytes(onDiskSize))

	tickerDur := 5 * time.Second
	var bytesSent uint64
	t := time.NewTicker(tickerDur)
	defer t.Stop()
	now := time.Now()

	sendBatch := func(batch *z.Buffer) error {
		defer func() { _ = batch.Release() }()
		sz := uint64(batch.LenNoPadding())
		if sz == 0 {
			return nil
		}
		bytesSent += sz
		// st.db.opt.Infof("%s Sending batch of size: %s.\n", st.LogPrefix, humanize.IBytes(sz))
		if err := st.Send(batch); err != nil {
			st.db.opt.Warningf("Error while sending: %v\n", err)
			return err
		}
		return nil
	}

	slurp := func(batch *z.Buffer) error {
	loop:
		for {
			// Send the batch immediately if it already exceeds the maximum allowed size.
			// If the size of the batch exceeds maxStreamSize, break from the loop to
			// avoid creating a batch that is so big that certain limits are reached.
			if uint64(batch.LenNoPadding()) > st.MaxSize {
				break loop
			}
			select {
			case kvs, ok := <-st.kvChan:
				if !ok {
					break loop
				}
				y.AssertTrue(kvs != nil)
				y.Check2(batch.Write(kvs.Bytes()))
				y.Check(kvs.Release())

			default:
				break loop
			}
		}
		return sendBatch(batch)
	} // end of slurp.

	writeRate := y.NewRateMonitor(20)
	scanRate := y.NewRateMonitor(20)
outer:
	for {
		var batch *z.Buffer
		select {
		case <-ctx.Done():
			return ctx.Err()

		case <-t.C:
			// Instead of calculating speed over the entire lifetime, we average the speed over
			// ticker duration.
			writeRate.Capture(bytesSent)
			scanned := st.scanned.Load()
			scanRate.Capture(scanned)
			numProducers := st.numProducers.Load()

			st.db.opt.Infof("%s [%s] Scan (%d): ~%s/%s at %s/sec. Sent: %s at %s/sec."+
				" jemalloc: %s\n",
				st.LogPrefix, y.FixedDuration(time.Since(now)), numProducers,
				y.IBytesToString(scanned, 1), humanize.IBytes(uncompressedSize),
				humanize.IBytes(scanRate.Rate()),
				y.IBytesToString(bytesSent, 1), humanize.IBytes(writeRate.Rate()),
				humanize.IBytes(uint64(z.NumAllocBytes())))

		case kvs, ok := <-st.kvChan:
			if !ok {
				break outer
			}
			y.AssertTrue(kvs != nil)
			batch = kvs

			// Otherwise, slurp more keys into this batch.
			if err := slurp(batch); err != nil {
				return err
			}
		}
	}

	st.db.opt.Infof("%s Sent data of size %s\n", st.LogPrefix, humanize.IBytes(bytesSent))
	return nil
}

// Orchestrate runs Stream. It picks up ranges from the SSTables, then runs NumGo number of
// goroutines to iterate over these ranges and batch up KVs in lists. It concurrently runs a single
// goroutine to pick these lists, batch them up further and send to Output.Send. Orchestrate also
// spits logs out to Infof, using provided LogPrefix. Note that all calls to Output.Send
// are serial. In case any of these steps encounter an error, Orchestrate would stop execution and
// return that error. Orchestrate can be called multiple times, but in serial order.
func (st *Stream) Orchestrate(ctx context.Context) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	st.rangeCh = make(chan keyRange, 3) // Contains keys for posting lists.

	// kvChan should only have a small capacity to ensure that we don't buffer up too much data if
	// sending is slow. Page size is set to 4MB, which is used to lazily cap the size of each
	// KVList. To get 128MB buffer, we can set the channel size to 32.
	st.kvChan = make(chan *z.Buffer, 32)

	if st.KeyToList == nil {
		st.KeyToList = st.ToList
	}

	// Picks up ranges from Badger, and sends them to rangeCh.
	go st.produceRanges(ctx)

	errCh := make(chan error, st.NumGo) // Stores error by consumeKeys.
	var wg sync.WaitGroup
	for i := 0; i < st.NumGo; i++ {
		wg.Add(1)

		go func(threadId int) {
			defer wg.Done()
			// Picks up ranges from rangeCh, generates KV lists, and sends them to kvChan.
			if err := st.produceKVs(ctx, threadId); err != nil {
				select {
				case errCh <- err:
				default:
				}
			}
		}(i)
	}

	// Pick up key-values from kvChan and send to stream.
	kvErr := make(chan error, 1)
	go func() {
		// Picks up KV lists from kvChan, and sends them to Output.
		err := st.streamKVs(ctx)
		if err != nil {
			cancel() // Stop all the go routines.
		}
		kvErr <- err
	}()
	wg.Wait()        // Wait for produceKVs to be over.
	close(st.kvChan) // Now we can close kvChan.
	defer func() {
		// If due to some error, we have buffers left in kvChan, we should release them.
		for buf := range st.kvChan {
			_ = buf.Release()
		}
	}()

	select {
	case err := <-errCh: // Check error from produceKVs.
		return err
	default:
	}

	// Wait for key streaming to be over.
	err := <-kvErr
	return err
}

func (db *DB) newStream() *Stream {
	return &Stream{
		db:        db,
		NumGo:     db.opt.NumGoroutines,
		LogPrefix: "Badger.Stream",
		MaxSize:   maxStreamSize,
	}
}

// NewStream creates a new Stream.
func (db *DB) NewStream() *Stream {
	if db.opt.managedTxns {
		panic("This API can not be called in managed mode.")
	}
	return db.newStream()
}

// NewStreamAt creates a new Stream at a particular timestamp. Should only be used with managed DB.
func (db *DB) NewStreamAt(readTs uint64) *Stream {
	if !db.opt.managedTxns {
		panic("This API can only be called in managed mode.")
	}
	stream := db.newStream()
	stream.readTs = readTs
	return stream
}

func BufferToKVList(buf *z.Buffer) (*pb.KVList, error) {
	var list pb.KVList
	err := buf.SliceIterate(func(s []byte) error {
		kv := new(pb.KV)
		if err := proto.Unmarshal(s, kv); err != nil {
			return err
		}
		list.Kv = append(list.Kv, kv)
		return nil
	})
	return &list, err
}

func KVToBuffer(kv *pb.KV, buf *z.Buffer) {
	in := buf.SliceAllocate(proto.Size(kv))[:0]
	_, err := proto.MarshalOptions{}.MarshalAppend(in, kv)
	y.AssertTrue(err == nil)
}
