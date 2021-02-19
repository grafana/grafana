package etreeutils

import (
	"errors"

	"fmt"

	"sort"

	"github.com/beevik/etree"
)

const (
	defaultPrefix = ""
	xmlnsPrefix   = "xmlns"
	xmlPrefix     = "xml"

	XMLNamespace   = "http://www.w3.org/XML/1998/namespace"
	XMLNSNamespace = "http://www.w3.org/2000/xmlns/"
)

var (
	DefaultNSContext = NSContext{
		prefixes: map[string]string{
			defaultPrefix: XMLNamespace,
			xmlPrefix:     XMLNamespace,
			xmlnsPrefix:   XMLNSNamespace,
		},
	}

	EmptyNSContext = NSContext{}

	ErrReservedNamespace       = errors.New("disallowed declaration of reserved namespace")
	ErrInvalidDefaultNamespace = errors.New("invalid default namespace declaration")
	ErrTraversalHalted         = errors.New("traversal halted")
)

type ErrUndeclaredNSPrefix struct {
	Prefix string
}

func (e ErrUndeclaredNSPrefix) Error() string {
	return fmt.Sprintf("undeclared namespace prefix: '%s'", e.Prefix)
}

type NSContext struct {
	prefixes map[string]string
}

func (ctx NSContext) Copy() NSContext {
	prefixes := make(map[string]string, len(ctx.prefixes)+4)
	for k, v := range ctx.prefixes {
		prefixes[k] = v
	}

	return NSContext{prefixes: prefixes}
}

func (ctx NSContext) declare(prefix, namespace string) etree.Attr {
	ctx.prefixes[prefix] = namespace

	switch prefix {
	case defaultPrefix:
		return etree.Attr{
			Key:   xmlnsPrefix,
			Value: namespace,
		}

	default:
		return etree.Attr{
			Space: xmlnsPrefix,
			Key:   prefix,
			Value: namespace,
		}
	}
}

func (ctx NSContext) SubContext(el *etree.Element) (NSContext, error) {
	// The subcontext should inherit existing declared prefixes
	newCtx := ctx.Copy()

	// Merge new namespace declarations on top of existing ones.
	for _, attr := range el.Attr {
		if attr.Space == xmlnsPrefix {
			// This attribute is a namespace declaration of the form "xmlns:<prefix>"

			// The 'xml' namespace may only be re-declared with the name 'http://www.w3.org/XML/1998/namespace'
			if attr.Key == xmlPrefix && attr.Value != XMLNamespace {
				return ctx, ErrReservedNamespace
			}

			// The 'xmlns' namespace may not be re-declared
			if attr.Key == xmlnsPrefix {
				return ctx, ErrReservedNamespace
			}

			newCtx.declare(attr.Key, attr.Value)
		} else if attr.Space == defaultPrefix && attr.Key == xmlnsPrefix {
			// This attribute is a default namespace declaration

			// The xmlns namespace value may not be declared as the default namespace
			if attr.Value == XMLNSNamespace {
				return ctx, ErrInvalidDefaultNamespace
			}

			newCtx.declare(defaultPrefix, attr.Value)
		}
	}

	return newCtx, nil
}

// Prefixes returns a copy of this context's prefix map.
func (ctx NSContext) Prefixes() map[string]string {
	prefixes := make(map[string]string, len(ctx.prefixes))
	for k, v := range ctx.prefixes {
		prefixes[k] = v
	}

	return prefixes
}

// LookupPrefix attempts to find a declared namespace for the specified prefix. If the prefix
// is an empty string this will be the default namespace for this context. If the prefix is
// undeclared in this context an ErrUndeclaredNSPrefix will be returned.
func (ctx NSContext) LookupPrefix(prefix string) (string, error) {
	if namespace, ok := ctx.prefixes[prefix]; ok {
		return namespace, nil
	}

	return "", ErrUndeclaredNSPrefix{
		Prefix: prefix,
	}
}

