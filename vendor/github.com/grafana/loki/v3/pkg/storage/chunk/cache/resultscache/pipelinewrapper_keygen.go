package resultscache

import (
	"context"

	"github.com/grafana/loki/v3/pkg/util/httpreq"
)

type PipelineWrapperKeyGenerator struct {
	inner KeyGenerator
}

func NewPipelineWrapperKeygen(inner KeyGenerator) KeyGenerator {
	return &PipelineWrapperKeyGenerator{inner: inner}
}

func (kg *PipelineWrapperKeyGenerator) GenerateCacheKey(ctx context.Context, userID string, r Request) string {
	innerKey := kg.inner.GenerateCacheKey(ctx, userID, r)

	if httpreq.ExtractHeader(ctx, httpreq.LokiDisablePipelineWrappersHeader) == "true" {
		return "pipeline-disabled:" + innerKey
	}
	return innerKey
}
