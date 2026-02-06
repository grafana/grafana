package build

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/build/buildinfo"
)

var now = time.Now // allow override for testing

// Deprecated: Use github.com/grafana/grafana-plugin-sdk-go/build/buildinfo.Info instead.
type Info = buildinfo.Info

// Deprecated: Use github.com/grafana/grafana-plugin-sdk-go/build/buildinfo.Getter instead.
type InfoGetter = buildinfo.Getter

// Deprecated: Use github.com/grafana/grafana-plugin-sdk-go/build/buildinfo.GetterFunc instead.
type InfoGetterFunc = buildinfo.GetterFunc

// Deprecated: Use github.com/grafana/grafana-plugin-sdk-go/build/buildinfo.GetBuildInfo instead.
var GetBuildInfo = buildinfo.GetBuildInfo
