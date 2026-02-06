package backend

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

const (
	// EndpointValidateAdmission friendly name for the validate admission endpoint/handler.
	EndpointValidateAdmission Endpoint = "validateAdmission"

	// EndpointMutateAdmission friendly name for the mutate admission endpoint/handler.
	EndpointMutateAdmission Endpoint = "mutateAdmission"
)

// AdmissionHandler is an EXPERIMENTAL service that allows checking objects before they are saved
// This is modeled after the kubernetes model for admission controllers
// Since grafana 11.1, this feature is under active development and will continue to evolve in 2024
// This may also be replaced with a more native kubernetes solution that does not work with existing tooling
type AdmissionHandler interface {
	// ValidateAdmission is a simple yes|no check if an object can be saved
	ValidateAdmission(context.Context, *AdmissionRequest) (*ValidationResponse, error)
	// MutateAdmission converts the input into an object that can be saved, or rejects the request
	MutateAdmission(context.Context, *AdmissionRequest) (*MutationResponse, error)
}

type ValidateAdmissionFunc func(context.Context, *AdmissionRequest) (*ValidationResponse, error)
type MutateAdmissionFunc func(context.Context, *AdmissionRequest) (*MutationResponse, error)

// Operation is the type of resource operation being checked for admission control
// https://github.com/kubernetes/kubernetes/blob/v1.30.0/pkg/apis/admission/types.go#L158
type AdmissionRequestOperation int32

const (
	AdmissionRequestCreate AdmissionRequestOperation = 0
	AdmissionRequestUpdate AdmissionRequestOperation = 1
	AdmissionRequestDelete AdmissionRequestOperation = 2
)

// String textual representation of the operation.
func (o AdmissionRequestOperation) String() string {
	return pluginv2.AdmissionRequest_Operation(o).String()
}

// Identify the Object properties
type GroupVersionKind struct {
	Group   string `json:"group,omitempty"`
	Version string `json:"version,omitempty"`
	Kind    string `json:"kind,omitempty"`
}

type AdmissionRequest struct {
	// NOTE: this may not include populated instance settings depending on the request
	PluginContext PluginContext `json:"pluginContext,omitempty"`
	// The requested operation
	Operation AdmissionRequestOperation `json:"operation,omitempty"`
	// The object kind
	Kind GroupVersionKind `json:"kind,omitempty"`
	// Object is the object in the request.  This includes the full metadata envelope.
	ObjectBytes []byte `json:"object_bytes,omitempty"`
	// OldObject is the object as it currently exists in storage. This includes the full metadata envelope.
	OldObjectBytes []byte `json:"old_object_bytes,omitempty"`
}

// Basic request to say if the validation was successful or not
type ValidationResponse struct {
	// Allowed indicates whether or not the admission request was permitted.
	Allowed bool `json:"allowed,omitempty"`
	// Result contains extra details into why an admission request was denied.
	// This field IS NOT consulted in any way if "Allowed" is "true".
	// +optional
	Result *StatusResult `json:"result,omitempty"`
	// warnings is a list of warning messages to return to the requesting API client.
	// Warning messages describe a problem the client making the API request should correct or be aware of.
	// Limit warnings to 120 characters if possible.
	// Warnings over 256 characters and large numbers of warnings may be truncated.
	// +optional
	Warnings []string `json:"warnings,omitempty"`
}

type MutationResponse struct {
	// Allowed indicates whether or not the admission request was permitted.
	Allowed bool `json:"allowed,omitempty"`
	// Result contains extra details into why an admission request was denied.
	// This field IS NOT consulted in any way if "Allowed" is "true".
	// +optional
	Result *StatusResult `json:"result,omitempty"`
	// warnings is a list of warning messages to return to the requesting API client.
	// Warning messages describe a problem the client making the API request should correct or be aware of.
	// Limit warnings to 120 characters if possible.
	// Warnings over 256 characters and large numbers of warnings may be truncated.
	// +optional
	Warnings []string `json:"warnings,omitempty"`
	// Mutated object bytes (when requested)
	// +optional
	ObjectBytes []byte `json:"object_bytes,omitempty"`
}

type StatusResult struct {
	// Status of the operation.
	// One of: "Success" or "Failure".
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
	// +optional
	Status string `json:"status,omitempty"`
	// A human-readable description of the status of this operation.
	// +optional
	Message string `json:"message,omitempty"`
	// A machine-readable description of why this operation is in the
	// "Failure" status. If this value is empty there
	// is no information available. A Reason clarifies an HTTP status
	// code but does not override it.
	// +optional
	Reason string `json:"reason,omitempty"`
	// Suggested HTTP return code for this status, 0 if not set.
	// +optional
	Code int32 `json:"code,omitempty"`
}
