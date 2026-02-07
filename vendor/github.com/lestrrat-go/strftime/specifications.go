package strftime

import (
	"fmt"
	"sync"

	"github.com/pkg/errors"
)

// because there is no such thing was a sync.RWLocker
type rwLocker interface {
	RLock()
	RUnlock()
	sync.Locker
}

// SpecificationSet is a container for patterns that Strftime uses.
// If you want a custom strftime, you can copy the default
// SpecificationSet and tweak it
type SpecificationSet interface {
	Lookup(byte) (Appender, error)
	Delete(byte) error
	Set(byte, Appender) error
}

type specificationSet struct {
	mutable bool
	lock    rwLocker
	store   map[byte]Appender
}

// The default specification set does not need any locking as it is never
// accessed from the outside, and is never mutated.
var defaultSpecificationSet SpecificationSet

func init() {
	defaultSpecificationSet = newImmutableSpecificationSet()
}

func newImmutableSpecificationSet() SpecificationSet {
	// Create a mutable one so that populateDefaultSpecifications work through
	// its magic, then copy the associated map
	// (NOTE: this is done this way because there used to be
	// two struct types for specification set, united under an interface.
	// it can now be removed, but we would need to change the entire
	// populateDefaultSpecifications method, and I'm currently too lazy
	// PRs welcome)
	tmp := NewSpecificationSet()

	ss := &specificationSet{
		mutable: false,
		lock:    nil, // never used, so intentionally not initialized
		store:   tmp.(*specificationSet).store,
	}

	return ss
}

// NewSpecificationSet creates a specification set with the default specifications.
func NewSpecificationSet() SpecificationSet {
	ds := &specificationSet{
		mutable: true,
		lock:    &sync.RWMutex{},
		store:   make(map[byte]Appender),
	}
	populateDefaultSpecifications(ds)

	return ds
}

var defaultSpecifications = map[byte]Appender{
	'A': fullWeekDayName,
	'a': abbrvWeekDayName,
	'B': fullMonthName,
	'b': abbrvMonthName,
	'C': centuryDecimal,
	'c': timeAndDate,
	'D': mdy,
	'd': dayOfMonthZeroPad,
	'e': dayOfMonthSpacePad,
	'F': ymd,
	'H': twentyFourHourClockZeroPad,
	'h': abbrvMonthName,
	'I': twelveHourClockZeroPad,
	'j': dayOfYear,
	'k': twentyFourHourClockSpacePad,
	'l': twelveHourClockSpacePad,
	'M': minutesZeroPad,
	'm': monthNumberZeroPad,
	'n': newline,
	'p': ampm,
	'R': hm,
	'r': imsp,
	'S': secondsNumberZeroPad,
	'T': hms,
	't': tab,
	'U': weekNumberSundayOrigin,
	'u': weekdayMondayOrigin,
	'V': weekNumberMondayOriginOneOrigin,
	'v': eby,
	'W': weekNumberMondayOrigin,
	'w': weekdaySundayOrigin,
	'X': natReprTime,
	'x': natReprDate,
	'Y': year,
	'y': yearNoCentury,
	'Z': timezone,
	'z': timezoneOffset,
	'%': percent,
}

func populateDefaultSpecifications(ds SpecificationSet) {
	for c, handler := range defaultSpecifications {
		if err := ds.Set(c, handler); err != nil {
			panic(fmt.Sprintf("failed to set default specification for %c: %s", c, err))
		}
	}
}

func (ds *specificationSet) Lookup(b byte) (Appender, error) {
	if ds.mutable {
		ds.lock.RLock()
		defer ds.lock.RLock()
	}
	v, ok := ds.store[b]
	if !ok {
		return nil, errors.Errorf(`lookup failed: '%%%c' was not found in specification set`, b)
	}
	return v, nil
}

func (ds *specificationSet) Delete(b byte) error {
	if !ds.mutable {
		return errors.New(`delete failed: this specification set is marked immutable`)
	}

	ds.lock.Lock()
	defer ds.lock.Unlock()
	delete(ds.store, b)
	return nil
}

func (ds *specificationSet) Set(b byte, a Appender) error {
	if !ds.mutable {
		return errors.New(`set failed: this specification set is marked immutable`)
	}

	ds.lock.Lock()
	defer ds.lock.Unlock()
	ds.store[b] = a
	return nil
}
