mysqlerr
========

MySQL Server Error Constants

Covers up to MySQL 5.7.13. Notice that some constants were renamed in later
versions of MySQL, because they became obsolete. (In case you wonder: the names
here match the symbols MySQL uses in source code.) Obsolete names haven't been
changed in this package to avoid breaking code, but you should no longer be
using them in applications. Here's the full list of changes since this package's
first version:

| Code | This package | MySQL (as of 5.7.8) |
| ---: | ------------ | ------------------- |
| 1150 | ER_DELAYED_CANT_CHANGE_LOCK | ER_UNUSED1 |
| 1151 | ER_TOO_MANY_DELAYED_THREADS | ER_UNUSED2 |
| 1165 | ER_DELAYED_INSERT_TABLE_LOCKED | ER_UNUSED3 |
| 1349 | ER_VIEW_SELECT_DERIVED | ER_VIEW_SELECT_DERIVED_UNUSED |
