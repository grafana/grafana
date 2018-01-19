" Vim syntax file
" Language: Thrift
" Maintainer: Martin Smith <martin@facebook.com>
" Last Change: $Date: $
" Copy to ~/.vim/
" Add to ~/.vimrc
"  au BufRead,BufNewFile *.thrift set filetype=thrift
"  au! Syntax thrift source ~/.vim/thrift.vim
"
" $Id: $
"
" Licensed to the Apache Software Foundation (ASF) under one
" or more contributor license agreements. See the NOTICE file
" distributed with this work for additional information
" regarding copyright ownership. The ASF licenses this file
" to you under the Apache License, Version 2.0 (the
" "License"); you may not use this file except in compliance
" with the License. You may obtain a copy of the License at
"
"   http://www.apache.org/licenses/LICENSE-2.0
"
" Unless required by applicable law or agreed to in writing,
" software distributed under the License is distributed on an
" "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
" KIND, either express or implied. See the License for the
" specific language governing permissions and limitations
" under the License.
"

if version < 600
  syntax clear
elseif exists("b:current_syntax")
  finish
endif

" Todo
syn keyword thriftTodo TODO todo FIXME fixme XXX xxx contained

" Comments
syn match thriftComment "#.*" contains=thriftTodo
syn region thriftComment start="/\*" end="\*/" contains=thriftTodo
syn match thriftComment "//.\{-}\(?>\|$\)\@="

" String
syn region thriftStringDouble matchgroup=None start=+"+  end=+"+

" Number
syn match thriftNumber "-\=\<\d\+\>" contained

" Keywords
syn keyword thriftKeyword namespace
syn keyword thriftKeyword xsd_all xsd_optional xsd_nillable xsd_attrs
syn keyword thriftKeyword include cpp_include cpp_type const optional required
syn keyword thriftBasicTypes void bool byte i8 i16 i32 i64 double string binary
syn keyword thriftStructure map list set struct typedef exception enum throws union

" Special
syn match thriftSpecial "\d\+:"

" Structure
syn keyword thriftStructure service oneway extends
"async"         { return tok_async;         }
"exception"     { return tok_xception;      }
"extends"       { return tok_extends;       }
"throws"        { return tok_throws;        }
"service"       { return tok_service;       }
"enum"          { return tok_enum;          }
"const"         { return tok_const;         }

if version >= 508 || !exists("did_thrift_syn_inits")
  if version < 508
    let did_thrift_syn_inits = 1
    command! -nargs=+ HiLink hi link <args>
  else
    command! -nargs=+ HiLink hi def link <args>
  endif

  HiLink thriftComment Comment
  HiLink thriftKeyword Special
  HiLink thriftBasicTypes Type
  HiLink thriftStructure StorageClass
  HiLink thriftTodo Todo
  HiLink thriftString String
  HiLink thriftNumber Number
  HiLink thriftSpecial Special
  HiLink thriftStructure Structure

  delcommand HiLink
endif

let b:current_syntax = "thrift"
