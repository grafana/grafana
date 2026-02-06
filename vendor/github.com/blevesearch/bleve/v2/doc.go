//  Copyright (c) 2014 Couchbase, Inc.
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

/*
Package bleve is a library for indexing and searching text.

Example Opening New Index, Indexing Data

	message := struct{
	    Id:   "example"
	    From: "xyz@couchbase.com",
	    Body: "bleve indexing is easy",
	}

	mapping := bleve.NewIndexMapping()
	index, _ := bleve.New("example.bleve", mapping)
	index.Index(message.Id, message)

Example Opening Existing Index, Searching Data

	index, _ := bleve.Open("example.bleve")
	query := bleve.NewQueryStringQuery("bleve")
	searchRequest := bleve.NewSearchRequest(query)
	searchResult, _ := index.Search(searchRequest)
*/
package bleve
