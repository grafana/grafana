// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"fmt"
	"time"

	"golang.org/x/exp/slices"
)

// ResourceReference is a reference to a ConfigEntry
// with an optional reference to a subsection of that ConfigEntry
// that can be specified as SectionName
type ResourceReference struct {
	// Kind is the kind of ConfigEntry that this resource refers to.
	Kind string
	// Name is the identifier for the ConfigEntry this resource refers to.
	Name string
	// SectionName is a generic subresource identifier that specifies
	// a subset of the ConfigEntry to which this reference applies. Usage
	// of this field should be up to the controller that leverages it. If
	// unused, this should be blank.
	SectionName string

	// Partition is the partition the config entry is associated with.
	// Partitioning is a Consul Enterprise feature.
	Partition string `json:",omitempty"`

	// Namespace is the namespace the config entry is associated with.
	// Namespacing is a Consul Enterprise feature.
	Namespace string `json:",omitempty"`
}

// ConfigEntryStatus is used for propagating back asynchronously calculated
// messages from control loops to a user
type ConfigEntryStatus struct {
	// Conditions is the set of condition objects associated with
	// a ConfigEntry status.
	Conditions []Condition
}

// Condition is used for a single message and state associated
// with an object. For example, a ConfigEntry that references
// multiple other resources may have different statuses with
// respect to each of those resources.
type Condition struct {
	// Type is a value from a bounded set of types that an object might have
	Type string
	// Status is a value from a bounded set of statuses that an object might have
	Status ConditionStatus
	// Reason is a value from a bounded set of reasons for a given status
	Reason string
	// Message is a message that gives more detailed information about
	// why a Condition has a given status and reason
	Message string
	// Resource is an optional reference to a resource for which this
	// condition applies
	Resource *ResourceReference
	// LastTransitionTime is the time at which this Condition was created
	LastTransitionTime *time.Time
}

type (
	ConditionStatus string
)

const (
	ConditionStatusTrue    ConditionStatus = "True"
	ConditionStatusFalse   ConditionStatus = "False"
	ConditionStatusUnknown ConditionStatus = "Unknown"
)

// GatewayConditionType is a type of condition associated with a
// Gateway. This type should be used with the GatewayStatus.Conditions
// field.
type GatewayConditionType string

// GatewayConditionReason defines the set of reasons that explain why a
// particular Gateway condition type has been raised.
type GatewayConditionReason string

