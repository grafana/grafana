package syntax

type WalkFn = func(e Expr)

func walkAll(f WalkFn, xs ...Walkable) {
	for _, x := range xs {
		x.Walk(f)
	}
}

type Walkable interface {
	Walk(f WalkFn)
}
