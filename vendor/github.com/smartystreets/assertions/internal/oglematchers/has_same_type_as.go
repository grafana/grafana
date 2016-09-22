// Copyright 2015 Aaron Jacobs. All Rights Reserved.
// Author: aaronjjacobs@gmail.com (Aaron Jacobs)
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

package oglematchers

import (
	"fmt"
	"reflect"
)

// HasSameTypeAs returns a matcher that matches values with exactly the same
// type as the supplied prototype.
func HasSameTypeAs(p interface{}) Matcher {
	expected := reflect.TypeOf(p)
	pred := func(c interface{}) error {
		actual := reflect.TypeOf(c)
		if actual != expected {
			return fmt.Errorf("which has type %v", actual)
		}

		return nil
	}

	return NewMatcher(pred, fmt.Sprintf("has type %v", expected))
}
