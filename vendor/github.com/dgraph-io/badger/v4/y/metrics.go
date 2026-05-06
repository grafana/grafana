/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package y

import (
	"expvar"
)

const (
	BADGER_METRIC_PREFIX = "badger_"
)

var (
	// lsmSize has size of the LSM in bytes
	lsmSize *expvar.Map
	// vlogSize has size of the value log in bytes
	vlogSize *expvar.Map
	// pendingWrites tracks the number of pending writes.
	pendingWrites *expvar.Map

	// These are cumulative

	// VLOG METRICS
	// numReads has cumulative number of reads from vlog
	numReadsVlog *expvar.Int
	// numWrites has cumulative number of writes into vlog
	numWritesVlog *expvar.Int
	// numBytesRead has cumulative number of bytes read from VLOG
	numBytesReadVlog *expvar.Int
	// numBytesVlogWritten has cumulative number of bytes written into VLOG
	numBytesVlogWritten *expvar.Int

	// LSM METRICS
	// numBytesRead has cumulative number of bytes read from LSM tree
	numBytesReadLSM *expvar.Int
	// numBytesWrittenToL0 has cumulative number of bytes written into LSM Tree
	numBytesWrittenToL0 *expvar.Int
	// numLSMGets is number of LSM gets
	numLSMGets *expvar.Map
	// numBytesCompactionWritten is the number of bytes written in the lsm tree due to compaction
	numBytesCompactionWritten *expvar.Map
	// numLSMBloomHits is number of LMS bloom hits
	numLSMBloomHits *expvar.Map

	// DB METRICS
	// numGets is number of gets -> Number of get requests made
	numGets *expvar.Int
	// number of get queries in which we actually get a result
	numGetsWithResults *expvar.Int
	// number of iterators created, these would be the number of range queries
	numIteratorsCreated *expvar.Int
	// numPuts is number of puts -> Number of puts requests made
	numPuts *expvar.Int
	// numMemtableGets is number of memtable gets -> Number of get requests made on memtable
	numMemtableGets *expvar.Int
	// numCompactionTables is the number of tables being compacted
	numCompactionTables *expvar.Int
	// Total writes by a user in bytes
	numBytesWrittenUser *expvar.Int
)

// These variables are global and have cumulative values for all kv stores.
// Naming convention of metrics: {badger_version}_{singular operation}_{granularity}_{component}
func init() {
	numReadsVlog = expvar.NewInt(BADGER_METRIC_PREFIX + "read_num_vlog")
	numBytesReadVlog = expvar.NewInt(BADGER_METRIC_PREFIX + "read_bytes_vlog")
	numWritesVlog = expvar.NewInt(BADGER_METRIC_PREFIX + "write_num_vlog")
	numBytesVlogWritten = expvar.NewInt(BADGER_METRIC_PREFIX + "write_bytes_vlog")

	numBytesReadLSM = expvar.NewInt(BADGER_METRIC_PREFIX + "read_bytes_lsm")
	numBytesWrittenToL0 = expvar.NewInt(BADGER_METRIC_PREFIX + "write_bytes_l0")
	numBytesCompactionWritten = expvar.NewMap(BADGER_METRIC_PREFIX + "write_bytes_compaction")

	numLSMGets = expvar.NewMap(BADGER_METRIC_PREFIX + "get_num_lsm")
	numLSMBloomHits = expvar.NewMap(BADGER_METRIC_PREFIX + "hit_num_lsm_bloom_filter")
	numMemtableGets = expvar.NewInt(BADGER_METRIC_PREFIX + "get_num_memtable")

	// User operations
	numGets = expvar.NewInt(BADGER_METRIC_PREFIX + "get_num_user")
	numPuts = expvar.NewInt(BADGER_METRIC_PREFIX + "put_num_user")
	numBytesWrittenUser = expvar.NewInt(BADGER_METRIC_PREFIX + "write_bytes_user")

	// Required for Enabled
	numGetsWithResults = expvar.NewInt(BADGER_METRIC_PREFIX + "get_with_result_num_user")
	numIteratorsCreated = expvar.NewInt(BADGER_METRIC_PREFIX + "iterator_num_user")

	// Sizes
	lsmSize = expvar.NewMap(BADGER_METRIC_PREFIX + "size_bytes_lsm")
	vlogSize = expvar.NewMap(BADGER_METRIC_PREFIX + "size_bytes_vlog")

	pendingWrites = expvar.NewMap(BADGER_METRIC_PREFIX + "write_pending_num_memtable")
	numCompactionTables = expvar.NewInt(BADGER_METRIC_PREFIX + "compaction_current_num_lsm")
}

