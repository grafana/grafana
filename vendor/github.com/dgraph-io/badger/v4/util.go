/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package badger

import (
	"encoding/hex"
	"fmt"
	"math/rand"
	"os"
	"time"

	"github.com/dgraph-io/badger/v4/table"
	"github.com/dgraph-io/badger/v4/y"
)

func (s *levelsController) validate() error {
	for _, l := range s.levels {
		if err := l.validate(); err != nil {
			return y.Wrap(err, "Levels Controller")
		}
	}
	return nil
}

// Check does some sanity check on one level of data or in-memory index.
func (s *levelHandler) validate() error {
	if s.level == 0 {
		return nil
	}

	s.RLock()
	defer s.RUnlock()
	numTables := len(s.tables)
	for j := 1; j < numTables; j++ {
		if j >= len(s.tables) {
			return fmt.Errorf("Level %d, j=%d numTables=%d", s.level, j, numTables)
		}

		if y.CompareKeys(s.tables[j-1].Biggest(), s.tables[j].Smallest()) >= 0 {
			return fmt.Errorf(
				"Inter: Biggest(j-1)[%d] \n%s\n vs Smallest(j)[%d]: \n%s\n: "+
					"level=%d j=%d numTables=%d",
				s.tables[j-1].ID(), hex.Dump(s.tables[j-1].Biggest()), s.tables[j].ID(),
				hex.Dump(s.tables[j].Smallest()), s.level, j, numTables)
		}

		if y.CompareKeys(s.tables[j].Smallest(), s.tables[j].Biggest()) > 0 {
			return fmt.Errorf(
				"Intra: \n%s\n vs \n%s\n: level=%d j=%d numTables=%d",
				hex.Dump(s.tables[j].Smallest()), hex.Dump(s.tables[j].Biggest()), s.level, j, numTables)
		}
	}
	return nil
}

// func (s *KV) debugPrintMore() { s.lc.debugPrintMore() }

// // debugPrintMore shows key ranges of each level.
// func (s *levelsController) debugPrintMore() {
// 	s.Lock()
// 	defer s.Unlock()
// 	for i := 0; i < s.kv.opt.MaxLevels; i++ {
// 		s.levels[i].debugPrintMore()
// 	}
// }

// func (s *levelHandler) debugPrintMore() {
// 	s.RLock()
// 	defer s.RUnlock()
// 	s.elog.Printf("Level %d:", s.level)
// 	for _, t := range s.tables {
// 		y.Printf(" [%s, %s]", t.Smallest(), t.Biggest())
// 	}
// 	y.Printf("\n")
// }

// reserveFileID reserves a unique file id.
func (s *levelsController) reserveFileID() uint64 {
	id := s.nextFileID.Add(1)
	return id - 1
}

func getIDMap(dir string) map[uint64]struct{} {
	fileInfos, err := os.ReadDir(dir)
	y.Check(err)
	idMap := make(map[uint64]struct{})
	for _, info := range fileInfos {
		if info.IsDir() {
			continue
		}
		fileID, ok := table.ParseFileID(info.Name())
		if !ok {
			continue
		}
		idMap[fileID] = struct{}{}
	}
	return idMap
}

func init() {
	rand.Seed(time.Now().UnixNano())
}
