// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package pqarrow

import (
	"github.com/apache/arrow-go/v18/arrow"
)

func releaseArrays(arrays []arrow.Array) {
	for _, a := range arrays {
		if a != nil {
			a.Release()
		}
	}
}

func releaseArrayData(data []arrow.ArrayData) {
	for _, d := range data {
		if d != nil {
			d.Release()
		}
	}
}

func releaseColumns(columns []arrow.Column) {
	for _, col := range columns {
		if col.Data() != nil { // data can be nil due to the way columns are constructed in ReadRowGroups
			col.Release()
		}
	}
}
