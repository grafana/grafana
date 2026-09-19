/**
 * Columns are `{ header, cell(row, index) }`. Cells are emitted verbatim, so a caller that puts
 * untrusted text in a cell has to escape the pipes itself; escaping here would break the links.
 */
class MarkdownReport {
  #title;
  #tableColumns;

  constructor({ title, tableColumns }) {
    this.#title = title;
    this.#tableColumns = tableColumns;
  }

  render({ sections = [], rows = [] }) {
    const blocks = [`# ${this.#title}`, ...sections, this.renderTable(rows)];
    return blocks.filter((block) => block !== '' && block != null).join('\n\n') + '\n';
  }

  renderTable(rows) {
    const header = this.#line(this.#tableColumns.map((column) => column.header));
    const separator = this.#line(this.#tableColumns.map(() => '---'));
    const body = rows.map((row, index) => this.#line(this.#tableColumns.map((column) => column.cell(row, index))));
    return [header, separator, ...body].join('\n');
  }

  #line(cells) {
    return `| ${cells.join(' | ')} |`;
  }
}

module.exports = { MarkdownReport };
