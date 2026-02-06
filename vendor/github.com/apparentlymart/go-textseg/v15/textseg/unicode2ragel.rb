#!/usr/bin/env ruby
#
# This scripted has been updated to accept more command-line arguments:
#
#    -u, --url                        URL to process
#    -m, --machine                    Machine name
#    -p, --properties                 Properties to add to the machine
#    -o, --output                     Write output to file
#
# Updated by: Marty Schoch <marty.schoch@gmail.com>
# 
# This script uses the unicode spec to generate a Ragel state machine
# that recognizes unicode alphanumeric characters.  It generates 5
# character classes: uupper, ulower, ualpha, udigit, and ualnum.
# Currently supported encodings are UTF-8 [default] and UCS-4.
#
# Usage: unicode2ragel.rb [options]
#    -e, --encoding [ucs4 | utf8]     Data encoding
#    -h, --help                       Show this message
#
# This script was originally written as part of the Ferret search
# engine library.
#
# Author: Rakan El-Khalil <rakan@well.com>

require 'optparse'
require 'open-uri'

ENCODINGS = [ :utf8, :ucs4 ]
ALPHTYPES = { :utf8 => "byte", :ucs4 => "rune" }
DEFAULT_CHART_URL = "http://www.unicode.org/Public/5.1.0/ucd/DerivedCoreProperties.txt"
DEFAULT_MACHINE_NAME= "WChar"

###
# Display vars & default option

TOTAL_WIDTH = 80
RANGE_WIDTH = 23
@encoding = :utf8
@chart_url = DEFAULT_CHART_URL
machine_name = DEFAULT_MACHINE_NAME
properties = []
@output = $stdout

###
# Option parsing

cli_opts = OptionParser.new do |opts|
  opts.on("-e", "--encoding [ucs4 | utf8]", "Data encoding") do |o|
    @encoding = o.downcase.to_sym
  end
  opts.on("-h", "--help", "Show this message") do
    puts opts
    exit
  end
  opts.on("-u", "--url URL", "URL to process") do |o|
    @chart_url = o 
  end
  opts.on("-m", "--machine MACHINE_NAME", "Machine name") do |o|
    machine_name = o
  end
  opts.on("-p", "--properties x,y,z", Array, "Properties to add to machine") do |o|
    properties = o
  end
  opts.on("-o", "--output FILE", "output file") do |o|
    @output = File.new(o, "w+")
  end
end

cli_opts.parse(ARGV)
unless ENCODINGS.member? @encoding
  puts "Invalid encoding: #{@encoding}"
  puts cli_opts
  exit
end

##
# Downloads the document at url and yields every alpha line's hex
# range and description.

