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
{-# LANGUAGE TupleSections #-}

module Thrift.Protocol.JSON
    ( module Thrift.Protocol
    , JSONProtocol(..)
    ) where

import Control.Applicative
import Control.Monad
import Data.Attoparsec.ByteString as P
import Data.Attoparsec.ByteString.Char8 as PC
import Data.Attoparsec.ByteString.Lazy as LP
import Data.ByteString.Base64.Lazy as B64C
import Data.ByteString.Base64 as B64
import Data.ByteString.Lazy.Builder as B
import Data.ByteString.Internal (c2w, w2c)
import Data.Functor
import Data.Int
import Data.List
import Data.Maybe (catMaybes)
import Data.Monoid
import Data.Text.Lazy.Encoding
import Data.Word
import qualified Data.HashMap.Strict as Map

import Thrift.Protocol
import Thrift.Transport
import Thrift.Types

import qualified Data.ByteString.Lazy as LBS
import qualified Data.ByteString.Lazy.Char8 as LBSC
import qualified Data.Text.Lazy as LT

-- | The JSON Protocol data uses the standard 'TJSONProtocol'.  Data is
-- encoded as a JSON 'ByteString'
data JSONProtocol t = JSONProtocol t
                      -- ^ Construct a 'JSONProtocol' with a 'Transport'

instance Protocol JSONProtocol where
    getTransport (JSONProtocol t) = t

    writeMessageBegin (JSONProtocol t) (s, ty, sq) = tWrite t $ toLazyByteString $
      B.char8 '[' <> buildShowable (1 :: Int32) <>
      B.string8 ",\"" <> escape (encodeUtf8 s) <> B.char8 '\"' <>
      B.char8 ',' <> buildShowable (fromEnum ty) <>
      B.char8 ',' <> buildShowable sq <>
      B.char8 ','
    writeMessageEnd (JSONProtocol t) = tWrite t "]"
    readMessageBegin p = runParser p $ skipSpace *> do
      _ver :: Int32 <- lexeme (PC.char8 '[') *> lexeme (signed decimal)
      bs <- lexeme (PC.char8 ',') *> lexeme escapedString
      case decodeUtf8' bs of
        Left _ -> fail "readMessage: invalid text encoding"
        Right str -> do
          ty <- toEnum <$> (lexeme (PC.char8 ',') *> lexeme (signed decimal))
          seqNum <- lexeme (PC.char8 ',') *> lexeme (signed decimal)
          _ <- PC.char8 ','
          return (str, ty, seqNum)
    readMessageEnd p = void $ runParser p (PC.char8 ']')

    serializeVal _ = toLazyByteString . buildJSONValue
    deserializeVal _ ty bs =
      case LP.eitherResult $ LP.parse (parseJSONValue ty) bs of
        Left s -> error s
        Right val -> val

    readVal p ty = runParser p $ skipSpace *> parseJSONValue ty


-- Writing Functions

buildJSONValue :: ThriftVal -> Builder
buildJSONValue (TStruct fields) = B.char8 '{' <> buildJSONStruct fields <> B.char8 '}'
buildJSONValue (TMap kt vt entries) =
  B.char8 '[' <> B.char8 '"' <> getTypeName kt <> B.char8 '"' <>
  B.char8 ',' <> B.char8 '"' <> getTypeName vt <> B.char8 '"' <>
  B.char8 ',' <> buildShowable (length entries) <>
  B.char8 ',' <> B.char8 '{' <> buildJSONMap entries <> B.char8 '}' <>
  B.char8 ']'
buildJSONValue (TList ty entries) =
  B.char8 '[' <> B.char8 '"' <> getTypeName ty <> B.char8 '"' <>
  B.char8 ',' <> buildShowable (length entries) <>
  (if length entries > 0
   then B.char8 ',' <> buildJSONList entries
   else mempty) <>
  B.char8 ']'
buildJSONValue (TSet ty entries) = buildJSONValue (TList ty entries)
buildJSONValue (TBool b) = if b then B.char8 '1' else B.char8 '0'
buildJSONValue (TByte b) = buildShowable b
buildJSONValue (TI16 i) = buildShowable i
buildJSONValue (TI32 i) = buildShowable i
buildJSONValue (TI64 i) = buildShowable i
buildJSONValue (TDouble d) = buildShowable d
buildJSONValue (TString s) = B.char8 '\"' <> escape s <> B.char8 '\"'
buildJSONValue (TBinary s) = B.char8 '\"' <> (B.lazyByteString . B64C.encode $ s) <> B.char8 '\"'

buildJSONStruct :: Map.HashMap Int16 (LT.Text, ThriftVal) -> Builder
buildJSONStruct = mconcat . intersperse (B.char8 ',') . Map.foldrWithKey buildField []
  where 
    buildField fid (_,val) = (:) $
      B.char8 '"' <> buildShowable fid <> B.string8 "\":" <> 
      B.char8 '{' <>
      B.char8 '"' <> getTypeName (getTypeOf val) <> B.string8 "\":" <>
      buildJSONValue val <>
      B.char8 '}'

buildJSONMap :: [(ThriftVal, ThriftVal)] -> Builder
buildJSONMap = mconcat . intersperse (B.char8 ',') . map buildKV
  where
    buildKV (key@(TString _), val) =
      buildJSONValue key <> B.char8 ':' <> buildJSONValue val
    buildKV (key, val) =
      B.char8 '\"' <> buildJSONValue key <> B.string8 "\":" <> buildJSONValue val
buildJSONList :: [ThriftVal] -> Builder
buildJSONList = mconcat . intersperse (B.char8 ',') . map buildJSONValue

buildShowable :: Show a => a ->  Builder
buildShowable = B.string8 . show

-- Reading Functions

parseJSONValue :: ThriftType -> Parser ThriftVal
parseJSONValue (T_STRUCT tmap) =
  TStruct <$> (lexeme (PC.char8 '{') *> parseJSONStruct tmap <* PC.char8 '}')
parseJSONValue (T_MAP kt vt) = fmap (TMap kt vt) $
  between '[' ']' $
    lexeme escapedString *> lexeme (PC.char8 ',') *>
    lexeme escapedString *> lexeme (PC.char8 ',') *>
    lexeme decimal *> lexeme (PC.char8 ',') *>
    between '{' '}' (parseJSONMap kt vt)
parseJSONValue (T_LIST ty) = fmap (TList ty) $
  between '[' ']' $ do
    len <- lexeme escapedString *> lexeme (PC.char8 ',') *> lexeme decimal
    if len > 0
      then lexeme (PC.char8 ',') *> parseJSONList ty
      else return []
parseJSONValue (T_SET ty) = fmap (TSet ty) $
  between '[' ']' $ do
    len <- lexeme escapedString *> lexeme (PC.char8 ',') *> lexeme decimal
    if len > 0
      then  lexeme (PC.char8 ',') *> parseJSONList ty
      else return []
parseJSONValue T_BOOL =
  (TBool True <$ PC.char8 '1') <|> (TBool False <$ PC.char8 '0')
parseJSONValue T_BYTE = TByte <$> signed decimal
parseJSONValue T_I16 = TI16 <$> signed decimal
parseJSONValue T_I32 = TI32 <$> signed decimal
parseJSONValue T_I64 = TI64 <$> signed decimal
parseJSONValue T_DOUBLE = TDouble <$> double
parseJSONValue T_STRING = TString <$> escapedString
parseJSONValue T_BINARY = TBinary <$> base64String
parseJSONValue T_STOP = fail "parseJSONValue: cannot parse type T_STOP"
parseJSONValue T_VOID = fail "parseJSONValue: cannot parse type T_VOID"

parseAnyValue :: Parser ()
parseAnyValue = choice $
                skipBetween '{' '}' :
                skipBetween '[' ']' :
                map (void . parseJSONValue)
                  [ T_BOOL
                  , T_I16
                  , T_I32
                  , T_I64
                  , T_DOUBLE
                  , T_STRING
                  , T_BINARY
                  ]
  where
    skipBetween :: Char -> Char -> Parser ()
    skipBetween a b = between a b $ void (PC.satisfy (\c -> c /= a && c /= b))
                                          <|> skipBetween a b

parseJSONStruct :: TypeMap -> Parser (Map.HashMap Int16 (LT.Text, ThriftVal))
parseJSONStruct tmap = Map.fromList . catMaybes <$> parseField
                       `sepBy` lexeme (PC.char8 ',')
  where
    parseField = do
      fid <- lexeme (between '"' '"' decimal) <* lexeme (PC.char8 ':')
      case Map.lookup fid tmap of
        Just (str, ftype) -> between '{' '}' $ do
          _ <- lexeme (escapedString) *> lexeme (PC.char8 ':')
          val <- lexeme (parseJSONValue ftype)
          return $ Just (fid, (str, val))
        Nothing -> lexeme parseAnyValue *> return Nothing

parseJSONMap :: ThriftType -> ThriftType -> Parser [(ThriftVal, ThriftVal)]
parseJSONMap kt vt =
  ((,) <$> lexeme (parseJSONKey kt) <*>
   (lexeme (PC.char8 ':') *> lexeme (parseJSONValue vt))) `sepBy`
  lexeme (PC.char8 ',')
  where
    parseJSONKey T_STRING = parseJSONValue T_STRING
    parseJSONKey T_BINARY = parseJSONValue T_BINARY
    parseJSONKey kt = PC.char8 '"' *> parseJSONValue kt <* PC.char8 '"'

parseJSONList :: ThriftType -> Parser [ThriftVal]
parseJSONList ty = lexeme (parseJSONValue ty) `sepBy` lexeme (PC.char8 ',')

escapedString :: Parser LBS.ByteString
escapedString = PC.char8 '"' *>
                (LBS.pack <$> P.many' (escapedChar <|> notChar8 '"')) <*
                PC.char8 '"'

base64String :: Parser LBS.ByteString
base64String = PC.char8 '"' *>
               (decodeBase64 . LBSC.pack <$> P.many' (PC.notChar '"')) <*
               PC.char8 '"'
               where
                 decodeBase64 b =
                   let padded = case (LBS.length b) `mod` 4 of
                                  2 -> LBS.append b "=="
                                  3 -> LBS.append b "="
                                  _ -> b in
                   case B64C.decode padded of
                     Right s -> s
                     Left x -> error x

escapedChar :: Parser Word8
escapedChar = PC.char8 '\\' *> (c2w <$> choice
                                [ '\SOH' <$ P.string "u0001"
                                , '\STX' <$ P.string "u0002"
                                , '\ETX' <$ P.string "u0003"
                                , '\EOT' <$ P.string "u0004"
                                , '\ENQ' <$ P.string "u0005"
                                , '\ACK' <$ P.string "u0006"
                                , '\BEL' <$ P.string "u0007"
                                , '\BS'  <$ P.string "u0008"
                                , '\VT'  <$ P.string "u000b"
                                , '\FF'  <$ P.string "u000c"
                                , '\CR'  <$ P.string "u000d"
                                , '\SO'  <$ P.string "u000e"
                                , '\SI'  <$ P.string "u000f"
                                , '\DLE' <$ P.string "u0010"
                                , '\DC1' <$ P.string "u0011"
                                , '\DC2' <$ P.string "u0012"
                                , '\DC3' <$ P.string "u0013"
                                , '\DC4' <$ P.string "u0014"
                                , '\NAK' <$ P.string "u0015"
                                , '\SYN' <$ P.string "u0016"
                                , '\ETB' <$ P.string "u0017"
                                , '\CAN' <$ P.string "u0018"
                                , '\EM'  <$ P.string "u0019"
                                , '\SUB' <$ P.string "u001a"
                                , '\ESC' <$ P.string "u001b"
                                , '\FS'  <$ P.string "u001c"
                                , '\GS'  <$ P.string "u001d"
                                , '\RS'  <$ P.string "u001e"
                                , '\US'  <$ P.string "u001f"
                                , '\DEL' <$ P.string "u007f"
                                , '\0' <$ PC.char '0'
                                , '\a' <$ PC.char 'a'
                                , '\b' <$ PC.char 'b'
                                , '\f' <$ PC.char 'f'
                                , '\n' <$ PC.char 'n'
                                , '\r' <$ PC.char 'r'
                                , '\t' <$ PC.char 't'
                                , '\v' <$ PC.char 'v'
                                , '\"' <$ PC.char '"'
                                , '\'' <$ PC.char '\''
                                , '\\' <$ PC.char '\\'
                                , '/'  <$ PC.char '/'
                                ])

escape :: LBS.ByteString -> Builder
escape = LBS.foldl' escapeChar mempty
  where
    escapeChar b w = b <> (B.lazyByteString $ case w2c w of
      '\0' -> "\\0"
      '\b' -> "\\b"
      '\f' -> "\\f"
      '\n' -> "\\n"
      '\r' -> "\\r"
      '\t' -> "\\t"
      '\"' -> "\\\""
      '\\' -> "\\\\"
      '\SOH' -> "\\u0001"
      '\STX' -> "\\u0002"
      '\ETX' -> "\\u0003"
      '\EOT' -> "\\u0004"
      '\ENQ' -> "\\u0005"
      '\ACK' -> "\\u0006"
      '\BEL' -> "\\u0007"
      '\VT'  -> "\\u000b"
      '\SO'  -> "\\u000e"
      '\SI'  -> "\\u000f"
      '\DLE' -> "\\u0010"
      '\DC1' -> "\\u0011"
      '\DC2' -> "\\u0012"
      '\DC3' -> "\\u0013"
      '\DC4' -> "\\u0014"
      '\NAK' -> "\\u0015"
      '\SYN' -> "\\u0016"
      '\ETB' -> "\\u0017"
      '\CAN' -> "\\u0018"
      '\EM'  -> "\\u0019"
      '\SUB' -> "\\u001a"
      '\ESC' -> "\\u001b"
      '\FS'  -> "\\u001c"
      '\GS'  -> "\\u001d"
      '\RS'  -> "\\u001e"
      '\US'  -> "\\u001f"
      '\DEL' -> "\\u007f"
      _ -> LBS.singleton w)

lexeme :: Parser a -> Parser a
lexeme = (<* skipSpace)

notChar8 :: Char -> Parser Word8
notChar8 c = P.satisfy (/= c2w c)

between :: Char -> Char -> Parser a -> Parser a
between a b p = lexeme (PC.char8 a) *> lexeme p <* lexeme (PC.char8 b)

getTypeName :: ThriftType -> Builder
getTypeName ty = B.string8 $ case ty of
  T_STRUCT _ -> "rec"
  T_MAP _ _  -> "map"
  T_LIST _   -> "lst"
  T_SET _    -> "set"
  T_BOOL     -> "tf"
  T_BYTE     -> "i8"
  T_I16      -> "i16"
  T_I32      -> "i32"
  T_I64      -> "i64"
  T_DOUBLE   -> "dbl"
  T_STRING   -> "str"
  T_BINARY   -> "str"
  _ -> error "Unrecognized Type"

