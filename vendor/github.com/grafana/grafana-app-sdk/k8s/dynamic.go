package k8s

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
)

// DynamicPatcher is a client which will always patch against the current preferred version of a kind.
type DynamicPatcher struct {
	client         *dynamic.DynamicClient
	discovery      *discovery.DiscoveryClient
	preferred      map[string]metav1.APIResource
	mux            sync.RWMutex
	lastUpdate     time.Time
	updateInterval time.Duration
	group          singleflight.Group
}

// NewDynamicPatcher returns a new DynamicPatcher using the provided rest.Config for its internal client(s),
// and cacheUpdateInterval as the interval to refresh its preferred version cache from the API server.
// To disable the cache refresh (and only update on first request and whenever ForceRefresh() is called),
// set this value to <= 0.
func NewDynamicPatcher(cfg *rest.Config, cacheUpdateInterval time.Duration) (*DynamicPatcher, error) {
	client, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("error creating dynamic client: %w", err)
	}
	disc, err := discovery.NewDiscoveryClientForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("error creating discovery client: %w", err)
	}
	return &DynamicPatcher{
		client:         client,
		discovery:      disc,
		preferred:      make(map[string]metav1.APIResource),
		updateInterval: cacheUpdateInterval,
	}, nil
}

type DynamicKindPatcher struct {
	patcher   *DynamicPatcher
	groupKind schema.GroupKind
}

func (d *DynamicKindPatcher) Get(ctx context.Context, identifier resource.Identifier) (*resource.UnstructuredWrapper, error) {
	return d.patcher.Get(ctx, d.groupKind, identifier)
}

func (d *DynamicKindPatcher) Patch(ctx context.Context, identifier resource.Identifier, patch resource.PatchRequest, options resource.PatchOptions) (resource.Object, error) {
	return d.patcher.Patch(ctx, d.groupKind, identifier, patch, options)
}

func (d *DynamicPatcher) Patch(ctx context.Context, groupKind schema.GroupKind, identifier resource.Identifier, patch resource.PatchRequest, opts resource.PatchOptions) (*resource.UnstructuredWrapper, error) {
	preferred, err := d.getPreferred(groupKind)
	if err != nil {
		return nil, err
	}
	logging.FromContext(ctx).Debug("patching with dynamic client", "group", groupKind.Group, "version", preferred.Version, "kind", groupKind.Kind, "plural", preferred.Name)
	data, err := marshalJSONPatch(patch)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal patch: %w", err)
	}
	res := d.client.Resource(schema.GroupVersionResource{
		Group:    preferred.Group,
		Version:  preferred.Version,
		Resource: preferred.Name,
	})
	subresources := make([]string, 0)
	if opts.Subresource != "" {
		subresources = append(subresources, opts.Subresource)
	}
	patchOpts := metav1.PatchOptions{}
	if opts.DryRun {
		patchOpts.DryRun = []string{"All"}
	}
	if preferred.Namespaced {
		resp, err := res.Namespace(identifier.Namespace).Patch(ctx, identifier.Name, types.JSONPatchType, data, patchOpts, subresources...)
		if err != nil {
			return nil, d.parseError(err)
		}
		return resource.NewUnstructuredWrapper(resp), nil
	}
	resp, err := res.Patch(ctx, identifier.Name, types.JSONPatchType, data, patchOpts, subresources...)
	if err != nil {
		return nil, d.parseError(err)
	}
	return resource.NewUnstructuredWrapper(resp), nil
}

func (d *DynamicPatcher) Get(ctx context.Context, groupKind schema.GroupKind, identifier resource.Identifier) (*resource.UnstructuredWrapper, error) {
	preferred, err := d.getPreferred(groupKind)
	if err != nil {
		return nil, err
	}
	logging.FromContext(ctx).Debug("patching with dynamic client", "group", groupKind.Group, "version", preferred.Version, "kind", groupKind.Kind, "plural", preferred.Name)
	res := d.client.Resource(schema.GroupVersionResource{
		Group:    preferred.Group,
		Version:  preferred.Version,
		Resource: preferred.Name,
	})
	if preferred.Namespaced {
		resp, err := res.Namespace(identifier.Namespace).Get(ctx, identifier.Name, metav1.GetOptions{})
		if err != nil {
			return nil, d.parseError(err)
		}
		return resource.NewUnstructuredWrapper(resp), nil
	}
	resp, err := res.Get(ctx, identifier.Name, metav1.GetOptions{})
	if err != nil {
		return nil, d.parseError(err)
	}
	return resource.NewUnstructuredWrapper(resp), nil
}

// ForKind returns a DynamicKindPatcher for the provided group and kind, which implements the Patch method from resource.Client.
// It wraps DynamicPatcher's Patch method, and will use the same self-updating cache of the preferred version
func (d *DynamicPatcher) ForKind(groupKind schema.GroupKind) *DynamicKindPatcher {
	return &DynamicKindPatcher{
		patcher:   d,
		groupKind: groupKind,
	}
}

// ForceRefresh forces an update of the DiscoveryClient's cache of preferred versions for kinds
func (d *DynamicPatcher) ForceRefresh() error {
	return d.updatePreferred()
}

func (d *DynamicPatcher) getPreferred(kind schema.GroupKind) (*metav1.APIResource, error) {
	_, err, _ := d.group.Do("check-cache-update", func() (any, error) {
		if d.preferred == nil || (d.updateInterval >= 0 && d.lastUpdate.Before(now().Add(-d.updateInterval))) {
			if err := d.updatePreferred(); err != nil {
				return nil, err
			}
		}
		return nil, nil
	})
	if err != nil {
		return nil, err
	}
	d.mux.RLock()
	defer d.mux.RUnlock()

	preferred, ok := d.preferred[kind.String()]
	if !ok {
		return nil, fmt.Errorf("preferred resource not found for kind '%s'", kind)
	}
	return &preferred, nil
}

func (d *DynamicPatcher) updatePreferred() error {
	d.mux.Lock()
	defer d.mux.Unlock()
	preferred, err := d.discovery.ServerPreferredResources()
	if err != nil {
		// There are errors that are "partial" errors and still return results.
		// In those cases, we should check into the error further rather than just returning.
		// If there are no results, return the error we got
		if len(preferred) == 0 {
			var statusErr *apierrors.StatusError
			if errors.As(err, &statusErr) {
				return statusErr
			}
			return fmt.Errorf("error getting preferred resources from discovery client: %w", err)
		}
		if cast, ok := err.(*discovery.ErrGroupDiscoveryFailed); ok {
			// Failed discovery for a number of groups. Log the failed groups
			for group, gerr := range cast.Groups {
				logging.DefaultLogger.Warn(fmt.Sprintf("discovery failed for GroupVersion %s", group.String()), "groupversion", group, "error", gerr)
			}
		} else {
			// just log the error
			logging.DefaultLogger.Warn("error getting preferred resources, returned partial results", "error", err)
		}
	}
	for _, pref := range preferred {
		gv, err := schema.ParseGroupVersion(pref.GroupVersion)
		if err != nil {
			return err
		}
		for _, res := range pref.APIResources {
			if res.Version == "" {
				res.Version = gv.Version
			}
			if res.Group == "" {
				res.Group = gv.Group
			}
			d.preferred[schema.GroupKind{
				Group: gv.Group,
				Kind:  res.Kind,
			}.String()] = res
		}
	}
	d.lastUpdate = now()
	return nil
}

func (*DynamicPatcher) parseError(err error) error {
	var statusErr *apierrors.StatusError
	if errors.As(err, &statusErr) {
		return NewServerResponseError(statusErr, statusErr.Status().Code)
	}
	return err
}
