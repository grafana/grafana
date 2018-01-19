/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

#include <string>
#include <fstream>
#include <iostream>
#include <vector>
#include <map>

#include <stdlib.h>
#include <sys/stat.h>
#include <sstream>
#include "thrift/platform.h"
#include "thrift/generate/t_generator.h"
#include "thrift/generate/t_html_generator.h"

using std::map;
using std::ofstream;
using std::ostringstream;
using std::pair;
using std::string;
using std::stringstream;
using std::vector;

static const string endl = "\n"; // avoid ostream << std::endl flushes

enum input_type { INPUT_UNKNOWN, INPUT_UTF8, INPUT_PLAIN };

/**
 * HTML code generator
 *
 * mostly copy/pasting/tweaking from mcslee's work.
 */
class t_html_generator : public t_generator {
public:
  t_html_generator(t_program* program,
                   const std::map<std::string, std::string>& parsed_options,
                   const std::string& option_string)
    : t_generator(program) {
    (void)option_string;
    std::map<std::string, std::string>::const_iterator iter;

    standalone_ = false;
    unsafe_ = false;
    for( iter = parsed_options.begin(); iter != parsed_options.end(); ++iter) {
      if( iter->first.compare("standalone") == 0) {
        standalone_ = true;
      } else if( iter->first.compare("noescape") == 0) {
        unsafe_ = true;
      } else {
        throw "unknown option html:" + iter->first;
      }
    }


    out_dir_base_ = "gen-html";
    input_type_ = INPUT_UNKNOWN;

    escape_.clear();
    escape_['&'] = "&amp;";
    escape_['<'] = "&lt;";
    escape_['>'] = "&gt;";
    escape_['"'] = "&quot;";
    escape_['\''] = "&apos;";

    init_allowed__markup();
  }

  void generate_program();
  void generate_program_toc();
  void generate_program_toc_row(t_program* tprog);
  void generate_program_toc_rows(t_program* tprog, std::vector<t_program*>& finished);
  void generate_index();
  std::string escape_html(std::string const& str);
  std::string escape_html_tags(std::string const& str);
  void generate_css();
  void generate_css_content(std::ofstream& f_target);
  void generate_style_tag();
  std::string make_file_link(std::string name);
  bool is_utf8_sequence(std::string const& str, size_t firstpos);
  void detect_input_encoding(std::string const& str, size_t firstpos);
  void init_allowed__markup();

  /**
   * Program-level generation functions
   */

  void generate_typedef(t_typedef* ttypedef);
  void generate_enum(t_enum* tenum);
  void generate_const(t_const* tconst);
  void generate_struct(t_struct* tstruct);
  void generate_service(t_service* tservice);
  void generate_xception(t_struct* txception);

  void print_doc(t_doc* tdoc);
  int print_type(t_type* ttype);
  void print_const_value(t_type* type, t_const_value* tvalue);
  void print_fn_args_doc(t_function* tfunction);

private:
  std::ofstream f_out_;
  std::string current_file_;
  input_type input_type_;
  std::map<std::string, int> allowed_markup;
  bool standalone_;
  bool unsafe_;
};

/**
 * Emits the Table of Contents links at the top of the module's page
 */
void t_html_generator::generate_program_toc() {
  f_out_ << "<table class=\"table-bordered table-striped "
            "table-condensed\"><thead><th>Module</th><th>Services</th>"
         << "<th>Data types</th><th>Constants</th></thead>" << endl;
  generate_program_toc_row(program_);
  f_out_ << "</table>" << endl;
}

/**
 * Recurses through from the provided program and generates a ToC row
 * for each discovered program exactly once by maintaining the list of
 * completed rows in 'finished'
 */
void t_html_generator::generate_program_toc_rows(t_program* tprog,
                                                 std::vector<t_program*>& finished) {
  for (vector<t_program*>::iterator iter = finished.begin(); iter != finished.end(); iter++) {
    if (tprog->get_path() == (*iter)->get_path()) {
      return;
    }
  }
  finished.push_back(tprog);
  generate_program_toc_row(tprog);
  vector<t_program*> includes = tprog->get_includes();
  for (vector<t_program*>::iterator iter = includes.begin(); iter != includes.end(); iter++) {
    generate_program_toc_rows(*iter, finished);
  }
}

/**
 * Emits the Table of Contents links at the top of the module's page
 */
