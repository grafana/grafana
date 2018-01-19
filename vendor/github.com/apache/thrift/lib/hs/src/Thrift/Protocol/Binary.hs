--
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

{-# LANGUAGE CPP #-}
{-# LANGUAGE ExistentialQuantification #-}
{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE ScopedTypeVariables #-}

module Thrift.Protocol.Binary
    ( module Thrift.Protocol
    , BinaryProtocol(..)
    ) where

import Control.Exception ( throw )
import Control.Monad
import Data.Bits
import Data.ByteString.Lazy.Builder
import Data.Functor
import Data.Int
import Data.Monoid
import Data.Text.Lazy.Encoding ( decodeUtf8, encodeUtf8 )

import Thrift.Protocol
import Thrift.Transport
import Thrift.Types

import qualified Data.Attoparsec.ByteString as P
import qualified Data.Attoparsec.ByteString.Lazy as LP
import qualified Data.Binary as Binary
import qualified Data.ByteString.Lazy as LBS
import qualified Data.HashMap.Strict as Map
import qualified Data.Text.Lazy as LT

data BinaryProtocol a = BinaryProtocol a

-- NOTE: Reading and Writing functions rely on Builders and Data.Binary to
-- encode and decode data.  Data.Binary assumes that the binary values it is
-- encoding to and decoding from are in BIG ENDIAN format, and converts the
-- endianness as necessary to match the local machine.
instance Protocol BinaryProtocol where
    getTransport (BinaryProtocol t) = t

    writeMessageBegin p (n, t, s) = tWrite (getTransport p) $ toLazyByteString $
        buildBinaryValue (TI32 (version1 .|. fromIntegral (fromEnum t))) <>
        buildBinaryValue (TString $ encodeUtf8 n) <>
        buildBinaryValue (TI32 s)

    readMessageBegin p = runParser p $ do
      TI32 ver <- parseBinaryValue T_I32
      if ver .&. versionMask /= version1
        then throw $ ProtocolExn PE_BAD_VERSION "Missing version identifier"
        else do
          TString s <- parseBinaryValue T_STRING
          TI32 sz <- parseBinaryValue T_I32
          return (decodeUtf8 s, toEnum $ fromIntegral $ ver .&. 0xFF, sz)

    serializeVal _ = toLazyByteString . buildBinaryValue
    deserializeVal _ ty bs =
      case LP.eitherResult $ LP.parse (parseBinaryValue ty) bs of
        Left s -> error s
        Right val -> val

    readVal p = runParser p . parseBinaryValue

-- | Writing Functions
buildBinaryValue :: ThriftVal -> Builder
buildBinaryValue (TStruct fields) = buildBinaryStruct fields <> buildType T_STOP
buildBinaryValue (TMap ky vt entries) =
  buildType ky <>
  buildType vt <>
  int32BE (fromIntegral (length entries)) <>
  buildBinaryMap entries
buildBinaryValue (TList ty entries) =
  buildType ty <>
  int32BE (fromIntegral (length entries)) <>
  buildBinaryList entries
buildBinaryValue (TSet ty entries) =
  buildType ty <>
  int32BE (fromIntegral (length entries)) <>
  buildBinaryList entries
buildBinaryValue (TBool b) =
  word8 $ toEnum $ if b then 1 else 0
buildBinaryValue (TByte b) = int8 b
buildBinaryValue (TI16 i) = int16BE i
buildBinaryValue (TI32 i) = int32BE i
buildBinaryValue (TI64 i) = int64BE i
buildBinaryValue (TDouble d) = doubleBE d
buildBinaryValue (TString s) = int32BE len <> lazyByteString s
  where
    len :: Int32 = fromIntegral (LBS.length s)
buildBinaryValue (TBinary s) = buildBinaryValue (TString s)

buildBinaryStruct :: Map.HashMap Int16 (LT.Text, ThriftVal) -> Builder
buildBinaryStruct = Map.foldrWithKey combine mempty
  where
    combine fid (_,val) s =
      buildTypeOf val <> int16BE fid <> buildBinaryValue val <> s

buildBinaryMap :: [(ThriftVal, ThriftVal)] -> Builder
buildBinaryMap = foldl combine mempty
  where
    combine s (key, val) = s <> buildBinaryValue key <> buildBinaryValue val

buildBinaryList :: [ThriftVal] -> Builder
buildBinaryList = foldr (mappend . buildBinaryValue) mempty

-- | Reading Functions
parseBinaryValue :: ThriftType -> P.Parser ThriftVal
parseBinaryValue (T_STRUCT tmap) = TStruct <$> parseBinaryStruct tmap
parseBinaryValue (T_MAP _ _) = do
  kt <- parseType
  vt <- parseType
  n <- Binary.decode . LBS.fromStrict <$> P.take 4
  TMap kt vt <$> parseBinaryMap kt vt n
parseBinaryValue (T_LIST _) = do
  t <- parseType
  n <- Binary.decode . LBS.fromStrict <$> P.take 4
  TList t <$> parseBinaryList t n
parseBinaryValue (T_SET _) = do
  t <- parseType
  n <- Binary.decode . LBS.fromStrict <$> P.take 4
  TSet t <$> parseBinaryList t n
parseBinaryValue T_BOOL = TBool . (/=0) <$> P.anyWord8
parseBinaryValue T_BYTE = TByte . Binary.decode . LBS.fromStrict <$> P.take 1
parseBinaryValue T_I16 = TI16 . Binary.decode . LBS.fromStrict <$> P.take 2
parseBinaryValue T_I32 = TI32 . Binary.decode . LBS.fromStrict <$> P.take 4
parseBinaryValue T_I64 = TI64 . Binary.decode . LBS.fromStrict <$> P.take 8
parseBinaryValue T_DOUBLE = TDouble . bsToDouble <$> P.take 8
parseBinaryValue T_STRING = parseBinaryString TString
parseBinaryValue T_BINARY = parseBinaryString TBinary
parseBinaryValue ty = error $ "Cannot read value of type " ++ show ty

parseBinaryString ty = do
  i :: Int32  <- Binary.decode . LBS.fromStrict <$> P.take 4
  ty . LBS.fromStrict <$> P.take (fromIntegral i)

parseBinaryStruct :: TypeMap -> P.Parser (Map.HashMap Int16 (LT.Text, ThriftVal))
parseBinaryStruct tmap = Map.fromList <$> P.manyTill parseField (matchType T_STOP)
  where
    parseField = do
      t <- parseType
      n <- Binary.decode . LBS.fromStrict <$> P.take 2
      v <- case (t, Map.lookup n tmap) of
             (T_STRING, Just (_, T_BINARY)) -> parseBinaryValue T_BINARY
             _ -> parseBinaryValue t
      return (n, ("", v))

parseBinaryMap :: ThriftType -> ThriftType -> Int32 -> P.Parser [(ThriftVal, ThriftVal)]
parseBinaryMap kt vt n | n <= 0 = return []
                       | otherwise = do
  k <- parseBinaryValue kt
  v <- parseBinaryValue vt
  ((k,v) :) <$> parseBinaryMap kt vt (n-1)

parseBinaryList :: ThriftType -> Int32 -> P.Parser [ThriftVal]
parseBinaryList ty n | n <= 0 = return []
                     | otherwise = liftM2 (:) (parseBinaryValue ty)
                                   (parseBinaryList ty (n-1))



-- | Write a type as a byte
buildType :: ThriftType -> Builder
buildType t = word8 $ fromIntegral $ fromEnum t

-- | Write type of a ThriftVal as a byte
buildTypeOf :: ThriftVal -> Builder
buildTypeOf = buildType . getTypeOf

-- | Read a byte as though it were a ThriftType
parseType :: P.Parser ThriftType
parseType = toEnum . fromIntegral <$> P.anyWord8

matchType :: ThriftType -> P.Parser ThriftType
matchType t = t <$ P.word8 (fromIntegral $ fromEnum t)
