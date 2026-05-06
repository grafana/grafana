# ice

[![PkgGoDev](https://pkg.go.dev/badge/github.com/blugelabs/ice)](https://pkg.go.dev/github.com/blugelabs/ice)
[![Tests](https://github.com/blugelabs/ice/workflows/Tests/badge.svg?branch=master&event=push)](https://github.com/blugelabs/ice/actions?query=workflow%3ATests+event%3Apush+branch%3Amaster)
[![Lint](https://github.com/blugelabs/ice/workflows/Lint/badge.svg?branch=master&event=push)](https://github.com/blugelabs/ice/actions?query=workflow%3ALint+event%3Apush+branch%3Amaster)

The file is written in the reverse order that we typically access data.  This helps us write in one pass since later sections of the file require file offsets of things we've already written.

Current usage:

- crc-32 bytes and version are in fixed position at the end of the file
- reading remainder of footer could be version specific
- remainder of footer gives us:
  - 3 important offsets (docValue, fields index and stored data index)
  - 2 important values (number of docs and chunk factor)
- field data is processed once and memoized onto the heap so that we never have to go back to disk for it
- access to stored data by doc number means first navigating to the stored data index, then accessing a fixed position offset into that slice, which gives us the actual address of the data.  the first bytes of that section tell us the size of data so that we know where it ends.
- access to all other indexed data follows the following pattern:
  - first know the field name -> convert to id
  - next navigate to term dictionary for that field
    - some operations stop here and do dictionary ops
  - next use dictionary to navigate to posting list for a specific term
  - walk posting list
  - if necessary, walk posting details as we go
  - if location info is desired, consult location bitmap to see if it is there

## stored fields section

- for each document
  - preparation phase:
    - produce a slice of metadata bytes and data bytes
    - produce these slices in field id order
    - field value is appended to the data slice
    - metadata slice is varint encoded with the following values for each field value
      - field id (uint16)
      - field value start offset in uncompressed data slice (uint64)
      - field value length (uint64)
      - compress the data slice using snappy
  - file writing phase:
    - remember the start offset for this document
    - write out meta data length (varint uint64)
    - write out compressed data length (varint uint64)
    - write out the metadata bytes
    - write out the compressed data bytes

## stored fields idx

- for each document
  - write start offset (remembered from previous section) of stored data (big endian uint64)

With this index and a known document number, we have direct access to all the stored field data.

## posting details (freq/norm) section

- for each posting list
  - produce a slice containing multiple consecutive chunks (each chunk is varint stream)
  - produce a slice remembering offsets of where each chunk starts
  - preparation phase:
    - for each hit in the posting list
    - if this hit is in next chunk close out encoding of last chunk and record offset start of next
    - encode term frequency (uint64)
    - encode norm factor (float32) - similarity specific implementation
  - file writing phase:
    - remember start position for this posting list details
    - write out number of chunks that follow (varint uint64)
    - write out length of each chunk (each a varint uint64)
    - write out the byte slice containing all the chunk data

If you know the doc number you're interested in, this format lets you jump to the correct chunk (docNum/chunkFactor) directly and then seek within that chunk until you find it.

## posting details (location) section

- for each posting list
  - produce a slice containing multiple consecutive chunks (each chunk is varint stream)
  - produce a slice remembering offsets of where each chunk starts
  - preparation phase:
    - for each hit in the posting list
    - if this hit is in next chunk close out encoding of last chunk and record offset start of next
    - encode field (uint16)
    - encode field pos (uint64)
    - encode field start (uint64)
    - encode field end (uint64)
  - file writing phase:
    - remember start position for this posting list details
    - write out number of chunks that follow (varint uint64)
    - write out length of each chunk (each a varint uint64)
    - write out the byte slice containing all the chunk data

If you know the doc number you're interested in, this format lets you jump to the correct chunk (docNum/chunkFactor) directly and then seek within that chunk until you find it.

## postings list section

- for each posting list
  - preparation phase:
    - encode roaring bitmap posting list to bytes (so we know the length)
  - file writing phase:
    - remember the start position for this posting list
    - write freq/norm details offset (remembered from previous, as varint uint64)
    - write location details offset (remembered from previous, as varint uint64)
    - write length of encoded roaring bitmap
    - write the serialized roaring bitmap data

## dictionary

- for each field
  - preparation phase:
    - encode vellum FST with dictionary data pointing to file offset of posting list (remembered from previous)
  - file writing phase:
    - remember the start position of this persistDictionary
    - write length of vellum data (varint uint64)
    - write out vellum data

## fields section

- for each field
  - file writing phase:
    - remember start offset for each field
    - write dictionary address (remembered from previous) (varint uint64)
    - write length of field name (varint uint64)
    - write field name bytes

## fields idx

- for each field
  - file writing phase:
    - write big endian uint64 of start offset for each field

NOTE: currently we don't know or record the length of this fields index.  Instead we rely on the fact that we know it immediately precedes a footer of known size.

## fields DocValue

- for each field
  - preparation phase:
    - produce a slice containing multiple consecutive chunks, where each chunk is composed of a meta section followed by compressed columnar field data
    - produce a slice remembering the length of each chunk
  - file writing phase:
    - remember the start position of this first field DocValue offset in the footer
    - write out number of chunks that follow (varint uint64)
    - write out length of each chunk (each a varint uint64)
    - write out the byte slice containing all the chunk data

NOTE: currently the meta header inside each chunk gives clue to the location offsets and size of the data pertaining to a given docID and any
read operation leverage that meta information to extract the document specific data from the file.

## footer

- file writing phase
  - write number of docs (big endian uint64)
  - write stored field index location (big endian uint64)
  - write field index location (big endian uint64)
  - write field docValue location (big endian uint64)
  - write out chunk factor (big endian uint32)
  - write out version (big endian uint32)
  - write out file CRC of everything preceding this (big endian uint32)

---

# ice file format diagrams 

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

Footer section describes the configuration of particular ice file. The format of footer is version-dependent, so it is necessary to check `V` field before the parsing.

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


    (...)                                              [F]                       [F + F#]
    | Fields                                           | Fields Index.                  |
    |==================================================|================================|
    |                                                  |                                |
    |   |~~~~~~~~|~~~~~~~~|---...---|~~~~~~~~|~~~~~~~~|||--------|--------|...|--------||
    ||->|   Dict | Length |    Name | # Docs |Tot Freq|||      0 |      1 |   | F# - 1 ||
    ||  |~~~~~~~~|~~~~~~~~|---...---|~~~~~~~~|~~~~~~~~|||--------|----|---|...|--------||
    ||                                                 |              |                 |
    ||=================================================|==============|=================|
     |                                                                |
     |----------------------------------------------------------------|
        

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
	|    [~~~~~~|~~~~~|~~~~~~~|~~~~~]                              | |
	| |->[ Size | Pos | Start | End ]                              | |
	| |  [~~~~~~|~~~~~|~~~~~~~|~~~~~]                              | |
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
