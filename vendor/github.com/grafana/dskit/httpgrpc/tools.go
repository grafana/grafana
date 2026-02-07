// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/httpgrpc/tools.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

package httpgrpc

import (
	// This is a workaround for go mod which fails to download gogoproto otherwise
	_ "github.com/gogo/protobuf/gogoproto"
)