func NumIteratorsCreatedAdd(enabled bool, val int64) {
	addInt(enabled, numIteratorsCreated, val)
}

func NumGetsWithResultsAdd(enabled bool, val int64) {
	addInt(enabled, numGetsWithResults, val)
}

func NumReadsVlogAdd(enabled bool, val int64) {
	addInt(enabled, numReadsVlog, val)
}

func NumBytesWrittenUserAdd(enabled bool, val int64) {
	addInt(enabled, numBytesWrittenUser, val)
}

func NumWritesVlogAdd(enabled bool, val int64) {
	addInt(enabled, numWritesVlog, val)
}

func NumBytesReadsVlogAdd(enabled bool, val int64) {
	addInt(enabled, numBytesReadVlog, val)
}

func NumBytesReadsLSMAdd(enabled bool, val int64) {
	addInt(enabled, numBytesReadLSM, val)
}

func NumBytesWrittenVlogAdd(enabled bool, val int64) {
	addInt(enabled, numBytesVlogWritten, val)
}

func NumBytesWrittenToL0Add(enabled bool, val int64) {
	addInt(enabled, numBytesWrittenToL0, val)
}

func NumBytesCompactionWrittenAdd(enabled bool, key string, val int64) {
	addToMap(enabled, numBytesCompactionWritten, key, val)
}

func NumGetsAdd(enabled bool, val int64) {
	addInt(enabled, numGets, val)
}

func NumPutsAdd(enabled bool, val int64) {
	addInt(enabled, numPuts, val)
}

func NumMemtableGetsAdd(enabled bool, val int64) {
	addInt(enabled, numMemtableGets, val)
}

func NumCompactionTablesAdd(enabled bool, val int64) {
	addInt(enabled, numCompactionTables, val)
}

func LSMSizeSet(enabled bool, key string, val expvar.Var) {
	storeToMap(enabled, lsmSize, key, val)
}

func VlogSizeSet(enabled bool, key string, val expvar.Var) {
	storeToMap(enabled, vlogSize, key, val)
}

func PendingWritesSet(enabled bool, key string, val expvar.Var) {
	storeToMap(enabled, pendingWrites, key, val)
}

func NumLSMBloomHitsAdd(enabled bool, key string, val int64) {
	addToMap(enabled, numLSMBloomHits, key, val)
}

func NumLSMGetsAdd(enabled bool, key string, val int64) {
	addToMap(enabled, numLSMGets, key, val)
}

func LSMSizeGet(enabled bool, key string) expvar.Var {
	return getFromMap(enabled, lsmSize, key)
}

func VlogSizeGet(enabled bool, key string) expvar.Var {
	return getFromMap(enabled, vlogSize, key)
}

func addInt(enabled bool, metric *expvar.Int, val int64) {
	if !enabled {
		return
	}

	metric.Add(val)
}

func addToMap(enabled bool, metric *expvar.Map, key string, val int64) {
	if !enabled {
		return
	}

	metric.Add(key, val)
}

func storeToMap(enabled bool, metric *expvar.Map, key string, val expvar.Var) {
	if !enabled {
		return
	}

	metric.Set(key, val)
}

func getFromMap(enabled bool, metric *expvar.Map, key string) expvar.Var {
	if !enabled {
		return nil
	}

	return metric.Get(key)
}
