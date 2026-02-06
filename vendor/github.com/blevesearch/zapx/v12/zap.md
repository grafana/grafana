# ZAP File Format 

## Legend

### Sections

    |========|
    |        | section
    |========|
    
### Fixed-size fields

    |--------|        |----|        |--|        |-|
    |        | uint64 |    | uint32 |  | uint16 | | uint8
    |--------|        |----|        |--|        |-|

### Varints

    |~~~~~~~~|
    |        | varint(up to uint64)
    |~~~~~~~~|

### Arbitrary-length fields

    |--------...---|
    |              | arbitrary-length field (string, vellum, roaring bitmap)
    |--------...---|

### Chunked data

	[--------]
	[        ]
	[--------]

## Overview

Footer section describes the configuration of particular ZAP file. The format of footer is version-dependent, so it is necessary to check `V` field before the parsing.

            |==================================================|
            | Stored Fields                                    |
            |==================================================|
    |-----> | Stored Fields Index                              |
    |       |==================================================|   
    |       | Dictionaries + Postings + DocValues              | 
    |       |==================================================|
    | |---> | DocValues Index                                  |
    | |     |==================================================|   
    | |     | Fields                                           |
    | |     |==================================================|
    | | |-> | Fields Index                                     |
    | | |   |========|========|========|========|====|====|====|
    | | |   |     D# |     SF |      F |    FDV | CF |  V | CC | (Footer)
    | | |   |========|====|===|====|===|====|===|====|====|====|
    | | |                 |        |        |
    |-+-+-----------------|        |        |
      | |--------------------------|        |
      |-------------------------------------|

     D#. Number of Docs.
     SF. Stored Fields Index Offset.
      F. Field Index Offset.
    FDV. Field DocValue Offset.
     CF. Chunk Factor.
      V. Version.
     CC. CRC32.

## Stored Fields

