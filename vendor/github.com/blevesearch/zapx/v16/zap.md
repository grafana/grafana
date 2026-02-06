# ZAP File Format

## Legend

### File Sections

    |========|
    |        | file section
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

            +==================================================+
            | Stored Fields                                    |
            |==================================================|
    +-----> | Stored Fields Index                              |
    |       |==================================================|
    |       | Inverted Text Index Section                      |
    |       |==================================================|
    |       | Vector Index Section                             |
    |       |==================================================|
    |       | Sections Info                                    |
    |       |==================================================|
    |   +-> | Sections Index                                   |
    |   |   |========+========+====+=====+======+====+====+====|
    |   |   |     D# |     SF |  F |  S  |  FDV | CF |  V | CC | (Footer)
    |   |   +========+====+===+====+==+==+======+====+====+====+
    |   |                 |           |
    +---------------------+           |
        |-----------------------------+


     D#. Number of Docs.
     SF. Stored Fields Index Offset.
      F. Field Index Offset.
      S. Sections Index Offset
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

## Index Sections

Sections Index is a set of NF uint64 addresses (0 through F# - 1) each of which are offsets to the records in the Sections Info. Inside the sections info, we have further offsets to specific type of index section for that particular field in the segment file. For example, field 0 may correspond to Vector Indexing and its records would have offsets to the Vector Index Section whereas a field 1 may correspond to Text Indexing and its records would rather point to somewhere within the Inverted Text Index Section.

       (...)                                                                        [F]                           [F + F#]
       + Sections Info                                                              + Sections Index                      +
       |============================================================================|=====================================|
       |                                                                            |                                     |
       | +---------+---------+-----+---------+---------+~~~~~~~~+~~~~~~~~+--+...+-+ | +-------+--------+...+------+-----+ |
    +----> S1 Addr | S1 Type | ... | Sn Addr | Sn Type |   NS   | Length |  Name  | | |     0 |      1 |   | F#-1 | NF  | |
    |  | +---------+---------+-----+---------+---------+~~~~~~~~+~~~~~~~~+--+...+-+ | +-------+----+---+...+------+-----+ |
    |  |                                                                            |              |                      |
    |  +============================================================================+==============|======================+
    |                                                                                              |
    +----------------------------------------------------------------------------------------------+

     NF. Number of fields
     NS. Number of index sections
     Sn. nth index section

## Inverted Text Index Section

Each field has its own types of indexes in separate sections as indicated above. This can be a vector index or inverted text index.

In case of inverted text index, the dictionary is encoded in [Vellum](https://github.com/couchbase/vellum) format. Dictionary consists of pairs `(term, offset)`, where `offset` indicates the position of postings (list of documents) for this particular term.

        +================================================================+- Inverted Text
        |                                                                |  Index Section
        |                                                                |
        |    Freq/Norm (chunked)                                         |
        |    [~~~~~~+~~~~~~~~~~~~~~~~~~~~~~~~~~~~~]                      |
        | +->[ Freq | Norm (float32 under varint) ]                      |
        | |  [~~~~~~+~~~~~~~~~~~~~~~~~~~~~~~~~~~~~]                      |
        | |                                                              |
        | +------------------------------------------------------------+ |
        |    Location Details (chunked)                                | |
        |    [~~~~~~+~~~~~+~~~~~~~+~~~~~+~~~~~~+~~~~~~~~+~~~~~]        | |
        | +->[ Size | Pos | Start | End | Arr# | ArrPos | ... ]        | |
        | |  [~~~~~~+~~~~~+~~~~~~~+~~~~~+~~~~~~+~~~~~~~~+~~~~~]        | |
        | |                                                            | |
        | +----------------------+                                     | |
        |          Postings List |                                     | |
        |         +~~~~~~~~+~~~~~+~~+~~~~~~~~+----------+...+-+        | |
        |      +->+    F/N |     LD | Length | ROARING BITMAP |        | |
        |      |  +~~~~~+~~|~~~~~~~~|~~~~~~~~+----------+...+-+        | |
        |      |        +----------------------------------------------+ |
        |      +-------------------------------------------------+       |
        |                                                        |       |
        |                     Dictionary                         |       |
        | +~~~~~~~~~~+~~~~~~~+~~~~~~~~+--------------------------+-...-+ |
    +-----> DV Start | DV End| Length | VELLUM DATA : (TERM -> OFFSET) | |
    |   | +~~~~~~~~~~+~~~~~~~+~~~~~~~~+----------------------------...-+ |
    |   |                                                                |
    |   |                                                                |
    |   |================================================================+- Vector Index Section
    |   |                                                                |
    |   +================================================================+- Synonym Index Section
    |   |                                                                |
    |   |================================================================+- Sections Info
    +-----------------------------+                                      |
        |                         |                                      |
        |     +-------+-----+-----+------+~~~~~~~~+~~~~~~~~+--+...+--+   |
        |     |  ...  | ITI | ITI ADDR   |   NS   | Length |    Name |   |
        |     +-------+-----+------------+~~~~~~~~+~~~~~~~~+--+...+--+   |
        +================================================================+


         ITI - Inverted Text Index

## Vector Index Section

In a vector index, each vector in a document is given a unique Id. This vector Id is to be used within the [Faiss](https://github.com/blevesearch/faiss) index. The mapping between the document Id and the vector Id is stored along with a serialized vector index. Doc Values are not applicable to this section.

        |================================================================+- Inverted Text Index Section
        |                                                                |
        |================================================================+- Vector Index Section
        |                                                                |
        |   +~~~~~~~~~~+~~~~~~~+~~~~~+~~~~~~+                            |
    +-------> DV Start | DVEnd | VIO | NVEC |                            |
    |   |   +~~~~~~~~~~+~~~~~~~+~~~~~+~~~~~~+                            |
    |   |                                                                |
    |   |   +~~~~~~~~~~~~+~~~~~~~~~~~~+                                  |
    |   |   | VectorID_0 |   DocID_0  |                                  |
    |   |   +~~~~~~~~~~~~+~~~~~~~~~~~~+                                  |
    |   |   | VectorID_1 |   DocID_1  |                                  |
    |   |   +~~~~~~~~~~~~+~~~~~~~~~~~~+                                  |
    |   |   |    ...     |    ...     |                                  |
    |   |   +~~~~~~~~~~~~+~~~~~~~~~~~~+                                  |
    |   |   | VectorID_N |   DocID_N  |                                  |
    |   |   +~~~~~~~~~~~~+~~~~~~~~~~~~+                                  |
    |   |                                                                |
    |   |   +~~~~~~~~~~~~~+                                              |
    |   |   |  FAISS LEN  |                                              |
    |   |   +~~~~~~~~~~~~~+                                              |
    |   |                                                                |
    |   |   +---------------------------+...+------------------------+   |
    |   |   |                  SERIALIZED FAISS INDEX                |   |
    |   |   +---------------------------+...+------------------------+   |
    |   |                                                                |
    |   |================================================================+- Synonym Index Section
    |   |                                                                |
    |   |================================================================+- Sections Info
    +-----------------------------+                                      |
        |                         |                                      |
        |     +-------+-----+-----+------+~~~~~~~~+~~~~~~~~+--+...+--+   |
        |     |  ...  | VI  | VI ADDR    |   NS   | Length |    Name |   |
        |     +-------+-----+------------+~~~~~~~~+~~~~~~~~+--+...+--+   |
        +================================================================+

         VI   - Vector Index
         VIO  - Vector Index Optimized for
         NVEC - Number of vectors
         FAISS LEN - Length of serialized FAISS index

## Synonym Index Section

In a synonyms index, the relationship between a term and its synonyms is represented using a Thesaurus. The Thesaurus is encoded in the [Vellum](https://github.com/couchbase/vellum) format and consists of pairs in the form `(term, offset)`. Here, the offset specifies the position of the postings list containing the synonyms for the given term. The postings list is stored as a Roaring64 bitmap, with each entry representing an encoded synonym for the term.

        |================================================================+- Inverted Text Index Section
        |                                                                |
        |================================================================+- Vector Index Section
        |                                                                |
        +================================================================+- Synonym Index Section
        |                                                                |
        |    (Offset)  +~~~~~+----------+...+---+                        |
        |   +--------->|  RL | ROARING64 BITMAP |                        |
        |   |          +~~~~~+----------+...+---+                        +-------------------+         
        |   |(Term -> Offset)                                                                |    
        |   +--------+                                                                       |
        |            |                            Term ID to Term map (NST Entries)          |   
        |    +~~~~+~~~~+~~~~~[{~~~~~+~~~~+~~~~~~}{~~~~~+~~~~+~~~~~~}...{~~~~~+~~~~+~~~~~~}]  |
        | +->| VL | VD | NST || TID | TL | Term || TID | TL | Term |   | TID | TL | Term |   |
        | |  +~~~~+~~~~+~~~~~[{~~~~~+~~~~+~~~~~~}{~~~~~+~~~~+~~~~~~}...{~~~~~+~~~~+~~~~~~}]  |
        | |                                                                                  |
        | +----------------------------+                                                     |
        |                              |                                                     |   
        | +~~~~~~~~~~+~~~~~~~~+~~~~~~~~~~~~~~~~~+                                            |
    +-----> DV Start | DV End | ThesaurusOffset |                                            |   
    |   | +~~~~~~~~~~+~~~~~~~~+~~~~~~~~~~~~~~~~~+                        +-------------------+
    |   |                                                                |
    |   |                                                                |
    |   |================================================================+- Sections Info
    +-----------------------------+                                      |
        |                         |                                      |
        |     +-------+-----+-----+------+~~~~~~~~+~~~~~~~~+--+...+--+   |
        |     |  ...  | SI  | SI ADDR    |   NS   | Length |    Name |   |
        |     +-------+-----+------------+~~~~~~~~+~~~~~~~~+--+...+--+   |
        +================================================================+

         SI  - Synonym Index
         VL  - Vellum Length
         VD  - Vellum Data (Term -> Offset)
         RL  - Roaring64 Length
         NST - Number of entries in the term ID to term map
         TID - Term ID (32-bit)
         TL  - Term Length

### Synonym Encoding

        ROARING64 BITMAP

        Each 64-bit entry consists of two parts: the first 32 bits represent the Term ID (TID),
        and the next 32 bits represent the Document Number (DN).

        [{~~~~~+~~~~}{~~~~~+~~~~}...{~~~~~+~~~~}]
         | TID | DN || TID | DN |   | TID | DN |
        [{~~~~~+~~~~}{~~~~~+~~~~}...{~~~~~+~~~~}]

            TID - Term ID (32-bit)
            DN  - Document Number (32-bit)

## Doc Values

DocValue start and end offsets are stored within the section content of each field. This allows each field having its own type of index to choose whether to store the doc values or not. For example, it may not make sense to store doc values for vector indexing and so, the offsets can be invalid ones for it whereas the fields having text indexing may have valid doc values offsets.

    +================================================================+
    |     +------...--+                                              |
    |  +->+ DocValues +<-+                                           |
    |  |  +------...--+  |                                           |
    |==|=================|===========================================+- Inverted Text
    ++~+~~~~~~~~~+~~~~~~~+~~+~~~~~~~~+-----------------------...--+  |  Index Section
    || DV START  |  DV END  | LENGTH | VELLUM DATA: TERM -> OFFSET|  |
    ++~~~~~~~~~~~+~~~~~~~~~~+~~~~~~~~+-----------------------...--+  |
    +================================================================+

DocValues is chunked Snappy-compressed values for each document and field.

    [~~~~~~~~~~~~~~~|~~~~~~|~~~~~~~~~|-...-|~~~~~~|~~~~~~~~~|--------------------...-]
    [ Doc# in Chunk | Doc1 | Offset1 | ... | DocN | OffsetN | SNAPPY COMPRESSED DATA ]
    [~~~~~~~~~~~~~~~|~~~~~~|~~~~~~~~~|-...-|~~~~~~|~~~~~~~~~|--------------------...-]

Last 16 bytes are description of chunks.

    |~~~~~~~~~~~~...~|----------------|----------------|
    |   Chunk Sizes  | Chunk Size Arr |         Chunk# |
    |~~~~~~~~~~~~...~|----------------|----------------|
