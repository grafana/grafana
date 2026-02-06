package builder

type Aliased struct {
	table interface{}
	alias string
}

func As(table interface{}, alias string) *Aliased {
	return &Aliased{table, alias}
}
