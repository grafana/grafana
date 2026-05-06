package codejen

type ManyToOne[I Input] interface {
	Jenny[I]

	// Generate takes a slice of Input and generates one File, The zero value of a
	// File may be returned to indicate the jenny was a no-op for the provided
	// Inputs.
	Generate(...I) (*File, error)
}

type m2oAdapt[InI, OutI Input] struct {
	fn func(OutI) InI
	g  ManyToOne[InI]
}

func (oa *m2oAdapt[InI, OutI]) JennyName() string {
	return oa.g.JennyName()
}

func (oa *m2oAdapt[InI, OutI]) Generate(ps ...OutI) (*File, error) {
	qs := make([]InI, len(ps))
	for i, p := range ps {
		qs[i] = oa.fn(p)
	}
	return oa.g.Generate(qs...)
}

// AdaptManyToOne takes a ManyToOne jenny that accepts a particular type as input
// (InI), and transforms it into a jenny that accepts a different type
// as input (OutI), given a function that can transform an InI
// to an OutI.
//
// Use this to make jennies reusable in other Input type contexts.
func AdaptManyToOne[InI, OutI Input](g ManyToOne[InI], fn func(OutI) InI) ManyToOne[OutI] {
	return &m2oAdapt[InI, OutI]{
		fn: fn,
		g:  g,
	}
}
