/*
Package badger implements an embeddable, simple and fast key-value database,
written in pure Go. It is designed to be highly performant for both reads and
writes simultaneously. Badger uses Multi-Version Concurrency Control (MVCC), and
supports transactions. It runs transactions concurrently, with serializable
snapshot isolation guarantees.

Badger uses an LSM tree along with a value log to separate keys from values,
hence reducing both write amplification and the size of the LSM tree. This
allows LSM tree to be served entirely from RAM, while the values are served
from SSD.

# Usage

Badger has the following main types: DB, Txn, Item and Iterator. DB contains
keys that are associated with values. It must be opened with the appropriate
options before it can be accessed.

All operations happen inside a Txn. Txn represents a transaction, which can
be read-only or read-write. Read-only transactions can read values for a
given key (which are returned inside an Item), or iterate over a set of
key-value pairs using an Iterator (which are returned as Item type values as
well). Read-write transactions can also update and delete keys from the DB.

See the examples for more usage details.
*/
package badger
