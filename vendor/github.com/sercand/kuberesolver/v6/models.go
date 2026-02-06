package kuberesolver

type EventType string

const (
	Added    EventType = "ADDED"
	Modified EventType = "MODIFIED"
	Deleted  EventType = "DELETED"
	Error    EventType = "ERROR"
)

// Event represents a single event to a watched resource.
type Event struct {
	Type   EventType     `json:"type"`
	Object EndpointSlice `json:"object"`
}

type EndpointSliceList struct {
	Items []EndpointSlice
}

type EndpointSlice struct {
	Endpoints []Endpoint
	Ports     []EndpointPort
}

type Endpoint struct {
	Addresses  []string
	Conditions EndpointConditions
}

type EndpointConditions struct {
	Ready       *bool `json:"ready"`
	Serving     *bool `json:"serving"`
	Terminating *bool `json:"terminating"`
}

type Metadata struct {
	Name            string            `json:"name"`
	Namespace       string            `json:"namespace"`
	ResourceVersion string            `json:"resourceVersion"`
	Labels          map[string]string `json:"labels"`
}
type EndpointPort struct {
	Name string `json:"name"`
	Port int    `json:"port"`
}
