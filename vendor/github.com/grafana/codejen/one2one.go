package codejen

type OneToOne[I Input] interface {
	Jenny[I]

	// Generate takes an Input and generates one [File]. The zero value of a File
	// may be returned to indicate the jenny was a no-op for the provided Input.
	Generate(I) (*File, error)
}

type o2oAdapt[InI, OutI Input] struct {
	fn func(OutI) InI
	j  OneToOne[InI]
}

func (oa *o2oAdapt[InI, OutI]) JennyName() string {
	return oa.j.JennyName()
}

func (oa *o2oAdapt[InI, OutI]) Generate(t OutI) (*File, error) {
	return oa.j.Generate(oa.fn(t))
}

// AdaptOneToOne takes a OneToOne jenny that accepts a particular type as input
// (InI), and transforms it into a jenny that accepts a different type
// as input (OutI), given a function that can transform an InI
// to an OutI.
//
// Use this to make jennies reusable in other Input type contexts.
func AdaptOneToOne[InI, OutI Input](j OneToOne[InI], fn func(OutI) InI) OneToOne[OutI] {
	return &o2oAdapt[InI, OutI]{
		fn: fn,
		j:  j,
	}
}

// MapOneToOne takes a OneToOne jenny and wraps it in a stack of FileMappers to create a
// new OneToOne jenny. When Generate is called, the output of the OneToOne jenny will be
// transformed
// func MapOneToOne[I Input](j OneToOne[I], fn ...FileMapper) OneToOne[I] {
//
// }
