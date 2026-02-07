# memberlist [![GoDoc](https://godoc.org/github.com/hashicorp/memberlist?status.png)](https://godoc.org/github.com/hashicorp/memberlist) [![CircleCI](https://circleci.com/gh/hashicorp/memberlist.svg?style=svg)](https://circleci.com/gh/hashicorp/memberlist)

memberlist is a [Go](http://www.golang.org) library that manages cluster
membership and member failure detection using a gossip based protocol.

The use cases for such a library are far-reaching: all distributed systems
require membership, and memberlist is a re-usable solution to managing
cluster membership and node failure detection.

memberlist is eventually consistent but converges quickly on average.
The speed at which it converges can be heavily tuned via various knobs
on the protocol. Node failures are detected and network partitions are partially
tolerated by attempting to communicate to potentially dead nodes through
multiple routes.

## Building

If you wish to build memberlist you'll need Go version 1.2+ installed.

Please check your installation with:

```
go version
```

## Usage

Memberlist is surprisingly simple to use. An example is shown below:

```go
/* Create the initial memberlist from a safe configuration.
   Please reference the godoc for other default config types.
   http://godoc.org/github.com/hashicorp/memberlist#Config
*/
list, err := memberlist.Create(memberlist.DefaultLocalConfig())
if err != nil {
	panic("Failed to create memberlist: " + err.Error())
}

// Join an existing cluster by specifying at least one known member.
n, err := list.Join([]string{"1.2.3.4"})
if err != nil {
	panic("Failed to join cluster: " + err.Error())
}

// Ask for members of the cluster
for _, member := range list.Members() {
	fmt.Printf("Member: %s %s\n", member.Name, member.Addr)
}

// Continue doing whatever you need, memberlist will maintain membership
// information in the background. Delegates can be used for receiving
// events when members join or leave.
```

The most difficult part of memberlist is configuring it since it has many
available knobs in order to tune state propagation delay and convergence times.
Memberlist provides a default configuration that offers a good starting point,
but errs on the side of caution, choosing values that are optimized for
higher convergence at the cost of higher bandwidth usage.

For complete documentation, see the associated [Godoc](http://godoc.org/github.com/hashicorp/memberlist).

## Protocol

memberlist is based on ["SWIM: Scalable Weakly-consistent Infection-style Process Group Membership Protocol"](http://ieeexplore.ieee.org/document/1028914/). However, we extend the protocol in a number of ways:

* Several extensions are made to increase propagation speed and
convergence rate.
* Another set of extensions, that we call Lifeguard, are made to make memberlist more robust in the presence of slow message processing (due to factors such as CPU starvation, and network delay or loss).

For details on all of these extensions, please read our paper "[Lifeguard : SWIM-ing with Situational Awareness](https://arxiv.org/abs/1707.00788)", along with the memberlist source.  We welcome any questions related
to the protocol on our issue tracker.

## Metrics Emission and Compatibility

This library can emit metrics using either `github.com/armon/go-metrics` or `github.com/hashicorp/go-metrics`. Choosing between the libraries is controlled via build tags. 

**Build Tags**
* `armonmetrics` - Using this tag will cause metrics to be routed to `armon/go-metrics`
* `hashicorpmetrics` - Using this tag will cause all metrics to be routed to `hashicorp/go-metrics`

If no build tag is specified, the default behavior is to use `armon/go-metrics`. 

**Deprecating `armon/go-metrics`**

Emitting metrics to `armon/go-metrics` is officially deprecated. Usage of `armon/go-metrics` will remain the default until mid-2025 with opt-in support continuing to the end of 2025.

**Migration**
To migrate an application currently using the older `armon/go-metrics` to instead use `hashicorp/go-metrics` the following should be done.

1. Upgrade libraries using `armon/go-metrics` to consume `hashicorp/go-metrics/compat` instead. This should involve only changing import statements. All repositories in the `hashicorp` namespace
2. Update an applications library dependencies to those that have the compatibility layer configured.
3. Update the application to use `hashicorp/go-metrics` for configuring metrics export instead of `armon/go-metrics`
   * Replace all application imports of `github.com/armon/go-metrics` with `github.com/hashicorp/go-metrics`
   * Instrument your build system to build with the `hashicorpmetrics` tag.

Eventually once the default behavior changes to use `hashicorp/go-metrics` by default (mid-2025), you can drop the `hashicorpmetrics` build tag.