void t_html_generator::generate_program_toc_row(t_program* tprog) {
  string fname = tprog->get_name() + ".html";
  f_out_ << "<tr>" << endl << "<td>" << tprog->get_name() << "</td><td>";
  if (!tprog->get_services().empty()) {
    vector<t_service*> services = tprog->get_services();
    vector<t_service*>::iterator sv_iter;
    for (sv_iter = services.begin(); sv_iter != services.end(); ++sv_iter) {
      string name = get_service_name(*sv_iter);
      f_out_ << "<a href=\"" << make_file_link(fname) << "#Svc_" << name << "\">" << name
             << "</a><br/>" << endl;
      f_out_ << "<ul>" << endl;
      map<string, string> fn_html;
      vector<t_function*> functions = (*sv_iter)->get_functions();
      vector<t_function*>::iterator fn_iter;
      for (fn_iter = functions.begin(); fn_iter != functions.end(); ++fn_iter) {
        string fn_name = (*fn_iter)->get_name();
        string html = "<li><a href=\"" + make_file_link(fname) + "#Fn_" + name + "_" + fn_name
                      + "\">" + fn_name + "</a></li>";
        fn_html.insert(pair<string, string>(fn_name, html));
      }
      for (map<string, string>::iterator html_iter = fn_html.begin(); html_iter != fn_html.end();
           html_iter++) {
        f_out_ << html_iter->second << endl;
      }
      f_out_ << "</ul>" << endl;
    }
  }
  f_out_ << "</td>" << endl << "<td>";
  map<string, string> data_types;
  if (!tprog->get_enums().empty()) {
    vector<t_enum*> enums = tprog->get_enums();
    vector<t_enum*>::iterator en_iter;
    for (en_iter = enums.begin(); en_iter != enums.end(); ++en_iter) {
      string name = (*en_iter)->get_name();
      // f_out_ << "<a href=\"" << make_file_link(fname) << "#Enum_" << name << "\">" << name
      // <<  "</a><br/>" << endl;
      string html = "<a href=\"" + make_file_link(fname) + "#Enum_" + name + "\">" + name + "</a>";
      data_types.insert(pair<string, string>(name, html));
    }
  }
  if (!tprog->get_typedefs().empty()) {
    vector<t_typedef*> typedefs = tprog->get_typedefs();
    vector<t_typedef*>::iterator td_iter;
    for (td_iter = typedefs.begin(); td_iter != typedefs.end(); ++td_iter) {
      string name = (*td_iter)->get_symbolic();
      // f_out_ << "<a href=\"" << make_file_link(fname) << "#Typedef_" << name << "\">" << name
      // << "</a><br/>" << endl;
      string html = "<a href=\"" + make_file_link(fname) + "#Typedef_" + name + "\">" + name
                    + "</a>";
      data_types.insert(pair<string, string>(name, html));
    }
  }
  if (!tprog->get_objects().empty()) {
    vector<t_struct*> objects = tprog->get_objects();
    vector<t_struct*>::iterator o_iter;
    for (o_iter = objects.begin(); o_iter != objects.end(); ++o_iter) {
      string name = (*o_iter)->get_name();
      // f_out_ << "<a href=\"" << make_file_link(fname) << "#Struct_" << name << "\">" << name
      //<< "</a><br/>" << endl;
      string html = "<a href=\"" + make_file_link(fname) + "#Struct_" + name + "\">" + name
                    + "</a>";
      data_types.insert(pair<string, string>(name, html));
    }
  }
  for (map<string, string>::iterator dt_iter = data_types.begin(); dt_iter != data_types.end();
       dt_iter++) {
    f_out_ << dt_iter->second << "<br/>" << endl;
  }
  f_out_ << "</td>" << endl << "<td>";
  if (!tprog->get_consts().empty()) {
    map<string, string> const_html;
    vector<t_const*> consts = tprog->get_consts();
    vector<t_const*>::iterator con_iter;
    for (con_iter = consts.begin(); con_iter != consts.end(); ++con_iter) {
      string name = (*con_iter)->get_name();
      string html = "<code><a href=\"" + make_file_link(fname) + "#Const_" + name + "\">" + name
                    + "</a></code>";
      const_html.insert(pair<string, string>(name, html));
    }
    for (map<string, string>::iterator con_iter = const_html.begin(); con_iter != const_html.end();
         con_iter++) {
      f_out_ << con_iter->second << "<br/>" << endl;
    }
  }
  f_out_ << "</code></td>" << endl << "</tr>";
}

/**
 * Prepares for file generation by opening up the necessary file output
 * stream.
 */