def each_alpha( url, property ) 
  URI.open( url ) do |file|
    file.each_line do |line|
      next if line =~ /^#/;
      next if line !~ /; #{property} *#/;

      range, description = line.split(/;/)
      range.strip!
      description.gsub!(/.*#/, '').strip!

      if range =~ /\.\./
           start, stop = range.split '..'
      else start = stop = range
      end

      yield start.hex .. stop.hex, description
    end
  end
end

###
# Formats to hex at minimum width

def to_hex( n )
  r = "%0X" % n
  r = "0#{r}" unless (r.length % 2).zero?
  r
end

###
# UCS4 is just a straight hex conversion of the unicode codepoint.

def to_ucs4( range )
  rangestr  =   "0x" + to_hex(range.begin)
  rangestr << "..0x" + to_hex(range.end) if range.begin != range.end
  [ rangestr ]
end

##
# 0x00     - 0x7f     -> 0zzzzzzz[7]
# 0x80     - 0x7ff    -> 110yyyyy[5] 10zzzzzz[6]
# 0x800    - 0xffff   -> 1110xxxx[4] 10yyyyyy[6] 10zzzzzz[6]
# 0x010000 - 0x10ffff -> 11110www[3] 10xxxxxx[6] 10yyyyyy[6] 10zzzzzz[6] 

UTF8_BOUNDARIES = [0x7f, 0x7ff, 0xffff, 0x10ffff]

def to_utf8_enc( n )
  r = 0
  if n <= 0x7f
    r = n
  elsif n <= 0x7ff
    y = 0xc0 | (n >> 6)
    z = 0x80 | (n & 0x3f)
    r = y << 8 | z
  elsif n <= 0xffff
    x = 0xe0 | (n >> 12)
    y = 0x80 | (n >>  6) & 0x3f
    z = 0x80 |  n        & 0x3f
    r = x << 16 | y << 8 | z
  elsif n <= 0x10ffff
    w = 0xf0 | (n >> 18)
    x = 0x80 | (n >> 12) & 0x3f
    y = 0x80 | (n >>  6) & 0x3f
    z = 0x80 |  n        & 0x3f
    r = w << 24 | x << 16 | y << 8 | z
  end

  to_hex(r)
end

def from_utf8_enc( n )
  n = n.hex
  r = 0
  if n <= 0x7f
    r = n
  elsif n <= 0xdfff
    y = (n >> 8) & 0x1f
    z =  n       & 0x3f
    r = y << 6 | z
  elsif n <= 0xefffff
    x = (n >> 16) & 0x0f
    y = (n >>  8) & 0x3f
    z =  n        & 0x3f
    r = x << 10 | y << 6 | z
  elsif n <= 0xf7ffffff
    w = (n >> 24) & 0x07
    x = (n >> 16) & 0x3f
    y = (n >>  8) & 0x3f
    z =  n        & 0x3f
    r = w << 18 | x << 12 | y << 6 | z
  end
  r
end

###
# Given a range, splits it up into ranges that can be continuously
# encoded into utf8.  Eg: 0x00 .. 0xff => [0x00..0x7f, 0x80..0xff]
# This is not strictly needed since the current [5.1] unicode standard
# doesn't have ranges that straddle utf8 boundaries.  This is included
# for completeness as there is no telling if that will ever change.

def utf8_ranges( range )
  ranges = []
  UTF8_BOUNDARIES.each do |max|
    if range.begin <= max
      if range.end <= max
        ranges << range
        return ranges
      end

      ranges << (range.begin .. max)
      range = (max + 1) .. range.end
    end
  end
  ranges
end

def build_range( start, stop )
  size = start.size/2
  left = size - 1
  return [""] if size < 1

  a = start[0..1]
  b = stop[0..1]

  ###
  # Shared prefix

  if a == b
    return build_range(start[2..-1], stop[2..-1]).map do |elt|
      "0x#{a} " + elt
    end
  end

  ###
  # Unshared prefix, end of run

  return ["0x#{a}..0x#{b} "] if left.zero?
  
  ###
  # Unshared prefix, not end of run
  # Range can be 0x123456..0x56789A
  # Which is equivalent to:
  #     0x123456 .. 0x12FFFF
  #     0x130000 .. 0x55FFFF
  #     0x560000 .. 0x56789A

  ret = []
  ret << build_range(start, a + "FF" * left)

  ###
  # Only generate middle range if need be.

  if a.hex+1 != b.hex
    max = to_hex(b.hex - 1)
    max = "FF" if b == "FF"
    ret << "0x#{to_hex(a.hex+1)}..0x#{max} " + "0x00..0xFF " * left
  end

  ###
  # Don't generate last range if it is covered by first range
  
  ret << build_range(b + "00" * left, stop) unless b == "FF"
  ret.flatten!
end

def to_utf8( range )
  utf8_ranges( range ).map do |r|   
    begin_enc = to_utf8_enc(r.begin)
    end_enc = to_utf8_enc(r.end)
    build_range begin_enc, end_enc
  end.flatten!
end

##
# Perform a 3-way comparison of the number of codepoints advertised by
# the unicode spec for the given range, the originally parsed range,
# and the resulting utf8 encoded range.

def count_codepoints( code )
  code.split(' ').inject(1) do |acc, elt|
    if elt =~ /0x(.+)\.\.0x(.+)/
      if @encoding == :utf8
        acc * (from_utf8_enc($2) - from_utf8_enc($1) + 1)
      else
        acc * ($2.hex - $1.hex + 1)
      end
    else
      acc
    end
  end
end

def is_valid?( range, desc, codes )
  spec_count  = 1
  spec_count  = $1.to_i if desc =~ /\[(\d+)\]/
  range_count = range.end - range.begin + 1

  sum = codes.inject(0) { |acc, elt| acc + count_codepoints(elt) }
  sum == spec_count and sum == range_count
end

##
# Generate the state maching to stdout

def generate_machine( name, property )
  pipe = " "
  @output.puts "    #{name} = "
  each_alpha( @chart_url, property ) do |range, desc|

    codes = (@encoding == :ucs4) ? to_ucs4(range) : to_utf8(range)

    #raise "Invalid encoding of range #{range}: #{codes.inspect}" unless 
    #  is_valid? range, desc, codes

    range_width = codes.map { |a| a.size }.max
    range_width = RANGE_WIDTH if range_width < RANGE_WIDTH

    desc_width  = TOTAL_WIDTH - RANGE_WIDTH - 11
    desc_width -= (range_width - RANGE_WIDTH) if range_width > RANGE_WIDTH

    if desc.size > desc_width
      desc = desc[0..desc_width - 4] + "..."
    end

    codes.each_with_index do |r, idx|
      desc = "" unless idx.zero?
      code = "%-#{range_width}s" % r
      @output.puts "      #{pipe} #{code} ##{desc}"
      pipe = "|"
    end
  end
  @output.puts "      ;"
  @output.puts ""
end

@output.puts <<EOF
# The following Ragel file was autogenerated with #{$0} 
# from: #{@chart_url}
#
# It defines #{properties}.
#
# To use this, make sure that your alphtype is set to #{ALPHTYPES[@encoding]},
# and that your input is in #{@encoding}.

%%{
    machine #{machine_name};
    
EOF

properties.each { |x| generate_machine( x, x ) }

@output.puts <<EOF
}%%
EOF
