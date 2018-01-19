/*
 * Copyright 2017 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package testdata

import (
	"log"
	"os"
	"path/filepath"
)

// Path returns the absolute path the given relative file or directory path,
// relative to the google.golang.org/grpc/testdata directory in the user's GOPATH.
// If rel is already absolute, it is returned unmodified.
func Path(rel string) string {
	if filepath.IsAbs(rel) {
		return rel
	}

	v, err := goPackagePath("google.golang.org/grpc/testdata")
	if err != nil {
		log.Fatalf("Error finding google.golang.org/grpc/testdata directory: %v", err)
	}

	return filepath.Join(v, rel)
}

func goPackagePath(pkg string) (path string, err error) {
	gp := os.Getenv("GOPATH")
	if gp == "" {
		return path, os.ErrNotExist
	}

	for _, p := range filepath.SplitList(gp) {
		dir := filepath.Join(p, "src", filepath.FromSlash(pkg))
		fi, err := os.Stat(dir)
		if os.IsNotExist(err) {
			continue
		}
		if err != nil {
			return "", err
		}
		if !fi.IsDir() {
			continue
		}
		return dir, nil
	}
	return path, os.ErrNotExist
}
