package codejen

type OneToMany[I Input] interface {
	Jenny[I]

	// Generate takes an Input and generates many [File]s, or none (nil) if the j
	// was a no-op for the provided Input.
	Generate(I) (Files, error)
}

type o2mAdapt[InI, OutI Input] struct {
	fn func(OutI) InI
	j  OneToMany[InI]
}

func (oa *o2mAdapt[InI, OutI]) JennyName() string {
	return oa.j.JennyName()
}

func (oa *o2mAdapt[InI, OutI]) Generate(t OutI) (Files, error) {
	return oa.j.Generate(oa.fn(t))
}

// AdaptOneToMany takes a OneToMany jenny that accepts a particular type as input
// (InI), and transforms it into a jenny that accepts a different type
// as input (OutI), given a function that can transform an InI
// to an OutI.
//
// Use this to make jennies reusable in other Input type contexts.
func AdaptOneToMany[InI, OutI Input](j OneToMany[InI], fn func(OutI) InI) OneToMany[OutI] {
	return &o2mAdapt[InI, OutI]{
		fn: fn,
		j:  j,
	}
}