void t_html_generator::generate_program() {
  // Make output directory
  MKDIR(get_out_dir().c_str());
  current_file_ = program_->get_name() + ".html";
  string fname = get_out_dir() + current_file_;
  f_out_.open(fname.c_str());
  f_out_ << "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\"" << endl;
  f_out_ << "    \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">" << endl;
  f_out_ << "<html xmlns=\"http://www.w3.org/1999/xhtml\">" << endl;
  f_out_ << "<head>" << endl;
  f_out_ << "<meta http-equiv=\"Content-Type\" content=\"text/html;charset=utf-8\" />" << endl;
  generate_style_tag();
  f_out_ << "<title>Thrift module: " << program_->get_name() << "</title></head><body>" << endl
         << "<div class=\"container-fluid\">" << endl
         << "<h1>Thrift module: " << program_->get_name() << "</h1>" << endl;

  print_doc(program_);

  generate_program_toc();

  if (!program_->get_consts().empty()) {
    f_out_ << "<hr/><h2 id=\"Constants\">Constants</h2>" << endl;
    vector<t_const*> consts = program_->get_consts();
    f_out_ << "<table class=\"table-bordered table-striped table-condensed\">";
    f_out_ << "<thead><th>Constant</th><th>Type</th><th>Value</th></thead>" << endl;
    generate_consts(consts);
    f_out_ << "</table>";
  }

  if (!program_->get_enums().empty()) {
    f_out_ << "<hr/><h2 id=\"Enumerations\">Enumerations</h2>" << endl;
    // Generate enums
    vector<t_enum*> enums = program_->get_enums();
    vector<t_enum*>::iterator en_iter;
    for (en_iter = enums.begin(); en_iter != enums.end(); ++en_iter) {
      generate_enum(*en_iter);
    }
  }

  if (!program_->get_typedefs().empty()) {
    f_out_ << "<hr/><h2 id=\"Typedefs\">Type declarations</h2>" << endl;
    // Generate typedefs
    vector<t_typedef*> typedefs = program_->get_typedefs();
    vector<t_typedef*>::iterator td_iter;
    for (td_iter = typedefs.begin(); td_iter != typedefs.end(); ++td_iter) {
      generate_typedef(*td_iter);
    }
  }

  if (!program_->get_objects().empty()) {
    f_out_ << "<hr/><h2 id=\"Structs\">Data structures</h2>" << endl;
    // Generate structs and exceptions in declared order
    vector<t_struct*> objects = program_->get_objects();
    vector<t_struct*>::iterator o_iter;
    for (o_iter = objects.begin(); o_iter != objects.end(); ++o_iter) {
      if ((*o_iter)->is_xception()) {
        generate_xception(*o_iter);
      } else {
        generate_struct(*o_iter);
      }
    }
  }

  if (!program_->get_services().empty()) {
    f_out_ << "<hr/><h2 id=\"Services\">Services</h2>" << endl;
    // Generate services
    vector<t_service*> services = program_->get_services();
    vector<t_service*>::iterator sv_iter;
    for (sv_iter = services.begin(); sv_iter != services.end(); ++sv_iter) {
      service_name_ = get_service_name(*sv_iter);
      generate_service(*sv_iter);
    }
  }

  f_out_ << "</div></body></html>" << endl;
  f_out_.close();

  generate_index();
  generate_css();
}

/**
 * Emits the index.html file for the recursive set of Thrift programs
 */
void t_html_generator::generate_index() {
  current_file_ = "index.html";
  string index_fname = get_out_dir() + current_file_;
  f_out_.open(index_fname.c_str());
  f_out_ << "<html><head>" << endl;
  generate_style_tag();
  f_out_ << "<title>All Thrift declarations</title></head><body>" << endl
         << "<div class=\"container-fluid\">" << endl << "<h1>All Thrift declarations</h1>" << endl;
  f_out_ << "<table class=\"table-bordered table-striped "
            "table-condensed\"><thead><th>Module</th><th>Services</th><th>Data types</th>"
         << "<th>Constants</th></thead>" << endl;
  vector<t_program*> programs;
  generate_program_toc_rows(program_, programs);
  f_out_ << "</table>" << endl;
  f_out_ << "</div></body></html>" << endl;
  f_out_.close();
}

void t_html_generator::generate_css() {
  if (!standalone_) {
    current_file_ = "style.css";
    string css_fname = get_out_dir() + current_file_;
    f_out_.open(css_fname.c_str());
    generate_css_content(f_out_);
    f_out_.close();
  }
}

void t_html_generator::generate_css_content(std::ofstream& f_target) {
  f_target << BOOTSTRAP_CSS() << endl;
  f_target << "/* Auto-generated CSS for generated Thrift docs */" << endl;
  f_target << "h3, h4 { margin-bottom: 6px; }" << endl;
  f_target << "div.definition { border: 1px solid #CCC; margin-bottom: 10px; padding: 10px; }"
           << endl;
  f_target << "div.extends { margin: -0.5em 0 1em 5em }" << endl;
  f_target << "td { vertical-align: top; }" << endl;
  f_target << "table { empty-cells: show; }" << endl;
  f_target << "code { line-height: 20px; }" << endl;
  f_target << ".table-bordered th, .table-bordered td { border-bottom: 1px solid #DDDDDD; }"
           << endl;
}

/**
 * Generates the CSS tag.
 * Depending on "standalone", either a CSS file link (default), or the entire CSS is embedded
 * inline.
 */
void t_html_generator::generate_style_tag() {
  if (!standalone_) {
    f_out_ << "<link href=\"style.css\" rel=\"stylesheet\" type=\"text/css\"/>" << endl;
  } else {
    f_out_ << "<style type=\"text/css\"/><!--" << endl;
    generate_css_content(f_out_);
    f_out_ << "--></style>" << endl;
  }
}

