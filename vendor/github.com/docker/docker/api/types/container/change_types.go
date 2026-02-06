package container

const (
	// ChangeModify represents the modify operation.
	ChangeModify ChangeType = 0
	// ChangeAdd represents the add operation.
	ChangeAdd ChangeType = 1
	// ChangeDelete represents the delete operation.
	ChangeDelete ChangeType = 2
)

func (ct ChangeType) String() string {
	switch ct {
	case ChangeModify:
		return "C"
	case ChangeAdd:
		return "A"
	case ChangeDelete:
		return "D"
	default:
		return ""
	}
}
