//  Copyright (c) 2020 Couchbase, Inc.
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

package index

import segment "github.com/blugelabs/bluge_segment_api"

type notificationChan chan struct{}

type epochWatcher struct {
	epoch    uint64
	notifyCh notificationChan
}

type epochWatchers []*epochWatcher

func (e *epochWatchers) Add(watcher *epochWatcher) {
	*e = append(*e, watcher)
}

func (e *epochWatchers) NotifySatisfiedWatchers(epoch uint64) {
	var epochWatchersNext epochWatchers
	for _, w := range *e {
		if w.epoch < epoch {
			close(w.notifyCh)
		} else {
			epochWatchersNext.Add(w)
		}
	}
	*e = epochWatchersNext
}

type watcherChan chan *epochWatcher

func (w watcherChan) NotifyUsAfter(epoch uint64, closeCh chan struct{}) (*epochWatcher, error) {
	ew := &epochWatcher{
		epoch:    epoch,
		notifyCh: make(notificationChan, 1),
	}
	select {
	case <-closeCh:
		return nil, segment.ErrClosed
	case w <- ew:
	}
	return ew, nil
}