/**
 * Returns the target file for a <a href> link
 * The returned string is empty, whenever filename refers to the current file.
 */
std::string t_html_generator::make_file_link(std::string filename) {
  return (current_file_.compare(filename) != 0) ? filename : "";
}

/**
 * If the provided documentable object has documentation attached, this
 * will emit it to the output stream in HTML format.
 */
void t_html_generator::print_doc(t_doc* tdoc) {
  if (tdoc->has_doc()) {
    if (unsafe_) {
      f_out_ << tdoc->get_doc() << "<br/>";
    } else {
      f_out_ << escape_html(tdoc->get_doc()) << "<br/>";
    }
  }
}

bool t_html_generator::is_utf8_sequence(std::string const& str, size_t firstpos) {
  // leading char determines the length of the sequence
  unsigned char c = str.at(firstpos);
  int count = 0;
  if ((c & 0xE0) == 0xC0) {
    count = 1;
  } else if ((c & 0xF0) == 0xE0) {
    count = 2;
  } else if ((c & 0xF8) == 0xF0) {
    count = 3;
  } else if ((c & 0xFC) == 0xF8) {
    count = 4;
  } else if ((c & 0xFE) == 0xFC) {
    count = 5;
  } else {
    // pdebug("UTF-8 test: char '%c' (%d) is not a valid UTF-8 leading byte", c, int(c));
    return false; // no UTF-8
  }

  // following chars
  size_t pos = firstpos + 1;
  while ((pos < str.length()) && (0 < count)) {
    c = str.at(pos);
    if ((c & 0xC0) != 0x80) {
      // pdebug("UTF-8 test: char '%c' (%d) is not a valid UTF-8 following byte", c, int(c));
      return false; // no UTF-8
    }
    --count;
    ++pos;
  }

  // true if the sequence is complete
  return (0 == count);
}

void t_html_generator::detect_input_encoding(std::string const& str, size_t firstpos) {
  if (is_utf8_sequence(str, firstpos)) {
    pdebug("Input seems to be already UTF-8 encoded");
    input_type_ = INPUT_UTF8;
    return;
  }

  // fallback
  pwarning(1, "Input is not UTF-8, treating as plain ANSI");
  input_type_ = INPUT_PLAIN;
}

void t_html_generator::init_allowed__markup() {
  allowed_markup.clear();
  // standalone tags
  allowed_markup["br"] = 1;
  allowed_markup["br/"] = 1;
  allowed_markup["img"] = 1;
  // paired tags
  allowed_markup["b"] = 1;
  allowed_markup["/b"] = 1;
  allowed_markup["u"] = 1;
  allowed_markup["/u"] = 1;
  allowed_markup["i"] = 1;
  allowed_markup["/i"] = 1;
  allowed_markup["s"] = 1;
  allowed_markup["/s"] = 1;
  allowed_markup["big"] = 1;
  allowed_markup["/big"] = 1;
  allowed_markup["small"] = 1;
  allowed_markup["/small"] = 1;
  allowed_markup["sup"] = 1;
  allowed_markup["/sup"] = 1;
  allowed_markup["sub"] = 1;
  allowed_markup["/sub"] = 1;
  allowed_markup["pre"] = 1;
  allowed_markup["/pre"] = 1;
  allowed_markup["tt"] = 1;
  allowed_markup["/tt"] = 1;
  allowed_markup["ul"] = 1;
  allowed_markup["/ul"] = 1;
  allowed_markup["ol"] = 1;
  allowed_markup["/ol"] = 1;
  allowed_markup["li"] = 1;
  allowed_markup["/li"] = 1;
  allowed_markup["a"] = 1;
  allowed_markup["/a"] = 1;
  allowed_markup["p"] = 1;
  allowed_markup["/p"] = 1;
  allowed_markup["code"] = 1;
  allowed_markup["/code"] = 1;
  allowed_markup["dl"] = 1;
  allowed_markup["/dl"] = 1;
  allowed_markup["dt"] = 1;
  allowed_markup["/dt"] = 1;
  allowed_markup["dd"] = 1;
  allowed_markup["/dd"] = 1;
  allowed_markup["h1"] = 1;
  allowed_markup["/h1"] = 1;
  allowed_markup["h2"] = 1;
  allowed_markup["/h2"] = 1;
  allowed_markup["h3"] = 1;
  allowed_markup["/h3"] = 1;
  allowed_markup["h4"] = 1;
  allowed_markup["/h4"] = 1;
  allowed_markup["h5"] = 1;
  allowed_markup["/h5"] = 1;
  allowed_markup["h6"] = 1;
  allowed_markup["/h6"] = 1;
}

