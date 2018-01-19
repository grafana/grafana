/*
 * Copyright 2009-2010 Cybozu Labs, Inc.
 * Copyright 2011 Kazuho Oku
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 * 
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 * 
 * THIS SOFTWARE IS PROVIDED BY CYBOZU LABS, INC. ``AS IS'' AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
 * EVENT SHALL CYBOZU LABS, INC. OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * 
 * The views and conclusions contained in the software and documentation are
 * those of the authors and should not be interpreted as representing official
 * policies, either expressed or implied, of Cybozu Labs, Inc.
 *
 */
#ifndef picojson_h
#define picojson_h

#include <algorithm>
#include <cassert>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <iterator>
#include <map>
#include <string>
#include <vector>

#ifdef _MSC_VER
    #define SNPRINTF _snprintf_s
    #pragma warning(push)
    #pragma warning(disable : 4244) // conversion from int to char
#else
    #define SNPRINTF snprintf
#endif

namespace picojson {
  
  enum {
    null_type,
    boolean_type,
    number_type,
    string_type,
    array_type,
    object_type
  };
  
  struct null {};
  
  class value {
  public:
    typedef std::vector<value> array;
    typedef std::map<std::string, value> object;
    union _storage {
      bool boolean_;
      double number_;
      std::string* string_;
      array* array_;
      object* object_;
    };
  protected:
    int type_;
    _storage u_;
  public:
    value();
    value(int type, bool);
    explicit value(bool b);
    explicit value(double n);
    explicit value(const std::string& s);
    explicit value(const array& a);
    explicit value(const object& o);
    explicit value(const char* s);
    value(const char* s, size_t len);
    ~value();
    value(const value& x);
    value& operator=(const value& x);
    void swap(value& x);
    template <typename T> bool is() const;
    template <typename T> const T& get() const;
    template <typename T> T& get();
    bool evaluate_as_boolean() const;
    const value& get(size_t idx) const;
    const value& get(const std::string& key) const;
    bool contains(size_t idx) const;
    bool contains(const std::string& key) const;
    std::string to_str() const;
    template <typename Iter> void serialize(Iter os) const;
    std::string serialize() const;
  private:
    template <typename T> value(const T*); // intentionally defined to block implicit conversion of pointer to bool
  };
  
  typedef value::array array;
  typedef value::object object;
  
  inline value::value() : type_(null_type) {}
  
  inline value::value(int type, bool) : type_(type) {
    switch (type) {
#define INIT(p, v) case p##type: u_.p = v; break
      INIT(boolean_, false);
      INIT(number_, 0.0);
      INIT(string_, new std::string());
      INIT(array_, new array());
      INIT(object_, new object());
#undef INIT
    default: break;
    }
  }
  
  inline value::value(bool b) : type_(boolean_type) {
    u_.boolean_ = b;
  }
  
  inline value::value(double n) : type_(number_type) {
    u_.number_ = n;
  }
  
  inline value::value(const std::string& s) : type_(string_type) {
    u_.string_ = new std::string(s);
  }
  
  inline value::value(const array& a) : type_(array_type) {
    u_.array_ = new array(a);
  }
  
  inline value::value(const object& o) : type_(object_type) {
    u_.object_ = new object(o);
  }
  
  inline value::value(const char* s) : type_(string_type) {
    u_.string_ = new std::string(s);
  }
  
  inline value::value(const char* s, size_t len) : type_(string_type) {
    u_.string_ = new std::string(s, len);
  }
  
  inline value::~value() {
    switch (type_) {
#define DEINIT(p) case p##type: delete u_.p; break
      DEINIT(string_);
      DEINIT(array_);
      DEINIT(object_);
#undef DEINIT
    default: break;
    }
  }
  
  inline value::value(const value& x) : type_(x.type_) {
    switch (type_) {
#define INIT(p, v) case p##type: u_.p = v; break
      INIT(string_, new std::string(*x.u_.string_));
      INIT(array_, new array(*x.u_.array_));
      INIT(object_, new object(*x.u_.object_));
#undef INIT
    default:
      u_ = x.u_;
      break;
    }
  }
  
  inline value& value::operator=(const value& x) {
    if (this != &x) {
      this->~value();
      new (this) value(x);
    }
    return *this;
  }
  
