package adapter

import (
	"bytes"
	"context"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/internal/convert"
	"github.com/grafana/grafana-plugin-sdk-go/backend/internal/resource"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

func (a *SDKAdapter) CallResource(ctx context.Context, protoReq *pluginv2.CallResource_Request) (*pluginv2.CallResource_Response, error) {
	r, exists := a.schema.Resources[protoReq.ResourceName]
	if !exists {
		return &pluginv2.CallResource_Response{
			Code: 404,
		}, nil
	}

	route := r.GetMatchingRoute(protoReq.ResourcePath, protoReq.Method)
	if route == nil {
		return &pluginv2.CallResource_Response{
			Code: 404,
		}, nil
	}

	httpHandler := route.Handler(convert.FromProto().CallResourceRequest(protoReq))
	reqBodyReader := bytes.NewReader(protoReq.Body)
	httpReq, err := http.NewRequestWithContext(ctx, protoReq.Method, protoReq.Url, reqBodyReader)
	if err != nil {
		return nil, err
	}

	for key, values := range protoReq.Headers {
		for _, value := range values.Values {
			httpReq.Header.Add(key, value)
		}
	}

	writer := resource.NewResourceResponseWriter()
	httpHandler.ServeHTTP(writer, httpReq)

	return writer.Result(), nil
}
