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

type subTask interface {
	applyTo(*subscriptions)
}

type subscriptions []Subscription

func (s subscriptions) applyTo(d *subscriptions) {
	*d = append(*d, s...)
}

type unsubscriptions []string

func (s unsubscriptions) applyTo(d *subscriptions) {
	l := len(*d)
	for _, topic := range s {
		for i, e := range *d {
			if e.Topic == topic {
				l--
				(*d)[i] = (*d)[l]
				break
			}
		}
	}
	*d = (*d)[:l]
}
