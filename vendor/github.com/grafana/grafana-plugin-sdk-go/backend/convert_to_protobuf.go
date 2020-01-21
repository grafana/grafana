package backend

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

type convertToProtobuf struct {
}

func toProto() convertToProtobuf {
	return convertToProtobuf{}
}

func (t convertToProtobuf) PluginConfig(pc PluginConfig) *pluginv2.PluginConfig {
	return &pluginv2.PluginConfig{
		Id:       pc.ID,
		OrgId:    pc.OrgID,
		Name:     pc.Name,
		Type:     pc.Type,
		Url:      pc.URL,
		JsonData: string(pc.JSONData),
	}
}

func (t convertToProtobuf) TimeRange(tr TimeRange) *pluginv2.TimeRange {
	return &pluginv2.TimeRange{
		FromEpochMS: tr.From.UnixNano() / int64(time.Millisecond),
		ToEpochMS:   tr.To.UnixNano() / int64(time.Millisecond),
	}
}

func (t convertToProtobuf) HealthStatus(status HealthStatus) pluginv2.CheckHealth_Response_HealthStatus {
	switch status {
	case HealthStatusUnknown:
		return pluginv2.CheckHealth_Response_UNKNOWN
	case HealthStatusOk:
		return pluginv2.CheckHealth_Response_OK
	case HealthStatusError:
		return pluginv2.CheckHealth_Response_ERROR
	}
	panic("unsupported protobuf health status type in sdk")
}

func (t convertToProtobuf) CheckHealthResponse(res *CheckHealthResult) *pluginv2.CheckHealth_Response {
	return &pluginv2.CheckHealth_Response{
		Status: t.HealthStatus(res.Status),
		Info:   res.Info,
	}
}

func (t convertToProtobuf) DataQuery(q DataQuery) *pluginv2.DataQuery {
	return &pluginv2.DataQuery{
		RefId:         q.RefID,
		MaxDataPoints: q.MaxDataPoints,
		IntervalMS:    q.Interval.Milliseconds(),
		TimeRange:     t.TimeRange(q.TimeRange),
		Json:          q.JSON,
	}
}

func (t convertToProtobuf) DataQueryRequest(req *DataQueryRequest) *pluginv2.DataQueryRequest {
	queries := make([]*pluginv2.DataQuery, len(req.Queries))
	for i, q := range req.Queries {
		queries[i] = t.DataQuery(q)
	}
	return &pluginv2.DataQueryRequest{
		Config:  t.PluginConfig(req.PluginConfig),
		Headers: req.Headers,
		Queries: queries,
	}
}

func (t convertToProtobuf) DataQueryResponse(res *DataQueryResponse) (*pluginv2.DataQueryResponse, error) {
	encodedFrames := make([][]byte, len(res.Frames))
	var err error
	for i, frame := range res.Frames {
		encodedFrames[i], err = dataframe.MarshalArrow(frame)
		if err != nil {
			return nil, err
		}
	}

	return &pluginv2.DataQueryResponse{
		Frames:   encodedFrames,
		Metadata: res.Metadata,
	}, nil
}

func (t convertToProtobuf) RouteMethod(rm RouteMethod) pluginv2.Resource_Route_Method {
	switch rm {
	case RouteMethodAny:
		return pluginv2.Resource_Route_ANY
	case RouteMethodGet:
		return pluginv2.Resource_Route_GET
	case RouteMethodPut:
		return pluginv2.Resource_Route_PUT
	case RouteMethodPost:
		return pluginv2.Resource_Route_POST
	case RouteMethodDelete:
		return pluginv2.Resource_Route_DELETE
	case RouteMethodPatch:
		return pluginv2.Resource_Route_PATCH
	}
	panic("unsupported protobuf resource route method type in sdk")
}

func (t convertToProtobuf) Route(r *Route) *pluginv2.Resource_Route {
	return &pluginv2.Resource_Route{
		Path:   r.Path,
		Method: t.RouteMethod(r.Method),
	}
}

func (t convertToProtobuf) Resource(r *Resource) *pluginv2.Resource {
	res := &pluginv2.Resource{
		Path:   r.Path,
		Routes: []*pluginv2.Resource_Route{},
	}

	for _, route := range r.Routes {
		res.Routes = append(res.Routes, t.Route(route))
	}

	return res
}

func (t convertToProtobuf) ResourceMap(rm ResourceMap) map[string]*pluginv2.Resource {
	res := map[string]*pluginv2.Resource{}
	for name, resource := range rm {
		res[name] = t.Resource(resource)
	}

	return res
}
