// Copyright 2019 The mqtt-go authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package mqtt

import (
	"math/rand"
	"sync/atomic"
	"time"
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

func (c *BaseClient) initID() {
	atomic.StoreUint32(&c.idLast, uint32(rand.Int31n(0xFFFE))+1)
}

func (c *BaseClient) newID() uint16 {
	id := uint16(atomic.AddUint32(&c.idLast, 1))
	if id == 0 {
		return c.newID()
	}
	return id
}
