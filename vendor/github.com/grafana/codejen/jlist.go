package codejen

import (
	"fmt"
	"sync"

	"github.com/hashicorp/go-multierror"
)

type jnode struct {
	next *jnode
	j    NamedJenny
}

// JennyListWithNamer creates a new JennyList that decorates errors using the
// provided namer func, which can derive a meaningful identifier string from the
// Input type for the JennyList.
func JennyListWithNamer[Input any](namer func(t Input) string) *JennyList[Input] {
	return &JennyList[Input]{
		inputnamer: namer,
	}
}

var _ ManyToMany[any] = &JennyList[any]{}

// JennyList is an ordered collection of jennies. JennyList itself implements
// [ManyToMany], and when called, will construct an [FS] by calling each of its
// contained jennies in order.
//
// The primary purpose of JennyList is to make it easy to create complex,
// case-specific code generators by composing sets of small, reusable jennies
// that each have clear, narrow responsibilities.
//
// The File outputs of all member jennies in a JennyList exist in the same
// relative path namespace. JennyList does not modify emitted paths. Path
// uniqueness (per [Files.Validate]) is internally enforced across the aggregate
// set of Files.
//
// JennyList's Input type parameter is used to enforce that every Jenny in the
// JennyList takes the same type parameter.
type JennyList[Input any] struct {
	mut sync.RWMutex

	// entrypoint to the singly linked list of jennies
	first *jnode

	// postprocessors, to be run on every file returned from each contained jenny
	post []FileMapper

	// inputnamer, if non-nil, gives a name to an input.
	inputnamer func(t Input) string
}

func (jl *JennyList[Input]) last() *jnode {
	j := jl.first
	for j != nil && j.next != nil {
		j = j.next
	}
	return j
}

func (jl *JennyList[Input]) JennyName() string {
	return fmt.Sprintf("JennyList[%T]", new(Input))
}

func (jl *JennyList[Input]) wrapinerr(in Input, err error) error {
	if err == nil {
		return nil
	}
	if jl.inputnamer == nil {
		return err
	}
	return fmt.Errorf("%w for input %q", err, jl.inputnamer(in))
}

func (jl *JennyList[Input]) GenerateFS(objs ...Input) (*FS, error) {
	jl.mut.RLock()
	defer jl.mut.RUnlock()

	if jl.first == nil {
		return nil, nil
	}

	jfs := NewFS()

	manyout := func(j Jenny[Input], err error, fl ...File) error {
		if err != nil {
			return fmt.Errorf("%s: %w", j.JennyName(), err)
		}

		if err = Files(fl).Validate(); err != nil {
			// This is unreachable in the case where there was a single File output, so plural is fine
			return fmt.Errorf("%s returned invalid Files: %w", j.JennyName(), err)
		}

		// postprocessing
		for i, f := range fl {
			for _, post := range jl.post {
				of, err := post(f)
				if err != nil {
					return fmt.Errorf("postprocessing of %s from %s failed: %w", f.RelativePath, jennystack(f.From), err)
				}
				f = of
			}
			fl[i] = f
		}
		return jfs.addValidated(fl...)
	}
	oneout := func(j Jenny[Input], f *File, err error) error {
		// errs and empty file case are handled by manyout with a zero-len variadic arg
		if err != nil || f == nil || !f.Exists() {
			return manyout(j, err)
		}
		return manyout(j, err, *f)
	}

	result := new(multierror.Error)
	jn := jl.first
	for jn != nil {
		var handlerr error
		switch jenny := jn.j.(type) {
		case OneToOne[Input]:
			for _, obj := range objs {
				f, err := jenny.Generate(obj)
				if procerr := jl.wrapinerr(obj, oneout(jenny, f, err)); procerr != nil {
					result = multierror.Append(result, procerr)
				}
			}
		case OneToMany[Input]:
			for _, obj := range objs {
				fl, err := jenny.Generate(obj)
				if procerr := jl.wrapinerr(obj, manyout(jenny, err, fl...)); procerr != nil {
					result = multierror.Append(result, procerr)
				}
			}
		case ManyToOne[Input]:
			f, err := jenny.Generate(objs...)
			handlerr = oneout(jenny, f, err)
		case ManyToMany[Input]:
			fl, err := jenny.Generate(objs...)
			handlerr = manyout(jenny, err, fl...)
		default:
			panic("unreachable")
		}

		if handlerr != nil {
			result = multierror.Append(result, handlerr)
		}
		jn = jn.next
	}

	if result.ErrorOrNil() != nil {
		return nil, multierror.Flatten(result)
	}

	return jfs, nil
}

