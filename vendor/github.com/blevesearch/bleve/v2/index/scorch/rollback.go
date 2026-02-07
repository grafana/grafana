//  Copyright (c) 2017 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package scorch

import (
	"fmt"
	"log"
	"os"

	"github.com/blevesearch/bleve/v2/util"
	bolt "go.etcd.io/bbolt"
)

type RollbackPoint struct {
	epoch uint64
	meta  map[string][]byte
}

func (r *RollbackPoint) GetInternal(key []byte) []byte {
	return r.meta[string(key)]
}

// RollbackPoints returns an array of rollback points available for
// the application to rollback to, with more recent rollback points
// (higher epochs) coming first.
func RollbackPoints(path string) ([]*RollbackPoint, error) {
	if len(path) == 0 {
		return nil, fmt.Errorf("RollbackPoints: invalid path")
	}

	rootBoltPath := path + string(os.PathSeparator) + "root.bolt"
	rootBoltOpt := &bolt.Options{
		ReadOnly: true,
	}
	rootBolt, err := bolt.Open(rootBoltPath, 0600, rootBoltOpt)
	if err != nil || rootBolt == nil {
		return nil, err
	}

	// start a read-only bolt transaction
	tx, err := rootBolt.Begin(false)
	if err != nil {
		return nil, fmt.Errorf("RollbackPoints: failed to start" +
			" read-only transaction")
	}

	// read-only bolt transactions to be rolled back
	defer func() {
		_ = tx.Rollback()
		_ = rootBolt.Close()
	}()

	snapshots := tx.Bucket(util.BoltSnapshotsBucket)
	if snapshots == nil {
		return nil, nil
	}

	rollbackPoints := []*RollbackPoint{}

	c1 := snapshots.Cursor()
	for k, _ := c1.Last(); k != nil; k, _ = c1.Prev() {
		_, snapshotEpoch, err := decodeUvarintAscending(k)
		if err != nil {
			log.Printf("RollbackPoints:"+
				" unable to parse segment epoch %x, continuing", k)
			continue
		}

		snapshot := snapshots.Bucket(k)
		if snapshot == nil {
			log.Printf("RollbackPoints:"+
				" snapshot key, but bucket missing %x, continuing", k)
			continue
		}

		meta := map[string][]byte{}
		c2 := snapshot.Cursor()
		for j, _ := c2.First(); j != nil; j, _ = c2.Next() {
			if j[0] == util.BoltInternalKey[0] {
				internalBucket := snapshot.Bucket(j)
				if internalBucket == nil {
					err = fmt.Errorf("internal bucket missing")
					break
				}
				err = internalBucket.ForEach(func(key []byte, val []byte) error {
					copiedVal := append([]byte(nil), val...)
					meta[string(key)] = copiedVal
					return nil
				})
				if err != nil {
					break
				}
			}
		}

		if err != nil {
			log.Printf("RollbackPoints:"+
				" failed in fetching internal data: %v", err)
			continue
		}

		rollbackPoints = append(rollbackPoints, &RollbackPoint{
			epoch: snapshotEpoch,
			meta:  meta,
		})
	}

	return rollbackPoints, nil
}

// Rollback atomically and durably brings the store back to the point
// in time as represented by the RollbackPoint.
// Rollback() should only be passed a RollbackPoint that came from the
// same store using the RollbackPoints() API along with the index path.
func Rollback(path string, to *RollbackPoint) error {
	if to == nil {
		return fmt.Errorf("Rollback: RollbackPoint is nil")
	}
	if len(path) == 0 {
		return fmt.Errorf("Rollback: index path is empty")
	}

	rootBoltPath := path + string(os.PathSeparator) + "root.bolt"
	rootBoltOpt := &bolt.Options{
		ReadOnly: false,
	}
	rootBolt, err := bolt.Open(rootBoltPath, 0600, rootBoltOpt)
	if err != nil || rootBolt == nil {
		return err
	}
	defer func() {
		err1 := rootBolt.Close()
		if err1 != nil && err == nil {
			err = err1
		}
	}()

	// pick all the younger persisted epochs in bolt store
	// including the target one.
	var found bool
	var eligibleEpochs []uint64
	err = rootBolt.View(func(tx *bolt.Tx) error {
		snapshots := tx.Bucket(util.BoltSnapshotsBucket)
		if snapshots == nil {
			return nil
		}
		sc := snapshots.Cursor()
		for sk, _ := sc.Last(); sk != nil && !found; sk, _ = sc.Prev() {
			_, snapshotEpoch, err := decodeUvarintAscending(sk)
			if err != nil {
				continue
			}
			if snapshotEpoch == to.epoch {
				found = true
			}
			eligibleEpochs = append(eligibleEpochs, snapshotEpoch)
		}
		return nil
	})

	if len(eligibleEpochs) == 0 {
		return fmt.Errorf("Rollback: no persisted epochs found in bolt")
	}
	if !found {
		return fmt.Errorf("Rollback: target epoch %d not found in bolt", to.epoch)
	}

	// start a write transaction
	tx, err := rootBolt.Begin(true)
	if err != nil {
		return err
	}

	defer func() {
		if err == nil {
			err = tx.Commit()
		} else {
			_ = tx.Rollback()
		}
		if err == nil {
			err = rootBolt.Sync()
		}
	}()

	snapshots := tx.Bucket(util.BoltSnapshotsBucket)
	if snapshots == nil {
		return nil
	}
	for _, epoch := range eligibleEpochs {
		k := encodeUvarintAscending(nil, epoch)
		if err != nil {
			continue
		}
		if epoch == to.epoch {
			// return here as it already processed until the given epoch
			return nil
		}
		err = snapshots.DeleteBucket(k)
		if err == bolt.ErrBucketNotFound {
			err = nil
		}
	}

	return err
}
