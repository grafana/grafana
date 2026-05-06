package ini

type lineToken interface {
	isLineToken()
}

type lineTokenProfile struct {
	Type string
	Name string
}

func (*lineTokenProfile) isLineToken() {}

type lineTokenProperty struct {
	Key   string
	Value string
}

func (*lineTokenProperty) isLineToken() {}

type lineTokenContinuation struct {
	Value string
}

func (*lineTokenContinuation) isLineToken() {}

type lineTokenSubProperty struct {
	Key   string
	Value string
}

func (*lineTokenSubProperty) isLineToken() {}
