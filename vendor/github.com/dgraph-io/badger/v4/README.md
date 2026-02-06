# BadgerDB

[![Go Reference](https://pkg.go.dev/badge/github.com/dgraph-io/badger/v4.svg)](https://pkg.go.dev/github.com/dgraph-io/badger/v4)
[![Go Report Card](https://goreportcard.com/badge/github.com/dgraph-io/badger/v4)](https://goreportcard.com/report/github.com/dgraph-io/badger/v4)
[![Sourcegraph](https://sourcegraph.com/github.com/hypermodeinc/badger/-/badge.svg)](https://sourcegraph.com/github.com/hypermodeinc/badger?badge)
[![ci-badger-tests](https://github.com/hypermodeinc/badger/actions/workflows/ci-badger-tests.yml/badge.svg)](https://github.com/hypermodeinc/badger/actions/workflows/ci-badger-tests.yml)
[![ci-badger-bank-tests](https://github.com/hypermodeinc/badger/actions/workflows/ci-badger-bank-tests.yml/badge.svg)](https://github.com/hypermodeinc/badger/actions/workflows/ci-badger-bank-tests.yml)

![Badger mascot](images/diggy-shadow.png)

BadgerDB is an embeddable, persistent and fast key-value (KV) database written in pure Go. It is the
underlying database for [Dgraph](https://github.com/hypermodeinc/dgraph), a fast, distributed graph database. It's meant
to be a performant alternative to non-Go-based key-value stores like RocksDB.

## Project Status

Badger is stable and is being used to serve data sets worth hundreds of terabytes. Badger supports
concurrent ACID transactions with serializable snapshot isolation (SSI) guarantees. A Jepsen-style
bank test runs nightly for 8h, with `--race` flag and ensures the maintenance of transactional
guarantees. Badger has also been tested to work with filesystem level anomalies, to ensure
persistence and consistency. Badger is being used by a number of projects which includes Dgraph,
Jaeger Tracing, UsenetExpress, and many more.

The list of projects using Badger can be found [here](#projects-using-badger).

Please consult the [Changelog] for more detailed information on releases.

[Changelog]: https://github.com/hypermodeinc/badger/blob/main/CHANGELOG.md

## Table of Contents

- [BadgerDB](#badgerdb)
  - [Project Status](#project-status)
  - [Table of Contents](#table-of-contents)
  - [Getting Started](#getting-started)
    - [Installing](#installing)
      - [Installing Badger Command Line Tool](#installing-badger-command-line-tool)
      - [Choosing a version](#choosing-a-version)
  - [Badger Documentation](#badger-documentation)
  - [Resources](#resources)
    - [Blog Posts](#blog-posts)
  - [Design](#design)
    - [Comparisons](#comparisons)
    - [Benchmarks](#benchmarks)
  - [Projects Using Badger](#projects-using-badger)
  - [Contributing](#contributing)
  - [Contact](#contact)

## Getting Started

### Installing

To start using Badger, install Go 1.21 or above. Badger v3 and above needs go modules. From your
project, run the following command

```sh
go get github.com/dgraph-io/badger/v4
```

This will retrieve the library.

#### Installing Badger Command Line Tool

Badger provides a CLI tool which can perform certain operations like offline backup/restore. To
install the Badger CLI, retrieve the repository and checkout the desired version. Then run

```sh
cd badger
go install .
```

This will install the badger command line utility into your $GOBIN path.

## Badger Documentation

Badger Documentation is available at https://docs.hypermode.com/badger

## Resources

### Blog Posts

1. [Introducing Badger: A fast key-value store written natively in Go](https://hypermode.com/blog/badger/)
2. [Make Badger crash resilient with ALICE](https://hypermode.com/blog/alice/)
3. [Badger vs LMDB vs BoltDB: Benchmarking key-value databases in Go](https://hypermode.com/blog/badger-lmdb-boltdb/)
4. [Concurrent ACID Transactions in Badger](https://hypermode.com/blog/badger-txn/)

## Design

Badger was written with these design goals in mind:

- Write a key-value database in pure Go.
- Use latest research to build the fastest KV database for data sets spanning terabytes.
- Optimize for SSDs.

Badger’s design is based on a paper titled _[WiscKey: Separating Keys from Values in SSD-conscious
Storage][wisckey]_.

[wisckey]: https://www.usenix.org/system/files/conference/fast16/fast16-papers-lu.pdf

### Comparisons

| Feature                       | Badger                                     | RocksDB                       | BoltDB    |
| ----------------------------- | ------------------------------------------ | ----------------------------- | --------- |
| Design                        | LSM tree with value log                    | LSM tree only                 | B+ tree   |
| High Read throughput          | Yes                                        | No                            | Yes       |
| High Write throughput         | Yes                                        | Yes                           | No        |
| Designed for SSDs             | Yes (with latest research <sup>1</sup>)    | Not specifically <sup>2</sup> | No        |
| Embeddable                    | Yes                                        | Yes                           | Yes       |
| Sorted KV access              | Yes                                        | Yes                           | Yes       |
| Pure Go (no Cgo)              | Yes                                        | No                            | Yes       |
| Transactions                  | Yes, ACID, concurrent with SSI<sup>3</sup> | Yes (but non-ACID)            | Yes, ACID |
| Snapshots                     | Yes                                        | Yes                           | Yes       |
| TTL support                   | Yes                                        | Yes                           | No        |
| 3D access (key-value-version) | Yes<sup>4</sup>                            | No                            | No        |

<sup>1</sup> The [WISCKEY paper][wisckey] (on which Badger is based) saw big wins with separating
values from keys, significantly reducing the write amplification compared to a typical LSM tree.

<sup>2</sup> RocksDB is an SSD optimized version of LevelDB, which was designed specifically for
rotating disks. As such RocksDB's design isn't aimed at SSDs.

<sup>3</sup> SSI: Serializable Snapshot Isolation. For more details, see the blog post
[Concurrent ACID Transactions in Badger](https://hypermode.com/blog/badger-txn/)

<sup>4</sup> Badger provides direct access to value versions via its Iterator API. Users can also
specify how many versions to keep per key via Options.

### Benchmarks

We have run comprehensive benchmarks against RocksDB, Bolt and LMDB. The benchmarking code, and the
detailed logs for the benchmarks can be found in the [badger-bench] repo. More explanation,
including graphs can be found the blog posts (linked above).

[badger-bench]: https://github.com/dgraph-io/badger-bench

## Projects Using Badger

Below is a list of known projects that use Badger:

- [Dgraph](https://github.com/hypermodeinc/dgraph) - Distributed graph database.
- [Jaeger](https://github.com/jaegertracing/jaeger) - Distributed tracing platform.
- [go-ipfs](https://github.com/ipfs/go-ipfs) - Go client for the InterPlanetary File System (IPFS),
  a new hypermedia distribution protocol.
- [Riot](https://github.com/go-ego/riot) - An open-source, distributed search engine.
- [emitter](https://github.com/emitter-io/emitter) - Scalable, low latency, distributed pub/sub
  broker with message storage, uses MQTT, gossip and badger.
- [OctoSQL](https://github.com/cube2222/octosql) - Query tool that allows you to join, analyse and
  transform data from multiple databases using SQL.
- [Dkron](https://dkron.io/) - Distributed, fault tolerant job scheduling system.
- [smallstep/certificates](https://github.com/smallstep/certificates) - Step-ca is an online
  certificate authority for secure, automated certificate management.
- [Sandglass](https://github.com/celrenheit/sandglass) - distributed, horizontally scalable,
  persistent, time sorted message queue.
- [TalariaDB](https://github.com/grab/talaria) - Grab's Distributed, low latency time-series
  database.
- [Sloop](https://github.com/salesforce/sloop) - Salesforce's Kubernetes History Visualization
  Project.
- [Usenet Express](https://usenetexpress.com/) - Serving over 300TB of data with Badger.
- [gorush](https://github.com/appleboy/gorush) - A push notification server written in Go.
- [0-stor](https://github.com/zero-os/0-stor) - Single device object store.
- [Dispatch Protocol](https://github.com/dispatchlabs/disgo) - Blockchain protocol for distributed
  application data analytics.
- [GarageMQ](https://github.com/valinurovam/garagemq) - AMQP server written in Go.
- [RedixDB](https://alash3al.github.io/redix/) - A real-time persistent key-value store with the
  same redis protocol.
- [BBVA](https://github.com/BBVA/raft-badger) - Raft backend implementation using BadgerDB for
  Hashicorp raft.
- [Fantom](https://github.com/Fantom-foundation/go-lachesis) - aBFT Consensus platform for
  distributed applications.
- [decred](https://github.com/decred/dcrdata) - An open, progressive, and self-funding
  cryptocurrency with a system of community-based governance integrated into its blockchain.
- [OpenNetSys](https://github.com/opennetsys/c3-go) - Create useful dApps in any software language.
- [HoneyTrap](https://github.com/honeytrap/honeytrap) - An extensible and opensource system for
  running, monitoring and managing honeypots.
- [Insolar](https://github.com/insolar/insolar) - Enterprise-ready blockchain platform.
- [IoTeX](https://github.com/iotexproject/iotex-core) - The next generation of the decentralized
  network for IoT powered by scalability- and privacy-centric blockchains.
- [go-sessions](https://github.com/kataras/go-sessions) - The sessions manager for Go net/http and
  fasthttp.
- [Babble](https://github.com/mosaicnetworks/babble) - BFT Consensus platform for distributed
  applications.
- [Tormenta](https://github.com/jpincas/tormenta) - Embedded object-persistence layer / simple JSON
  database for Go projects.
- [BadgerHold](https://github.com/timshannon/badgerhold) - An embeddable NoSQL store for querying Go
  types built on Badger
- [Goblero](https://github.com/didil/goblero) - Pure Go embedded persistent job queue backed by
  BadgerDB
- [Surfline](https://www.surfline.com) - Serving global wave and weather forecast data with Badger.
- [Cete](https://github.com/mosuka/cete) - Simple and highly available distributed key-value store
  built on Badger. Makes it easy bringing up a cluster of Badger with Raft consensus algorithm by
  hashicorp/raft.
- [Volument](https://volument.com/) - A new take on website analytics backed by Badger.
- [KVdb](https://kvdb.io/) - Hosted key-value store and serverless platform built on top of Badger.
- [Terminotes](https://gitlab.com/asad-awadia/terminotes) - Self hosted notes storage and search
  server - storage powered by BadgerDB
- [Pyroscope](https://github.com/pyroscope-io/pyroscope) - Open source continuous profiling platform
  built with BadgerDB
- [Veri](https://github.com/bgokden/veri) - A distributed feature store optimized for Search and
  Recommendation tasks.
- [bIter](https://github.com/MikkelHJuul/bIter) - A library and Iterator interface for working with
  the `badger.Iterator`, simplifying from-to, and prefix mechanics.
- [ld](https://github.com/MikkelHJuul/ld) - (Lean Database) A very simple gRPC-only key-value
  database, exposing BadgerDB with key-range scanning semantics.
- [Souin](https://github.com/darkweak/Souin) - A RFC compliant HTTP cache with lot of other features
  based on Badger for the storage. Compatible with all existing reverse-proxies.
- [Xuperchain](https://github.com/xuperchain/xupercore) - A highly flexible blockchain architecture
  with great transaction performance.
- [m2](https://github.com/qichengzx/m2) - A simple http key/value store based on the raft protocol.
- [chaindb](https://github.com/ChainSafe/chaindb) - A blockchain storage layer used by
  [Gossamer](https://chainsafe.github.io/gossamer/), a Go client for the
  [Polkadot Network](https://polkadot.network/).
- [vxdb](https://github.com/vitalvas/vxdb) - Simple schema-less Key-Value NoSQL database with
  simplest API interface.
- [Opacity](https://github.com/opacity/storage-node) - Backend implementation for the Opacity
  storage project
- [Vephar](https://github.com/vaccovecrana/vephar) - A minimal key/value store using hashicorp-raft
  for cluster coordination and Badger for data storage.
- [gowarcserver](https://github.com/nlnwa/gowarcserver) - Open-source server for warc files. Can be
  used in conjunction with pywb
- [flow-go](https://github.com/onflow/flow-go) - A fast, secure, and developer-friendly blockchain
  built to support the next generation of games, apps and the digital assets that power them.
- [Wrgl](https://www.wrgl.co) - A data version control system that works like Git but specialized to
  store and diff CSV.
- [Loggie](https://github.com/loggie-io/loggie) - A lightweight, cloud-native data transfer agent
  and aggregator.
- [raft-badger](https://github.com/rfyiamcool/raft-badger) - raft-badger implements LogStore and
  StableStore Interface of hashcorp/raft. it is used to store raft log and metadata of
  hashcorp/raft.
- [DVID](https://github.com/janelia-flyem/dvid) - A dataservice for branched versioning of a variety
  of data types. Originally created for large-scale brain reconstructions in Connectomics.
- [KVS](https://github.com/tauraamui/kvs) - A library for making it easy to persist, load and query
  full structs into BadgerDB, using an ownership hierarchy model.
- [LLS](https://github.com/Boc-chi-no/LLS) - LLS is an efficient URL Shortener that can be used to
  shorten links and track link usage. Support for BadgerDB and MongoDB. Improved performance by more
  than 30% when using BadgerDB
- [lakeFS](https://github.com/treeverse/lakeFS) - lakeFS is an open-source data version control that
  transforms your object storage to Git-like repositories. lakeFS uses BadgerDB for its underlying
  local metadata KV store implementation
- [Goptivum](https://github.com/smegg99/Goptivum) - Goptivum is a better frontend and API for the
  Vulcan Optivum schedule program
- [ActionManager](https://mftlabs.io/actionmanager) - A dynamic entity manager based on rjsf schema
  and badger db
- [MightyMap](https://github.com/thisisdevelopment/mightymap) - Mightymap: Conveys both robustness
  and high capability, fitting for a powerful concurrent map.
- [FlowG](https://github.com/link-society/flowg) - A low-code log processing facility
- [Bluefin](https://github.com/blinklabs-io/bluefin) - Bluefin is a TUNA Proof of Work miner for
  the Fortuna smart contract on the Cardano blockchain
- [cDNSd](https://github.com/blinklabs-io/cdnsd) - A Cardano blockchain backed DNS server daemon
- [Dingo](https://github.com/blinklabs-io/dingo) - A Cardano blockchain data node

If you are using Badger in a project please send a pull request to add it to the list.

## Contributing

If you're interested in contributing to Badger see [CONTRIBUTING](./CONTRIBUTING.md).

## Contact

- Please use [Github issues](https://github.com/hypermodeinc/badger/issues) for filing bugs.
- Please use [discuss.hypermode.com](https://discuss.hypermode.com) for questions, discussions, and feature
  requests.
- Follow us on Twitter [@hypermodeinc](https://twitter.com/hypermodeinc).
