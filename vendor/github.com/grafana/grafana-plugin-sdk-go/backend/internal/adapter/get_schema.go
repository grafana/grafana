package adapter

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend/internal/convert"
	"github.com/grafana/grafana-plugin-sdk-go/backend/models"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

func (a *SDKAdapter) GetSchema(ctx context.Context, req *pluginv2.GetSchema_Request) (*pluginv2.GetSchema_Response, error) {
	a.schema = models.Schema{}
	protoRes := &pluginv2.GetSchema_Response{
		Resources: map[string]*pluginv2.Resource{},
	}

	if a.SchemaProvider != nil {
		a.schema = a.SchemaProvider()
		if a.schema.Resources != nil {
			protoRes.Resources = convert.ToProto().ResourceMap(a.schema.Resources)
		}
	}

	return protoRes, nil
}
