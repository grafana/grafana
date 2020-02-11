// Copyright (c) 2016-2017. Oleg Sklyar & teris.io. All rights reserved.
// See the LICENSE file in the project root for licensing information.

// Original algorithm:
// Copyright (c) 2015 Dylan Greene, contributors: https://github.com/dylang/shortid.
// MIT-license as found in the LICENSE file.

// Seed computation: based on The Central Randomizer 1.3
// Copyright (c) 1997 Paul Houle (houle@msc.cornell.edu)

// Package shortid enables the generation of short, unique, non-sequential and by default URL friendly
// Ids. The package is heavily inspired by the node.js https://github.com/dylang/shortid library.
//
// Id Length
//
// The standard Id length is 9 symbols when generated at a rate of 1 Id per millisecond,
// occasionally it reaches 11 (at the rate of a few thousand Ids per millisecond) and very-very
// rarely it can go beyond that during continuous generation at full throttle on high-performant
// hardware. A test generating 500k Ids at full throttle on conventional hardware generated the
// following Ids at the head and the tail (length > 9 is expected for this test):
//
//  -NDveu-9Q
//  iNove6iQ9J
//  NVDve6-9Q
//  VVDvc6i99J
//  NVovc6-QQy
//  VVoveui9QC
//  ...
//  tFmGc6iQQs
//  KpTvcui99k
//  KFTGcuiQ9p
//  KFmGeu-Q9O
//  tFTvcu-QQt
//  tpTveu-99u
//
// Life span
//
// The package guarantees the generation of unique Ids with zero collisions for 34 years
// (1/1/2016-1/1/2050) using the same worker Id within a single (although concurrent) application if
// application restarts take longer than 1 millisecond. The package supports up to 32 works, all
// providing unique sequences.
//
// Implementation details
//
// Although heavily inspired by the node.js shortid library this is
// not a simple Go port. In addition it
//
//  - is safe to concurrency;
//  - does not require any yearly version/epoch resets;
//  - provides stable Id size over a long period at the rate of 1ms;
//  - guarantees no collisions (due to guaranteed fixed size of Ids between milliseconds and because
//    multiple requests within the same ms lead to longer Ids with the prefix unique to the ms);
//  - supports 32 over 16 workers.
//
// The algorithm uses less randomness than the original node.js implementation, which permits to
// extend the life span as well as reduce and guarantee the length. In general terms, each Id
// has the following 3 pieces of information encoded: the millisecond (first 8 symbols), the worker
// Id (9th symbol), running concurrent counter within the same millisecond, only if required, over
// all remaining symbols. The element of randomness per symbol is 1/2 for the worker and the
// millisecond and 0 for the counter. Here 0 means no randomness, i.e. every value is encoded using
// a 64-base alphabet; 1/2 means one of two matching symbols of the supplied alphabet, 1/4 one of
// four matching symbols. The original algorithm of the node.js module uses 1/4 throughout.
//
// All methods accepting the parameters that govern the randomness are exported and can be used
// to directly implement an algorithm with e.g. more randomness, but with longer Ids and shorter
// life spans.
package shortid

import (
	randc "crypto/rand"
	"errors"
	"fmt"
	"math"
	randm "math/rand"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"
)

// Version defined the library version.
const Version = 1.1

// DefaultABC is the default URL-friendly alphabet.
const DefaultABC = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-"

// Abc represents a shuffled alphabet used to generate the Ids and provides methods to
// encode data.
type Abc struct {
	alphabet []rune
}

// Shortid type represents a short Id generator working with a given alphabet.
type Shortid struct {
	abc    Abc
	worker uint
	epoch  time.Time  // ids can be generated for 34 years since this date
	ms     uint       // ms since epoch for the last id
	count  uint       // request count within the same ms
	mx     sync.Mutex // locks access to ms and count
}

var shortid *Shortid

func init() {
	shortid = MustNew(0, DefaultABC, 1)
}

// GetDefault retrieves the default short Id generator initialised with the default alphabet,
// worker=0 and seed=1. The default can be overwritten using SetDefault.
func GetDefault() *Shortid {
	return (*Shortid)(atomic.LoadPointer((*unsafe.Pointer)(unsafe.Pointer(&shortid))))
}

