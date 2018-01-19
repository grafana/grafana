/*

Agg computes aggregate values over tabular text.
It behaves somewhat like the SQL “GROUP BY” clause.

Usage:

	agg [function...]

It reads input from stdin as a sequence of records, one per line.
It treats each line as a set of fields separated by white space.
One field (the first, by default) is designated as the key.
Successive lines with equal keys are grouped into a group,
and agg produces one line of output for each group.
(Note that only contiguous input lines can form a group.
If you need to make sure that all records for a given key
are grouped together, sort the input first.)

For each remaining field,
agg applies a function to all the values in the group,
producing a single output value.
The command line arguments specify which functions to use,
one per field in the input table.

Functions

The available functions are:

    key        group by this field (default for field 1)
    first      value from first line of group (default for rest)
    last       value from last line of group
    sample     value from any line of group, uniformly at random
    prefix     longest common string prefix
    join:sep   concatenate strings with given sep
    smin       lexically least string
    smax       lexically greatest string
    min        numerically least value
    max        numerically greatest value
    sum        numeric sum
    mean       arithmetic mean
    count      number of records (ignores input value)
    const:val  print val, ignoring input
    drop       omit the column entirely

The numeric functions skip items that don't parse as numbers.

Examples

Using the following input:

    $ cat >input
    -rwx   alice      100   /home/alice/bin/crdt
    -rw-   alice   210002   /home/alice/thesis.tex
    -rw-   bob      10051   /home/bob/expenses.tab
    -rwx   kr      862060   /home/kr/bin/blog
    -rwx   kr      304608   /home/kr/bin/agg

Disk usage for each user, plus where that disk usage occurs
(longest common prefix of filesystem paths):

    $ agg <input drop key sum prefix
    alice	210153	/home/alice/
    bob	10051	/home/bob/expenses.tab
    kr	1166668	/home/kr/

Disk usage for executable vs non-executable files:

    $ sort input | agg key drop sum join:,
    -rw-	220053	/home/alice/thesis.tex,/home/bob/expenses.tab
    -rwx	1166768	/home/alice/bin/crdt,/home/kr/bin/agg,/home/kr/bin/blog

*/
package main
