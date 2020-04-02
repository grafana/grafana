// Copyright 2016 The XORM Authors. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

/*

Package builder is a simple and powerful sql builder for Go.

Make sure you have installed Go 1.1+ and then:

    go get xorm.io/builder

WARNNING: Currently, only query conditions are supported. Below is the supported conditions.

1. Eq is a redefine of a map, you can give one or more conditions to Eq

    import . "xorm.io/builder"

    sql, args, _ := ToSQL(Eq{"a":1})
    // a=? [1]
    sql, args, _ := ToSQL(Eq{"b":"c"}.And(Eq{"c": 0}))
    // b=? AND c=? ["c", 0]
    sql, args, _ := ToSQL(Eq{"b":"c", "c":0})
    // b=? AND c=? ["c", 0]
    sql, args, _ := ToSQL(Eq{"b":"c"}.Or(Eq{"b":"d"}))
    // b=? OR b=? ["c", "d"]
    sql, args, _ := ToSQL(Eq{"b": []string{"c", "d"}})
    // b IN (?,?) ["c", "d"]
    sql, args, _ := ToSQL(Eq{"b": 1, "c":[]int{2, 3}})
    // b=? AND c IN (?,?) [1, 2, 3]

2. Neq is the same to Eq

    import . "xorm.io/builder"

    sql, args, _ := ToSQL(Neq{"a":1})
    // a<>? [1]
    sql, args, _ := ToSQL(Neq{"b":"c"}.And(Neq{"c": 0}))
    // b<>? AND c<>? ["c", 0]
    sql, args, _ := ToSQL(Neq{"b":"c", "c":0})
    // b<>? AND c<>? ["c", 0]
    sql, args, _ := ToSQL(Neq{"b":"c"}.Or(Neq{"b":"d"}))
    // b<>? OR b<>? ["c", "d"]
    sql, args, _ := ToSQL(Neq{"b": []string{"c", "d"}})
    // b NOT IN (?,?) ["c", "d"]
    sql, args, _ := ToSQL(Neq{"b": 1, "c":[]int{2, 3}})
    // b<>? AND c NOT IN (?,?) [1, 2, 3]

3. Gt, Gte, Lt, Lte

    import . "xorm.io/builder"

    sql, args, _ := ToSQL(Gt{"a", 1}.And(Gte{"b", 2}))
    // a>? AND b>=? [1, 2]
    sql, args, _ := ToSQL(Lt{"a", 1}.Or(Lte{"b", 2}))
    // a<? OR b<=? [1, 2]

4. Like

    import . "xorm.io/builder"

    sql, args, _ := ToSQL(Like{"a", "c"})
    // a LIKE ? [%c%]

5. Expr you can customerize your sql with Expr

    import . "xorm.io/builder"

    sql, args, _ := ToSQL(Expr("a = ? ", 1))
    // a = ? [1]
    sql, args, _ := ToSQL(Eq{"a": Expr("select id from table where c = ?", 1)})
    // a=(select id from table where c = ?) [1]

6. In and NotIn

    import . "xorm.io/builder"

    sql, args, _ := ToSQL(In("a", 1, 2, 3))
    // a IN (?,?,?) [1,2,3]
    sql, args, _ := ToSQL(In("a", []int{1, 2, 3}))
    // a IN (?,?,?) [1,2,3]
    sql, args, _ := ToSQL(In("a", Expr("select id from b where c = ?", 1))))
    // a IN (select id from b where c = ?) [1]

7. IsNull and NotNull

    import . "xorm.io/builder"

    sql, args, _ := ToSQL(IsNull{"a"})
    // a IS NULL []
    sql, args, _ := ToSQL(NotNull{"b"})
     // b IS NOT NULL []

8. And(conds ...Cond), And can connect one or more condtions via AND

    import . "xorm.io/builder"

    sql, args, _ := ToSQL(And(Eq{"a":1}, Like{"b", "c"}, Neq{"d", 2}))
    // a=? AND b LIKE ? AND d<>? [1, %c%, 2]

9. Or(conds ...Cond), Or can connect one or more conditions via Or

    import . "xorm.io/builder"

    sql, args, _ := ToSQL(Or(Eq{"a":1}, Like{"b", "c"}, Neq{"d", 2}))
    // a=? OR b LIKE ? OR d<>? [1, %c%, 2]
    sql, args, _ := ToSQL(Or(Eq{"a":1}, And(Like{"b", "c"}, Neq{"d", 2})))
    // a=? OR (b LIKE ? AND d<>?) [1, %c%, 2]

10. Between

    import . "xorm.io/builder"

    sql, args, _ := ToSQL(Between("a", 1, 2))
    // a BETWEEN 1 AND 2

11. define yourself conditions
Since Cond is a interface, you can define yourself conditions and compare with them
*/
package builder