  inline void value::swap(value& x) {
    std::swap(type_, x.type_);
    std::swap(u_, x.u_);
  }
  
#define IS(ctype, jtype)			     \
  template <> inline bool value::is<ctype>() const { \
    return type_ == jtype##_type;		     \
  }
  IS(null, null)
  IS(bool, boolean)
  IS(int, number)
  IS(double, number)
  IS(std::string, string)
  IS(array, array)
  IS(object, object)
#undef IS
  
#define GET(ctype, var)						\
  template <> inline const ctype& value::get<ctype>() const {	\
    assert("type mismatch! call vis<type>() before get<type>()" \
	   && is<ctype>());				        \
    return var;							\
  }								\
  template <> inline ctype& value::get<ctype>() {		\
    assert("type mismatch! call is<type>() before get<type>()"	\
	   && is<ctype>());					\
    return var;							\
  }
  GET(bool, u_.boolean_)
  GET(double, u_.number_)
  GET(std::string, *u_.string_)
  GET(array, *u_.array_)
  GET(object, *u_.object_)
#undef GET
  
  inline bool value::evaluate_as_boolean() const {
    switch (type_) {
    case null_type:
      return false;
    case boolean_type:
      return u_.boolean_;
    case number_type:
      return u_.number_ != 0;
    case string_type:
      return ! u_.string_->empty();
    default:
      return true;
    }
  }
  
  inline const value& value::get(size_t idx) const {
    static value s_null;
    assert(is<array>());
    return idx < u_.array_->size() ? (*u_.array_)[idx] : s_null;
  }

  inline const value& value::get(const std::string& key) const {
    static value s_null;
    assert(is<object>());
    object::const_iterator i = u_.object_->find(key);
    return i != u_.object_->end() ? i->second : s_null;
  }

  inline bool value::contains(size_t idx) const {
    assert(is<array>());
    return idx < u_.array_->size();
  }

  inline bool value::contains(const std::string& key) const {
    assert(is<object>());
    object::const_iterator i = u_.object_->find(key);
    return i != u_.object_->end();
  }
  
  inline std::string value::to_str() const {
    switch (type_) {
    case null_type:      return "null";
    case boolean_type:   return u_.boolean_ ? "true" : "false";
    case number_type:    {
      char buf[256];
      double tmp;
      SNPRINTF(buf, sizeof(buf), fabs(u_.number_) < (1ULL << 53) && modf(u_.number_, &tmp) == 0 ? "%.f" : "%.17g", u_.number_);
      return buf;
    }
    case string_type:    return *u_.string_;
    case array_type:     return "array";
    case object_type:    return "object";
    default:             assert(0);
#ifdef _MSC_VER
      __assume(0);
#endif
    }
    return std::string();
  }
  
  template <typename Iter> void copy(const std::string& s, Iter oi) {
    std::copy(s.begin(), s.end(), oi);
  }
  
  template <typename Iter> void serialize_str(const std::string& s, Iter oi) {
    *oi++ = '"';
    for (std::string::const_iterator i = s.begin(); i != s.end(); ++i) {
      switch (*i) {
#define MAP(val, sym) case val: copy(sym, oi); break
	MAP('"', "\\\"");
	MAP('\\', "\\\\");
	MAP('/', "\\/");
	MAP('\b', "\\b");
	MAP('\f', "\\f");
	MAP('\n', "\\n");
	MAP('\r', "\\r");
	MAP('\t', "\\t");
#undef MAP
      default:
	if ((unsigned char)*i < 0x20 || *i == 0x7f) {
	  char buf[7];
	  SNPRINTF(buf, sizeof(buf), "\\u%04x", *i & 0xff);
	  copy(buf, buf + 6, oi);
	  } else {
	  *oi++ = *i;
	}
	break;
      }
    }
    *oi++ = '"';
  }
  
  template <typename Iter> void value::serialize(Iter oi) const {
    switch (type_) {
    case string_type:
      serialize_str(*u_.string_, oi);
      break;
    case array_type: {
      *oi++ = '[';
      for (array::const_iterator i = u_.array_->begin();
           i != u_.array_->end();
           ++i) {
	if (i != u_.array_->begin()) {
	  *oi++ = ',';
	}
	i->serialize(oi);
      }
      *oi++ = ']';
      break;
    }
    case object_type: {
      *oi++ = '{';
      for (object::const_iterator i = u_.object_->begin();
	   i != u_.object_->end();
	   ++i) {
	if (i != u_.object_->begin()) {
	  *oi++ = ',';
	}
	serialize_str(i->first, oi);
	*oi++ = ':';
	i->second.serialize(oi);
      }
      *oi++ = '}';
      break;
    }
    default:
      copy(to_str(), oi);
      break;
    }
  }
  
