// Copyright 2020 CUE Authors
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

package pkg

import (
	_ "cuelang.org/go/pkg/crypto/ed25519"
	_ "cuelang.org/go/pkg/crypto/hmac"
	_ "cuelang.org/go/pkg/crypto/md5"
	_ "cuelang.org/go/pkg/crypto/sha1"
	_ "cuelang.org/go/pkg/crypto/sha256"
	_ "cuelang.org/go/pkg/crypto/sha512"
	_ "cuelang.org/go/pkg/encoding/base64"
	_ "cuelang.org/go/pkg/encoding/csv"
	_ "cuelang.org/go/pkg/encoding/hex"
	_ "cuelang.org/go/pkg/encoding/json"
	_ "cuelang.org/go/pkg/encoding/yaml"
	_ "cuelang.org/go/pkg/html"

	_ "cuelang.org/go/pkg/list"
	_ "cuelang.org/go/pkg/math"
	_ "cuelang.org/go/pkg/math/bits"
	_ "cuelang.org/go/pkg/net"
	_ "cuelang.org/go/pkg/path"
	_ "cuelang.org/go/pkg/regexp"
	_ "cuelang.org/go/pkg/strconv"
	_ "cuelang.org/go/pkg/strings"
	_ "cuelang.org/go/pkg/struct"
	_ "cuelang.org/go/pkg/text/tabwriter"
	_ "cuelang.org/go/pkg/text/template"
	_ "cuelang.org/go/pkg/time"
	_ "cuelang.org/go/pkg/tool"
	_ "cuelang.org/go/pkg/tool/cli"
	_ "cuelang.org/go/pkg/tool/exec"
	_ "cuelang.org/go/pkg/tool/file"
	_ "cuelang.org/go/pkg/tool/http"
	_ "cuelang.org/go/pkg/tool/os"
	_ "cuelang.org/go/pkg/uuid"
)
