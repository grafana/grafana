package perfstat

// Network Interface types
const (
	IFT_OTHER       = 0x1
	IFT_1822        = 0x2 /* old-style arpanet imp */
	IFT_HDH1822     = 0x3 /* HDH arpanet imp */
	IFT_X25DDN      = 0x4 /* x25 to imp */
	IFT_X25         = 0x5 /* PDN X25 interface (RFC877) */
	IFT_ETHER       = 0x6 /* Ethernet CSMACD */
	IFT_ISO88023    = 0x7 /* CMSA CD */
	IFT_ISO88024    = 0x8 /* Token Bus */
	IFT_ISO88025    = 0x9 /* Token Ring */
	IFT_ISO88026    = 0xa /* MAN */
	IFT_STARLAN     = 0xb
	IFT_P10         = 0xc /* Proteon 10MBit ring */
	IFT_P80         = 0xd /* Proteon 10MBit ring */
	IFT_HY          = 0xe /* Hyperchannel */
	IFT_FDDI        = 0xf
	IFT_LAPB        = 0x10
	IFT_SDLC        = 0x11
	IFT_T1          = 0x12
	IFT_CEPT        = 0x13 /* E1 - european T1 */
	IFT_ISDNBASIC   = 0x14
	IFT_ISDNPRIMARY = 0x15
	IFT_PTPSERIAL   = 0x16 /* Proprietary PTP serial */
	IFT_PPP         = 0x17 /* RFC 1331 */
	IFT_LOOP        = 0x18 /* loopback */
	IFT_EON         = 0x19 /* ISO over IP */
	IFT_XETHER      = 0x1a /* obsolete 3MB experimental ethernet */
	IFT_NSIP        = 0x1b /* XNS over IP */
	IFT_SLIP        = 0x1c /* IP over generic TTY */
	IFT_ULTRA       = 0x1d /* Ultra Technologies */
	IFT_DS3         = 0x1e /* Generic T3 */
	IFT_SIP         = 0x1f /* SMDS */
	IFT_FRELAY      = 0x20 /* Frame Relay DTE only */
	IFT_RS232       = 0x21
	IFT_PARA        = 0x22 /* parallel-port */
	IFT_ARCNET      = 0x23
	IFT_ARCNETPLUS  = 0x24
	IFT_ATM         = 0x25 /* ATM cells */
	IFT_MIOX25      = 0x26
	IFT_SONET       = 0x27 /* SONET or SDH */
	IFT_X25PLE      = 0x28
	IFT_ISO88022LLC = 0x29
	IFT_LOCALTALK   = 0x2a
	IFT_SMDSDXI     = 0x2b
	IFT_FRELAYDCE   = 0x2c /* Frame Relay DCE */
	IFT_V35         = 0x2d
	IFT_HSSI        = 0x2e
	IFT_HIPPI       = 0x2f
	IFT_MODEM       = 0x30 /* Generic Modem */
	IFT_AAL5        = 0x31 /* AAL5 over ATM */
	IFT_SONETPATH   = 0x32
	IFT_SONETVT     = 0x33
	IFT_SMDSICIP    = 0x34 /* SMDS InterCarrier Interface */
	IFT_PROPVIRTUAL = 0x35 /* Proprietary Virtual/internal */
	IFT_PROPMUX     = 0x36 /* Proprietary Multiplexing */
	IFT_VIPA        = 0x37 /* Virtual Interface */
	IFT_SN          = 0x38 /* Federation Switch */
	IFT_SP          = 0x39 /* SP switch */
	IFT_FCS         = 0x3a /* IP over Fiber Channel */
	IFT_TUNNEL      = 0x3b
	IFT_GIFTUNNEL   = 0x3c /* IPv4 over IPv6 tunnel */
	IFT_HF          = 0x3d /* Support for PERCS HFI*/
	IFT_CLUSTER     = 0x3e /* cluster pseudo network interface */
	IFT_FB          = 0xc7 /* IP over Infiniband. Number by IANA */
)

type NetIfaceTotal struct {
	Number     int32 /* number of network interfaces  */
	IPackets   int64 /* number of packets received on interface */
	IBytes     int64 /* number of bytes received on interface */
	IErrors    int64 /* number of input errors on interface */
	OPackets   int64 /* number of packets sent on interface */
	OBytes     int64 /* number of bytes sent on interface */
	OErrors    int64 /* number of output errors on interface */
	Collisions int64 /* number of collisions on csma interface */
	XmitDrops  int64 /* number of packets not transmitted */
	Version    int64 /* version number (1, 2, etc.,) */
}

