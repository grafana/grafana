package stats

// The `stats` package includes a generic implementation of the sql.Statistic
// interface and mutator methods for applying filter predicates to statistics.
//
// Statistics are used for optimizer transformations whose optimal plans
// depends on the contents and shape of rows in a database, as opposed to
// normalization transformations that always simplify and improve a plan's
// runtime.
//
// The process of exploring the search space of query plans based on table
// data shape is called "costed exploration", or just "costing". Costing
// includes:
//   - indexed range scans given a set of filters and indexes
//   - join ordering and join execution operators
//   - sort enforcement via indexing or sort nodes
//   - aggregating before or after a join
//   - executing scalar subqueries as lateral joins or as nested relations
//
// Statistics as the source of truth for comparing the costs of different
// query plans. The key metric for comparison is "cardinality", which is the
// number of rows that a relation is expected to return. Relational operators
// mutate child statistics to accumulate the effect of that operator on the
// output cardinality.
//
// For example, if the query below applies an equality filter to a tablescan:
//
// SELECT * from mytable where i > 0
//
// The cardinality of the total output depends on 1) the number of rows in
// mytable, and 2) the fraction of mytable that is positive. The cardinality
// changes as the values in mytable changes. If mytable has 10 non-negative
// rows, the cardinality of the query is 10. If we run the query below:
//
// UPDATE mytable set i = i-5;
//
// the cardinality of the query will now depend on whether we've made any
// previously positive |i| values zero or negative.
//
// Histogram
//
// Histograms are the key data structure we use to maintain statistics in
// response to real DML mutations and theoretical mutations by relational
// operators.
//
// A histogram is an ordered set of partitions of a table index. The ideal
// histogram has evenly spaced partitions, enough partitions to provide
// useful metric accuracy, and few enough partitions that updating
// statistics is fast.
//
// A histogram might look something like this:
//
// -10: ******
// 0: **********
// 10: ****
//
// This histogram has 5 buckets. Upper bound values are explicit. The
// contents of each bucket is visualized by the number of asterisks. We
// interpret this visualization as: there are 6 rows less than or equal to -10,
// 10 rows between 0 and 10, and 4 rows between 0 and 10.
//
// We can store this information in a compact form:
//
// type Histogram struct {
//   Buckets []struct{
//     UpperBound int
//     RowCount   int
//   }
// }
//
// Going back to our query:
//
// SELECT * from mytable where i > 0
//
// Our estimate for the output cardinality without a histogram would be
// anywhere between 0 and 20 rows. The histogram gives a more accurate
// estimate, 4. If the histogram is completely up-to-date with the contents
// of the database, this histogram metric will be the exact value.
//
// Index Costing
//
// We use histograms to compare index options for range scans. For example,
// we might have a query with several filters:
//
// CREATE TABLE ab (
//   a int,
//   b int,
//   PRIMARY KEY(a,b),
//   KEY(b,a)
// );
//
// SELECT * FROM ab WHERE a > 2 and b < 4;
//
// We have a choice whether to read index (ab) from (2,∞), or index (ba) from
// (-∞,4). We consult the histogram to find which plan is the cheapest:
//
// (a,b)
//  0,8:   ********** (10)
//  5,12:  **** (4)
//  10,5:  ******** (8)
//  15,20: ***** (5)
//
// (b,a)
//  0,0:  * (1)
//  2,1:  *** (3)
//  6,5:  ****** (6)
//  10,2: ***************** (17)
//
// We notice that (a) values are consistently distributed from 0-15+, but (b)
// values are clustered between 6-10+. Applying the predicates to the
// appropriate indexes yields range scan estimates:
//  - (ab)->(2,∞)  = 17 (4+8+5)
//  - (ba)->(-∞,4) = 10 (1+3+6)
//
// The output cardinality after applying both filters might not be 10, but the
// cheapest plan will use (ba) to read the 10 rows from disk before applying
// the (a > 2) filter.
//
// Similar logic applies to multiple and overlapping filters. We accumulate the
// effect of statistics truncation to estimate which index and combination of
// filters reads the fewest rows from disk.

// TODO MCVs
// TODO unique count
// TODO joins
//
