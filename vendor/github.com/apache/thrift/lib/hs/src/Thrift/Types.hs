-- Licensed to the Apache Software Foundation (ASF) under one
-- or more contributor license agreements. See the NOTICE file
-- distributed with this work for additional information
-- regarding copyright ownership. The ASF licenses this file
-- to you under the Apache License, Version 2.0 (the
-- "License"); you may not use this file except in compliance
-- with the License. You may obtain a copy of the License at
--
--   http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing,
-- software distributed under the License is distributed on an
-- "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
-- KIND, either express or implied. See the License for the
-- specific language governing permissions and limitations
-- under the License.
--

{-# OPTIONS_GHC -fno-warn-orphans #-}

module Thrift.Types where

import Data.Foldable (foldl')
import Data.Hashable ( Hashable, hashWithSalt )
import Data.Int
import Test.QuickCheck.Arbitrary
import Test.QuickCheck.Gen (elements)
import Data.Text.Lazy (Text)
import qualified Data.ByteString.Lazy as LBS
import qualified Data.HashMap.Strict as Map
import qualified Data.HashSet as Set
import qualified Data.Vector as Vector

instance (Hashable a) => Hashable (Vector.Vector a) where
  hashWithSalt = Vector.foldl' hashWithSalt


type TypeMap = Map.HashMap Int16 (Text, ThriftType)

data ThriftVal = TStruct (Map.HashMap Int16 (Text, ThriftVal))
               | TMap ThriftType ThriftType [(ThriftVal, ThriftVal)]
               | TList ThriftType [ThriftVal]
               | TSet ThriftType [ThriftVal]
               | TBool Bool
               | TByte Int8
               | TI16 Int16
               | TI32 Int32
               | TI64 Int64
               | TString LBS.ByteString
               | TBinary LBS.ByteString
               | TDouble Double
                 deriving (Eq, Show)

-- Information is needed here for collection types (ie T_STRUCT, T_MAP,
-- T_LIST, and T_SET) so that we know what types those collections are
-- parameterized by.  In most protocols, this cannot be discerned directly
-- from the data being read.
data ThriftType
    = T_STOP
    | T_VOID
    | T_BOOL
    | T_BYTE
    | T_DOUBLE
    | T_I16
    | T_I32
    | T_I64
    | T_STRING
    | T_BINARY
    | T_STRUCT TypeMap
    | T_MAP ThriftType ThriftType
    | T_SET ThriftType
    | T_LIST ThriftType
      deriving ( Eq, Show )

-- NOTE: when using toEnum information about parametized types is NOT preserved.
-- This design choice is consistent woth the Thrift implementation in other
-- languages
instance Enum ThriftType where
    fromEnum T_STOP       = 0
    fromEnum T_VOID       = 1
    fromEnum T_BOOL       = 2
    fromEnum T_BYTE       = 3
    fromEnum T_DOUBLE     = 4
    fromEnum T_I16        = 6
    fromEnum T_I32        = 8
    fromEnum T_I64        = 10
    fromEnum T_STRING     = 11
    fromEnum T_BINARY     = 11
    fromEnum (T_STRUCT _) = 12
    fromEnum (T_MAP _ _)  = 13
    fromEnum (T_SET _)    = 14
    fromEnum (T_LIST _)   = 15

    toEnum 0  = T_STOP
    toEnum 1  = T_VOID
    toEnum 2  = T_BOOL
    toEnum 3  = T_BYTE
    toEnum 4  = T_DOUBLE
    toEnum 6  = T_I16
    toEnum 8  = T_I32
    toEnum 10 = T_I64
    toEnum 11 = T_STRING
    -- toEnum 11 = T_BINARY
    toEnum 12 = T_STRUCT Map.empty
    toEnum 13 = T_MAP T_VOID T_VOID
    toEnum 14 = T_SET T_VOID
    toEnum 15 = T_LIST T_VOID
    toEnum t = error $ "Invalid ThriftType " ++ show t

data MessageType
    = M_CALL
    | M_REPLY
    | M_EXCEPTION
    | M_ONEWAY
      deriving ( Eq, Show )

instance Enum MessageType where
    fromEnum M_CALL      =  1
    fromEnum M_REPLY     =  2
    fromEnum M_EXCEPTION =  3
    fromEnum M_ONEWAY    =  4

    toEnum 1 = M_CALL
    toEnum 2 = M_REPLY
    toEnum 3 = M_EXCEPTION
    toEnum 4 = M_ONEWAY
    toEnum t = error $ "Invalid MessageType " ++ show t

instance Arbitrary MessageType where
  arbitrary = elements [M_CALL, M_REPLY, M_EXCEPTION, M_ONEWAY]