type NetIface struct {
	Name        string /* name of the interface */
	Description string /* interface description (from ODM, similar to lscfg output) */
	Type        uint8  /* ethernet, tokenring, etc. interpretation can be done using /usr/include/net/if_types.h */
	MTU         int64  /* network frame size */
	IPackets    int64  /* number of packets received on interface */
	IBytes      int64  /* number of bytes received on interface */
	IErrors     int64  /* number of input errors on interface */
	OPackets    int64  /* number of packets sent on interface */
	OBytes      int64  /* number of bytes sent on interface */
	OErrors     int64  /* number of output errors on interface */
	Collisions  int64  /* number of collisions on csma interface */
	Bitrate     int64  /* adapter rating in bit per second */
	XmitDrops   int64  /* number of packets not transmitted */
	Version     int64  /* version number (1, 2, etc.,) */
	IfIqDrops   int64  /* Dropped on input, this interface */
	IfArpDrops  int64  /* Dropped because no arp response */
}

type NetBuffer struct {
	Name          string /* size in ascii, always power of 2 (ex: "32", "64", "128") */
	InUse         int64  /* number of buffer currently allocated */
	Calls         int64  /* number of buffer allocations since last reset */
	Delayed       int64  /* number of delayed allocations */
	Free          int64  /* number of free calls */
	Failed        int64  /* number of failed allocations */
	HighWatermark int64  /* high threshold for number of buffer allocated */
	Freed         int64  /* number of buffers freed */
	Version       int64  /* version number (1, 2, etc.,) */
}

// Network adapter types
const (
	NET_PHY  = 0 /* physical device */
	NET_SEA  = 1 /* shared ethernet adapter */
	NET_VIR  = 2 /* virtual device */
	NET_HEA  = 3 /* host ethernet adapter */
	NET_EC   = 4 /* etherchannel */
	NET_VLAN = 5 /* vlan pseudo device */
)

type NetAdapter struct {
	Version                    int64  /* version number (1,2, etc) */
	Name                       string /* name of the adapter */
	TxPackets                  int64  /* Transmit Packets on interface */
	TxBytes                    int64  /* Transmit Bytes on interface */
	TxInterrupts               int64  /* Transfer Interrupts */
	TxErrors                   int64  /* Transmit Errors */
	TxPacketsDropped           int64  /* Packets Dropped at the time of Data Transmission */
	TxQueueSize                int64  /* Maximum Packets on Software Transmit Queue */
	TxQueueLen                 int64  /* Transmission Queue Length */
	TxQueueOverflow            int64  /* Transmission Queue Overflow */
	TxBroadcastPackets         int64  /* Number of Broadcast Packets Transmitted */
	TxMulticastPackets         int64  /* Number of Multicast packets Transmitted */
	TxCarrierSense             int64  /* Lost Carrier Sense signal count */
	TxDMAUnderrun              int64  /* Count of DMA Under-runs for Transmission */
	TxLostCTSErrors            int64  /* The number of unsuccessful transmissions due to the loss of the Clear-to-Send signal error */
	TxMaxCollisionErrors       int64  /* Maximum Collision Errors at Transmission */
	TxLateCollisionErrors      int64  /* Late Collision Errors at Transmission */
	TxDeferred                 int64  /* The number of packets deferred for Transmission. */
	TxTimeoutErrors            int64  /* Time Out Errors for Transmission */
	TxSingleCollisionCount     int64  /* Count of Single Collision error at Transmission */
	TxMultipleCollisionCount   int64  /* Count of Multiple Collision error at Transmission */
	RxPackets                  int64  /* Receive Packets on interface */
	RxBytes                    int64  /* Receive Bytes on interface */
	RxInterrupts               int64  /* Receive Interrupts */
	RxErrors                   int64  /* Input errors on interface */
	RxPacketsDropped           int64  /* The number of packets accepted by the device driver for transmission which were not (for any reason) given to the device. */
	RxBadPackets               int64  /* Count of Bad Packets Received. */
	RxMulticastPackets         int64  /* Number of MultiCast Packets Received */
	RxBroadcastPackets         int64  /* Number of Broadcast Packets Received */
	RxCRCErrors                int64  /* Count of Packets Received with CRC errors  */
	RxDMAOverrun               int64  /* Count of DMA over-runs for Data Receival. */
	RxAlignmentErrors          int64  /* Packets Received with Alignment Error  */
	RxNoResourceErrors         int64  /* Packets Received with No Resource Errors */
	RxCollisionErrors          int64  /* Packets Received with Collision errors */
	RxPacketTooShortErrors     int64  /* Count of Short Packets Received. */
	RxPacketTooLongErrors      int64  /* Count of Too Long Packets Received. */
	RxPacketDiscardedByAdapter int64  /* Count of Received Packets discarded by Adapter. */
	AdapterType                int32  /* 0 - Physical, 1 - SEA, 2 - Virtual, 3 -HEA */
}
