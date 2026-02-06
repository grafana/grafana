/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package sqlparser

import querypb "github.com/dolthub/vitess/go/vt/proto/query"

// RedactSQLQuery returns a sql string with the params stripped out for display
func RedactSQLQuery(sql string) (string, error) {
	bv := map[string]*querypb.BindVariable{}
	sqlStripped, comments := SplitMarginComments(sql)

	stmt, err := Parse(sqlStripped)
	if err != nil {
		return "", err
	}

	prefix := "redacted"
	Normalize(stmt, bv, prefix)

	return comments.Leading + String(stmt) + comments.Trailing, nil
}