// the following are directly from the k8s spec
const (
	// This condition is true when the controller managing the Gateway is
	// syntactically and semantically valid enough to produce some configuration
	// in the underlying data plane. This does not indicate whether or not the
	// configuration has been propagated to the data plane.
	//
	// Possible reasons for this condition to be True are:
	//
	// * "Accepted"
	//
	// Possible reasons for this condition to be False are:
	//
	// * InvalidCertificates
	//
	GatewayConditionAccepted GatewayConditionType = "Accepted"

	// This reason is used with the "Accepted" condition when the condition is
	// True.
	GatewayReasonAccepted GatewayConditionReason = "Accepted"

	// This reason is used with the "Accepted" condition when the gateway has multiple invalid
	// certificates and cannot bind to any routes
	GatewayReasonInvalidCertificates GatewayConditionReason = "InvalidCertificates"

	// This reason is used with the "Accepted" condition when the gateway has multiple invalid
	// JWT providers and cannot bind to any routes
	GatewayReasonInvalidJWTProviders GatewayConditionReason = "InvalidJWTProviders"

	// This condition indicates that the gateway was unable to resolve
	// conflicting specification requirements for this Listener. If a
	// Listener is conflicted, its network port should not be configured
	// on any network elements.
	//
	// Possible reasons for this condition to be true are:
	//
	// * "RouteConflict"
	//
	// Possible reasons for this condition to be False are:
	//
	// * "NoConflict"
	//
	// Controllers may raise this condition with other reasons,
	// but should prefer to use the reasons listed above to improve
	// interoperability.
	GatewayConditionConflicted GatewayConditionType = "Conflicted"
	// This reason is used with the "Conflicted" condition when the condition
	// is False.
	GatewayReasonNoConflict GatewayConditionReason = "NoConflict"
	// This reason is used with the "Conflicted" condition when the route is
	// in a conflicted state, such as when a TCPListener attempts to bind to two routes
	GatewayReasonRouteConflict GatewayConditionReason = "RouteConflict"

	// This condition indicates whether the controller was able to
	// resolve all the object references for the Gateway. When setting this
	// condition to False, a ResourceReference to the misconfigured Listener should
	// be provided.
	//
	// Possible reasons for this condition to be true are:
	//
	// * "ResolvedRefs"
	//
	// Possible reasons for this condition to be False are:
	//
	// * "InvalidCertificateRef"
	// * "InvalidRouteKinds"
	// * "RefNotPermitted"
	//
	GatewayConditionResolvedRefs GatewayConditionType = "ResolvedRefs"

	// This reason is used with the "ResolvedRefs" condition when the condition
	// is true.
	GatewayReasonResolvedRefs GatewayConditionReason = "ResolvedRefs"

	// This reason is used with the "ResolvedRefs" condition when a
	// Listener has a TLS configuration with at least one TLS CertificateRef
	// that is invalid or does not exist.
	// A CertificateRef is considered invalid when it refers to a nonexistent
	// or unsupported resource or kind, or when the data within that resource
	// is malformed.
	// This reason must be used only when the reference is allowed, either by
	// referencing an object in the same namespace as the Gateway, or when
	// a cross-namespace reference has been explicitly allowed by a ReferenceGrant.
	// If the reference is not allowed, the reason RefNotPermitted must be used
	// instead.
	GatewayListenerReasonInvalidCertificateRef GatewayConditionReason = "InvalidCertificateRef"

	// This reason is used with the "ResolvedRefs" condition when a
	// Listener has a JWT configuration with at least one JWTProvider
	// that is invalid or does not exist.
	// A JWTProvider is considered invalid when it refers to a nonexistent
	// or unsupported resource or kind, or when the data within that resource
	// is malformed.
	GatewayListenerReasonInvalidJWTProviderRef GatewayConditionReason = "InvalidJWTProviderRef"
)

var validGatewayConditionReasonsMapping = map[GatewayConditionType]map[ConditionStatus][]GatewayConditionReason{
	GatewayConditionAccepted: {
		ConditionStatusTrue: {
			GatewayReasonAccepted,
		},
		ConditionStatusFalse: {
			GatewayReasonInvalidCertificates,
			GatewayReasonInvalidJWTProviders,
		},
		ConditionStatusUnknown: {},
	},
	GatewayConditionConflicted: {
		ConditionStatusTrue: {
			GatewayReasonRouteConflict,
		},
		ConditionStatusFalse: {
			GatewayReasonNoConflict,
		},
		ConditionStatusUnknown: {},
	},
	GatewayConditionResolvedRefs: {
		ConditionStatusTrue: {
			GatewayReasonResolvedRefs,
		},
		ConditionStatusFalse: {
			GatewayListenerReasonInvalidCertificateRef,
			GatewayListenerReasonInvalidJWTProviderRef,
		},
		ConditionStatusUnknown: {},
	},
}

func ValidateGatewayConditionReason(name GatewayConditionType, status ConditionStatus, reason GatewayConditionReason) error {
	if err := checkConditionStatus(status); err != nil {
		return err
	}

	reasons, ok := validGatewayConditionReasonsMapping[name]
	if !ok {
		return fmt.Errorf("unrecognized GatewayConditionType %q", name)
	}

	reasonsForStatus, ok := reasons[status]
	if !ok {
		return fmt.Errorf("unrecognized ConditionStatus %q", status)
	}

	if !slices.Contains(reasonsForStatus, reason) {
		return fmt.Errorf("gateway condition reason %q not allowed for gateway condition type %q with status %q", reason, name, status)
	}
	return nil
}

// RouteConditionType is a type of condition for a route.
type RouteConditionType string

// RouteConditionReason is a reason for a route condition.
type RouteConditionReason string

