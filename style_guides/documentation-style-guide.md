# Documention style guide

This style guide applies to all documentation created for Grafana products.

## Contributing

This style guide is a living document. Add to it whenever a style decision is made or question is answered.

## Published guides

For all items not covered in this guide, refer to the [Microsoft Style Guide](https://docs.microsoft.com/en-us/style-guide/welcome/) and the [Chicago Manual of Style](https://www.chicagomanualofstyle.org/home.html).

## Grafana-specific style

### General

* Use active voice. Avoid passive voice.
  - Passive: The heatmap visualization is displayed.
  - Active: Grafana displays the heatmap visualization.
* Write in the imperative second person. Examples: You can write a query. Click the panel. Close the window.
* Write in present tense.
  - Not: The panel will open.
  - Use: The panel opens. Grafana opens the panel.

### File naming conventions

- Files that are displayed in the help system should have names that are all lowercase, no spaces. Use hyphens instead of spaces. Example: glossary.md
- Documentation file names should match the title. **Note:** This only applies to new files at this time. Do not change the names of older files unless directed to do so.
- Internal reference file names should be all uppercase except the file extension. Example: CONTRIBUTING.md

### Headings

* Write headings in sentence case, not title case.
  - This is sentence case
  - This Is Title Case
* Task topic headings start with a verb.
  - Write a query. Create a dashboard.
* Concept and reference topic headings should be nouns or gerunds. Examples: Contributing to docs, Visualizations, Style guide

### Images

* Preferred format is .png
* File extension should be all lowercase.
* Preferred DPI is 72.
* Assume all graphics will be exclusively viewed on the web.
* Maximum image size is 3840px X 2160px.
* Screenshots should be readable, but not too large.

### Capitalization

* Grafana, Loki, and Prometheus are always capitalized unless part of a code block.
* Git is always capitalized, unless part of a code block.
* Abbreviations are always capitalized (such as HTTP or URL)

### Word usage

Grafana products has some words, abbreviations, and slang particular to this discourse commmunity.

#### data source

Two words, not one

**Exceptions:**
* "datasource" used as an identifier
* "datasource" in a URL