// NSIterHandler is a function which is invoked with a element and its surrounding
// NSContext during traversals.
type NSIterHandler func(NSContext, *etree.Element) error

// NSTraverse traverses an element tree, invoking the passed handler for each element
// in the tree.
func NSTraverse(ctx NSContext, el *etree.Element, handle NSIterHandler) error {
	ctx, err := ctx.SubContext(el)
	if err != nil {
		return err
	}

	err = handle(ctx, el)
	if err != nil {
		return err
	}

	// Recursively traverse child elements.
	for _, child := range el.ChildElements() {
		err := NSTraverse(ctx, child, handle)
		if err != nil {
			return err
		}
	}

	return nil
}

// NSDetatch makes a copy of the passed element, and declares any namespaces in
// the passed context onto the new element before returning it.
func NSDetatch(ctx NSContext, el *etree.Element) (*etree.Element, error) {
	ctx, err := ctx.SubContext(el)
	if err != nil {
		return nil, err
	}

	el = el.Copy()

	// Build a new attribute list
	attrs := make([]etree.Attr, 0, len(el.Attr))

	// First copy over anything that isn't a namespace declaration
	for _, attr := range el.Attr {
		if attr.Space == xmlnsPrefix {
			continue
		}

		if attr.Space == defaultPrefix && attr.Key == xmlnsPrefix {
			continue
		}

		attrs = append(attrs, attr)
	}

	// Append all in-context namespace declarations
	for prefix, namespace := range ctx.prefixes {
		// Skip the implicit "xml" and "xmlns" prefix declarations
		if prefix == xmlnsPrefix || prefix == xmlPrefix {
			continue
		}

		// Also skip declararing the default namespace as XMLNamespace
		if prefix == defaultPrefix && namespace == XMLNamespace {
			continue
		}

		if prefix != defaultPrefix {
			attrs = append(attrs, etree.Attr{
				Space: xmlnsPrefix,
				Key:   prefix,
				Value: namespace,
			})
		} else {
			attrs = append(attrs, etree.Attr{
				Key:   xmlnsPrefix,
				Value: namespace,
			})
		}
	}

	sort.Sort(SortedAttrs(attrs))

	el.Attr = attrs

	return el, nil
}

// NSSelectOne behaves identically to NSSelectOneCtx, but uses DefaultNSContext as the
// surrounding context.
func NSSelectOne(el *etree.Element, namespace, tag string) (*etree.Element, error) {
	return NSSelectOneCtx(DefaultNSContext, el, namespace, tag)
}

// NSSelectOneCtx conducts a depth-first search for an element with the specified namespace
// and tag. If such an element is found, a new *etree.Element is returned which is a
// copy of the found element, but with all in-context namespace declarations attached
// to the element as attributes.
func NSSelectOneCtx(ctx NSContext, el *etree.Element, namespace, tag string) (*etree.Element, error) {
	var found *etree.Element

	err := NSFindIterateCtx(ctx, el, namespace, tag, func(ctx NSContext, el *etree.Element) error {
		var err error

		found, err = NSDetatch(ctx, el)
		if err != nil {
			return err
		}

		return ErrTraversalHalted
	})

	if err != nil {
		return nil, err
	}

	return found, nil
}

// NSFindIterate behaves identically to NSFindIterateCtx, but uses DefaultNSContext
// as the surrounding context.
func NSFindIterate(el *etree.Element, namespace, tag string, handle NSIterHandler) error {
	return NSFindIterateCtx(DefaultNSContext, el, namespace, tag, handle)
}

