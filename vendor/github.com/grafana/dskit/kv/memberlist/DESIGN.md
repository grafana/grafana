# Memberlist

## Zone-aware routing

Memberlist zone-aware routing is an optional feature that allows to significantly reduce the cross-AZ data transfer.

When the feature is enabled, memberlist nodes can have one of these roles:

- `member`
- `bridge`

A **member** is a normal application instance.
A member only gossip and push/pull to other nodes (members and bridges) in the same zone.
This means that the bulk of data transfer done by the memberlist client running in a member node stays within the zone.

A **bridge** is a special application instance that act as a bridge between multiple zones.
A bridge can gossip and push/pull to other nodes (members and bridges) in the same zone, and to the bridges in other zones (but not to members in the other zones).
In these regards, a bridge is effectively the component that allows two different zones to communicate.

To ensure that messages are propagated between zones, the bridge prefers to communicate to other bridges first:

- Broadcast messages: out of N nodes to select for broadcasting a message, the bridge always select at least 1 node from the pool of bridges in the other zones, and then select the remaining N-1 nodes randomly across the pool of nodes in the same zone + bridges in the other zones.
- Push/pull syncs: for the push/pull operations initiated by the bridge itself, the bridge always contact a random bridge in other zones. The only exception is if there are no bridges in other zones: in this case, the bridge will select a random node in its own zone.

Node probes (health checks) can still cross the AZ boundaries, but these are typically a small fraction of the total data transfer done by memberlist.

```
┌───────────────────────┐   ┌────────────────────────┐
│                       │   │                        │
│   member-zone-a-1     │   │     member-zone-b-1    │
│      ▲   ▲            │   │        ▲   ▲           │
│      │   │            │   │        │   │           │
│      │   │            │   │        │   │           │
│      │   ▼            │   │        │   ▼           │
│   member-zone-a-2     │   │     member-zone-b-2    │
│      │   ▲            │   │        │   ▲           │
│      │   │            │   │        │   │           │
│      │   │            │   │        │   │           │
│      ▼   ▼            │   │        ▼   ▼           │
│   bridge-zone-a-1  ◄──│───│──►  bridge-zone-b-1    │
│                       │   │                        │
└───────────────────────┘   └────────────────────────┘
         zone-a                        zone-b
```

The role and availability zone of each node are explicitly assigned using CLI flags, or their respective YAML configuration options:

- `-memberlist.zone-aware-routing.instance-availability-zone`
- `-memberlist.zone-aware-routing.role`
