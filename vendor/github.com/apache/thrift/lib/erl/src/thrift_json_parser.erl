%% Licensed to the Apache Software Foundation (ASF) under one
%% or more contributor license agreements. See the NOTICE file
%% distributed with this work for additional information
%% regarding copyright ownership. The ASF licenses this file
%% to you under the Apache License, Version 2.0 (the
%% "License"); you may not use this file except in compliance
%% with the License. You may obtain a copy of the License at
%%
%%   http://www.apache.org/licenses/LICENSE-2.0
%%
%% Unless required by applicable law or agreed to in writing,
%% software distributed under the License is distributed on an
%% "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
%% KIND, either express or implied. See the License for the
%% specific language governing permissions and limitations
%% under the License.
%%
%% The json parser implementation was created by
%% alisdair sullivan <alisdair@hartbrake.com> based on
%% the jsx json library

-module(thrift_json_parser).
-export([parser/0, handle_event/2]).


-record(config, {strict_utf8 = false :: boolean()}).


parser() -> fun(JSON) -> start(JSON, {?MODULE, []}, [], #config{}) end.


handle_event(Event, {Handler, State}, _Config) -> {Handler, Handler:handle_event(Event, State)}.

handle_event(end_json, State) -> lists:reverse([end_json] ++ State);
handle_event(Event, State) -> [Event] ++ State.


%% whitespace
-define(space, 16#20).
-define(tab, 16#09).
-define(cr, 16#0D).
-define(newline, 16#0A).

%% object delimiters
-define(start_object, 16#7B).
-define(end_object, 16#7D).

%% array delimiters
-define(start_array, 16#5B).
-define(end_array, 16#5D).

%% kv seperator
-define(comma, 16#2C).
-define(doublequote, 16#22).
-define(singlequote, 16#27).
-define(colon, 16#3A).

%% string escape sequences
-define(rsolidus, 16#5C).
-define(solidus, 16#2F).

%% math
-define(zero, 16#30).
-define(decimalpoint, 16#2E).
-define(negative, 16#2D).
-define(positive, 16#2B).

%% comments
-define(star, 16#2A).


%% some useful guards
-define(is_hex(Symbol),
    (Symbol >= $a andalso Symbol =< $f) orelse
    (Symbol >= $A andalso Symbol =< $F) orelse
    (Symbol >= $0 andalso Symbol =< $9)
).

-define(is_nonzero(Symbol),
    Symbol >= $1 andalso Symbol =< $9
).

-define(is_whitespace(Symbol),
    Symbol =:= ?space; Symbol =:= ?tab; Symbol =:= ?cr; Symbol =:= ?newline
).


%% lists are benchmarked to be faster (tho higher in memory usage) than binaries
new_seq() -> [].
new_seq(C) -> [C].

acc_seq(Seq, C) when is_list(C) -> lists:reverse(C) ++ Seq;
acc_seq(Seq, C) -> [C] ++ Seq.

end_seq(Seq) -> unicode:characters_to_binary(lists:reverse(Seq)).

end_seq(Seq, _) -> end_seq(Seq).


start(<<16#ef, 16#bb, 16#bf, Rest/binary>>, Handler, Stack, Config) ->
    value(Rest, Handler, Stack, Config);
start(Bin, Handler, Stack, Config) ->
    value(Bin, Handler, Stack, Config).


value(<<?doublequote, Rest/binary>>, Handler, Stack, Config) ->
    string(Rest, Handler, new_seq(), Stack, Config);
value(<<$t, Rest/binary>>, Handler, Stack, Config) ->
    true(Rest, Handler, Stack, Config);
value(<<$f, Rest/binary>>, Handler, Stack, Config) ->
    false(Rest, Handler, Stack, Config);
value(<<$n, Rest/binary>>, Handler, Stack, Config) ->
    null(Rest, Handler, Stack, Config);
value(<<?negative, Rest/binary>>, Handler, Stack, Config) ->
    negative(Rest, Handler, new_seq($-), Stack, Config);
value(<<?zero, Rest/binary>>, Handler, Stack, Config) ->
    zero(Rest, Handler, new_seq($0), Stack, Config);
value(<<S, Rest/binary>>, Handler, Stack, Config) when ?is_nonzero(S) ->
    integer(Rest, Handler, new_seq(S), Stack, Config);
value(<<?start_object, Rest/binary>>, Handler, Stack, Config) ->
    object(Rest, handle_event(start_object, Handler, Config), [key|Stack], Config);
value(<<?start_array, Rest/binary>>, Handler, Stack, Config) ->
    array(Rest, handle_event(start_array, Handler, Config), [array|Stack], Config);
value(<<S, Rest/binary>>, Handler, Stack, Config) when ?is_whitespace(S) ->
    value(Rest, Handler, Stack, Config);
value(_Bin, _Handler, _Stack, _Config) ->
    erlang:error(badarg).


object(<<?doublequote, Rest/binary>>, Handler, Stack, Config) ->
    string(Rest, Handler, new_seq(), Stack, Config);
object(<<?end_object, Rest/binary>>, Handler, [key|Stack], Config) ->
    maybe_done(Rest, handle_event(end_object, Handler, Config), Stack, Config);
object(<<S, Rest/binary>>, Handler, Stack, Config) when ?is_whitespace(S) ->
    object(Rest, Handler, Stack, Config);
object(_Bin, _Handler, _Stack, _Config) ->
    erlang:error(badarg).


array(<<?end_array, Rest/binary>>, Handler, [array|Stack], Config) ->
    maybe_done(Rest, handle_event(end_array, Handler, Config), Stack, Config);
array(<<S, Rest/binary>>, Handler, Stack, Config) when ?is_whitespace(S) ->
    array(Rest, Handler, Stack, Config);
array(Bin, Handler, Stack, Config) ->
    value(Bin, Handler, Stack, Config).


colon(<<?colon, Rest/binary>>, Handler, [key|Stack], Config) ->
    value(Rest, Handler, [object|Stack], Config);
colon(<<S, Rest/binary>>, Handler, Stack, Config) when ?is_whitespace(S) ->
    colon(Rest, Handler, Stack, Config);
colon(_Bin, _Handler, _Stack, _Config) ->
    erlang:error(badarg).


key(<<?doublequote, Rest/binary>>, Handler, Stack, Config) ->
    string(Rest, Handler, new_seq(), Stack, Config);
key(<<S, Rest/binary>>, Handler, Stack, Config) when ?is_whitespace(S) ->
    key(Rest, Handler, Stack, Config);
key(_Bin, _Handler, _Stack, _Config) ->
    erlang:error(badarg).


%% note that if you encounter an error from string and you can't find the clause that
%%  caused it here, it might be in unescape below
string(<<?doublequote, Rest/binary>>, Handler, Acc, Stack, Config) ->
    doublequote(Rest, Handler, Acc, Stack, Config);
string(<<?solidus, Rest/binary>>, Handler, Acc, Stack, Config) ->
    string(Rest, Handler, acc_seq(Acc, ?solidus), Stack, Config);
string(<<?rsolidus/utf8, Rest/binary>>, Handler, Acc, Stack, Config) ->
    unescape(Rest, Handler, Acc, Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X >= 16#20, X < 16#2028 ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X == 16#2028; X == 16#2029 ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X > 16#2029, X < 16#d800 ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X > 16#dfff, X < 16#fdd0 ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X > 16#fdef, X < 16#fffe ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X >= 16#10000, X < 16#1fffe ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X >= 16#20000, X < 16#2fffe ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X >= 16#30000, X < 16#3fffe ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X >= 16#40000, X < 16#4fffe ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X >= 16#50000, X < 16#5fffe ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X >= 16#60000, X < 16#6fffe ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X >= 16#70000, X < 16#7fffe ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X >= 16#80000, X < 16#8fffe ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X >= 16#90000, X < 16#9fffe ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X >= 16#a0000, X < 16#afffe ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X >= 16#b0000, X < 16#bfffe ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X >= 16#c0000, X < 16#cfffe ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X >= 16#d0000, X < 16#dfffe ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X >= 16#e0000, X < 16#efffe ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X >= 16#f0000, X < 16#ffffe ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
string(<<X/utf8, Rest/binary>>, Handler, Acc, Stack, Config) when X >= 16#100000, X < 16#10fffe ->
    string(Rest, Handler, acc_seq(Acc, X), Stack, Config);
%% surrogates
string(<<237, X, _, Rest/binary>>, Handler, Acc, Stack, Config=#config{strict_utf8=false})
        when X >= 160 ->
    string(Rest, Handler, acc_seq(Acc, 16#fffd), Stack, Config);
%% u+xfffe, u+xffff, control codes and other noncharacters
string(<<_/utf8, Rest/binary>>, Handler, Acc, Stack, Config=#config{strict_utf8=false}) ->
    string(Rest, Handler, acc_seq(Acc, 16#fffd), Stack, Config);
%% u+fffe and u+ffff for R14BXX (subsequent runtimes will happily match the
%%  preceding clause
string(<<239, 191, X, Rest/binary>>, Handler, Acc, Stack, Config=#config{strict_utf8=false})
        when X == 190; X == 191 ->
    string(Rest, Handler, acc_seq(Acc, 16#fffd), Stack, Config);
%% overlong encodings and missing continuations of a 2 byte sequence
string(<<X, Rest/binary>>, Handler, Acc, Stack, Config=#config{strict_utf8=false})
        when X >= 192, X =< 223 ->
    strip_continuations(Rest, Handler, Acc, Stack, Config, 1);
%% overlong encodings and missing continuations of a 3 byte sequence
string(<<X, Rest/binary>>, Handler, Acc, Stack, Config=#config{strict_utf8=false})
        when X >= 224, X =< 239 ->
    strip_continuations(Rest, Handler, Acc, Stack, Config, 2);
%% overlong encodings and missing continuations of a 4 byte sequence
string(<<X, Rest/binary>>, Handler, Acc, Stack, Config=#config{strict_utf8=false})
        when X >= 240, X =< 247 ->
    strip_continuations(Rest, Handler, Acc, Stack, Config, 3);
%% incompletes and unexpected bytes, including orphan continuations
string(<<_, Rest/binary>>, Handler, Acc, Stack, Config=#config{strict_utf8=false}) ->
    string(Rest, Handler, acc_seq(Acc, 16#fffd), Stack, Config);
string(_Bin, _Handler, _Acc, _Stack, _Config) ->
  erlang:error(badarg).


doublequote(Rest, Handler, Acc, [key|_] = Stack, Config) ->
    colon(Rest, handle_event({key, end_seq(Acc, Config)}, Handler, Config), Stack, Config);
doublequote(Rest, Handler, Acc, Stack, Config) ->
    maybe_done(Rest, handle_event({string, end_seq(Acc, Config)}, Handler, Config), Stack, Config).


%% strips continuation bytes after bad utf bytes, guards against both too short
%%  and overlong sequences. N is the maximum number of bytes to strip
strip_continuations(<<Rest/binary>>, Handler, Acc, Stack, Config, 0) ->
    string(Rest, Handler, acc_seq(Acc, 16#fffd), Stack, Config);
strip_continuations(<<X, Rest/binary>>, Handler, Acc, Stack, Config, N) when X >= 128, X =< 191 ->
    strip_continuations(Rest, Handler, Acc, Stack, Config, N - 1);
%% not a continuation byte, insert a replacement character for sequence thus
%%  far and dispatch back to string
strip_continuations(<<Rest/binary>>, Handler, Acc, Stack, Config, _) ->
    string(Rest, Handler, acc_seq(Acc, 16#fffd), Stack, Config).


%% this all gets really gross and should probably eventually be folded into
%%  but for now it fakes being part of string on incompletes and errors
unescape(<<$b, Rest/binary>>, Handler, Acc, Stack, Config) ->
    string(Rest, Handler, acc_seq(Acc, $\b), Stack, Config);
unescape(<<$f, Rest/binary>>, Handler, Acc, Stack, Config) ->
    string(Rest, Handler, acc_seq(Acc, $\f), Stack, Config);
unescape(<<$n, Rest/binary>>, Handler, Acc, Stack, Config) ->
    string(Rest, Handler, acc_seq(Acc, $\n), Stack, Config);
unescape(<<$r, Rest/binary>>, Handler, Acc, Stack, Config) ->
    string(Rest, Handler, acc_seq(Acc, $\r), Stack, Config);
unescape(<<$t, Rest/binary>>, Handler, Acc, Stack, Config) ->
    string(Rest, Handler, acc_seq(Acc, $\t), Stack, Config);
unescape(<<?doublequote, Rest/binary>>, Handler, Acc, Stack, Config) ->
    string(Rest, Handler, acc_seq(Acc, $\"), Stack, Config);
unescape(<<?rsolidus, Rest/binary>>, Handler, Acc, Stack, Config) ->
    string(Rest, Handler, acc_seq(Acc, $\\), Stack, Config);
unescape(<<?solidus, Rest/binary>>, Handler, Acc, Stack, Config) ->
    string(Rest, Handler, acc_seq(Acc, $/), Stack, Config);
unescape(<<$u, $d, A, B, C, ?rsolidus, $u, $d, X, Y, Z, Rest/binary>>, Handler, Acc, Stack, Config)
        when (A == $8 orelse A == $9 orelse A == $a orelse A == $b),
             (X == $c orelse X == $d orelse X == $e orelse X == $f),
             ?is_hex(B), ?is_hex(C), ?is_hex(Y), ?is_hex(Z)
        ->
    High = erlang:list_to_integer([$d, A, B, C], 16),
    Low = erlang:list_to_integer([$d, X, Y, Z], 16),
    Codepoint = (High - 16#d800) * 16#400 + (Low - 16#dc00) + 16#10000,
    string(Rest, Handler, acc_seq(Acc, Codepoint), Stack, Config);
unescape(<<$u, $d, A, B, C, ?rsolidus, $u, W, X, Y, Z, Rest/binary>>, Handler, Acc, Stack, Config)
        when (A == $8 orelse A == $9 orelse A == $a orelse A == $b),
             ?is_hex(B), ?is_hex(C), ?is_hex(W), ?is_hex(X), ?is_hex(Y), ?is_hex(Z)
        ->
    string(Rest, Handler, acc_seq(Acc, [16#fffd, 16#fffd]), Stack, Config);
unescape(<<$u, A, B, C, D, Rest/binary>>, Handler, Acc, Stack, Config)
        when ?is_hex(A), ?is_hex(B), ?is_hex(C), ?is_hex(D) ->
    case erlang:list_to_integer([A, B, C, D], 16) of
        Codepoint when Codepoint < 16#d800; Codepoint > 16#dfff ->
            string(Rest, Handler, acc_seq(Acc, Codepoint), Stack, Config);
        _ ->
            string(Rest, Handler, acc_seq(Acc, 16#fffd), Stack, Config)
    end;
unescape(_Bin, _Handler, _Acc, _Stack, _Config) ->
    erlang:error(badarg).


%% like in strings, there's some pseudo states in here that will never
%%  show up in errors or incompletes. some show up in value, some show
%%  up in integer, decimal or exp
negative(<<$0, Rest/binary>>, Handler, Acc, Stack, Config) ->
    zero(Rest, Handler, acc_seq(Acc, $0), Stack, Config);
negative(<<S, Rest/binary>>, Handler, Acc, Stack, Config) when ?is_nonzero(S) ->
    integer(Rest, Handler, acc_seq(Acc, S), Stack, Config);
negative(_Bin, _Handler, _Acc, _Stack, _Config) ->
    erlang:error(badarg).


zero(<<?decimalpoint, Rest/binary>>, Handler, Acc, Stack, Config) ->
    decimal(Rest, Handler, acc_seq(Acc, ?decimalpoint), Stack, Config);
zero(<<S, Rest/binary>>, Handler, Acc, Stack, Config) when S =:= $e; S =:= $E ->
    e(Rest, Handler, acc_seq(Acc, ".0e"), Stack, Config);
zero(Bin, Handler, Acc, Stack, Config) ->
    finish_number(Bin, Handler, {zero, Acc}, Stack, Config).


integer(<<S, Rest/binary>>, Handler, Acc, Stack, Config) when S =:= ?zero; ?is_nonzero(S) ->
    integer(Rest, Handler, acc_seq(Acc, S), Stack, Config);
integer(<<?decimalpoint, Rest/binary>>, Handler, Acc, Stack, Config) ->
    initialdecimal(Rest, Handler, acc_seq(Acc, ?decimalpoint), Stack, Config);
integer(<<S, Rest/binary>>, Handler, Acc, Stack, Config) when S =:= $e; S =:= $E ->
    e(Rest, Handler, acc_seq(Acc, ".0e"), Stack, Config);
integer(Bin, Handler, Acc, Stack, Config) ->
    finish_number(Bin, Handler, {integer, Acc}, Stack, Config).


initialdecimal(<<S, Rest/binary>>, Handler, Acc, Stack, Config) when S =:= ?zero; ?is_nonzero(S) ->
    decimal(Rest, Handler, acc_seq(Acc, S), Stack, Config);
initialdecimal(_Bin, _Handler, _Acc, _Stack, _Config) ->
    erlang:error(badarg).


decimal(<<S, Rest/binary>>, Handler, Acc, Stack, Config) when S =:= ?zero; ?is_nonzero(S) ->
    decimal(Rest, Handler, acc_seq(Acc, S), Stack, Config);
decimal(<<S, Rest/binary>>, Handler, Acc, Stack, Config) when S =:= $e; S =:= $E ->
    e(Rest, Handler, acc_seq(Acc, $e), Stack, Config);
decimal(Bin, Handler, Acc, Stack, Config) ->
    finish_number(Bin, Handler, {decimal, Acc}, Stack, Config).


e(<<S, Rest/binary>>, Handler, Acc, Stack, Config) when S =:= ?zero; ?is_nonzero(S) ->
    exp(Rest, Handler, acc_seq(Acc, S), Stack, Config);
e(<<Sign, Rest/binary>>, Handler, Acc, Stack, Config) when Sign =:= ?positive; Sign =:= ?negative ->
    ex(Rest, Handler, acc_seq(Acc, Sign), Stack, Config);
e(_Bin, _Handler, _Acc, _Stack, _Config) ->
    erlang:error(badarg).


ex(<<S, Rest/binary>>, Handler, Acc, Stack, Config) when S =:= ?zero; ?is_nonzero(S) ->
    exp(Rest, Handler, acc_seq(Acc, S), Stack, Config);
ex(_Bin, _Handler, _Acc, _Stack, _Config) ->
    erlang:error(badarg).


exp(<<S, Rest/binary>>, Handler, Acc, Stack, Config) when S =:= ?zero; ?is_nonzero(S) ->
    exp(Rest, Handler, acc_seq(Acc, S), Stack, Config);
exp(Bin, Handler, Acc, Stack, Config) ->
    finish_number(Bin, Handler, {exp, Acc}, Stack, Config).


finish_number(Rest, Handler, Acc, [], Config) ->
    maybe_done(Rest, handle_event(format_number(Acc), Handler, Config), [], Config);
finish_number(Rest, Handler, Acc, Stack, Config) ->
    maybe_done(Rest, handle_event(format_number(Acc), Handler, Config), Stack, Config).


format_number({zero, Acc}) -> {integer, list_to_integer(lists:reverse(Acc))};
format_number({integer, Acc}) -> {integer, list_to_integer(lists:reverse(Acc))};
format_number({decimal, Acc}) -> {float, list_to_float(lists:reverse(Acc))};
format_number({exp, Acc}) -> {float, list_to_float(lists:reverse(Acc))}.


true(<<$r, $u, $e, Rest/binary>>, Handler, Stack, Config) ->
    maybe_done(Rest, handle_event({literal, true}, Handler, Config), Stack, Config);
true(_Bin, _Handler, _Stack, _Config) ->
    erlang:error(badarg).


false(<<$a, $l, $s, $e, Rest/binary>>, Handler, Stack, Config) ->
    maybe_done(Rest, handle_event({literal, false}, Handler, Config), Stack, Config);
false(_Bin, _Handler, _Stack, _Config) ->
    erlang:error(badarg).


null(<<$u, $l, $l, Rest/binary>>, Handler, Stack, Config) ->
    maybe_done(Rest, handle_event({literal, null}, Handler, Config), Stack, Config);
null(_Bin, _Handler, _Stack, _Config) ->
    erlang:error(badarg).


maybe_done(<<Rest/binary>>, Handler, [], Config) ->
    done(Rest, handle_event(end_json, Handler, Config), [], Config);
maybe_done(<<?end_object, Rest/binary>>, Handler, [object|Stack], Config) ->
    maybe_done(Rest, handle_event(end_object, Handler, Config), Stack, Config);
maybe_done(<<?end_array, Rest/binary>>, Handler, [array|Stack], Config) ->
    maybe_done(Rest, handle_event(end_array, Handler, Config), Stack, Config);
maybe_done(<<?comma, Rest/binary>>, Handler, [object|Stack], Config) ->
    key(Rest, Handler, [key|Stack], Config);
maybe_done(<<?comma, Rest/binary>>, Handler, [array|_] = Stack, Config) ->
    value(Rest, Handler, Stack, Config);
maybe_done(<<S, Rest/binary>>, Handler, Stack, Config) when ?is_whitespace(S) ->
    maybe_done(Rest, Handler, Stack, Config);
maybe_done(_Bin, _Handler, _Stack, _Config) ->
    erlang:error(badarg).


done(<<S, Rest/binary>>, Handler, [], Config) when ?is_whitespace(S) ->
    done(Rest, Handler, [], Config);
done(<<>>, {_Handler, State}, [], _Config) -> State;
done(_Bin, _Handler, _Stack, _Config) -> erlang:error(badarg).
