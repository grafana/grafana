package redis

import "sync"

// ScanIterator is used to incrementally iterate over a collection of elements.
// It's safe for concurrent use by multiple goroutines.
type ScanIterator struct {
	mu  sync.Mutex // protects Scanner and pos
	cmd *ScanCmd
	pos int
}

// Err returns the last iterator error, if any.
func (it *ScanIterator) Err() error {
	it.mu.Lock()
	err := it.cmd.Err()
	it.mu.Unlock()
	return err
}

// Next advances the cursor and returns true if more values can be read.
func (it *ScanIterator) Next() bool {
	it.mu.Lock()
	defer it.mu.Unlock()

	// Instantly return on errors.
	if it.cmd.Err() != nil {
		return false
	}

	// Advance cursor, check if we are still within range.
	if it.pos < len(it.cmd.page) {
		it.pos++
		return true
	}

	for {
		// Return if there is no more data to fetch.
		if it.cmd.cursor == 0 {
			return false
		}

		// Fetch next page.
		if it.cmd._args[0] == "scan" {
			it.cmd._args[1] = it.cmd.cursor
		} else {
			it.cmd._args[2] = it.cmd.cursor
		}

		err := it.cmd.process(it.cmd)
		if err != nil {
			return false
		}

		it.pos = 1

		// Redis can occasionally return empty page.
		if len(it.cmd.page) > 0 {
			return true
		}
	}
}

// Val returns the key/field at the current cursor position.
func (it *ScanIterator) Val() string {
	var v string
	it.mu.Lock()
	if it.cmd.Err() == nil && it.pos > 0 && it.pos <= len(it.cmd.page) {
		v = it.cmd.page[it.pos-1]
	}
	it.mu.Unlock()
	return v
}