std::string t_html_generator::escape_html_tags(std::string const& str) {
  std::ostringstream result;

  unsigned char c = '?';
  size_t lastpos;
  size_t firstpos = 0;
  while (firstpos < str.length()) {

    // look for non-ASCII char
    lastpos = firstpos;
    while (lastpos < str.length()) {
      c = str.at(lastpos);
      if (('<' == c) || ('>' == c)) {
        break;
      }
      ++lastpos;
    }

    // copy what we got so far
    if (lastpos > firstpos) {
      result << str.substr(firstpos, lastpos - firstpos);
      firstpos = lastpos;
    }

    // reached the end?
    if (firstpos >= str.length()) {
      break;
    }

    // tag end without corresponding begin
    ++firstpos;
    if ('>' == c) {
      result << "&gt;";
      continue;
    }

    // extract the tag
    std::ostringstream tagstream;
    while (firstpos < str.length()) {
      c = str.at(firstpos);
      ++firstpos;
      if ('<' == c) {
        tagstream << "&lt;"; // nested begin?
      } else if ('>' == c) {
        break;
      } else {
        tagstream << c; // not very efficient, but tags should be quite short
      }
    }

    // we allow for several markup in docstrings, all else will become escaped
    string tag_content = tagstream.str();
    string tag_key = tag_content;
    size_t first_white = tag_key.find_first_of(" \t\f\v\n\r");
    if (first_white != string::npos) {
      tag_key.erase(first_white);
    }
    for (std::string::size_type i = 0; i < tag_key.length(); ++i) {
      tag_key[i] = tolower(tag_key[i]);
    }
    if (allowed_markup.find(tag_key) != allowed_markup.end()) {
      result << "<" << tag_content << ">";
    } else {
      result << "&lt;" << tagstream.str() << "&gt;";
      pverbose("illegal markup <%s> in doc-comment\n", tag_key.c_str());
    }
  }

  return result.str();
}

std::string t_html_generator::escape_html(std::string const& str) {
  // the generated HTML header says it is UTF-8 encoded
  // if UTF-8 input has been detected before, we don't need to change anything
  if (input_type_ == INPUT_UTF8) {
    return escape_html_tags(str);
  }

  // convert unsafe chars to their &#<num>; equivalent
  std::ostringstream result;
  unsigned char c = '?';
  unsigned int ic = 0;
  size_t lastpos;
  size_t firstpos = 0;
  while (firstpos < str.length()) {

    // look for non-ASCII char
    lastpos = firstpos;
    while (lastpos < str.length()) {
      c = str.at(lastpos);
      ic = c;
      if ((32 > ic) || (127 < ic)) {
        break;
      }
      ++lastpos;
    }

    // copy what we got so far
    if (lastpos > firstpos) {
      result << str.substr(firstpos, lastpos - firstpos);
      firstpos = lastpos;
    }

    // reached the end?
    if (firstpos >= str.length()) {
      break;
    }

    // some control code?
    if (ic <= 31) {
      switch (c) {
      case '\r':
      case '\n':
      case '\t':
        result << c;
        break;
      default: // silently consume all other ctrl chars
        break;
      }
      ++firstpos;
      continue;
    }

    // reached the end?
    if (firstpos >= str.length()) {
      break;
    }

    // try to detect input encoding
    if (input_type_ == INPUT_UNKNOWN) {
      detect_input_encoding(str, firstpos);
      if (input_type_ == INPUT_UTF8) {
        lastpos = str.length();
        result << str.substr(firstpos, lastpos - firstpos);
        break;
      }
    }

    // convert the character to something useful based on the detected encoding
    switch (input_type_) {
    case INPUT_PLAIN:
      result << "&#" << ic << ";";
      ++firstpos;
      break;
    default:
      throw "Unexpected or unrecognized input encoding";
    }
  }

  return escape_html_tags(result.str());
}

/**
 * Prints out the provided type in HTML
 */
int t_html_generator::print_type(t_type* ttype) {
  std::string::size_type len = 0;
  f_out_ << "<code>";
  if (ttype->is_container()) {
    if (ttype->is_list()) {
      f_out_ << "list&lt;";
      len = 6 + print_type(((t_list*)ttype)->get_elem_type());
      f_out_ << "&gt;";
    } else if (ttype->is_set()) {
      f_out_ << "set&lt;";
      len = 5 + print_type(((t_set*)ttype)->get_elem_type());
      f_out_ << "&gt;";
    } else if (ttype->is_map()) {
      f_out_ << "map&lt;";
      len = 5 + print_type(((t_map*)ttype)->get_key_type());
      f_out_ << ", ";
      len += print_type(((t_map*)ttype)->get_val_type());
      f_out_ << "&gt;";
    }
  } else if (ttype->is_base_type()) {
    f_out_ << (((t_base_type*)ttype)->is_binary() ? "binary" : ttype->get_name());
    len = ttype->get_name().size();
  } else {
    string prog_name = ttype->get_program()->get_name();
    string type_name = ttype->get_name();
    f_out_ << "<a href=\"" << make_file_link(prog_name + ".html") << "#";
    if (ttype->is_typedef()) {
      f_out_ << "Typedef_";
    } else if (ttype->is_struct() || ttype->is_xception()) {
      f_out_ << "Struct_";
    } else if (ttype->is_enum()) {
      f_out_ << "Enum_";
    } else if (ttype->is_service()) {
      f_out_ << "Svc_";
    }
    f_out_ << type_name << "\">";
    len = type_name.size();
    if (ttype->get_program() != program_) {
      f_out_ << prog_name << ".";
      len += prog_name.size() + 1;
    }
    f_out_ << type_name << "</a>";
  }
  f_out_ << "</code>";
  return (int)len;
}

