package sockaddr

// ForwardingBlacklist is a faux RFC that includes a list of non-forwardable IP
// blocks.
const ForwardingBlacklist = 4294967295
const ForwardingBlacklistRFC = "4294967295"

// IsRFC tests to see if an SockAddr matches the specified RFC
func IsRFC(rfcNum uint, sa SockAddr) bool {
	rfcNetMap := KnownRFCs()
	rfcNets, ok := rfcNetMap[rfcNum]
	if !ok {
		return false
	}

	var contained bool
	for _, rfcNet := range rfcNets {
		if rfcNet.Contains(sa) {
			contained = true
			break
		}
	}
	return contained
}

// KnownRFCs returns an initial set of known RFCs.
//
// NOTE (sean@): As this list evolves over time, please submit patches to keep
// this list current.  If something isn't right, inquire, as it may just be a
// bug on my part.  Some of the inclusions were based on my judgement as to what
// would be a useful value (e.g. RFC3330).
//
// Useful resources:
//
// * https://www.iana.org/assignments/ipv6-address-space/ipv6-address-space.xhtml
// * https://www.iana.org/assignments/ipv6-unicast-address-assignments/ipv6-unicast-address-assignments.xhtml
// * https://www.iana.org/assignments/ipv6-address-space/ipv6-address-space.xhtml
func KnownRFCs() map[uint]SockAddrs {
	// NOTE(sean@): Multiple SockAddrs per RFC lend themselves well to a
	// RADIX tree, but `ENOTIME`.  Patches welcome.
	return map[uint]SockAddrs{
		919: {
			// [RFC919] Broadcasting Internet Datagrams
			MustIPv4Addr("255.255.255.255/32"), // [RFC1122], §7 Broadcast IP Addressing - Proposed Standards
		},
		1122: {
			// [RFC1122] Requirements for Internet Hosts -- Communication Layers
			MustIPv4Addr("0.0.0.0/8"),   // [RFC1122], §3.2.1.3
			MustIPv4Addr("127.0.0.0/8"), // [RFC1122], §3.2.1.3
		},
		1112: {
			// [RFC1112] Host Extensions for IP Multicasting
			MustIPv4Addr("224.0.0.0/4"), // [RFC1112], §4 Host Group Addresses
		},
		1918: {
			// [RFC1918] Address Allocation for Private Internets
			MustIPv4Addr("10.0.0.0/8"),
			MustIPv4Addr("172.16.0.0/12"),
			MustIPv4Addr("192.168.0.0/16"),
		},
		2544: {
			// [RFC2544] Benchmarking Methodology for Network
			// Interconnect Devices
			MustIPv4Addr("198.18.0.0/15"),
		},
		2765: {
			// [RFC2765] Stateless IP/ICMP Translation Algorithm
			// (SIIT) (obsoleted by RFCs 6145, which itself was
			// later obsoleted by 7915).

			// [RFC2765], §2.1 Addresses
			MustIPv6Addr("0:0:0:0:0:ffff:0:0/96"),
		},
		2928: {
			// [RFC2928] Initial IPv6 Sub-TLA ID Assignments
			MustIPv6Addr("2001::/16"), // Superblock
			//MustIPv6Addr("2001:0000::/23"), // IANA
			//MustIPv6Addr("2001:0200::/23"), // APNIC
			//MustIPv6Addr("2001:0400::/23"), // ARIN
			//MustIPv6Addr("2001:0600::/23"), // RIPE NCC
			//MustIPv6Addr("2001:0800::/23"), // (future assignment)
			// ...
			//MustIPv6Addr("2001:FE00::/23"), // (future assignment)
		},
		3056: { // 6to4 address
			// [RFC3056] Connection of IPv6 Domains via IPv4 Clouds

			// [RFC3056], §2 IPv6 Prefix Allocation
			MustIPv6Addr("2002::/16"),
		},
		3068: {
			// [RFC3068] An Anycast Prefix for 6to4 Relay Routers
			// (obsolete by RFC7526)

			// [RFC3068], § 6to4 Relay anycast address
			MustIPv4Addr("192.88.99.0/24"),

			// [RFC3068], §2.5 6to4 IPv6 relay anycast address
			//
			// NOTE: /120 == 128-(32-24)
			MustIPv6Addr("2002:c058:6301::/120"),
		},
		3171: {
			// [RFC3171] IANA Guidelines for IPv4 Multicast Address Assignments
			MustIPv4Addr("224.0.0.0/4"),
		},
		3330: {
			// [RFC3330] Special-Use IPv4 Addresses

			// Addresses in this block refer to source hosts on
			// "this" network.  Address 0.0.0.0/32 may be used as a
			// source address for this host on this network; other
			// addresses within 0.0.0.0/8 may be used to refer to
			// specified hosts on this network [RFC1700, page 4].
			MustIPv4Addr("0.0.0.0/8"),

			// 10.0.0.0/8 - This block is set aside for use in
			// private networks.  Its intended use is documented in
			// [RFC1918].  Addresses within this block should not
			// appear on the public Internet.
			MustIPv4Addr("10.0.0.0/8"),

			// 14.0.0.0/8 - This block is set aside for assignments
			// to the international system of Public Data Networks
			// [RFC1700, page 181]. The registry of assignments
			// within this block can be accessed from the "Public
			// Data Network Numbers" link on the web page at
			// http://www.iana.org/numbers.html.  Addresses within
			// this block are assigned to users and should be
			// treated as such.

			// 24.0.0.0/8 - This block was allocated in early 1996
			// for use in provisioning IP service over cable
			// television systems.  Although the IANA initially was
			// involved in making assignments to cable operators,
			// this responsibility was transferred to American
			// Registry for Internet Numbers (ARIN) in May 2001.
			// Addresses within this block are assigned in the
			// normal manner and should be treated as such.

			// 39.0.0.0/8 - This block was used in the "Class A
			// Subnet Experiment" that commenced in May 1995, as
			// documented in [RFC1797].  The experiment has been
			// completed and this block has been returned to the
			// pool of addresses reserved for future allocation or
			// assignment.  This block therefore no longer has a
			// special use and is subject to allocation to a
			// Regional Internet Registry for assignment in the
			// normal manner.

			// 127.0.0.0/8 - This block is assigned for use as the Internet host
			// loopback address.  A datagram sent by a higher level protocol to an
			// address anywhere within this block should loop back inside the host.
			// This is ordinarily implemented using only 127.0.0.1/32 for loopback,
			// but no addresses within this block should ever appear on any network
			// anywhere [RFC1700, page 5].
			MustIPv4Addr("127.0.0.0/8"),

			// 128.0.0.0/16 - This block, corresponding to the
			// numerically lowest of the former Class B addresses,
			// was initially and is still reserved by the IANA.
			// Given the present classless nature of the IP address
			// space, the basis for the reservation no longer
			// applies and addresses in this block are subject to
			// future allocation to a Regional Internet Registry for
			// assignment in the normal manner.

			// 169.254.0.0/16 - This is the "link local" block.  It
			// is allocated for communication between hosts on a
			// single link.  Hosts obtain these addresses by
			// auto-configuration, such as when a DHCP server may
			// not be found.
			MustIPv4Addr("169.254.0.0/16"),

			// 172.16.0.0/12 - This block is set aside for use in
			// private networks.  Its intended use is documented in
			// [RFC1918].  Addresses within this block should not
			// appear on the public Internet.
			MustIPv4Addr("172.16.0.0/12"),

			// 191.255.0.0/16 - This block, corresponding to the numerically highest
			// to the former Class B addresses, was initially and is still reserved
			// by the IANA.  Given the present classless nature of the IP address
			// space, the basis for the reservation no longer applies and addresses
			// in this block are subject to future allocation to a Regional Internet
			// Registry for assignment in the normal manner.

			// 192.0.0.0/24 - This block, corresponding to the
			// numerically lowest of the former Class C addresses,
			// was initially and is still reserved by the IANA.
			// Given the present classless nature of the IP address
			// space, the basis for the reservation no longer
			// applies and addresses in this block are subject to
			// future allocation to a Regional Internet Registry for
			// assignment in the normal manner.

			// 192.0.2.0/24 - This block is assigned as "TEST-NET" for use in
			// documentation and example code.  It is often used in conjunction with
			// domain names example.com or example.net in vendor and protocol
			// documentation.  Addresses within this block should not appear on the
			// public Internet.
			MustIPv4Addr("192.0.2.0/24"),

			// 192.88.99.0/24 - This block is allocated for use as 6to4 relay
			// anycast addresses, according to [RFC3068].
			MustIPv4Addr("192.88.99.0/24"),

			// 192.168.0.0/16 - This block is set aside for use in private networks.
			// Its intended use is documented in [RFC1918].  Addresses within this
			// block should not appear on the public Internet.
			MustIPv4Addr("192.168.0.0/16"),

			// 198.18.0.0/15 - This block has been allocated for use
			// in benchmark tests of network interconnect devices.
			// Its use is documented in [RFC2544].
			MustIPv4Addr("198.18.0.0/15"),

			// 223.255.255.0/24 - This block, corresponding to the
			// numerically highest of the former Class C addresses,
			// was initially and is still reserved by the IANA.
			// Given the present classless nature of the IP address
			// space, the basis for the reservation no longer
			// applies and addresses in this block are subject to
			// future allocation to a Regional Internet Registry for
			// assignment in the normal manner.

			// 224.0.0.0/4 - This block, formerly known as the Class
			// D address space, is allocated for use in IPv4
			// multicast address assignments.  The IANA guidelines
			// for assignments from this space are described in
			// [RFC3171].
			MustIPv4Addr("224.0.0.0/4"),

			// 240.0.0.0/4 - This block, formerly known as the Class E address
			// space, is reserved.  The "limited broadcast" destination address
			// 255.255.255.255 should never be forwarded outside the (sub-)net of
			// the source.  The remainder of this space is reserved
			// for future use.  [RFC1700, page 4]
			MustIPv4Addr("240.0.0.0/4"),
		},
		3849: {
			// [RFC3849] IPv6 Address Prefix Reserved for Documentation
			MustIPv6Addr("2001:db8::/32"), // [RFC3849], §4 IANA Considerations
		},
		3927: {
			// [RFC3927] Dynamic Configuration of IPv4 Link-Local Addresses
			MustIPv4Addr("169.254.0.0/16"), // [RFC3927], §2.1 Link-Local Address Selection
		},
		4038: {
			// [RFC4038] Application Aspects of IPv6 Transition

			// [RFC4038], §4.2. IPv6 Applications in a Dual-Stack Node
			MustIPv6Addr("0:0:0:0:0:ffff::/96"),
		},
		4193: {
			// [RFC4193] Unique Local IPv6 Unicast Addresses
			MustIPv6Addr("fc00::/7"),
		},
		4291: {
			// [RFC4291] IP Version 6 Addressing Architecture

			// [RFC4291], §2.5.2 The Unspecified Address
			MustIPv6Addr("::/128"),

			// [RFC4291], §2.5.3 The Loopback Address
			MustIPv6Addr("::1/128"),

			// [RFC4291], §2.5.5.1.  IPv4-Compatible IPv6 Address
			MustIPv6Addr("::/96"),

			// [RFC4291], §2.5.5.2.  IPv4-Mapped IPv6 Address
			MustIPv6Addr("::ffff:0:0/96"),

			// [RFC4291], §2.5.6 Link-Local IPv6 Unicast Addresses
			MustIPv6Addr("fe80::/10"),

			// [RFC4291], §2.5.7 Site-Local IPv6 Unicast Addresses
			// (depreciated)
			MustIPv6Addr("fec0::/10"),

			// [RFC4291], §2.7 Multicast Addresses
			MustIPv6Addr("ff00::/8"),

			// IPv6 Multicast Information.
			//
			// In the following "table" below, `ff0x` is replaced
			// with the following values depending on the scope of
			// the query:
			//
			// IPv6 Multicast Scopes:
			// * ff00/9 // reserved
			// * ff01/9 // interface-local
			// * ff02/9 // link-local
			// * ff03/9 // realm-local
			// * ff04/9 // admin-local
			// * ff05/9 // site-local
			// * ff08/9 // organization-local
			// * ff0e/9 // global
			// * ff0f/9 // reserved
			//
			// IPv6 Multicast Addresses:
			// * ff0x::2 // All routers
			// * ff02::5 // OSPFIGP
			// * ff02::6 // OSPFIGP Designated Routers
			// * ff02::9 // RIP Routers
			// * ff02::a // EIGRP Routers
			// * ff02::d // All PIM Routers
			// * ff02::1a // All RPL Routers
			// * ff0x::fb // mDNSv6
			// * ff0x::101 // All Network Time Protocol (NTP) servers
			// * ff02::1:1 // Link Name
			// * ff02::1:2 // All-dhcp-agents
			// * ff02::1:3 // Link-local Multicast Name Resolution
			// * ff05::1:3 // All-dhcp-servers
			// * ff02::1:ff00:0/104 // Solicited-node multicast address.
			// * ff02::2:ff00:0/104 // Node Information Queries
		},
		4380: {
			// [RFC4380] Teredo: Tunneling IPv6 over UDP through
			// Network Address Translations (NATs)

			// [RFC4380], §2.6 Global Teredo IPv6 Service Prefix
			MustIPv6Addr("2001:0000::/32"),
		},
		4773: {
			// [RFC4773] Administration of the IANA Special Purpose IPv6 Address Block
			MustIPv6Addr("2001:0000::/23"), // IANA
		},
		4843: {
			// [RFC4843] An IPv6 Prefix for Overlay Routable Cryptographic Hash Identifiers (ORCHID)
			MustIPv6Addr("2001:10::/28"), // [RFC4843], §7 IANA Considerations
		},
		5180: {
			// [RFC5180] IPv6 Benchmarking Methodology for Network Interconnect Devices
			MustIPv6Addr("2001:0200::/48"), // [RFC5180], §8 IANA Considerations
		},
		5735: {
			// [RFC5735] Special Use IPv4 Addresses
			MustIPv4Addr("192.0.2.0/24"),    // TEST-NET-1
			MustIPv4Addr("198.51.100.0/24"), // TEST-NET-2
			MustIPv4Addr("203.0.113.0/24"),  // TEST-NET-3
			MustIPv4Addr("198.18.0.0/15"),   // Benchmarks
		},
		5737: {
			// [RFC5737] IPv4 Address Blocks Reserved for Documentation
			MustIPv4Addr("192.0.2.0/24"),    // TEST-NET-1
			MustIPv4Addr("198.51.100.0/24"), // TEST-NET-2
			MustIPv4Addr("203.0.113.0/24"),  // TEST-NET-3
		},
		6052: {
			// [RFC6052] IPv6 Addressing of IPv4/IPv6 Translators
			MustIPv6Addr("64:ff9b::/96"), // [RFC6052], §2.1. Well-Known Prefix
		},
		6333: {
			// [RFC6333] Dual-Stack Lite Broadband Deployments Following IPv4 Exhaustion
			MustIPv4Addr("192.0.0.0/29"), // [RFC6333], §5.7 Well-Known IPv4 Address
		},
		6598: {
			// [RFC6598] IANA-Reserved IPv4 Prefix for Shared Address Space
			MustIPv4Addr("100.64.0.0/10"),
		},
		6666: {
			// [RFC6666] A Discard Prefix for IPv6
			MustIPv6Addr("0100::/64"),
		},
		6890: {
			// [RFC6890] Special-Purpose IP Address Registries

			// From "RFC6890 §2.2.1 Information Requirements":
			/*
			   The IPv4 and IPv6 Special-Purpose Address Registries maintain the
			   following information regarding each entry:

			   o  Address Block - A block of IPv4 or IPv6 addresses that has been
			      registered for a special purpose.

			   o  Name - A descriptive name for the special-purpose address block.

			   o  RFC - The RFC through which the special-purpose address block was
			      requested.

			   o  Allocation Date - The date upon which the special-purpose address
			      block was allocated.

			   o  Termination Date - The date upon which the allocation is to be
			      terminated.  This field is applicable for limited-use allocations
			      only.

			   o  Source - A boolean value indicating whether an address from the
			      allocated special-purpose address block is valid when used as the
			      source address of an IP datagram that transits two devices.

			   o  Destination - A boolean value indicating whether an address from
			      the allocated special-purpose address block is valid when used as
			      the destination address of an IP datagram that transits two
			      devices.

			   o  Forwardable - A boolean value indicating whether a router may
			      forward an IP datagram whose destination address is drawn from the
			      allocated special-purpose address block between external
			      interfaces.

			   o  Global - A boolean value indicating whether an IP datagram whose
			      destination address is drawn from the allocated special-purpose
			      address block is forwardable beyond a specified administrative
			      domain.

			   o  Reserved-by-Protocol - A boolean value indicating whether the
			      special-purpose address block is reserved by IP, itself.  This
			      value is "TRUE" if the RFC that created the special-purpose
			      address block requires all compliant IP implementations to behave
			      in a special way when processing packets either to or from
			      addresses contained by the address block.

			   If the value of "Destination" is FALSE, the values of "Forwardable"
			   and "Global" must also be false.
			*/

			/*+----------------------+----------------------------+
			* | Attribute            | Value                      |
			* +----------------------+----------------------------+
			* | Address Block        | 0.0.0.0/8                  |
			* | Name                 | "This host on this network"|
			* | RFC                  | [RFC1122], Section 3.2.1.3 |
			* | Allocation Date      | September 1981             |
			* | Termination Date     | N/A                        |
			* | Source               | True                       |
			* | Destination          | False                      |
			* | Forwardable          | False                      |
			* | Global               | False                      |
			* | Reserved-by-Protocol | True                       |
			* +----------------------+----------------------------+*/
			MustIPv4Addr("0.0.0.0/8"),

			/*+----------------------+---------------+
			* | Attribute            | Value         |
			* +----------------------+---------------+
			* | Address Block        | 10.0.0.0/8    |
			* | Name                 | Private-Use   |
			* | RFC                  | [RFC1918]     |
			* | Allocation Date      | February 1996 |
			* | Termination Date     | N/A           |
			* | Source               | True          |
			* | Destination          | True          |
			* | Forwardable          | True          |
			* | Global               | False         |
			* | Reserved-by-Protocol | False         |
			* +----------------------+---------------+ */
			MustIPv4Addr("10.0.0.0/8"),

			/*+----------------------+----------------------+
			  | Attribute            | Value                |
			  +----------------------+----------------------+
			  | Address Block        | 100.64.0.0/10        |
			  | Name                 | Shared Address Space |
			  | RFC                  | [RFC6598]            |
			  | Allocation Date      | April 2012           |
			  | Termination Date     | N/A                  |
			  | Source               | True                 |
			  | Destination          | True                 |
			  | Forwardable          | True                 |
			  | Global               | False                |
			  | Reserved-by-Protocol | False                |
			  +----------------------+----------------------+*/
			MustIPv4Addr("100.64.0.0/10"),

			/*+----------------------+----------------------------+
			  | Attribute            | Value                      |
			  +----------------------+----------------------------+
			  | Address Block        | 127.0.0.0/8                |
			  | Name                 | Loopback                   |
			  | RFC                  | [RFC1122], Section 3.2.1.3 |
			  | Allocation Date      | September 1981             |
			  | Termination Date     | N/A                        |
			  | Source               | False [1]                  |
			  | Destination          | False [1]                  |
			  | Forwardable          | False [1]                  |
			  | Global               | False [1]                  |
			  | Reserved-by-Protocol | True                       |
			  +----------------------+----------------------------+*/
			// [1] Several protocols have been granted exceptions to
			// this rule.  For examples, see [RFC4379] and
			// [RFC5884].
			MustIPv4Addr("127.0.0.0/8"),

			/*+----------------------+----------------+
			  | Attribute            | Value          |
			  +----------------------+----------------+
			  | Address Block        | 169.254.0.0/16 |
			  | Name                 | Link Local     |
			  | RFC                  | [RFC3927]      |
			  | Allocation Date      | May 2005       |
			  | Termination Date     | N/A            |
			  | Source               | True           |
			  | Destination          | True           |
			  | Forwardable          | False          |
			  | Global               | False          |
			  | Reserved-by-Protocol | True           |
			  +----------------------+----------------+*/
			MustIPv4Addr("169.254.0.0/16"),

			/*+----------------------+---------------+
			  | Attribute            | Value         |
			  +----------------------+---------------+
			  | Address Block        | 172.16.0.0/12 |
			  | Name                 | Private-Use   |
			  | RFC                  | [RFC1918]     |
			  | Allocation Date      | February 1996 |
			  | Termination Date     | N/A           |
			  | Source               | True          |
			  | Destination          | True          |
			  | Forwardable          | True          |
			  | Global               | False         |
			  | Reserved-by-Protocol | False         |
			  +----------------------+---------------+*/
			MustIPv4Addr("172.16.0.0/12"),

			/*+----------------------+---------------------------------+
			  | Attribute            | Value                           |
			  +----------------------+---------------------------------+
			  | Address Block        | 192.0.0.0/24 [2]                |
			  | Name                 | IETF Protocol Assignments       |
			  | RFC                  | Section 2.1 of this document    |
			  | Allocation Date      | January 2010                    |
			  | Termination Date     | N/A                             |
			  | Source               | False                           |
			  | Destination          | False                           |
			  | Forwardable          | False                           |
			  | Global               | False                           |
			  | Reserved-by-Protocol | False                           |
			  +----------------------+---------------------------------+*/
			// [2] Not usable unless by virtue of a more specific
			// reservation.
			MustIPv4Addr("192.0.0.0/24"),

			/*+----------------------+--------------------------------+
			  | Attribute            | Value                          |
			  +----------------------+--------------------------------+
			  | Address Block        | 192.0.0.0/29                   |
			  | Name                 | IPv4 Service Continuity Prefix |
			  | RFC                  | [RFC6333], [RFC7335]           |
			  | Allocation Date      | June 2011                      |
			  | Termination Date     | N/A                            |
			  | Source               | True                           |
			  | Destination          | True                           |
			  | Forwardable          | True                           |
			  | Global               | False                          |
			  | Reserved-by-Protocol | False                          |
			  +----------------------+--------------------------------+*/
			MustIPv4Addr("192.0.0.0/29"),

			/*+----------------------+----------------------------+
			  | Attribute            | Value                      |
			  +----------------------+----------------------------+
			  | Address Block        | 192.0.2.0/24               |
			  | Name                 | Documentation (TEST-NET-1) |
			  | RFC                  | [RFC5737]                  |
			  | Allocation Date      | January 2010               |
			  | Termination Date     | N/A                        |
			  | Source               | False                      |
			  | Destination          | False                      |
			  | Forwardable          | False                      |
			  | Global               | False                      |
			  | Reserved-by-Protocol | False                      |
			  +----------------------+----------------------------+*/
			MustIPv4Addr("192.0.2.0/24"),

			/*+----------------------+--------------------+
			  | Attribute            | Value              |
			  +----------------------+--------------------+
			  | Address Block        | 192.88.99.0/24     |
			  | Name                 | 6to4 Relay Anycast |
			  | RFC                  | [RFC3068]          |
			  | Allocation Date      | June 2001          |
			  | Termination Date     | N/A                |
			  | Source               | True               |
			  | Destination          | True               |
			  | Forwardable          | True               |
			  | Global               | True               |
			  | Reserved-by-Protocol | False              |
			  +----------------------+--------------------+*/
			MustIPv4Addr("192.88.99.0/24"),

			/*+----------------------+----------------+
			  | Attribute            | Value          |
			  +----------------------+----------------+
			  | Address Block        | 192.168.0.0/16 |
			  | Name                 | Private-Use    |
			  | RFC                  | [RFC1918]      |
			  | Allocation Date      | February 1996  |
			  | Termination Date     | N/A            |
			  | Source               | True           |
			  | Destination          | True           |
			  | Forwardable          | True           |
			  | Global               | False          |
			  | Reserved-by-Protocol | False          |
			  +----------------------+----------------+*/
			MustIPv4Addr("192.168.0.0/16"),

			/*+----------------------+---------------+
			  | Attribute            | Value         |
			  +----------------------+---------------+
			  | Address Block        | 198.18.0.0/15 |
			  | Name                 | Benchmarking  |
			  | RFC                  | [RFC2544]     |
			  | Allocation Date      | March 1999    |
			  | Termination Date     | N/A           |
			  | Source               | True          |
			  | Destination          | True          |
			  | Forwardable          | True          |
			  | Global               | False         |
			  | Reserved-by-Protocol | False         |
			  +----------------------+---------------+*/
			MustIPv4Addr("198.18.0.0/15"),

			/*+----------------------+----------------------------+
			  | Attribute            | Value                      |
			  +----------------------+----------------------------+
			  | Address Block        | 198.51.100.0/24            |
			  | Name                 | Documentation (TEST-NET-2) |
			  | RFC                  | [RFC5737]                  |
			  | Allocation Date      | January 2010               |
			  | Termination Date     | N/A                        |
			  | Source               | False                      |
			  | Destination          | False                      |
			  | Forwardable          | False                      |
			  | Global               | False                      |
			  | Reserved-by-Protocol | False                      |
			  +----------------------+----------------------------+*/
			MustIPv4Addr("198.51.100.0/24"),

			/*+----------------------+----------------------------+
			  | Attribute            | Value                      |
			  +----------------------+----------------------------+
			  | Address Block        | 203.0.113.0/24             |
			  | Name                 | Documentation (TEST-NET-3) |
			  | RFC                  | [RFC5737]                  |
			  | Allocation Date      | January 2010               |
			  | Termination Date     | N/A                        |
			  | Source               | False                      |
			  | Destination          | False                      |
			  | Forwardable          | False                      |
			  | Global               | False                      |
			  | Reserved-by-Protocol | False                      |
			  +----------------------+----------------------------+*/
			MustIPv4Addr("203.0.113.0/24"),

			/*+----------------------+----------------------+
			  | Attribute            | Value                |
			  +----------------------+----------------------+
			  | Address Block        | 240.0.0.0/4          |
			  | Name                 | Reserved             |
			  | RFC                  | [RFC1112], Section 4 |
			  | Allocation Date      | August 1989          |
			  | Termination Date     | N/A                  |
			  | Source               | False                |
			  | Destination          | False                |
			  | Forwardable          | False                |
			  | Global               | False                |
			  | Reserved-by-Protocol | True                 |
			  +----------------------+----------------------+*/
			MustIPv4Addr("240.0.0.0/4"),

			/*+----------------------+----------------------+
			  | Attribute            | Value                |
			  +----------------------+----------------------+
			  | Address Block        | 255.255.255.255/32   |
			  | Name                 | Limited Broadcast    |
			  | RFC                  | [RFC0919], Section 7 |
			  | Allocation Date      | October 1984         |
			  | Termination Date     | N/A                  |
			  | Source               | False                |
			  | Destination          | True                 |
			  | Forwardable          | False                |
			  | Global               | False                |
			  | Reserved-by-Protocol | False                |
			  +----------------------+----------------------+*/
			MustIPv4Addr("255.255.255.255/32"),

			/*+----------------------+------------------+
			  | Attribute            | Value            |
			  +----------------------+------------------+
			  | Address Block        | ::1/128          |
			  | Name                 | Loopback Address |
			  | RFC                  | [RFC4291]        |
			  | Allocation Date      | February 2006    |
			  | Termination Date     | N/A              |
			  | Source               | False            |
			  | Destination          | False            |
			  | Forwardable          | False            |
			  | Global               | False            |
			  | Reserved-by-Protocol | True             |
			  +----------------------+------------------+*/
			MustIPv6Addr("::1/128"),

			/*+----------------------+---------------------+
			  | Attribute            | Value               |
			  +----------------------+---------------------+
			  | Address Block        | ::/128              |
			  | Name                 | Unspecified Address |
			  | RFC                  | [RFC4291]           |
			  | Allocation Date      | February 2006       |
			  | Termination Date     | N/A                 |
			  | Source               | True                |
			  | Destination          | False               |
			  | Forwardable          | False               |
			  | Global               | False               |
			  | Reserved-by-Protocol | True                |
			  +----------------------+---------------------+*/
			MustIPv6Addr("::/128"),

			/*+----------------------+---------------------+
			  | Attribute            | Value               |
			  +----------------------+---------------------+
			  | Address Block        | 64:ff9b::/96        |
			  | Name                 | IPv4-IPv6 Translat. |
			  | RFC                  | [RFC6052]           |
			  | Allocation Date      | October 2010        |
			  | Termination Date     | N/A                 |
			  | Source               | True                |
			  | Destination          | True                |
			  | Forwardable          | True                |
			  | Global               | True                |
			  | Reserved-by-Protocol | False               |
			  +----------------------+---------------------+*/
			MustIPv6Addr("64:ff9b::/96"),

			/*+----------------------+---------------------+
			  | Attribute            | Value               |
			  +----------------------+---------------------+
			  | Address Block        | ::ffff:0:0/96       |
			  | Name                 | IPv4-mapped Address |
			  | RFC                  | [RFC4291]           |
			  | Allocation Date      | February 2006       |
			  | Termination Date     | N/A                 |
			  | Source               | False               |
			  | Destination          | False               |
			  | Forwardable          | False               |
			  | Global               | False               |
			  | Reserved-by-Protocol | True                |
			  +----------------------+---------------------+*/
			MustIPv6Addr("::ffff:0:0/96"),

			/*+----------------------+----------------------------+
			  | Attribute            | Value                      |
			  +----------------------+----------------------------+
			  | Address Block        | 100::/64                   |
			  | Name                 | Discard-Only Address Block |
			  | RFC                  | [RFC6666]                  |
			  | Allocation Date      | June 2012                  |
			  | Termination Date     | N/A                        |
			  | Source               | True                       |
			  | Destination          | True                       |
			  | Forwardable          | True                       |
			  | Global               | False                      |
			  | Reserved-by-Protocol | False                      |
			  +----------------------+----------------------------+*/
			MustIPv6Addr("100::/64"),

			/*+----------------------+---------------------------+
			  | Attribute            | Value                     |
			  +----------------------+---------------------------+
			  | Address Block        | 2001::/23                 |
			  | Name                 | IETF Protocol Assignments |
			  | RFC                  | [RFC2928]                 |
			  | Allocation Date      | September 2000            |
			  | Termination Date     | N/A                       |
			  | Source               | False[1]                  |
			  | Destination          | False[1]                  |
			  | Forwardable          | False[1]                  |
			  | Global               | False[1]                  |
			  | Reserved-by-Protocol | False                     |
			  +----------------------+---------------------------+*/
			// [1] Unless allowed by a more specific allocation.
			MustIPv6Addr("2001::/16"),

			/*+----------------------+----------------+
			  | Attribute            | Value          |
			  +----------------------+----------------+
			  | Address Block        | 2001::/32      |
			  | Name                 | TEREDO         |
			  | RFC                  | [RFC4380]      |
			  | Allocation Date      | January 2006   |
			  | Termination Date     | N/A            |
			  | Source               | True           |
			  | Destination          | True           |
			  | Forwardable          | True           |
			  | Global               | False          |
			  | Reserved-by-Protocol | False          |
			  +----------------------+----------------+*/
			// Covered by previous entry, included for completeness.
			//
			// MustIPv6Addr("2001::/16"),

			/*+----------------------+----------------+
			  | Attribute            | Value          |
			  +----------------------+----------------+
			  | Address Block        | 2001:2::/48    |
			  | Name                 | Benchmarking   |
			  | RFC                  | [RFC5180]      |
			  | Allocation Date      | April 2008     |
			  | Termination Date     | N/A            |
			  | Source               | True           |
			  | Destination          | True           |
			  | Forwardable          | True           |
			  | Global               | False          |
			  | Reserved-by-Protocol | False          |
			  +----------------------+----------------+*/
			// Covered by previous entry, included for completeness.
			//
			// MustIPv6Addr("2001:2::/48"),

			/*+----------------------+---------------+
			  | Attribute            | Value         |
			  +----------------------+---------------+
			  | Address Block        | 2001:db8::/32 |
			  | Name                 | Documentation |
			  | RFC                  | [RFC3849]     |
			  | Allocation Date      | July 2004     |
			  | Termination Date     | N/A           |
			  | Source               | False         |
			  | Destination          | False         |
			  | Forwardable          | False         |
			  | Global               | False         |
			  | Reserved-by-Protocol | False         |
			  +----------------------+---------------+*/
			// Covered by previous entry, included for completeness.
			//
			// MustIPv6Addr("2001:db8::/32"),

			/*+----------------------+--------------+
			  | Attribute            | Value        |
			  +----------------------+--------------+
			  | Address Block        | 2001:10::/28 |
			  | Name                 | ORCHID       |
			  | RFC                  | [RFC4843]    |
			  | Allocation Date      | March 2007   |
			  | Termination Date     | March 2014   |
			  | Source               | False        |
			  | Destination          | False        |
			  | Forwardable          | False        |
			  | Global               | False        |
			  | Reserved-by-Protocol | False        |
			  +----------------------+--------------+*/
			// Covered by previous entry, included for completeness.
			//
			// MustIPv6Addr("2001:10::/28"),

			/*+----------------------+---------------+
			  | Attribute            | Value         |
			  +----------------------+---------------+
			  | Address Block        | 2002::/16 [2] |
			  | Name                 | 6to4          |
			  | RFC                  | [RFC3056]     |
			  | Allocation Date      | February 2001 |
			  | Termination Date     | N/A           |
			  | Source               | True          |
			  | Destination          | True          |
			  | Forwardable          | True          |
			  | Global               | N/A [2]       |
			  | Reserved-by-Protocol | False         |
			  +----------------------+---------------+*/
			// [2] See [RFC3056] for details.
			MustIPv6Addr("2002::/16"),

			/*+----------------------+--------------+
			  | Attribute            | Value        |
			  +----------------------+--------------+
			  | Address Block        | fc00::/7     |
			  | Name                 | Unique-Local |
			  | RFC                  | [RFC4193]    |
			  | Allocation Date      | October 2005 |
			  | Termination Date     | N/A          |
			  | Source               | True         |
			  | Destination          | True         |
			  | Forwardable          | True         |
			  | Global               | False        |
			  | Reserved-by-Protocol | False        |
			  +----------------------+--------------+*/
			MustIPv6Addr("fc00::/7"),

			/*+----------------------+-----------------------+
			  | Attribute            | Value                 |
			  +----------------------+-----------------------+
			  | Address Block        | fe80::/10             |
			  | Name                 | Linked-Scoped Unicast |
			  | RFC                  | [RFC4291]             |
			  | Allocation Date      | February 2006         |
			  | Termination Date     | N/A                   |
			  | Source               | True                  |
			  | Destination          | True                  |
			  | Forwardable          | False                 |
			  | Global               | False                 |
			  | Reserved-by-Protocol | True                  |
			  +----------------------+-----------------------+*/
			MustIPv6Addr("fe80::/10"),
		},
		7335: {
			// [RFC7335] IPv4 Service Continuity Prefix
			MustIPv4Addr("192.0.0.0/29"), // [RFC7335], §6 IANA Considerations
		},
		ForwardingBlacklist: { // Pseudo-RFC
			// Blacklist of non-forwardable IP blocks taken from RFC6890
			//
			// TODO: the attributes for forwardable should be
			// searcahble and embedded in the main list of RFCs
			// above.
			MustIPv4Addr("0.0.0.0/8"),
			MustIPv4Addr("127.0.0.0/8"),
			MustIPv4Addr("169.254.0.0/16"),
			MustIPv4Addr("192.0.0.0/24"),
			MustIPv4Addr("192.0.2.0/24"),
			MustIPv4Addr("198.51.100.0/24"),
			MustIPv4Addr("203.0.113.0/24"),
			MustIPv4Addr("240.0.0.0/4"),
			MustIPv4Addr("255.255.255.255/32"),
			MustIPv6Addr("::1/128"),
			MustIPv6Addr("::/128"),
			MustIPv6Addr("::ffff:0:0/96"),

			// There is no way of expressing a whitelist per RFC2928
			// atm without creating a negative mask, which I don't
			// want to do atm.
			//MustIPv6Addr("2001::/23"),

			MustIPv6Addr("2001:db8::/32"),
			MustIPv6Addr("2001:10::/28"),
			MustIPv6Addr("fe80::/10"),
		},
	}
}

// VisitAllRFCs iterates over all known RFCs and calls the visitor
func VisitAllRFCs(fn func(rfcNum uint, sockaddrs SockAddrs)) {
	rfcNetMap := KnownRFCs()

	// Blacklist of faux-RFCs.  Don't show the world that we're abusing the
	// RFC system in this library.
	rfcBlacklist := map[uint]struct{}{
		ForwardingBlacklist: {},
	}

	for rfcNum, sas := range rfcNetMap {
		if _, found := rfcBlacklist[rfcNum]; !found {
			fn(rfcNum, sas)
		}
	}
}
