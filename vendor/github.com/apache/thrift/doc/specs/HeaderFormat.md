<link href="http://kevinburke.bitbucket.org/markdowncss/markdown.css" rel="stylesheet"></link>

Header format for the THeader.h
===============================

      0 1 2 3 4 5 6 7 8 9 a b c d e f 0 1 2 3 4 5 6 7 8 9 a b c d e f
    +----------------------------------------------------------------+
    | 0|                          LENGTH                             |
    +----------------------------------------------------------------+
    | 0|       HEADER MAGIC          |            FLAGS              |
    +----------------------------------------------------------------+
    |                         SEQUENCE NUMBER                        |
    +----------------------------------------------------------------+
    | 0|     Header Size(/32)        | ...
    +---------------------------------

                      Header is of variable size:
                       (and starts at offset 14)

    +----------------------------------------------------------------+
    |         PROTOCOL ID  (varint)  |   NUM TRANSFORMS (varint)     |
    +----------------------------------------------------------------+
    |      TRANSFORM 0 ID (varint)   |        TRANSFORM 0 DATA ...
    +----------------------------------------------------------------+
    |         ...                              ...                   |
    +----------------------------------------------------------------+
    |        INFO 0 ID (varint)      |       INFO 0  DATA ...
    +----------------------------------------------------------------+
    |         ...                              ...                   |
    +----------------------------------------------------------------+
    |                                                                |
    |                              PAYLOAD                           |
    |                                                                |
    +----------------------------------------------------------------+

The `LENGTH` field is 32 bits, and counts the remaining bytes in the
packet, NOT including the length field.  The header size field is 16
bits, and defines the size of the header remaining NOT including the
`HEADER MAGIC`, `FLAGS`, `SEQUENCE NUMBER` and header size fields.  The
Header size field is in bytes/4.

The transform ID's are varints.  The data for each transform is
defined by the transform ID in the code - no size is given in the
header.  If a transform ID is specified from a client and the server
doesn't know about the transform ID, an error MUST be returned as we
don't know how to transform the data.

Conversely, data in the info headers is ignorable.  This should only
be things like timestamps, debuging tracing, etc.  Using the header
size you should be able to skip this data and read the payload safely
if you don't know the info ID.

Info's should be oldest supported to newest supported order, so that
if we read an info ID we don't support, none of the remaining info
ID's will be supported either, and we can safely skip to the payload.

Info ID's and transform ID's should share the same ID space.

### PADDING:

Header will be padded out to next 4-byte boundary with `0x00`.

Max frame size is `0x3FFFFFFF`, which is slightly less than `HTTP_MAGIC`.
This allows us to distingush between different (older) transports.

### Transform IDs:

    ZLIB_TRANSFORM 0x01 - No data for this.  Use zlib to (de)compress the
                          data.

    HMAC_TRANSFORM 0x02 - Variable amount of mac data.  One byte to specify
                          size. Mac data is appended at the end of the packet.
    SNAPPY_TRANSFORM  0x03  - No data for this.  Use snappy to (de)compress the
                          data.


###Info IDs:

    INFO_KEYVALUE 0x01 - varint32 number of headers.
                       - key/value pairs of varstrings (varint16 length plus
                         no-trailing-null string).