/**
 * Prints out an HTML representation of the provided constant value
 */
void t_html_generator::print_const_value(t_type* type, t_const_value* tvalue) {

  // if tvalue is an identifier, the constant content is already shown elsewhere
  if (tvalue->get_type() == t_const_value::CV_IDENTIFIER) {
    string fname = program_->get_name() + ".html";
    string name = escape_html(tvalue->get_identifier());
    f_out_ << "<code><a href=\"" + make_file_link(fname) + "#Const_" + name + "\">" + name
              + "</a></code>";
    return;
  }

  t_type* truetype = type;
  while (truetype->is_typedef()) {
    truetype = ((t_typedef*)truetype)->get_type();
  }

  bool first = true;
  if (truetype->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)truetype)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_STRING:
      f_out_ << '"' << escape_html(get_escaped_string(tvalue)) << '"';
      break;
    case t_base_type::TYPE_BOOL:
      f_out_ << ((tvalue->get_integer() != 0) ? "true" : "false");
      break;
    case t_base_type::TYPE_I8:
      f_out_ << tvalue->get_integer();
      break;
    case t_base_type::TYPE_I16:
      f_out_ << tvalue->get_integer();
      break;
    case t_base_type::TYPE_I32:
      f_out_ << tvalue->get_integer();
      break;
    case t_base_type::TYPE_I64:
      f_out_ << tvalue->get_integer();
      break;
    case t_base_type::TYPE_DOUBLE:
      if (tvalue->get_type() == t_const_value::CV_INTEGER) {
        f_out_ << tvalue->get_integer();
      } else {
        f_out_ << tvalue->get_double();
      }
      break;
    default:
      f_out_ << "UNKNOWN BASE TYPE";
      break;
    }
  } else if (truetype->is_enum()) {
    f_out_ << escape_html(truetype->get_name()) << "."
           << escape_html(tvalue->get_identifier_name());
  } else if (truetype->is_struct() || truetype->is_xception()) {
    f_out_ << "{ ";
    const vector<t_field*>& fields = ((t_struct*)truetype)->get_members();
    vector<t_field*>::const_iterator f_iter;
    const map<t_const_value*, t_const_value*>& val = tvalue->get_map();
    map<t_const_value*, t_const_value*>::const_iterator v_iter;
    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      t_type* field_type = NULL;
      for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
        if ((*f_iter)->get_name() == v_iter->first->get_string()) {
          field_type = (*f_iter)->get_type();
        }
      }
      if (field_type == NULL) {
        throw "type error: " + truetype->get_name() + " has no field "
            + v_iter->first->get_string();
      }
      if (!first) {
        f_out_ << ", ";
      }
      first = false;
      f_out_ << escape_html(v_iter->first->get_string()) << " = ";
      print_const_value(field_type, v_iter->second);
    }
    f_out_ << " }";
  } else if (truetype->is_map()) {
    f_out_ << "{ ";
    map<t_const_value*, t_const_value*> map_elems = tvalue->get_map();
    map<t_const_value*, t_const_value*>::iterator map_iter;
    for (map_iter = map_elems.begin(); map_iter != map_elems.end(); map_iter++) {
      if (!first) {
        f_out_ << ", ";
      }
      first = false;
      print_const_value(((t_map*)truetype)->get_key_type(), map_iter->first);
      f_out_ << " = ";
      print_const_value(((t_map*)truetype)->get_val_type(), map_iter->second);
    }
    f_out_ << " }";
  } else if (truetype->is_list()) {
    f_out_ << "{ ";
    vector<t_const_value*> list_elems = tvalue->get_list();
    ;
    vector<t_const_value*>::iterator list_iter;
    for (list_iter = list_elems.begin(); list_iter != list_elems.end(); list_iter++) {
      if (!first) {
        f_out_ << ", ";
      }
      first = false;
      print_const_value(((t_list*)truetype)->get_elem_type(), *list_iter);
    }
    f_out_ << " }";
  } else if (truetype->is_set()) {
    f_out_ << "{ ";
    vector<t_const_value*> list_elems = tvalue->get_list();
    ;
    vector<t_const_value*>::iterator list_iter;
    for (list_iter = list_elems.begin(); list_iter != list_elems.end(); list_iter++) {
      if (!first) {
        f_out_ << ", ";
      }
      first = false;
      print_const_value(((t_set*)truetype)->get_elem_type(), *list_iter);
    }
    f_out_ << " }";
  } else {
    f_out_ << "UNKNOWN TYPE";
  }
}