// SetDefault overwrites the default generator.
func SetDefault(sid *Shortid) {
	target := (*unsafe.Pointer)(unsafe.Pointer(&shortid))
	source := unsafe.Pointer(sid)
	atomic.SwapPointer(target, source)
}

// Generate generates an Id using the default generator.
func Generate() (string, error) {
	return shortid.Generate()
}

// MustGenerate acts just like Generate, but panics instead of returning errors.
func MustGenerate() string {
	id, err := Generate()
	if err == nil {
		return id
	}
	panic(err)
}

// New constructs an instance of the short Id generator for the given worker number [0,31], alphabet
// (64 unique symbols) and seed value (to shuffle the alphabet). The worker number should be
// different for multiple or distributed processes generating Ids into the same data space. The
// seed, on contrary, should be identical.
func New(worker uint8, alphabet string, seed uint64) (*Shortid, error) {
	if worker > 31 {
		return nil, errors.New("expected worker in the range [0,31]")
	}
	abc, err := NewAbc(alphabet, seed)
	if err == nil {
		sid := &Shortid{
			abc:    abc,
			worker: uint(worker),
			epoch:  time.Date(2016, time.January, 1, 0, 0, 0, 0, time.UTC),
			ms:     0,
			count:  0,
		}
		return sid, nil
	}
	return nil, err
}

// MustNew acts just like New, but panics instead of returning errors.
func MustNew(worker uint8, alphabet string, seed uint64) *Shortid {
	sid, err := New(worker, alphabet, seed)
	if err == nil {
		return sid
	}
	panic(err)
}

// Generate generates a new short Id.
func (sid *Shortid) Generate() (string, error) {
	return sid.GenerateInternal(nil, sid.epoch)
}

// MustGenerate acts just like Generate, but panics instead of returning errors.
func (sid *Shortid) MustGenerate() string {
	id, err := sid.Generate()
	if err == nil {
		return id
	}
	panic(err)
}

// GenerateInternal should only be used for testing purposes.
func (sid *Shortid) GenerateInternal(tm *time.Time, epoch time.Time) (string, error) {
	ms, count := sid.getMsAndCounter(tm, epoch)
	idrunes := make([]rune, 9)
	if tmp, err := sid.abc.Encode(ms, 8, 5); err == nil {
		copy(idrunes, tmp) // first 8 symbols
	} else {
		return "", err
	}
	if tmp, err := sid.abc.Encode(sid.worker, 1, 5); err == nil {
		idrunes[8] = tmp[0]
	} else {
		return "", err
	}
	if count > 0 {
		if countrunes, err := sid.abc.Encode(count, 0, 6); err == nil {
			// only extend if really need it
			idrunes = append(idrunes, countrunes...)
		} else {
			return "", err
		}
	}
	return string(idrunes), nil
}

func (sid *Shortid) getMsAndCounter(tm *time.Time, epoch time.Time) (uint, uint) {
	sid.mx.Lock()
	defer sid.mx.Unlock()
	var ms uint
	if tm != nil {
		ms = uint(tm.Sub(epoch).Nanoseconds() / 1000000)
	} else {
		ms = uint(time.Now().Sub(epoch).Nanoseconds() / 1000000)
	}
	if ms == sid.ms {
		sid.count++
	} else {
		sid.count = 0
		sid.ms = ms
	}
	return sid.ms, sid.count
}

// String returns a string representation of the short Id generator.
func (sid *Shortid) String() string {
	return fmt.Sprintf("Shortid(worker=%v, epoch=%v, abc=%v)", sid.worker, sid.epoch, sid.abc)
}

// Abc returns the instance of alphabet used for representing the Ids.
func (sid *Shortid) Abc() Abc {
	return sid.abc
}

// Epoch returns the value of epoch used as the beginning of millisecond counting (normally
// 2016-01-01 00:00:00 local time)
func (sid *Shortid) Epoch() time.Time {
	return sid.epoch
}

// Worker returns the value of worker for this short Id generator.
func (sid *Shortid) Worker() uint {
	return sid.worker
}

