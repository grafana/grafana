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

// Package compute is a native-go implementation of an Acero-like
// arrow compute engine. It requires go1.18+
//
// While consumers of Arrow that are able to use CGO could utilize the
// C Data API (using the cdata package) and could link against the
// acero library directly, there are consumers who cannot use CGO. This
// is an attempt to provide for those users, and in general create a
// native-go arrow compute engine.
//
// The overwhelming majority of things in this package require go1.18 as
// it utilizes generics. The files in this package and its sub-packages
// are all excluded from being built by go versions lower than 1.18 so
// that the larger Arrow module itself is still compatible with go1.17.
//
// Everything in this package should be considered Experimental for now.
package compute

//go:generate stringer -type=FuncKind -linecomment