/**
 * Prints out documentation for arguments/exceptions of a function, if any documentation has been
 * supplied.
 */
void t_html_generator::print_fn_args_doc(t_function* tfunction) {
  bool has_docs = false;
  vector<t_field*> args = tfunction->get_arglist()->get_members();
  vector<t_field*>::iterator arg_iter = args.begin();
  if (arg_iter != args.end()) {
    for (; arg_iter != args.end(); arg_iter++) {
      if ((*arg_iter)->has_doc() && !(*arg_iter)->get_doc().empty())
        has_docs = true;
    }
    if (has_docs) {
      arg_iter = args.begin();
      f_out_ << "<br/><h4 id=\"Parameters_" << service_name_ << "_" << tfunction->get_name()
             << "\">Parameters</h4>" << endl;
      f_out_ << "<table class=\"table-bordered table-striped table-condensed\">";
      f_out_ << "<thead><th>Name</th><th>Description</th></thead>";
      for (; arg_iter != args.end(); arg_iter++) {
        f_out_ << "<tr><td>" << (*arg_iter)->get_name();
        f_out_ << "</td><td>";
        f_out_ << escape_html((*arg_iter)->get_doc());
        f_out_ << "</td></tr>" << endl;
      }
      f_out_ << "</table>";
    }
  }

  has_docs = false;
  vector<t_field*> excepts = tfunction->get_xceptions()->get_members();
  vector<t_field*>::iterator ex_iter = excepts.begin();
  if (ex_iter != excepts.end()) {
    for (; ex_iter != excepts.end(); ex_iter++) {
      if ((*ex_iter)->has_doc() && !(*ex_iter)->get_doc().empty())
        has_docs = true;
    }
    if (has_docs) {
      ex_iter = excepts.begin();
      f_out_ << "<br/><h4 id=\"Exceptions_" << service_name_ << "_" << tfunction->get_name()
             << "\">Exceptions</h4>" << endl;
      f_out_ << "<table class=\"table-bordered table-striped table-condensed\">";
      f_out_ << "<thead><th>Type</th><th>Description</th></thead>";
      for (; ex_iter != excepts.end(); ex_iter++) {
        f_out_ << "<tr><td>" << (*ex_iter)->get_type()->get_name();
        f_out_ << "</td><td>";
        f_out_ << escape_html((*ex_iter)->get_doc());
        f_out_ << "</td></tr>" << endl;
      }
      f_out_ << "</table>";
    }
  }
}

/**
 * Generates a typedef.
 *
 * @param ttypedef The type definition
 */
void t_html_generator::generate_typedef(t_typedef* ttypedef) {
  string name = ttypedef->get_name();
  f_out_ << "<div class=\"definition\">";
  f_out_ << "<h3 id=\"Typedef_" << name << "\">Typedef: " << name << "</h3>" << endl;
  f_out_ << "<p><strong>Base type:</strong>&nbsp;";
  print_type(ttypedef->get_type());
  f_out_ << "</p>" << endl;
  print_doc(ttypedef);
  f_out_ << "</div>" << endl;
}

/**
 * Generates code for an enumerated type.
 *
 * @param tenum The enumeration
 */
void t_html_generator::generate_enum(t_enum* tenum) {
  string name = tenum->get_name();
  f_out_ << "<div class=\"definition\">";
  f_out_ << "<h3 id=\"Enum_" << name << "\">Enumeration: " << name << "</h3>" << endl;
  print_doc(tenum);
  vector<t_enum_value*> values = tenum->get_constants();
  vector<t_enum_value*>::iterator val_iter;
  f_out_ << "<br/><table class=\"table-bordered table-striped table-condensed\">" << endl;
  for (val_iter = values.begin(); val_iter != values.end(); ++val_iter) {
    f_out_ << "<tr><td><code>";
    f_out_ << (*val_iter)->get_name();
    f_out_ << "</code></td><td><code>";
    f_out_ << (*val_iter)->get_value();
    f_out_ << "</code></td><td>" << endl;
    print_doc((*val_iter));
    f_out_ << "</td></tr>" << endl;
  }
  f_out_ << "</table></div>" << endl;
}

/**
 * Generates a constant value
 */
void t_html_generator::generate_const(t_const* tconst) {
  string name = tconst->get_name();
  f_out_ << "<tr id=\"Const_" << name << "\"><td><code>" << name << "</code></td><td>";
  print_type(tconst->get_type());
  f_out_ << "</td><td><code>";
  print_const_value(tconst->get_type(), tconst->get_value());
  f_out_ << "</code></td></tr>";
  if (tconst->has_doc()) {
    f_out_ << "<tr><td colspan=\"3\"><blockquote>";
    print_doc(tconst);
    f_out_ << "</blockquote></td></tr>";
  }
}

/**
 * Generates a struct definition for a thrift data type.
 *
 * @param tstruct The struct definition
 */
