/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package badger

import (
	stderrors "errors"
	"math"
)

const (
	// ValueThresholdLimit is the maximum permissible value of opt.ValueThreshold.
	ValueThresholdLimit = math.MaxUint16 - 16 + 1
)

var (
	// ErrValueLogSize is returned when opt.ValueLogFileSize option is not within the valid
	// range.
	ErrValueLogSize = stderrors.New("Invalid ValueLogFileSize, must be in range [1MB, 2GB)")

	// ErrKeyNotFound is returned when key isn't found on a txn.Get.
	ErrKeyNotFound = stderrors.New("Key not found")

	// ErrTxnTooBig is returned if too many writes are fit into a single transaction.
	ErrTxnTooBig = stderrors.New("Txn is too big to fit into one request")

	// ErrConflict is returned when a transaction conflicts with another transaction. This can
	// happen if the read rows had been updated concurrently by another transaction.
	ErrConflict = stderrors.New("Transaction Conflict. Please retry")

	// ErrReadOnlyTxn is returned if an update function is called on a read-only transaction.
	ErrReadOnlyTxn = stderrors.New("No sets or deletes are allowed in a read-only transaction")

	// ErrDiscardedTxn is returned if a previously discarded transaction is re-used.
	ErrDiscardedTxn = stderrors.New("This transaction has been discarded. Create a new one")

	// ErrEmptyKey is returned if an empty key is passed on an update function.
	ErrEmptyKey = stderrors.New("Key cannot be empty")

	// ErrInvalidKey is returned if the key has a special !badger! prefix,
	// reserved for internal usage.
	ErrInvalidKey = stderrors.New("Key is using a reserved !badger! prefix")

	// ErrBannedKey is returned if the read/write key belongs to any banned namespace.
	ErrBannedKey = stderrors.New("Key is using the banned prefix")

	// ErrThresholdZero is returned if threshold is set to zero, and value log GC is called.
	// In such a case, GC can't be run.
	ErrThresholdZero = stderrors.New(
		"Value log GC can't run because threshold is set to zero")

	// ErrNoRewrite is returned if a call for value log GC doesn't result in a log file rewrite.
	ErrNoRewrite = stderrors.New(
		"Value log GC attempt didn't result in any cleanup")

	// ErrRejected is returned if a value log GC is called either while another GC is running, or
	// after DB::Close has been called.
	ErrRejected = stderrors.New("Value log GC request rejected")

	// ErrInvalidRequest is returned if the user request is invalid.
	ErrInvalidRequest = stderrors.New("Invalid request")

	// ErrManagedTxn is returned if the user tries to use an API which isn't
	// allowed due to external management of transactions, when using ManagedDB.
	ErrManagedTxn = stderrors.New(
		"Invalid API request. Not allowed to perform this action using ManagedDB")

	// ErrNamespaceMode is returned if the user tries to use an API which is allowed only when
	// NamespaceOffset is non-negative.
	ErrNamespaceMode = stderrors.New(
		"Invalid API request. Not allowed to perform this action when NamespaceMode is not set.")

	// ErrInvalidDump if a data dump made previously cannot be loaded into the database.
	ErrInvalidDump = stderrors.New("Data dump cannot be read")

	// ErrZeroBandwidth is returned if the user passes in zero bandwidth for sequence.
	ErrZeroBandwidth = stderrors.New("Bandwidth must be greater than zero")

	// ErrWindowsNotSupported is returned when opt.ReadOnly is used on Windows
	ErrWindowsNotSupported = stderrors.New("Read-only mode is not supported on Windows")

	// ErrPlan9NotSupported is returned when opt.ReadOnly is used on Plan 9
	ErrPlan9NotSupported = stderrors.New("Read-only mode is not supported on Plan 9")

	// ErrTruncateNeeded is returned when the value log gets corrupt, and requires truncation of
	// corrupt data to allow Badger to run properly.
	ErrTruncateNeeded = stderrors.New(
		"Log truncate required to run DB. This might result in data loss")

	// ErrBlockedWrites is returned if the user called DropAll. During the process of dropping all
	// data from Badger, we stop accepting new writes, by returning this error.
	ErrBlockedWrites = stderrors.New("Writes are blocked, possibly due to DropAll or Close")

	// ErrNilCallback is returned when subscriber's callback is nil.
	ErrNilCallback = stderrors.New("Callback cannot be nil")

	// ErrEncryptionKeyMismatch is returned when the storage key is not
	// matched with the key previously given.
	ErrEncryptionKeyMismatch = stderrors.New("Encryption key mismatch")

	// ErrInvalidDataKeyID is returned if the datakey id is invalid.
	ErrInvalidDataKeyID = stderrors.New("Invalid datakey id")

	// ErrInvalidEncryptionKey is returned if length of encryption keys is invalid.
	ErrInvalidEncryptionKey = stderrors.New("Encryption key's length should be" +
		"either 16, 24, or 32 bytes")
	// ErrGCInMemoryMode is returned when db.RunValueLogGC is called in in-memory mode.
	ErrGCInMemoryMode = stderrors.New("Cannot run value log GC when DB is opened in InMemory mode")

	// ErrDBClosed is returned when a get operation is performed after closing the DB.
	ErrDBClosed = stderrors.New("DB Closed")
)