// NSFindIterateCtx conducts a depth-first traversal searching for elements with the
// specified tag in the specified namespace. It uses the passed NSContext for prefix
// lookups. For each such element, the passed handler function is invoked. If the
// handler function returns an error traversal is immediately halted. If the error
// returned by the handler is  ErrTraversalHalted then nil will be returned by
// NSFindIterate. If any other error is returned by the handler, that error will be
// returned by NSFindIterate.
func NSFindIterateCtx(ctx NSContext, el *etree.Element, namespace, tag string, handle NSIterHandler) error {
	err := NSTraverse(ctx, el, func(ctx NSContext, el *etree.Element) error {
		_ctx, err := ctx.SubContext(el)
		if err != nil {
			return err
		}

		currentNS, err := _ctx.LookupPrefix(el.Space)
		if err != nil {
			return err
		}

		// Base case, el is the sought after element.
		if currentNS == namespace && el.Tag == tag {
			return handle(ctx, el)
		}

		return nil
	})

	if err != nil && err != ErrTraversalHalted {
		return err
	}

	return nil
}

// NSFindOne behaves identically to NSFindOneCtx, but uses DefaultNSContext for
// context.
func NSFindOne(el *etree.Element, namespace, tag string) (*etree.Element, error) {
	return NSFindOneCtx(DefaultNSContext, el, namespace, tag)
}

// NSFindOneCtx conducts a depth-first search for the specified element. If such an element
// is found a reference to it is returned.
func NSFindOneCtx(ctx NSContext, el *etree.Element, namespace, tag string) (*etree.Element, error) {
	var found *etree.Element

	err := NSFindIterateCtx(ctx, el, namespace, tag, func(ctx NSContext, el *etree.Element) error {
		found = el
		return ErrTraversalHalted
	})

	if err != nil {
		return nil, err
	}

	return found, nil
}

// NSIterateChildren iterates the children of an element, invoking the passed
// handler with each direct child of the element, and the context surrounding
// that child.
func NSIterateChildren(ctx NSContext, el *etree.Element, handle NSIterHandler) error {
	ctx, err := ctx.SubContext(el)
	if err != nil {
		return err
	}

	// Iterate the child elements.
	for _, child := range el.ChildElements() {
		err = handle(ctx, child)
		if err != nil {
			return err
		}
	}

	return nil
}

// NSFindIterateChildrenCtx takes an element and its surrounding context, and iterates
// the children of that element searching for an element matching the passed namespace
// and tag. For each such element that is found, handle is invoked with the matched
// element and its own surrounding context.
func NSFindChildrenIterateCtx(ctx NSContext, el *etree.Element, namespace, tag string, handle NSIterHandler) error {
	err := NSIterateChildren(ctx, el, func(ctx NSContext, el *etree.Element) error {
		_ctx, err := ctx.SubContext(el)
		if err != nil {
			return err
		}

		currentNS, err := _ctx.LookupPrefix(el.Space)
		if err != nil {
			return err
		}

		// Base case, el is the sought after element.
		if currentNS == namespace && el.Tag == tag {
			return handle(ctx, el)
		}

		return nil
	})

	if err != nil && err != ErrTraversalHalted {
		return err
	}

	return nil
}

// NSFindOneChild behaves identically to NSFindOneChildCtx, but uses
// DefaultNSContext for context.
func NSFindOneChild(el *etree.Element, namespace, tag string) (*etree.Element, error) {
	return NSFindOneChildCtx(DefaultNSContext, el, namespace, tag)
}

// NSFindOneCtx conducts a depth-first search for the specified element. If such an
// element is found a reference to it is returned.
func NSFindOneChildCtx(ctx NSContext, el *etree.Element, namespace, tag string) (*etree.Element, error) {
	var found *etree.Element

	err := NSFindChildrenIterateCtx(ctx, el, namespace, tag, func(ctx NSContext, el *etree.Element) error {
		found = el
		return ErrTraversalHalted
	})

	if err != nil && err != ErrTraversalHalted {
		return nil, err
	}

	return found, nil
}

// NSBuildParentContext recurses upward from an element in order to build an NSContext
// for its immediate parent. If the element has no parent DefaultNSContext
// is returned.
func NSBuildParentContext(el *etree.Element) (NSContext, error) {
	parent := el.Parent()
	if parent == nil {
		return DefaultNSContext, nil
	}

	ctx, err := NSBuildParentContext(parent)

	if err != nil {
		return ctx, err
	}

	return ctx.SubContext(parent)
}
