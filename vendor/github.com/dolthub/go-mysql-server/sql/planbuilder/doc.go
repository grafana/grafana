package planbuilder

// The planbuilder package is responsible for:
// - converting an ast.SQLNode tree into a sql.Node tree
// - resolving column and table uses
//
// In the future this package will absorb type checking and coercion
//
// This package currently does minor expression uniqueness tracking, which
// should be absorbed by the plan IR.
//
//
// Name resolution works similarly to an attribute grammar. A simple attribute
// grammar walks an AST and populates a node's attributes either by inspecting
// its parents for top-down attributes, or children for bottom-up attributes.
// Type checking for expressions, for example, takes initial hints from the
// parent and build types upwards, applying casts where appropriate. For
// example, the float_col below should cast (1+1) to a float, and 2/1 to an
// int:
//
// INSERT INTO table (float_col, int_col) values (1+1, 2/1)
//
// Variable resolution of SQL queries works similarly, but involves more
// branching logic and in postgres and cockroach are divided into two phases:
// analysis and building. Analysis walks the AST, resolves types, collects name
// definitions, and replaces certain nodes with tracker ASTs that make
// aggregations and subqueries easier to build. Building (transform in PG)
// initializes the optimizer IR by adding expression groups to the query memo.
// In our case we create the sql.Node tree.
//
// The order that we walk nodes in an AST depends on the particular query.
// In the simplest case, a SELECT expression resolves column references using
// FROM scope definitions. The source columns below are x:1, y:2, z:3:
//
// select x, y from xy where x = 0
// Project
// ├─ columns: [xy.x:1!null, xy.y:2!null]
// └─ Filter
//     ├─ Eq
//     │   ├─ xy.x:1!null
//     │   └─ 0 (tinyint)
//     └─ Table
//         ├─ name: xy
//         └─ columns: [x y z]
//
// It is useful to assign unique ids to referencable expressions. It is more
// difficult to track symbols after substituting execution time indexes.
//
// There are two main complexities: 1) many clauses have required input
// dependencies that are not naturally represented in the AST representation,
// and instead have to be tracked and added with intermediate projections.
// 2) Tracking dependencies using only string matching is fraught. We need
// a way to reliably detect that two expressions are identical, refer to it with
// references, and when adding expressions to the plan identify when the same
// expression has already been evaluated and projected lower in the tree.
// We currently only have partial solutions for these two problems.
//
// The first difficulty, tracking input dependencies, is solved by separating
// resolving into two phases. The first phase walks the tree to identify special
// functions and expressions with unique input dependencies. For example,
// aggregation and window functions (/ arguments) are a special case that require
// unique rules when building, and are tracked separately. Accessory columns used
// by ORDER BY, HAVING, and DISTINCT require projection inputs that are not
// returned as output target projections.
//
// In the example below, we identify and tag two aggregations that are assigned
// expression ids after x,y, and z: SUM(y):4, COUNT(y):5. The sort node and
// target list projections that use those aggregations resolve their id references:
//
// select x, sum(y) from xy group by x order by x - count(y)
// =>
// Project
// ├─ columns: [xy.x:1!null, SUM(xy.y):4!null as sum(y)]
// └─ Sort((xy.x:1!null - COUNT(xy.y):5!null) ASC nullsFirst)
//     └─ GroupBy
//         ├─ select: xy.y:2!null, xy.x:1!null, SUM(xy.y:2!null), COUNT(xy.y:2!null)
//         ├─ group: xy.x:1!null
//         └─ Table
//             ├─ name: xy
//             └─ columns: [x y z]
//
// Passthrough columns not included in the SELECT target list need to be added
// to the intermediate aggregation projection:
//
// select x from xy having z > 0
// =>
// Project
// ├─ columns: [xy.x:1!null]
// └─ Having
//     ├─ GreaterThan
//     │   ├─ xy.z:3!null
//     │   └─ 0 (tinyint)
//     └─ GroupBy
//         ├─ select: xy.x:1!null, xy.z:3!null
//         ├─ group:
//         └─ Table
//             ├─ name: xy
//             └─ columns: [x y z]
//
// Aggregations are probably a long-tail of testing to get this behavior right,
// particularly when aggregate functions are initialized outside of their
// execution scope (select (select u from uv where max(x) > u limit 1) from xy).
//
// The second difficulty is how to represent complex expressions and references while
// building the plan, and how low in the tree to execute expression logic. This
// is a secondary concern compared to generating unique ids for aggregation
// functions and source columns.
//
// For example, (x+z) is a target and grouping column below. The aggregation
// could return (x+z) which the target list passes through:
//
// SELECT count(xy.x) AS count_1, x + z AS lx FROM xy GROUP BY x + z
// =>
// Project
// ├─ columns: [COUNT(xy.x):4!null as count_1, (xy.x:1!null + xy.z:3!null) as lx]
// └─ GroupBy
//     ├─ select: xy.x:1!null, (xy.x:1!null + xy.z:3!null), COUNT(xy.x:1!null), xy.z:3!null
//     ├─ group: (xy.x:1!null + xy.z:3!null)
//     └─ Table
//         ├─ name: xy
//         └─ columns: [x y z]
//
// We do not have a good way of referencing expressions that are not
// aggregation functions or table columns. In other databases, expressions are
// interned when they are added to the plan IR. So an expression will be evaluated
// and available for reference at the lowest level of the tree it was built. If
// an aggregation builds an expression, a projection built later will find
// the reference and avoid re-computing the value. If a relation earlier in the
// tree built a subtree of an expression currently being built, it can input
// the reference rather than computing the subtree.
//
// TODO:
// - The analyze phase should include type checking and coercion.
// - The analyze phase is missing other validation logic.Ambiguous table
//   names, column names. Validate strict grouping columns.
// - Use memo to intern built expressions, avoid re-evaluating complex expressions
//   when references exist.
// - Much more aggregation testing needed.
//
