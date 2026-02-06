package codejen

// ManyToMany is a Jenny that accepts many inputs, and produces 0 to N files as output.
type ManyToMany[I Input] interface {
	Jenny[I]

	// Generate takes a slice of Input and generates many [File]s, or none
	// (nil) if the j was a no-op for the provided Input.
	//
	// A nil, nil return is used to indicate the generator had nothing to do for the
	// provided Input.
	Generate(...I) (Files, error)
}

type m2mAdapt[InI, OutI Input] struct {
	fn func(OutI) InI
	j  ManyToMany[InI]
}

func (oa *m2mAdapt[InI, OutI]) JennyName() string {
	return oa.j.JennyName()
}

func (oa *m2mAdapt[InI, OutI]) Generate(ps ...OutI) (Files, error) {
	qs := make([]InI, len(ps))
	for i, p := range ps {
		qs[i] = oa.fn(p)
	}
	return oa.j.Generate(qs...)
}

// AdaptManyToMany takes a ManyToMany jenny that accepts a particular type as input
// (InI), and transforms it into a jenny that accepts a different type
// as input (OutI), given a function that can transform an InI
// to an OutI.
//
// Use this to make jennies reusable in other Input type contexts.
func AdaptManyToMany[InI, OutI Input](j ManyToMany[InI], fn func(OutI) InI) ManyToMany[OutI] {
	return &m2mAdapt[InI, OutI]{
		fn: fn,
		j:  j,
	}
}