// NewAbc constructs a new instance of shuffled alphabet to be used for Id representation.
func NewAbc(alphabet string, seed uint64) (Abc, error) {
	runes := []rune(alphabet)
	if len(runes) != len(DefaultABC) {
		return Abc{}, fmt.Errorf("alphabet must contain %v unique characters", len(DefaultABC))
	}
	if nonUnique(runes) {
		return Abc{}, errors.New("alphabet must contain unique characters only")
	}
	abc := Abc{alphabet: nil}
	abc.shuffle(alphabet, seed)
	return abc, nil
}

// MustNewAbc acts just like NewAbc, but panics instead of returning errors.
func MustNewAbc(alphabet string, seed uint64) Abc {
	res, err := NewAbc(alphabet, seed)
	if err == nil {
		return res
	}
	panic(err)
}

func nonUnique(runes []rune) bool {
	found := make(map[rune]struct{})
	for _, r := range runes {
		if _, seen := found[r]; !seen {
			found[r] = struct{}{}
		}
	}
	return len(found) < len(runes)
}

func (abc *Abc) shuffle(alphabet string, seed uint64) {
	source := []rune(alphabet)
	for len(source) > 1 {
		seed = (seed*9301 + 49297) % 233280
		i := int(seed * uint64(len(source)) / 233280)

		abc.alphabet = append(abc.alphabet, source[i])
		source = append(source[:i], source[i+1:]...)
	}
	abc.alphabet = append(abc.alphabet, source[0])
}

// Encode encodes a given value into a slice of runes of length nsymbols. In case nsymbols==0, the
// length of the result is automatically computed from data. Even if fewer symbols is required to
// encode the data than nsymbols, all positions are used encoding 0 where required to guarantee
// uniqueness in case further data is added to the sequence. The value of digits [4,6] represents
// represents n in 2^n, which defines how much randomness flows into the algorithm: 4 -- every value
// can be represented by 4 symbols in the alphabet (permitting at most 16 values), 5 -- every value
// can be represented by 2 symbols in the alphabet (permitting at most 32 values), 6 -- every value
// is represented by exactly 1 symbol with no randomness (permitting 64 values).
func (abc *Abc) Encode(val, nsymbols, digits uint) ([]rune, error) {
	if digits < 4 || 6 < digits {
		return nil, fmt.Errorf("allowed digits range [4,6], found %v", digits)
	}

	var computedSize uint = 1
	if val >= 1 {
		computedSize = uint(math.Log2(float64(val)))/digits + 1
	}
	if nsymbols == 0 {
		nsymbols = computedSize
	} else if nsymbols < computedSize {
		return nil, fmt.Errorf("cannot accommodate data, need %v digits, got %v", computedSize, nsymbols)
	}

	mask := 1<<digits - 1

	random := make([]int, int(nsymbols))
	// no random component if digits == 6
	if digits < 6 {
		copy(random, maskedRandomInts(len(random), 0x3f-mask))
	}

	res := make([]rune, int(nsymbols))
	for i := range res {
		shift := digits * uint(i)
		index := (int(val>>shift) & mask) | random[i]
		res[i] = abc.alphabet[index]
	}
	return res, nil
}

// MustEncode acts just like Encode, but panics instead of returning errors.
func (abc *Abc) MustEncode(val, size, digits uint) []rune {
	res, err := abc.Encode(val, size, digits)
	if err == nil {
		return res
	}
	panic(err)
}

func maskedRandomInts(size, mask int) []int {
	ints := make([]int, size)
	bytes := make([]byte, size)
	if _, err := randc.Read(bytes); err == nil {
		for i, b := range bytes {
			ints[i] = int(b) & mask
		}
	} else {
		for i := range ints {
			ints[i] = randm.Intn(0xff) & mask
		}
	}
	return ints
}

// String returns a string representation of the Abc instance.
func (abc Abc) String() string {
	return fmt.Sprintf("Abc{alphabet='%v')", abc.Alphabet())
}

// Alphabet returns the alphabet used as an immutable string.
func (abc Abc) Alphabet() string {
	return string(abc.alphabet)
}