  inline std::string value::serialize() const {
    std::string s;
    serialize(std::back_inserter(s));
    return s;
  }
  
  template <typename Iter> class input {
  protected:
    Iter cur_, end_;
    int last_ch_;
    bool ungot_;
    int line_;
  public:
    input(const Iter& first, const Iter& last) : cur_(first), end_(last), last_ch_(-1), ungot_(false), line_(1) {}
    int getc() {
      if (ungot_) {
	ungot_ = false;
	return last_ch_;
      }
      if (cur_ == end_) {
	last_ch_ = -1;
	return -1;
      }
      if (last_ch_ == '\n') {
	line_++;
      }
      last_ch_ = *cur_++ & 0xff;
      return last_ch_;
    }
    void ungetc() {
      if (last_ch_ != -1) {
	assert(! ungot_);
	ungot_ = true;
      }
    }
    Iter cur() const { return cur_; }
    int line() const { return line_; }
    void skip_ws() {
      while (1) {
	int ch = getc();
	if (! (ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r')) {
	  ungetc();
	  break;
	}
      }
    }
    bool expect(int expect) {
      skip_ws();
      if (getc() != expect) {
	ungetc();
	return false;
      }
      return true;
    }
    bool match(const std::string& pattern) {
      for (std::string::const_iterator pi(pattern.begin());
	   pi != pattern.end();
	   ++pi) {
	if (getc() != *pi) {
	  ungetc();
	  return false;
	}
      }
      return true;
    }
  };
  
  template<typename Iter> inline int _parse_quadhex(input<Iter> &in) {
    int uni_ch = 0, hex;
    for (int i = 0; i < 4; i++) {
      if ((hex = in.getc()) == -1) {
	return -1;
      }
      if ('0' <= hex && hex <= '9') {
	hex -= '0';
      } else if ('A' <= hex && hex <= 'F') {
	hex -= 'A' - 0xa;
      } else if ('a' <= hex && hex <= 'f') {
	hex -= 'a' - 0xa;
      } else {
	in.ungetc();
	return -1;
      }
      uni_ch = uni_ch * 16 + hex;
    }
    return uni_ch;
  }
  
  template<typename String, typename Iter> inline bool _parse_codepoint(String& out, input<Iter>& in) {
    int uni_ch;
    if ((uni_ch = _parse_quadhex(in)) == -1) {
      return false;
    }
    if (0xd800 <= uni_ch && uni_ch <= 0xdfff) {
      if (0xdc00 <= uni_ch) {
	// a second 16-bit of a surrogate pair appeared
	return false;
      }
      // first 16-bit of surrogate pair, get the next one
      if (in.getc() != '\\' || in.getc() != 'u') {
	in.ungetc();
	return false;
      }
      int second = _parse_quadhex(in);
      if (! (0xdc00 <= second && second <= 0xdfff)) {
	return false;
      }
      uni_ch = ((uni_ch - 0xd800) << 10) | ((second - 0xdc00) & 0x3ff);
      uni_ch += 0x10000;
    }
    if (uni_ch < 0x80) {
      out.push_back(uni_ch);
    } else {
      if (uni_ch < 0x800) {
	out.push_back(0xc0 | (uni_ch >> 6));
      } else {
	if (uni_ch < 0x10000) {
	  out.push_back(0xe0 | (uni_ch >> 12));
	} else {
	  out.push_back(0xf0 | (uni_ch >> 18));
	  out.push_back(0x80 | ((uni_ch >> 12) & 0x3f));
	}
	out.push_back(0x80 | ((uni_ch >> 6) & 0x3f));
      }
      out.push_back(0x80 | (uni_ch & 0x3f));
    }
    return true;
  }
  
  template<typename String, typename Iter> inline bool _parse_string(String& out, input<Iter>& in) {
    while (1) {
      int ch = in.getc();
      if (ch < ' ') {
	in.ungetc();
	return false;
      } else if (ch == '"') {
	return true;
      } else if (ch == '\\') {
	if ((ch = in.getc()) == -1) {
	  return false;
	}
	switch (ch) {
#define MAP(sym, val) case sym: out.push_back(val); break
	  MAP('"', '\"');
	  MAP('\\', '\\');
	  MAP('/', '/');
	  MAP('b', '\b');
	  MAP('f', '\f');
	  MAP('n', '\n');
	  MAP('r', '\r');
	  MAP('t', '\t');
#undef MAP
	case 'u':
	  if (! _parse_codepoint(out, in)) {
	    return false;
	  }
	  break;
	default:
	  return false;
	}
      } else {
	out.push_back(ch);
      }
    }
    return false;
  }
  
  template <typename Context, typename Iter> inline bool _parse_array(Context& ctx, input<Iter>& in) {
    if (! ctx.parse_array_start()) {
      return false;
    }
    size_t idx = 0;
    if (in.expect(']')) {
      return ctx.parse_array_stop(idx);
    }
    do {
      if (! ctx.parse_array_item(in, idx)) {
	return false;
      }
      idx++;
    } while (in.expect(','));
    return in.expect(']') && ctx.parse_array_stop(idx);
  }
  
  template <typename Context, typename Iter> inline bool _parse_object(Context& ctx, input<Iter>& in) {
    if (! ctx.parse_object_start()) {
      return false;
    }
    if (in.expect('}')) {
      return true;
    }
    do {
      std::string key;
      if (! in.expect('"')
	  || ! _parse_string(key, in)
	  || ! in.expect(':')) {
	return false;
      }
      if (! ctx.parse_object_item(in, key)) {
	return false;
      }
    } while (in.expect(','));
    return in.expect('}');
  }
  
  template <typename Iter> inline bool _parse_number(double& out, input<Iter>& in) {
    std::string num_str;
    while (1) {
      int ch = in.getc();
      if (('0' <= ch && ch <= '9') || ch == '+' || ch == '-' || ch == '.'
	  || ch == 'e' || ch == 'E') {
	num_str.push_back(ch);
      } else {
	in.ungetc();
	break;
      }
    }
    char* endp;
    out = strtod(num_str.c_str(), &endp);
    return endp == num_str.c_str() + num_str.size();
  }
  
  template <typename Context, typename Iter> inline bool _parse(Context& ctx, input<Iter>& in) {
    in.skip_ws();
    int ch = in.getc();
    switch (ch) {
#define IS(ch, text, op) case ch: \
      if (in.match(text) && op) { \
	return true; \
      } else { \
	return false; \
      }
      IS('n', "ull", ctx.set_null());
      IS('f', "alse", ctx.set_bool(false));
      IS('t', "rue", ctx.set_bool(true));
#undef IS
    case '"':
      return ctx.parse_string(in);
    case '[':
      return _parse_array(ctx, in);
    case '{':
      return _parse_object(ctx, in);
    default:
      if (('0' <= ch && ch <= '9') || ch == '-') {
	in.ungetc();
	double f;
	if (_parse_number(f, in)) {
	  ctx.set_number(f);
	  return true;
	} else {
	  return false;
	}
      }
      break;
    }
    in.ungetc();
    return false;
  }
  
  class deny_parse_context {
  public:
    bool set_null() { return false; }
    bool set_bool(bool) { return false; }
    bool set_number(double) { return false; }
    template <typename Iter> bool parse_string(input<Iter>&) { return false; }
    bool parse_array_start() { return false; }
    template <typename Iter> bool parse_array_item(input<Iter>&, size_t) {
      return false;
    }
    bool parse_array_stop(size_t) { return false; }
    bool parse_object_start() { return false; }
    template <typename Iter> bool parse_object_item(input<Iter>&, const std::string&) {
      return false;
    }
  };
  
  class default_parse_context {
  protected:
    value* out_;
  public:
    default_parse_context(value* out) : out_(out) {}
    bool set_null() {
      *out_ = value();
      return true;
    }
    bool set_bool(bool b) {
      *out_ = value(b);
      return true;
    }
    bool set_number(double f) {
      *out_ = value(f);
      return true;
    }
    template<typename Iter> bool parse_string(input<Iter>& in) {
      *out_ = value(string_type, false);
      return _parse_string(out_->get<std::string>(), in);
    }
    bool parse_array_start() {
      *out_ = value(array_type, false);
      return true;
    }
    template <typename Iter> bool parse_array_item(input<Iter>& in, size_t) {
      array& a = out_->get<array>();
      a.push_back(value());
      default_parse_context ctx(&a.back());
      return _parse(ctx, in);
    }
    bool parse_array_stop(size_t) { return true; }
    bool parse_object_start() {
      *out_ = value(object_type, false);
      return true;
    }
    template <typename Iter> bool parse_object_item(input<Iter>& in, const std::string& key) {
      object& o = out_->get<object>();
      default_parse_context ctx(&o[key]);
      return _parse(ctx, in);
    }
  private:
    default_parse_context(const default_parse_context&);
    default_parse_context& operator=(const default_parse_context&);
  };

  class null_parse_context {
  public:
    struct dummy_str {
      void push_back(int) {}
    };
  public:
    null_parse_context() {}
    bool set_null() { return true; }
    bool set_bool(bool) { return true; }
    bool set_number(double) { return true; }
    template <typename Iter> bool parse_string(input<Iter>& in) {
      dummy_str s;
      return _parse_string(s, in);
    }
    bool parse_array_start() { return true; }
    template <typename Iter> bool parse_array_item(input<Iter>& in, size_t) {
      return _parse(*this, in);
    }
    bool parse_array_stop(size_t) { return true; }
    bool parse_object_start() { return true; }
    template <typename Iter> bool parse_object_item(input<Iter>& in, const std::string&) {
      return _parse(*this, in);
    }
  private:
    null_parse_context(const null_parse_context&);
    null_parse_context& operator=(const null_parse_context&);
  };
  
  // obsolete, use the version below
  template <typename Iter> inline std::string parse(value& out, Iter& pos, const Iter& last) {
    std::string err;
    pos = parse(out, pos, last, &err);
    return err;
  }
  
  template <typename Context, typename Iter> inline Iter _parse(Context& ctx, const Iter& first, const Iter& last, std::string* err) {
    input<Iter> in(first, last);
    if (! _parse(ctx, in) && err != NULL) {
      char buf[64];
      SNPRINTF(buf, sizeof(buf), "syntax error at line %d near: ", in.line());
      *err = buf;
      while (1) {
	int ch = in.getc();
	if (ch == -1 || ch == '\n') {
	  break;
	} else if (ch >= ' ') {
	  err->push_back(ch);
	}
      }
    }
    return in.cur();
  }
  
  template <typename Iter> inline Iter parse(value& out, const Iter& first, const Iter& last, std::string* err) {
    default_parse_context ctx(&out);
    return _parse(ctx, first, last, err);
  }
  
  inline std::string parse(value& out, std::istream& is) {
    std::string err;
    parse(out, std::istreambuf_iterator<char>(is.rdbuf()),
	  std::istreambuf_iterator<char>(), &err);
    return err;
  }
  
  template <typename T> struct last_error_t {
    static std::string s;
  };
  template <typename T> std::string last_error_t<T>::s;
  
  inline void set_last_error(const std::string& s) {
    last_error_t<bool>::s = s;
  }
  
  inline const std::string& get_last_error() {
    return last_error_t<bool>::s;
  }

  inline bool operator==(const value& x, const value& y) {
    if (x.is<null>())
      return y.is<null>();
#define PICOJSON_CMP(type)					\
    if (x.is<type>())						\
      return y.is<type>() && x.get<type>() == y.get<type>()
    PICOJSON_CMP(bool);
    PICOJSON_CMP(double);
    PICOJSON_CMP(std::string);
    PICOJSON_CMP(array);
    PICOJSON_CMP(object);
#undef PICOJSON_CMP
    assert(0);
#ifdef _MSC_VER
    __assume(0);
#endif
    return false;
  }
  
  inline bool operator!=(const value& x, const value& y) {
    return ! (x == y);
  }
}

namespace std {
  template<> inline void swap(picojson::value& x, picojson::value& y)
    {
      x.swap(y);
    }
}

inline std::istream& operator>>(std::istream& is, picojson::value& x)
{
  picojson::set_last_error(std::string());
  std::string err = picojson::parse(x, is);
  if (! err.empty()) {
    picojson::set_last_error(err);
    is.setstate(std::ios::failbit);
  }
  return is;
}

inline std::ostream& operator<<(std::ostream& os, const picojson::value& x)
{
  x.serialize(std::ostream_iterator<char>(os));
  return os;
}
#ifdef _MSC_VER
    #pragma warning(pop)
#endif

#endif
#ifdef TEST_PICOJSON
#ifdef _MSC_VER
    #pragma warning(disable : 4127) // conditional expression is constant
#endif

using namespace std;
  
static void plan(int num)
{
  printf("1..%d\n", num);
}

static bool success = true;

static void ok(bool b, const char* name = "")
{
  static int n = 1;
  if (! b)
    success = false;
  printf("%s %d - %s\n", b ? "ok" : "ng", n++, name);
}

template <typename T> void is(const T& x, const T& y, const char* name = "")
{
  if (x == y) {
    ok(true, name);
  } else {
    ok(false, name);
  }
}

#include <algorithm>
#include <sstream>
#include <float.h>
#include <limits.h>

int main(void)
{
  plan(85);

  // constructors
#define TEST(expr, expected) \
    is(picojson::value expr .serialize(), string(expected), "picojson::value" #expr)
  
  TEST( (true),  "true");
  TEST( (false), "false");
  TEST( (42.0),   "42");
  TEST( (string("hello")), "\"hello\"");
  TEST( ("hello"), "\"hello\"");
  TEST( ("hello", 4), "\"hell\"");

  {
    double a = 1;
    for (int i = 0; i < 1024; i++) {
      picojson::value vi(a);
      std::stringstream ss;
      ss << vi;
      picojson::value vo;
      ss >> vo;
      double b = vo.get<double>();
      if ((i < 53 && a != b) || fabs(a - b) / b > 1e-8) {
        printf("ng i=%d a=%.18e b=%.18e\n", i, a, b);
      }
      a *= 2;
    }
  }
  
#undef TEST
  
#define TEST(in, type, cmp, serialize_test) {				\
    picojson::value v;							\
    const char* s = in;							\
    string err = picojson::parse(v, s, s + strlen(s));			\
    ok(err.empty(), in " no error");					\
    ok(v.is<type>(), in " check type");					\
    is<type>(v.get<type>(), cmp, in " correct output");			\
    is(*s, '\0', in " read to eof");					\
    if (serialize_test) {						\
      is(v.serialize(), string(in), in " serialize");			\
    }									\
  }
  TEST("false", bool, false, true);
  TEST("true", bool, true, true);
  TEST("90.5", double, 90.5, false);
  TEST("1.7976931348623157e+308", double, DBL_MAX, false);
  TEST("\"hello\"", string, string("hello"), true);
  TEST("\"\\\"\\\\\\/\\b\\f\\n\\r\\t\"", string, string("\"\\/\b\f\n\r\t"),
       true);
  TEST("\"\\u0061\\u30af\\u30ea\\u30b9\"", string,
       string("a\xe3\x82\xaf\xe3\x83\xaa\xe3\x82\xb9"), false);
  TEST("\"\\ud840\\udc0b\"", string, string("\xf0\xa0\x80\x8b"), false);
#undef TEST

#define TEST(type, expr) {					       \
    picojson::value v;						       \
    const char *s = expr;					       \
    string err = picojson::parse(v, s, s + strlen(s));		       \
    ok(err.empty(), "empty " #type " no error");		       \
    ok(v.is<picojson::type>(), "empty " #type " check type");	       \
    ok(v.get<picojson::type>().empty(), "check " #type " array size"); \
  }
  TEST(array, "[]");
  TEST(object, "{}");
#undef TEST
  
  {
    picojson::value v;
    const char *s = "[1,true,\"hello\"]";
    string err = picojson::parse(v, s, s + strlen(s));
    ok(err.empty(), "array no error");
    ok(v.is<picojson::array>(), "array check type");
    is(v.get<picojson::array>().size(), size_t(3), "check array size");
    ok(v.contains(0), "check contains array[0]");
    ok(v.get(0).is<double>(), "check array[0] type");
    is(v.get(0).get<double>(), 1.0, "check array[0] value");
    ok(v.contains(1), "check contains array[1]");
    ok(v.get(1).is<bool>(), "check array[1] type");
    ok(v.get(1).get<bool>(), "check array[1] value");
    ok(v.contains(2), "check contains array[2]");
    ok(v.get(2).is<string>(), "check array[2] type");
    is(v.get(2).get<string>(), string("hello"), "check array[2] value");
    ok(!v.contains(3), "check not contains array[3]");
  }
  
  {
    picojson::value v;
    const char *s = "{ \"a\": true }";
    string err = picojson::parse(v, s, s + strlen(s));
    ok(err.empty(), "object no error");
    ok(v.is<picojson::object>(), "object check type");
    is(v.get<picojson::object>().size(), size_t(1), "check object size");
    ok(v.contains("a"), "check contains property");
    ok(v.get("a").is<bool>(), "check bool property exists");
    is(v.get("a").get<bool>(), true, "check bool property value");
    is(v.serialize(), string("{\"a\":true}"), "serialize object");
    ok(!v.contains("z"), "check not contains property");
  }

#define TEST(json, msg) do {				\
    picojson::value v;					\
    const char *s = json;				\
    string err = picojson::parse(v, s, s + strlen(s));	\
    is(err, string("syntax error at line " msg), msg);	\
  } while (0)
  TEST("falsoa", "1 near: oa");
  TEST("{]", "1 near: ]");
  TEST("\n\bbell", "2 near: bell");
  TEST("\"abc\nd\"", "1 near: ");
#undef TEST
  
  {
    picojson::value v1, v2;
    const char *s;
    string err;
    s = "{ \"b\": true, \"a\": [1,2,\"three\"], \"d\": 2 }";
    err = picojson::parse(v1, s, s + strlen(s));
    s = "{ \"d\": 2.0, \"b\": true, \"a\": [1,2,\"three\"] }";
    err = picojson::parse(v2, s, s + strlen(s));
    ok((v1 == v2), "check == operator in deep comparison");
  }

  {
    picojson::value v1, v2;
    const char *s;
    string err;
    s = "{ \"b\": true, \"a\": [1,2,\"three\"], \"d\": 2 }";
    err = picojson::parse(v1, s, s + strlen(s));
    s = "{ \"d\": 2.0, \"a\": [1,\"three\"], \"b\": true }";
    err = picojson::parse(v2, s, s + strlen(s));
    ok((v1 != v2), "check != operator for array in deep comparison");
  }

  {
    picojson::value v1, v2;
    const char *s;
    string err;
    s = "{ \"b\": true, \"a\": [1,2,\"three\"], \"d\": 2 }";
    err = picojson::parse(v1, s, s + strlen(s));
    s = "{ \"d\": 2.0, \"a\": [1,2,\"three\"], \"b\": false }";
    err = picojson::parse(v2, s, s + strlen(s));
    ok((v1 != v2), "check != operator for object in deep comparison");
  }

  {
    picojson::value v1, v2;
    const char *s;
    string err;
    s = "{ \"b\": true, \"a\": [1,2,\"three\"], \"d\": 2 }";
    err = picojson::parse(v1, s, s + strlen(s));
    picojson::object& o = v1.get<picojson::object>();
    o.erase("b");
    picojson::array& a = o["a"].get<picojson::array>();
    picojson::array::iterator i;
    i = std::remove(a.begin(), a.end(), picojson::value(std::string("three")));
    a.erase(i, a.end());
    s = "{ \"a\": [1,2], \"d\": 2 }";
    err = picojson::parse(v2, s, s + strlen(s));
    ok((v1 == v2), "check erase()");
  }

  ok(picojson::value(3.0).serialize() == "3",
     "integral number should be serialized as a integer");
  
  {
    const char* s = "{ \"a\": [1,2], \"d\": 2 }";
    picojson::null_parse_context ctx;
    string err;
    picojson::_parse(ctx, s, s + strlen(s), &err);
    ok(err.empty(), "null_parse_context");
  }
  
  {
    picojson::value v1, v2;
    v1 = picojson::value(true);
    swap(v1, v2);
    ok(v1.is<picojson::null>(), "swap (null)");
    ok(v2.get<bool>() == true, "swap (bool)");

    v1 = picojson::value("a");
    v2 = picojson::value(1.0);
    swap(v1, v2);
    ok(v1.get<double>() == 1.0, "swap (dobule)");
    ok(v2.get<string>() == "a", "swap (string)");

    v1 = picojson::value(picojson::object());
    v2 = picojson::value(picojson::array());
    swap(v1, v2);
    ok(v1.is<picojson::array>(), "swap (array)");
    ok(v2.is<picojson::object>(), "swap (object)");
  }
  
  return success ? 0 : 1;
}

#endif