func (jl *JennyList[Input]) Generate(objs ...Input) (Files, error) {
	jfs, err := jl.GenerateFS(objs...)
	if err != nil {
		return nil, err
	}
	return jfs.AsFiles(), nil
}

func (jl *JennyList[Input]) append(n ...*jnode) {
	jl.mut.Lock()
	last := jl.last()
	if last == nil {
		jl.first = n[0]
		n = n[1:]
		last = jl.first
	}
	for _, jn := range n {
		last.next = jn
		last = last.next
	}
	jl.mut.Unlock()
}

func tojnode[J NamedJenny](jennies ...J) []*jnode {
	nlist := make([]*jnode, len(jennies))
	for i, j := range jennies {
		nlist[i] = &jnode{
			j: j,
		}
	}
	return nlist
}

// Append adds Jennies to the end of the JennyList. In Generate, Jennies are
// called in the order they were appended.
//
// All provided jennies must also implement one of [OneToOne], [OneToMany],
// [ManyToOne], [ManyToMany], or this method will panic. For proper type safety,
// use the Append* methods.
func (jl *JennyList[Input]) Append(jennies ...Jenny[Input]) {
	nlist := make([]*jnode, len(jennies))
	for i, j := range jennies {
		switch j.(type) {
		case OneToOne[Input], OneToMany[Input], ManyToOne[Input], ManyToMany[Input]:
			nlist[i] = &jnode{
				j: j,
			}
		default:
			intyp := *(new(Input))
			errtxt := `%T is not a valid Jenny, must implement one of
	codejen.OneToOne[%T]
	codejen.OneToMany[%T]
	codejen.ManyToOne[%T]
	codejen.ManyToMany[%T]
`
			panic(fmt.Sprintf(errtxt, j, intyp, intyp, intyp, intyp))
		}
	}
	jl.append(nlist...)
}

// AppendOneToOne is like [JennyList.Append], but typesafe for OneToOne jennies.
func (jl *JennyList[Input]) AppendOneToOne(jennies ...OneToOne[Input]) {
	jl.append(tojnode(jennies...)...)
}

// AppendManyToOne is like [JennyList.Append], but typesafe for ManyToOne jennies.
func (jl *JennyList[Input]) AppendManyToOne(jennies ...ManyToOne[Input]) {
	jl.append(tojnode(jennies...)...)
}

// AppendOneToMany is like [JennyList.Append], but typesafe for OneToMany jennies.
func (jl *JennyList[Input]) AppendOneToMany(jennies ...OneToMany[Input]) {
	jl.append(tojnode(jennies...)...)
}

// AppendManyToMany is like [JennyList.Append], but typesafe for ManyToMany jennies.
func (jl *JennyList[Input]) AppendManyToMany(jennies ...ManyToMany[Input]) {
	jl.append(tojnode(jennies...)...)
}

// AddPostprocessors appends a slice of FileMapper to its internal list of
// postprocessors.
//
// Postprocessors are run (FIFO) on every File produced by the JennyList.
func (jl *JennyList[Input]) AddPostprocessors(fn ...FileMapper) {
	jl.mut.Lock()
	jl.post = append(jl.post, fn...)
	jl.mut.Unlock()
}