Stored Fields Index is `D#` consecutive 64-bit unsigned integers - offsets, where relevant Stored Fields Data records are located.

    0                                [SF]                   [SF + D# * 8]
    | Stored Fields                  | Stored Fields Index              |
    |================================|==================================|
    |                                |                                  |
    |       |--------------------|   ||--------|--------|. . .|--------||
    |   |-> | Stored Fields Data |   ||      0 |      1 |     | D# - 1 ||
    |   |   |--------------------|   ||--------|----|---|. . .|--------||
    |   |                            |              |                   |
    |===|============================|==============|===================|
        |                                           |
        |-------------------------------------------|

Stored Fields Data is an arbitrary size record, which consists of metadata and [Snappy](https://github.com/golang/snappy)-compressed data.

    Stored Fields Data
    |~~~~~~~~|~~~~~~~~|~~~~~~~~...~~~~~~~~|~~~~~~~~...~~~~~~~~|
    |    MDS |    CDS |                MD |                CD |
    |~~~~~~~~|~~~~~~~~|~~~~~~~~...~~~~~~~~|~~~~~~~~...~~~~~~~~|
    
    MDS. Metadata size.
    CDS. Compressed data size.
    MD. Metadata.
    CD. Snappy-compressed data.

## Fields

Fields Index section located between addresses `F` and `len(file) - len(footer)` and consist of `uint64` values (`F1`, `F2`, ...) which are offsets to records in Fields section. We have `F# = (len(file) - len(footer) - F) / sizeof(uint64)` fields.


    (...)                            [F]                       [F + F#]
    | Fields                         | Fields Index.                  |
    |================================|================================|
    |                                |                                |
    |   |~~~~~~~~|~~~~~~~~|---...---|||--------|--------|...|--------||
    ||->|   Dict | Length |    Name |||      0 |      1 |   | F# - 1 ||
    ||  |~~~~~~~~|~~~~~~~~|---...---|||--------|----|---|...|--------||
    ||                               |              |                 |
    ||===============================|==============|=================|
     |                                              |
     |----------------------------------------------|
        

## Dictionaries + Postings

Each of fields has its own dictionary, encoded in [Vellum](https://github.com/couchbase/vellum) format. Dictionary consists of pairs `(term, offset)`, where `offset` indicates the position of postings (list of documents) for this particular term.

	|================================================================|- Dictionaries + 
	|                                                                |   Postings +
	|                                                                |    DocValues
	|    Freq/Norm (chunked)                                         |
	|    [~~~~~~|~~~~~~~~~~~~~~~~~~~~~~~~~~~~~]                      |
	| |->[ Freq | Norm (float32 under varint) ]                      |
	| |  [~~~~~~|~~~~~~~~~~~~~~~~~~~~~~~~~~~~~]                      |
	| |                                                              |
	| |------------------------------------------------------------| |
	|    Location Details (chunked)                                | |
	|    [~~~~~~|~~~~~|~~~~~~~|~~~~~|~~~~~~|~~~~~~~~|~~~~~]        | |
	| |->[ Size | Pos | Start | End | Arr# | ArrPos | ... ]        | |
	| |  [~~~~~~|~~~~~|~~~~~~~|~~~~~|~~~~~~|~~~~~~~~|~~~~~]        | |
	| |                                                            | |
	| |----------------------|                                     | |
	|          Postings List |                                     | |
	|         |~~~~~~~~|~~~~~|~~|~~~~~~~~|-----------...--|        | |
	|      |->|    F/N |     LD | Length | ROARING BITMAP |        | |
	|      |  |~~~~~|~~|~~~~~~~~|~~~~~~~~|-----------...--|        | |
	|      |        |----------------------------------------------| |
	|      |--------------------------------------|                  |
	|          Dictionary                         |                  |
	|         |~~~~~~~~|--------------------------|-...-|            |
	|      |->| Length | VELLUM DATA : (TERM -> OFFSET) |            |
	|      |  |~~~~~~~~|----------------------------...-|            |
	|      |                                                         |
	|======|=========================================================|- DocValues Index
	|      |                                                         |
	|======|=========================================================|- Fields
	|      |                                                         |
	| |~~~~|~~~|~~~~~~~~|---...---|                                  |
	| |   Dict | Length |    Name |                                  |
	| |~~~~~~~~|~~~~~~~~|---...---|                                  |
	|                                                                |
	|================================================================|

## DocValues

DocValues Index is `F#` pairs of varints, one pair per field. Each pair of varints indicates start and end point of DocValues slice.

	|================================================================|
	|     |------...--|                                              |
	|  |->| DocValues |<-|                                           |
	|  |  |------...--|  |                                           |
	|==|=================|===========================================|- DocValues Index
	||~|~~~~~~~~~|~~~~~~~|~~|           |~~~~~~~~~~~~~~|~~~~~~~~~~~~||
	|| DV1 START | DV1 STOP | . . . . . | DV(F#) START | DV(F#) END ||
	||~~~~~~~~~~~|~~~~~~~~~~|           |~~~~~~~~~~~~~~|~~~~~~~~~~~~||
	|================================================================|

DocValues is chunked Snappy-compressed values for each document and field.

    [~~~~~~~~~~~~~~~|~~~~~~|~~~~~~~~~|-...-|~~~~~~|~~~~~~~~~|--------------------...-]
    [ Doc# in Chunk | Doc1 | Offset1 | ... | DocN | OffsetN | SNAPPY COMPRESSED DATA ]
    [~~~~~~~~~~~~~~~|~~~~~~|~~~~~~~~~|-...-|~~~~~~|~~~~~~~~~|--------------------...-]

Last 16 bytes are description of chunks.

    |~~~~~~~~~~~~...~|----------------|----------------|
    |   Chunk Sizes  | Chunk Size Arr |         Chunk# |
    |~~~~~~~~~~~~...~|----------------|----------------|
