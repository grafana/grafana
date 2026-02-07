package option

import (
	"github.com/grafana/cog/internal/veneers"
)

type RewriteRule struct {
	Selector Selector
	Action   RewriteAction
}

func Rename(selector Selector, newName string) RewriteRule {
	return RewriteRule{
		Selector: selector,
		Action:   RenameAction(newName),
	}
}

func ArrayToAppend(selector Selector) RewriteRule {
	return RewriteRule{
		Selector: selector,
		Action:   ArrayToAppendAction(),
	}
}

func MapToIndex(selector Selector) RewriteRule {
	return RewriteRule{
		Selector: selector,
		Action:   MapToIndexAction(),
	}
}

func RenameArguments(selector Selector, newNames []string) RewriteRule {
	return RewriteRule{
		Selector: selector,
		Action:   RenameArgumentsAction(newNames),
	}
}

func Omit(selector Selector) RewriteRule {
	return RewriteRule{
		Selector: selector,
		Action:   OmitAction(),
	}
}

func VeneerTrailAsComments(selector Selector) RewriteRule {
	return RewriteRule{
		Selector: selector,
		Action:   VeneerTrailAsCommentsAction(),
	}
}

func UnfoldBoolean(selector Selector, unfoldOpts BooleanUnfold) RewriteRule {
	return RewriteRule{
		Selector: selector,
		Action:   UnfoldBooleanAction(unfoldOpts),
	}
}

func StructFieldsAsArguments(selector Selector, explicitFields ...string) RewriteRule {
	return RewriteRule{
		Selector: selector,
		Action:   StructFieldsAsArgumentsAction(explicitFields...),
	}
}

func StructFieldsAsOptions(selector Selector, explicitFields ...string) RewriteRule {
	return RewriteRule{
		Selector: selector,
		Action:   StructFieldsAsOptionsAction(explicitFields...),
	}
}

func DisjunctionAsOptions(selector Selector, argumentIndex int) RewriteRule {
	return RewriteRule{
		Selector: selector,
		Action:   DisjunctionAsOptionsAction(argumentIndex),
	}
}

func Duplicate(selector Selector, duplicateName string) RewriteRule {
	return RewriteRule{
		Selector: selector,
		Action:   DuplicateAction(duplicateName),
	}
}

func AddAssignment(selector Selector, assignment veneers.Assignment) RewriteRule {
	return RewriteRule{
		Selector: selector,
		Action:   AddAssignmentAction(assignment),
	}
}

func AddComments(selector Selector, comments []string) RewriteRule {
	return RewriteRule{
		Selector: selector,
		Action:   AddCommentsAction(comments),
	}
}