void t_html_generator::generate_struct(t_struct* tstruct) {
  string name = tstruct->get_name();
  f_out_ << "<div class=\"definition\">";
  f_out_ << "<h3 id=\"Struct_" << name << "\">";
  if (tstruct->is_xception()) {
    f_out_ << "Exception: ";
  } else if (tstruct->is_union()) {
    f_out_ << "Union: ";
  } else {
    f_out_ << "Struct: ";
  }
  f_out_ << name << "</h3>" << endl;
  vector<t_field*> members = tstruct->get_members();
  vector<t_field*>::iterator mem_iter = members.begin();
  f_out_ << "<table class=\"table-bordered table-striped table-condensed\">";
  f_out_ << "<thead><th>Key</th><th>Field</th><th>Type</th><th>Description</th><th>Requiredness</"
            "th><th>Default value</th></thead>" << endl;
  for (; mem_iter != members.end(); mem_iter++) {
    f_out_ << "<tr><td>" << (*mem_iter)->get_key() << "</td><td>";
    f_out_ << (*mem_iter)->get_name();
    f_out_ << "</td><td>";
    print_type((*mem_iter)->get_type());
    f_out_ << "</td><td>";
    f_out_ << escape_html((*mem_iter)->get_doc());
    f_out_ << "</td><td>";
    if ((*mem_iter)->get_req() == t_field::T_OPTIONAL) {
      f_out_ << "optional";
    } else if ((*mem_iter)->get_req() == t_field::T_REQUIRED) {
      f_out_ << "required";
    } else {
      f_out_ << "default";
    }
    f_out_ << "</td><td>";
    t_const_value* default_val = (*mem_iter)->get_value();
    if (default_val != NULL) {
      f_out_ << "<code>";
      print_const_value((*mem_iter)->get_type(), default_val);
      f_out_ << "</code>";
    }
    f_out_ << "</td></tr>" << endl;
  }
  f_out_ << "</table><br/>";
  print_doc(tstruct);
  f_out_ << "</div>";
}

/**
 * Exceptions are special structs
 *
 * @param tstruct The struct definition
 */
void t_html_generator::generate_xception(t_struct* txception) {
  generate_struct(txception);
}

/**
 * Generates the HTML block for a Thrift service.
 *
 * @param tservice The service definition
 */
void t_html_generator::generate_service(t_service* tservice) {
  f_out_ << "<h3 id=\"Svc_" << service_name_ << "\">Service: " << service_name_ << "</h3>" << endl;

  if (tservice->get_extends()) {
    f_out_ << "<div class=\"extends\"><em>extends</em> ";
    print_type(tservice->get_extends());
    f_out_ << "</div>\n";
  }
  print_doc(tservice);
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator fn_iter = functions.begin();
  for (; fn_iter != functions.end(); fn_iter++) {
    string fn_name = (*fn_iter)->get_name();
    f_out_ << "<div class=\"definition\">";
    f_out_ << "<h4 id=\"Fn_" << service_name_ << "_" << fn_name << "\">Function: " << service_name_
           << "." << fn_name << "</h4>" << endl;
    f_out_ << "<pre>";
    std::string::size_type offset = print_type((*fn_iter)->get_returntype());
    bool first = true;
    f_out_ << " " << fn_name << "(";
    offset += fn_name.size() + 2;
    vector<t_field*> args = (*fn_iter)->get_arglist()->get_members();
    vector<t_field*>::iterator arg_iter = args.begin();
    for (; arg_iter != args.end(); arg_iter++) {
      if (!first) {
        f_out_ << "," << endl;
        for (std::string::size_type i = 0; i < offset; ++i) {
          f_out_ << " ";
        }
      }
      first = false;
      print_type((*arg_iter)->get_type());
      f_out_ << " " << (*arg_iter)->get_name();
      if ((*arg_iter)->get_value() != NULL) {
        f_out_ << " = ";
        print_const_value((*arg_iter)->get_type(), (*arg_iter)->get_value());
      }
    }
    f_out_ << ")" << endl;
    first = true;
    vector<t_field*> excepts = (*fn_iter)->get_xceptions()->get_members();
    vector<t_field*>::iterator ex_iter = excepts.begin();
    if (ex_iter != excepts.end()) {
      f_out_ << "    throws ";
      for (; ex_iter != excepts.end(); ex_iter++) {
        if (!first) {
          f_out_ << ", ";
        }
        first = false;
        print_type((*ex_iter)->get_type());
      }
      f_out_ << endl;
    }
    f_out_ << "</pre>";
    print_doc(*fn_iter);
    print_fn_args_doc(*fn_iter);
    f_out_ << "</div>";
  }
}

THRIFT_REGISTER_GENERATOR(
    html,
    "HTML",
    "    standalone:      Self-contained mode, includes all CSS in the HTML files.\n"
    "                     Generates no style.css file, but HTML files will be larger.\n"
    "    noescape:        Do not escape html in doc text.\n")
