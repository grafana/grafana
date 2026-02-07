package memo

import "errors"

var HaltErr = errors.New("halt dfs")

// DfsRel runs a callback |cb| on all execution plans in the memo expression
// group. An expression group is defined by 1) a set of child expression
// groups that serve as logical inputs to this operator, and 2) a set of logically
// equivalent plans for executing this expression group's operator. We recursively
// walk to expression group leaves, and then traverse every execution plan in leaf
// groups before working upwards back to the root group. Returning a HaltErr
// short circuits the walk.
func DfsRel(grp *ExprGroup, cb func(rel RelExpr) error) error {
	seen := make(map[GroupId]struct{})
	err := dfsRelHelper(grp, seen, cb)
	if errors.Is(err, HaltErr) {
		return nil
	}
	return err
}

func dfsRelHelper(grp *ExprGroup, seen map[GroupId]struct{}, cb func(rel RelExpr) error) error {
	if _, ok := seen[grp.Id]; ok {
		return nil
	} else {
		seen[grp.Id] = struct{}{}
	}
	n := grp.First
	for n != nil {
		for _, c := range n.Children() {
			err := dfsRelHelper(c, seen, cb)
			if err != nil {
				return err
			}
		}
		err := cb(n)
		if err != nil {
			return err
		}
		n = n.Next()
	}
	return nil
}