// The following statuses are taken from the K8's Spec
// With the exception of: "RouteReasonInvalidDiscoveryChain" and "NoUpstreamServicesTargeted"
const (
	// This condition indicates whether the route has been accepted or rejected
	// by a Gateway, and why.
	//
	// Possible reasons for this condition to be true are:
	//
	// * "Accepted"
	//
	// Possible reasons for this condition to be False are:
	//
	// * "InvalidDiscoveryChain"
	// * "NoUpstreamServicesTargeted"
	//
	//
	// Controllers may raise this condition with other reasons,
	// but should prefer to use the reasons listed above to improve
	// interoperability.
	RouteConditionAccepted RouteConditionType = "Accepted"

	// This reason is used with the "Accepted" condition when the Route has been
	// accepted by the Gateway.
	RouteReasonAccepted RouteConditionReason = "Accepted"

	// This reason is used with the "Accepted" condition when the route has an
	// invalid discovery chain, this includes conditions like the protocol being invalid
	// or the discovery chain failing to compile
	RouteReasonInvalidDiscoveryChain RouteConditionReason = "InvalidDiscoveryChain"

	// This reason is used with the "Accepted" condition when the route
	RouteReasonNoUpstreamServicesTargeted RouteConditionReason = "NoUpstreamServicesTargeted"
)

// the following statuses are custom to Consul
const (
	// This condition indicates whether the route was able to successfully bind the
	// Listener on the gateway
	// Possible reasons for this condition to be true are:
	//
	// * "Bound"
	//
	// Possible reasons for this condition to be false are:
	//
	// * "FailedToBind"
	// * "GatewayNotFound"
	//
	RouteConditionBound RouteConditionType = "Bound"

	// This reason is used with the "Bound" condition when the condition
	// is true
	RouteReasonBound RouteConditionReason = "Bound"

	// This reason is used with the "Bound" condition when the route failed
	// to bind to the gateway
	RouteReasonFailedToBind RouteConditionReason = "FailedToBind"

	// This reason is used with the "Bound" condition when the route fails
	// to find the gateway
	RouteReasonGatewayNotFound RouteConditionReason = "GatewayNotFound"

	// This reason is used with the "Accepted" condition when the route references non-existent
	// JWTProviders
	RouteReasonJWTProvidersNotFound RouteConditionReason = "JWTProvidersNotFound"
)

var validRouteConditionReasonsMapping = map[RouteConditionType]map[ConditionStatus][]RouteConditionReason{
	RouteConditionAccepted: {
		ConditionStatusTrue: {
			RouteReasonAccepted,
		},
		ConditionStatusFalse: {
			RouteReasonInvalidDiscoveryChain,
			RouteReasonNoUpstreamServicesTargeted,
		},
		ConditionStatusUnknown: {},
	},
	RouteConditionBound: {
		ConditionStatusTrue: {
			RouteReasonBound,
		},
		ConditionStatusFalse: {
			RouteReasonGatewayNotFound,
			RouteReasonFailedToBind,
			RouteReasonJWTProvidersNotFound,
		},
		ConditionStatusUnknown: {},
	},
}

func ValidateRouteConditionReason(name RouteConditionType, status ConditionStatus, reason RouteConditionReason) error {
	if err := checkConditionStatus(status); err != nil {
		return err
	}

	reasons, ok := validRouteConditionReasonsMapping[name]
	if !ok {
		return fmt.Errorf("unrecognized RouteConditionType %s", name)
	}

	reasonsForStatus, ok := reasons[status]
	if !ok {
		return fmt.Errorf("unrecognized ConditionStatus %s", name)
	}

	if !slices.Contains(reasonsForStatus, reason) {
		return fmt.Errorf("route condition reason %s not allowed for route condition type %s with status %s", reason, name, status)
	}

	return nil
}

func checkConditionStatus(status ConditionStatus) error {
	switch status {
	case ConditionStatusTrue, ConditionStatusFalse, ConditionStatusUnknown:
		return nil
	default:
		return fmt.Errorf("unrecognized condition status: %q", status)
	}
}
