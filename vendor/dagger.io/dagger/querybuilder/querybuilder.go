package querybuilder

import (
	"context"
	"encoding/json"
	"fmt"
	"runtime/debug"
	"strings"
	"sync"

	"github.com/Khan/genqlient/graphql"
	"golang.org/x/sync/errgroup"
)

func Query() *Selection {
	return &Selection{}
}

type Selection struct {
	name     string
	alias    string
	args     map[string]*argument
	bind     any
	multiple bool

	prev *Selection

	client graphql.Client
}

func (s *Selection) path() []*Selection {
	selections := []*Selection{}
	for sel := s; sel.prev != nil; sel = sel.prev {
		selections = append([]*Selection{sel}, selections...)
	}

	return selections
}

func (s *Selection) Root() *Selection {
	return &Selection{
		client: s.client,
	}
}

func (s *Selection) SelectWithAlias(alias, name string) *Selection {
	sel := &Selection{
		name:   name,
		prev:   s,
		alias:  alias,
		client: s.client,
	}
	return sel
}

func (s *Selection) Select(name string) *Selection {
	return s.SelectWithAlias("", name)
}

func (s *Selection) SelectMultiple(name ...string) *Selection {
	sel := s.SelectWithAlias("", strings.Join(name, " "))
	sel.multiple = true
	return sel
}

func (s *Selection) Arg(name string, value any) *Selection {
	sel := *s
	if sel.args == nil {
		sel.args = map[string]*argument{}
	}

	sel.args[name] = &argument{
		value: value,
	}
	return &sel
}

func (s *Selection) Bind(v interface{}) *Selection {
	sel := *s
	sel.bind = v
	return &sel
}

func (s *Selection) marshalArguments(ctx context.Context) error {
	eg, gctx := errgroup.WithContext(ctx)
	for _, sel := range s.path() {
		for _, arg := range sel.args {
			arg := arg
			eg.Go(func() error {
				return arg.marshal(gctx)
			})
		}
	}

	return eg.Wait()
}

func (s *Selection) Build(ctx context.Context) (string, error) {
	if err := s.marshalArguments(ctx); err != nil {
		return "", err
	}

	var b strings.Builder
	b.WriteString("query")

	path := s.path()

	for _, sel := range path {
		if sel.prev != nil && sel.prev.multiple {
			return "", fmt.Errorf("sibling selections not end of chain")
		}

		b.WriteRune('{')

		if sel.alias != "" {
			b.WriteString(sel.alias)
			b.WriteRune(':')
		}

		b.WriteString(sel.name)

		if len(sel.args) > 0 {
			b.WriteRune('(')
			i := 0
			for name, arg := range sel.args {
				if i > 0 {
					b.WriteString(", ")
				}
				b.WriteString(name)
				b.WriteRune(':')
				b.WriteString(arg.marshalled)
				i++
			}
			b.WriteRune(')')
		}
	}

	b.WriteString(strings.Repeat("}", len(path)))
	return b.String(), nil
}

func (s *Selection) unpack(data any) error {
	for _, i := range s.path() {
		k := i.name
		if i.alias != "" {
			k = i.alias
		}

		if !i.multiple {
			if f, ok := data.(map[string]any); ok {
				data = f[k]
			}
		}

		if i.bind != nil {
			marshalled, err := json.Marshal(data)
			if err != nil {
				return err
			}
			if err := json.Unmarshal(marshalled, i.bind); err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *Selection) Client(c graphql.Client) *Selection {
	sel := *s
	sel.client = c
	return &sel
}

func (s *Selection) Execute(ctx context.Context) error {
	if s.client == nil {
		debug.PrintStack()
		return fmt.Errorf("no client configured for selection")
	}

	query, err := s.Build(ctx)
	if err != nil {
		return err
	}

	var response any
	err = s.client.MakeRequest(ctx,
		&graphql.Request{
			Query: query,
		},
		&graphql.Response{Data: &response},
	)
	if err != nil {
		return err
	}

	return s.unpack(response)
}

type argument struct {
	value any

	marshalled    string
	marshalledErr error
	once          sync.Once
}

func (a *argument) marshal(ctx context.Context) error {
	a.once.Do(func() {
		a.marshalled, a.marshalledErr = MarshalGQL(ctx, a.value)
	})
	return a.marshalledErr
}
