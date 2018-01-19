open Thrift

module T = Transport

let c_0xff_32 = Int32.of_string "0xff"

(* Copied from OCamlnet rtypes.ml *)
let encode_frame_size x =
	let s = String.create 4 in
	let n3 = Int32.to_int (Int32.shift_right_logical x 24) land 0xff in
	let n2 = Int32.to_int (Int32.shift_right_logical x 16) land 0xff in
	let n1 = Int32.to_int (Int32.shift_right_logical x 8) land 0xff in
	let n0 = Int32.to_int (Int32.logand x c_0xff_32) in
		String.unsafe_set s 0 (Char.unsafe_chr n3);
		String.unsafe_set s 1 (Char.unsafe_chr n2);
		String.unsafe_set s 2 (Char.unsafe_chr n1);
		String.unsafe_set s 3 (Char.unsafe_chr n0);
		s
		
let decode_frame_size s = 
	let n3 = Int32.of_int (Char.code s.[0]) in
	let n2 = Int32.of_int (Char.code s.[1]) in
	let n1 = Int32.of_int (Char.code s.[2]) in
	let n0 = Int32.of_int (Char.code s.[3]) in
		Int32.logor
		(Int32.shift_left n3 24)
		(Int32.logor
			(Int32.shift_left n2 16)
			(Int32.logor
				(Int32.shift_left n1 8)
				n0))

class t ?(max_length=Sys.max_string_length) (transport: T.t) =
object (self)
	inherit T.t

	method isOpen = transport#isOpen
	method opn = transport#opn
	method close = transport#close
 
	val mutable read_buf = None
	val mutable read_buf_offset = 0
	val mutable write_buf = ""

	method private read_frame =
		let len_buf = String.create 4 in
		assert (transport#readAll len_buf 0 4 = 4); 
		
		let size = Int32.to_int (decode_frame_size len_buf) in
		
		(if size < 0
		then failwith (Printf.sprintf "Read a negative frame size (%i)!" size));
		
		(if size > max_length
		then failwith (Printf.sprintf "Frame size (%i) larger than max length (%i)!" size max_length));

		let buf = String.create size in
			assert (transport#readAll buf 0 size = size);
			read_buf <- Some buf;
			read_buf_offset <- 0

	method private read_from_frame frame buf off len =
		let to_copy = min len ((String.length frame) - read_buf_offset) in
			String.blit frame read_buf_offset buf off to_copy;
			read_buf_offset <- read_buf_offset + to_copy;
			to_copy

	method read buf off len = 
		match read_buf with
		| Some frame -> 
			let i = self#read_from_frame frame buf off len in
			if i > 0
			then i
			else begin
				self#read_frame; 
				self#read_from_frame frame buf off len
			end
		| None ->
				self#read_frame;
				self#read buf off len 
	 
	method write buf off len = 
		write_buf <- write_buf ^ (String.sub buf off len)

	method flush = 
		let encoded_size = encode_frame_size (Int32.of_int (String.length write_buf)) in
			transport#write encoded_size 0 (String.length encoded_size);
			transport#write write_buf 0 (String.length write_buf);
			transport#flush; 
			write_buf <- ""
end


