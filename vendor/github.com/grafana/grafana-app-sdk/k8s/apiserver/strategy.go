package apiserver

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage/names"
	"sigs.k8s.io/structured-merge-diff/v4/fieldpath"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
)

type strategy struct {
	ObjectTyper runtime.ObjectTyper
	kind        resource.Kind
	namer       names.NameGenerator
}

func newStrategy(scheme *runtime.Scheme, kind resource.Kind) *strategy {
	return &strategy{
		ObjectTyper: scheme,
		kind:        kind,
		namer:       names.SimpleNameGenerator,
	}
}

func (s *strategy) NamespaceScoped() bool {
	return s.kind.Scope() == resource.NamespacedScope
}

func (s *strategy) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	fields := map[fieldpath.APIVersion]*fieldpath.Set{
		fieldpath.APIVersion(s.kind.GroupVersionKind().GroupVersion().String()): fieldpath.NewSet(
			fieldpath.MakePathOrDie("status"),
		),
	}
	return fields
}

func (s *strategy) GenerateName(base string) string {
	return s.namer.GenerateName(base)
}

func (*strategy) PrepareForCreate(_ context.Context, _ runtime.Object) {
}

func (*strategy) Validate(_ context.Context, _ runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

func (*strategy) Canonicalize(_ runtime.Object) {
}

func (*strategy) AllowCreateOnUpdate() bool {
	return false
}

func (*strategy) WarningsOnCreate(_ context.Context, _ runtime.Object) []string {
	return nil
}

func (*strategy) PrepareForUpdate(ctx context.Context, obj, old runtime.Object) {
	if obj == nil || old == nil {
		return
	}
	newObj, ok1 := obj.(resource.Object)
	oldObj, ok2 := old.(resource.Object)
	if !ok1 || !ok2 {
		logging.FromContext(ctx).Error("PrepareForUpdate called with non-resource.Object object")
		return
	}
	status, ok := oldObj.GetSubresource(string(resource.SubresourceStatus))
	if ok {
		err := newObj.SetSubresource(string(resource.SubresourceStatus), status)
		if err != nil {
			logging.FromContext(ctx).Error("PrepareForUpdate set status error", "error", err)
		}
	}
}

func (*strategy) ValidateUpdate(_ context.Context, _, _ runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

func (*strategy) AllowUnconditionalUpdate() bool {
	return false
}

func (*strategy) WarningsOnUpdate(_ context.Context, _, _ runtime.Object) []string {
	return nil
}

func (*strategy) PrepareForDelete(_ context.Context, _ runtime.Object) {
}

func (*strategy) WarningsOnDelete(_ context.Context, _ runtime.Object) []string {
	return nil
}

func (s *strategy) ObjectKinds(obj runtime.Object) ([]schema.GroupVersionKind, bool, error) {
	return s.ObjectTyper.ObjectKinds(obj)
}

func (s *strategy) Recognizes(gvk schema.GroupVersionKind) bool {
	return gvk == s.kind.GroupVersionKind()
}

func (*strategy) CheckGracefulDelete(_ context.Context, _ runtime.Object, _ *metav1.DeleteOptions) bool {
	return false
}

var _ rest.Scoper = &strategy{}
var _ rest.RESTCreateStrategy = &strategy{}
var _ rest.RESTUpdateStrategy = &strategy{}
var _ rest.RESTDeleteStrategy = &strategy{}
var _ rest.RESTGracefulDeleteStrategy = &strategy{}

// genericStatusStrategy allows for writing objects with status fields, however may not create them.
// It ignores spec and metadata fields, and does not allow for updates outside of the status field.
type genericStatusStrategy struct {
	runtime.ObjectTyper
	names.NameGenerator

	gv schema.GroupVersion
}

// NewStatusStrategy creates a new genericStatusStrategy.
func newStatusStrategy(typer runtime.ObjectTyper, gv schema.GroupVersion) *genericStatusStrategy {
	return &genericStatusStrategy{typer, names.SimpleNameGenerator, gv}
}

func (*genericStatusStrategy) NamespaceScoped() bool {
	return true
}

func (g *genericStatusStrategy) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	fields := map[fieldpath.APIVersion]*fieldpath.Set{
		fieldpath.APIVersion(g.gv.String()): fieldpath.NewSet(
			fieldpath.MakePathOrDie("spec"),
			fieldpath.MakePathOrDie("metadata"),
		),
	}

	return fields
}

func (*genericStatusStrategy) PrepareForUpdate(ctx context.Context, obj, old runtime.Object) {
	if obj == nil || old == nil {
		return
	}
	oldObj, ok1 := old.(resource.Object)
	newObj, ok2 := obj.(resource.Object)
	if !ok1 || !ok2 {
		logging.FromContext(ctx).Error("Status PrepareForUpdate called with non-resource.Object object")
		return
	}
	newObj.SetAnnotations(oldObj.GetAnnotations())
	newObj.SetLabels(oldObj.GetLabels())
	newObj.SetFinalizers(oldObj.GetFinalizers())
	newObj.SetOwnerReferences(oldObj.GetOwnerReferences())
	// TODO: we shouldn't have to do this, right? It's not being done in OSS grafana, but we lose the spec otherwise here...
	err := newObj.SetSpec(oldObj.GetSpec())
	if err != nil {
		logging.FromContext(ctx).Error("Status PrepareForUpdate set spec error", "error", err)
	}
}

func (*genericStatusStrategy) AllowCreateOnUpdate() bool {
	return false
}

func (*genericStatusStrategy) AllowUnconditionalUpdate() bool {
	return false
}

// Canonicalize normalizes the object after validation.
func (*genericStatusStrategy) Canonicalize(_ runtime.Object) {
}

// ValidateUpdate validates an update of genericStatusStrategy.
func (*genericStatusStrategy) ValidateUpdate(_ context.Context, _, _ runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

// WarningsOnUpdate returns warnings for the given update.
func (*genericStatusStrategy) WarningsOnUpdate(_ context.Context, _, _ runtime.Object) []string {
	return nil
}
