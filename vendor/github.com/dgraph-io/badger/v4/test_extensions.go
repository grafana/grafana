/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package badger

// Important: Do NOT import the "testing" package, as otherwise, that
// will pull in imports into the production class that we do not want.

// TODO: Consider using this with specific compilation tags so that it only
//       shows up when performing testing (e.g., specify build tag=unit).
//       We are not yet ready to do that, as it may impact customer usage as
//       well as requiring us to update the CI build flags. Moreover, the
//       current model does not actually incur any significant cost.
//       If we do this, we will also want to introduce a parallel file that
//       overrides some of these structs and functions with empty contents.

// String constants for messages to be pushed to syncChan.
const (
	updateDiscardStatsMsg = "updateDiscardStats iteration done"
	endVLogInitMsg        = "End: vlog.init(db)"
)

// testOnlyOptions specifies an extension to the type Options that we want to
// use only in the context of testing.
type testOnlyOptions struct {
	// syncChan is used to listen for specific messages related to activities
	// that can occur in a DB instance. Currently, this is only used in
	// testing activities.
	syncChan chan string
}

// testOnlyDBExtensions specifies an extension to the type DB that we want to
// use only in the context of testing.
type testOnlyDBExtensions struct {
	syncChan chan string

	// onCloseDiscardCapture will be populated by a DB instance during the
	// process of performing the Close operation. Currently, we only consider
	// using this during testing.
	onCloseDiscardCapture map[uint64]uint64
}

// logToSyncChan sends a message to the DB's syncChan. Note that we expect
// that the DB never closes this channel; the responsibility for
// allocating and closing the channel belongs to the test module.
// if db.syncChan is nil or has never been initialized, ths will be
// silently ignored.
func (db *DB) logToSyncChan(msg string) {
	if db.syncChan != nil {
		db.syncChan <- msg
	}
}

// captureDiscardStats will copy the contents of the discardStats file
// maintained by vlog to the onCloseDiscardCapture map specified by
// db.opt. Of couse, if db.opt.onCloseDiscardCapture is nil (as expected
// for a production system as opposed to a test system), this is a no-op.
func (db *DB) captureDiscardStats() {
	if db.onCloseDiscardCapture != nil {
		db.vlog.discardStats.Lock()
		db.vlog.discardStats.Iterate(func(id, val uint64) {
			db.onCloseDiscardCapture[id] = val
		})
		db.vlog.discardStats.Unlock()
	}
}
