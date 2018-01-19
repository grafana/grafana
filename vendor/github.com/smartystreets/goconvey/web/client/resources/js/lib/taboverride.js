/*! taboverride v4.0.3 | https://github.com/wjbryant/taboverride
(c) 2015 Bill Bryant | http://opensource.org/licenses/mit */

/**
 * @fileOverview taboverride
 * @author       Bill Bryant
 * @version      4.0.3
 */

/*jslint browser: true */
/*global exports, define */

// use CommonJS or AMD if available
(function (factory) {
    'use strict';

    var mod;

    if (typeof exports === 'object') {
        // Node.js/CommonJS
        factory(exports);
    } else if (typeof define === 'function' && define.amd) {
        // AMD - register as an anonymous module
        // files must be concatenated using an AMD-aware tool such as r.js
        define(['exports'], factory);
    } else {
        // no module format - create global variable
        mod = window.tabOverride = {};
        factory(mod);
    }
}(function (tabOverride) {
    'use strict';

    /**
     * The tabOverride namespace object
     *
     * @namespace tabOverride
     */

    var document = window.document,
        listeners,
        aTab = '\t', // the string representing a tab
        tabKey = 9,
        untabKey = 9,
        tabModifierKeys = [],
        untabModifierKeys = ['shiftKey'],
        autoIndent = true, // whether each line should be automatically indented
        inWhitespace = false, // whether the start of the selection is in the leading whitespace on enter
        textareaElem = document.createElement('textarea'), // temp textarea element to get newline character(s)
        newline, // the newline character sequence (\n or \r\n)
        newlineLen, // the number of characters used for a newline (1 or 2)
        hooks = {};

    /**
     * Determines whether the specified modifier keys match the modifier keys
     * that were pressed.
     *
     * @param  {string[]} modifierKeys  the modifier keys to check - ex: ['shiftKey']
     * @param  {Event}    e             the event object for the keydown event
     * @return {boolean}                whether modifierKeys are valid for the event
     *
     * @method tabOverride.utils.isValidModifierKeyCombo
     */
    function isValidModifierKeyCombo(modifierKeys, e) {
        var modifierKeyNames = ['alt', 'ctrl', 'meta', 'shift'],
            numModKeys = modifierKeys.length,
            i,
            j,
            currModifierKey,
            isValid = true;

        // check that all required modifier keys were pressed
        for (i = 0; i < numModKeys; i += 1) {
            if (!e[modifierKeys[i]]) {
                isValid = false;
                break;
            }
        }

        // if the requirements were met, check for additional modifier keys
        if (isValid) {
            for (i = 0; i < modifierKeyNames.length; i += 1) {
                currModifierKey = modifierKeyNames[i] + 'Key';

                // if this key was pressed
                if (e[currModifierKey]) {
                    // if there are required keys, check whether the current key
                    // is required
                    if (numModKeys) {
                        isValid = false;

                        // if this is a required key, continue
                        for (j = 0; j < numModKeys; j += 1) {
                            if (currModifierKey === modifierKeys[j]) {
                                isValid = true;
                                break;
                            }
                        }
                    } else {
                        // no required keys, but one was pressed
                        isValid = false;
                    }
                }

                // an extra key was pressed, don't check anymore
                if (!isValid) {
                    break;
                }
            }
        }

        return isValid;
    }

    /**
     * Determines whether the tab key combination was pressed.
     *
     * @param  {number}  keyCode  the key code of the key that was pressed
     * @param  {Event}   e        the event object for the key event
     * @return {boolean}          whether the tab key combo was pressed
     *
     * @private
     */
    function tabKeyComboPressed(keyCode, e) {
        return keyCode === tabKey && isValidModifierKeyCombo(tabModifierKeys, e);
    }

    /**
     * Determines whether the untab key combination was pressed.
     *
     * @param  {number}  keyCode  the key code of the key that was pressed
     * @param  {Event}   e        the event object for the key event
     * @return {boolean}          whether the untab key combo was pressed
     *
     * @private
     */
    function untabKeyComboPressed(keyCode, e) {
        return keyCode === untabKey && isValidModifierKeyCombo(untabModifierKeys, e);
    }

    /**
     * Creates a function to get and set the specified key combination.
     *
     * @param  {Function} keyFunc       getter/setter function for the key
     * @param  {string[]} modifierKeys  the array of modifier keys to manipulate
     * @return {Function}               a getter/setter function for the specified
     *                                  key combination
     *
     * @private
     */
    function createKeyComboFunction(keyFunc, modifierKeys) {
        return function (keyCode, modifierKeyNames) {
            var i,
                keyCombo = '';

            if (arguments.length) {
                if (typeof keyCode === 'number') {
                    keyFunc(keyCode);

                    modifierKeys.length = 0; // clear the array

                    if (modifierKeyNames && modifierKeyNames.length) {
                        for (i = 0; i < modifierKeyNames.length; i += 1) {
                            modifierKeys.push(modifierKeyNames[i] + 'Key');
                        }
                    }
                }

                return this;
            }

            for (i = 0; i < modifierKeys.length; i += 1) {
                keyCombo += modifierKeys[i].slice(0, -3) + '+';
            }

            return keyCombo + keyFunc();
        };
    }

    /**
     * Event handler to insert or remove tabs and newlines on the keydown event
     * for the tab or enter key.
     *
     * @param {Event} e  the event object
     *
     * @method tabOverride.handlers.keydown
     */
    function overrideKeyDown(e) {
        e = e || event;

        // textarea elements can only contain text nodes which don't receive
        // keydown events, so the event target/srcElement will always be the
        // textarea element, however, prefer currentTarget in order to support
        // delegated events in compliant browsers
        var target = e.currentTarget || e.srcElement, // don't use the "this" keyword (doesn't work in old IE)
            key = e.keyCode, // the key code for the key that was pressed
            tab, // the string representing a tab
            tabLen, // the length of a tab
            text, // initial text in the textarea
            range, // the IE TextRange object
            tempRange, // used to calculate selection start and end positions in IE
            preNewlines, // the number of newline character sequences before the selection start (for IE)
            selNewlines, // the number of newline character sequences within the selection (for IE)
            initScrollTop, // initial scrollTop value used to fix scrolling in Firefox
            selStart, // the selection start position
            selEnd, // the selection end position
            sel, // the selected text
            startLine, // for multi-line selections, the first character position of the first line
            endLine, // for multi-line selections, the last character position of the last line
            numTabs, // the number of tabs inserted / removed in the selection
            startTab, // if a tab was removed from the start of the first line
            preTab, // if a tab was removed before the start of the selection
            whitespace, // the whitespace at the beginning of the first selected line
            whitespaceLen, // the length of the whitespace at the beginning of the first selected line
            CHARACTER = 'character'; // string constant used for the Range.move methods

        // don't do any unnecessary work
        if ((target.nodeName && target.nodeName.toLowerCase() !== 'textarea') ||
                (key !== tabKey && key !== untabKey && (key !== 13 || !autoIndent))) {
            return;
        }

        // initialize variables used for tab and enter keys
        inWhitespace = false; // this will be set to true if enter is pressed in the leading whitespace
        text = target.value;

        // this is really just for Firefox, but will be used by all browsers that support
        // selectionStart and selectionEnd - whenever the textarea value property is reset,
        // Firefox scrolls back to the top - this is used to set it back to the original value
        // scrollTop is nonstandard, but supported by all modern browsers
        initScrollTop = target.scrollTop;

        // get the text selection
        if (typeof target.selectionStart === 'number') {
            selStart = target.selectionStart;
            selEnd = target.selectionEnd;
            sel = text.slice(selStart, selEnd);

        } else if (document.selection) { // IE
            range = document.selection.createRange();
            sel = range.text;
            tempRange = range.duplicate();
            tempRange.moveToElementText(target);
            tempRange.setEndPoint('EndToEnd', range);
            selEnd = tempRange.text.length;
            selStart = selEnd - sel.length;

            // whenever the value of the textarea is changed, the range needs to be reset
            // IE <9 (and Opera) use both \r and \n for newlines - this adds an extra character
            // that needs to be accounted for when doing position calculations with ranges
            // these values are used to offset the selection start and end positions
            if (newlineLen > 1) {
                preNewlines = text.slice(0, selStart).split(newline).length - 1;
                selNewlines = sel.split(newline).length - 1;
            } else {
                preNewlines = selNewlines = 0;
            }
        } else {
            return; // cannot access textarea selection - do nothing
        }

        // tab / untab key - insert / remove tab
        if (key === tabKey || key === untabKey) {

            // initialize tab variables
            tab = aTab;
            tabLen = tab.length;
            numTabs = 0;
            startTab = 0;
            preTab = 0;

            // multi-line selection
            if (selStart !== selEnd && sel.indexOf('\n') !== -1) {
                // for multiple lines, only insert / remove tabs from the beginning of each line

                // find the start of the first selected line
                if (selStart === 0 || text.charAt(selStart - 1) === '\n') {
                    // the selection starts at the beginning of a line
                    startLine = selStart;
                } else {
                    // the selection starts after the beginning of a line
                    // set startLine to the beginning of the first partially selected line
                    // subtract 1 from selStart in case the cursor is at the newline character,
                    // for instance, if the very end of the previous line was selected
                    // add 1 to get the next character after the newline
                    // if there is none before the selection, lastIndexOf returns -1
                    // when 1 is added to that it becomes 0 and the first character is used
                    startLine = text.lastIndexOf('\n', selStart - 1) + 1;
                }

                // find the end of the last selected line
                if (selEnd === text.length || text.charAt(selEnd) === '\n') {
                    // the selection ends at the end of a line
                    endLine = selEnd;
                } else if (text.charAt(selEnd - 1) === '\n') {
                    // the selection ends at the start of a line, but no
                    // characters are selected - don't indent this line
                    endLine = selEnd - 1;
                } else {
                    // the selection ends before the end of a line
                    // set endLine to the end of the last partially selected line
                    endLine = text.indexOf('\n', selEnd);
                    if (endLine === -1) {
                        endLine = text.length;
                    }
                }

                // tab key combo - insert tabs
                if (tabKeyComboPressed(key, e)) {

                    numTabs = 1; // for the first tab

                    // insert tabs at the beginning of each line of the selection
                    target.value = text.slice(0, startLine) + tab +
                        text.slice(startLine, endLine).replace(/\n/g, function () {
                            numTabs += 1;
                            return '\n' + tab;
                        }) + text.slice(endLine);

                    // set start and end points
                    if (range) { // IE
                        range.collapse();
                        range.moveEnd(CHARACTER, selEnd + (numTabs * tabLen) - selNewlines - preNewlines);
                        range.moveStart(CHARACTER, selStart + tabLen - preNewlines);
                        range.select();
                    } else {
                        // the selection start is always moved by 1 character
                        target.selectionStart = selStart + tabLen;
                        // move the selection end over by the total number of tabs inserted
                        target.selectionEnd = selEnd + (numTabs * tabLen);
                        target.scrollTop = initScrollTop;
                    }
                } else if (untabKeyComboPressed(key, e)) {
                    // if the untab key combo was pressed, remove tabs instead of inserting them

                    if (text.slice(startLine).indexOf(tab) === 0) {
                        // is this tab part of the selection?
                        if (startLine === selStart) {
                            // it is, remove it
                            sel = sel.slice(tabLen);
                        } else {
                            // the tab comes before the selection
                            preTab = tabLen;
                        }
                        startTab = tabLen;
                    }

                    target.value = text.slice(0, startLine) + text.slice(startLine + preTab, selStart) +
                        sel.replace(new RegExp('\n' + tab, 'g'), function () {
                            numTabs += 1;
                            return '\n';
                        }) + text.slice(selEnd);

                    // set start and end points
                    if (range) { // IE
                        // setting end first makes calculations easier
                        range.collapse();
                        range.moveEnd(CHARACTER, selEnd - startTab - (numTabs * tabLen) - selNewlines - preNewlines);
                        range.moveStart(CHARACTER, selStart - preTab - preNewlines);
                        range.select();
                    } else {
                        // set start first for Opera
                        target.selectionStart = selStart - preTab; // preTab is 0 or tabLen
                        // move the selection end over by the total number of tabs removed
                        target.selectionEnd = selEnd - startTab - (numTabs * tabLen);
                    }
                } else {
                    return; // do nothing for invalid key combinations
                }

            } else { // single line selection

                // tab key combo - insert a tab
                if (tabKeyComboPressed(key, e)) {
                    if (range) { // IE
                        range.text = tab;
                        range.select();
                    } else {
                        target.value = text.slice(0, selStart) + tab + text.slice(selEnd);
                        target.selectionEnd = target.selectionStart = selStart + tabLen;
                        target.scrollTop = initScrollTop;
                    }
                } else if (untabKeyComboPressed(key, e)) {
                    // if the untab key combo was pressed, remove a tab instead of inserting one

                    // if the character before the selection is a tab, remove it
                    if (text.slice(selStart - tabLen).indexOf(tab) === 0) {
                        target.value = text.slice(0, selStart - tabLen) + text.slice(selStart);

                        // set start and end points
                        if (range) { // IE
                            // collapses range and moves it by -1 tab
                            range.move(CHARACTER, selStart - tabLen - preNewlines);
                            range.select();
                        } else {
                            target.selectionEnd = target.selectionStart = selStart - tabLen;
                            target.scrollTop = initScrollTop;
                        }
                    }
                } else {
                    return; // do nothing for invalid key combinations
                }
            }
        } else if (autoIndent) { // Enter key
            // insert a newline and copy the whitespace from the beginning of the line

            // find the start of the first selected line
            if (selStart === 0 || text.charAt(selStart - 1) === '\n') {
                // the selection starts at the beginning of a line
                // do nothing special
                inWhitespace = true;
                return;
            }

            // see explanation under "multi-line selection" above
            startLine = text.lastIndexOf('\n', selStart - 1) + 1;

            // find the end of the first selected line
            endLine = text.indexOf('\n', selStart);

            // if no newline is found, set endLine to the end of the text
            if (endLine === -1) {
                endLine = text.length;
            }

            // get the whitespace at the beginning of the first selected line (spaces and tabs only)
            whitespace = text.slice(startLine, endLine).match(/^[ \t]*/)[0];
            whitespaceLen = whitespace.length;

            // the cursor (selStart) is in the whitespace at beginning of the line
            // do nothing special
            if (selStart < startLine + whitespaceLen) {
                inWhitespace = true;
                return;
            }

            if (range) { // IE
                // insert the newline and whitespace
                range.text = '\n' + whitespace;
                range.select();
            } else {
                // insert the newline and whitespace
                target.value = text.slice(0, selStart) + '\n' + whitespace + text.slice(selEnd);
                // Opera uses \r\n for a newline, instead of \n,
                // so use newlineLen instead of a hard-coded value
                target.selectionEnd = target.selectionStart = selStart + newlineLen + whitespaceLen;
                target.scrollTop = initScrollTop;
            }
        }

        if (e.preventDefault) {
            e.preventDefault();
        } else {
            e.returnValue = false;
            return false;
        }
    }

    /**
     * Event handler to prevent the default action for the keypress event when
     * tab or enter is pressed. Opera and Firefox also fire a keypress event
     * when the tab or enter key is pressed. Opera requires that the default
     * action be prevented on this event or the textarea will lose focus.
     *
     * @param {Event} e  the event object
     *
     * @method tabOverride.handlers.keypress
     */
    function overrideKeyPress(e) {
        e = e || event;

        var key = e.keyCode;

        if (tabKeyComboPressed(key, e) || untabKeyComboPressed(key, e) ||
                (key === 13 && autoIndent && !inWhitespace)) {

            if (e.preventDefault) {
                e.preventDefault();
            } else {
                e.returnValue = false;
                return false;
            }
        }
    }

    /**
     * Executes all registered extension functions for the specified hook.
     *
     * @param {string} hook    the name of the hook for which the extensions are registered
     * @param {Array}  [args]  the arguments to pass to the extension
     *
     * @method tabOverride.utils.executeExtensions
     */
    function executeExtensions(hook, args) {
        var i,
            extensions = hooks[hook] || [],
            len = extensions.length;

        for (i = 0; i < len; i += 1) {
            extensions[i].apply(null, args);
        }
    }

    /**
     * @typedef {Object} tabOverride.utils~handlerObj
     *
     * @property {string}   type     the event type
     * @property {Function} handler  the handler function - passed an Event object
     */

    /**
     * @typedef {Object} tabOverride.utils~listenersObj
     *
     * @property {Function} add     Adds all the event listeners to the
     *                              specified element
     * @property {Function} remove  Removes all the event listeners from
     *                              the specified element
     */

    /**
     * Creates functions to add and remove event listeners in a cross-browser
     * compatible way.
     *
     * @param  {tabOverride.utils~handlerObj[]} handlerList  an array of {@link tabOverride.utils~handlerObj handlerObj} objects
     * @return {tabOverride.utils~listenersObj}              a listenersObj object used to add and remove the event listeners
     *
     * @method tabOverride.utils.createListeners
     */
    function createListeners(handlerList) {
        var i,
            len = handlerList.length,
            remove,
            add;

        function loop(func) {
            for (i = 0; i < len; i += 1) {
                func(handlerList[i].type, handlerList[i].handler);
            }
        }

        // use the standard event handler registration method when available
        if (document.addEventListener) {
            remove = function (elem) {
                loop(function (type, handler) {
                    elem.removeEventListener(type, handler, false);
                });
            };
            add = function (elem) {
                // remove listeners before adding them to make sure they are not
                // added more than once
                remove(elem);
                loop(function (type, handler) {
                    elem.addEventListener(type, handler, false);
                });
            };
        } else if (document.attachEvent) {
            // support IE 6-8
            remove = function (elem) {
                loop(function (type, handler) {
                    elem.detachEvent('on' + type, handler);
                });
            };
            add = function (elem) {
                remove(elem);
                loop(function (type, handler) {
                    elem.attachEvent('on' + type, handler);
                });
            };
        }

        return {
            add: add,
            remove: remove
        };
    }

    /**
     * Adds the Tab Override event listeners to the specified element.
     *
     * Hooks: addListeners - passed the element to which the listeners will
     * be added.
     *
     * @param {Element} elem  the element to which the listeners will be added
     *
     * @method tabOverride.utils.addListeners
     */
    function addListeners(elem) {
        executeExtensions('addListeners', [elem]);
        listeners.add(elem);
    }

    /**
     * Removes the Tab Override event listeners from the specified element.
     *
     * Hooks: removeListeners - passed the element from which the listeners
     * will be removed.
     *
     * @param {Element} elem  the element from which the listeners will be removed
     *
     * @method tabOverride.utils.removeListeners
     */
    function removeListeners(elem) {
        executeExtensions('removeListeners', [elem]);
        listeners.remove(elem);
    }


    // Initialize Variables

    listeners = createListeners([
        { type: 'keydown', handler: overrideKeyDown },
        { type: 'keypress', handler: overrideKeyPress }
    ]);

    // get the characters used for a newline
    textareaElem.value = '\n';
    newline = textareaElem.value;
    newlineLen = newline.length;
    textareaElem = null;


    // Public Properties and Methods

    /**
     * Namespace for utility methods
     *
     * @namespace
     */
    tabOverride.utils = {
        executeExtensions: executeExtensions,
        isValidModifierKeyCombo: isValidModifierKeyCombo,
        createListeners: createListeners,
        addListeners: addListeners,
        removeListeners: removeListeners
    };

    /**
     * Namespace for event handler functions
     *
     * @namespace
     */
    tabOverride.handlers = {
        keydown: overrideKeyDown,
        keypress: overrideKeyPress
    };

    /**
     * Adds an extension function to be executed when the specified hook is
     * "fired." The extension function is called for each element and is passed
     * any relevant arguments for the hook.
     *
     * @param  {string}   hook  the name of the hook for which the extension
     *                          will be registered
     * @param  {Function} func  the function to be executed when the hook is "fired"
     * @return {Object}         the tabOverride object
     */
    tabOverride.addExtension = function (hook, func) {
        if (hook && typeof hook === 'string' && typeof func === 'function') {
            if (!hooks[hook]) {
                hooks[hook] = [];
            }
            hooks[hook].push(func);
        }

        return this;
    };

    /**
     * Enables or disables Tab Override for the specified textarea element(s).
     *
     * Hooks: set - passed the current element and a boolean indicating whether
     * Tab Override was enabled or disabled.
     *
     * @param  {Element|Element[]} elems          the textarea element(s) for
     *                                            which to enable or disable
     *                                            Tab Override
     * @param  {boolean}           [enable=true]  whether Tab Override should be
     *                                            enabled for the element(s)
     * @return {Object}                           the tabOverride object
     */
    tabOverride.set = function (elems, enable) {
        var enableFlag,
            elemsArr,
            numElems,
            setListeners,
            attrValue,
            i,
            elem;

        if (elems) {
            enableFlag = arguments.length < 2 || enable;

            // don't manipulate param when referencing arguments object
            // this is just a matter of practice
            elemsArr = elems;
            numElems = elemsArr.length;

            if (typeof numElems !== 'number') {
                elemsArr = [elemsArr];
                numElems = 1;
            }

            if (enableFlag) {
                setListeners = addListeners;
                attrValue = 'true';
            } else {
                setListeners = removeListeners;
                attrValue = '';
            }

            for (i = 0; i < numElems; i += 1) {
                elem = elemsArr[i];
                if (elem && elem.nodeName && elem.nodeName.toLowerCase() === 'textarea') {
                    executeExtensions('set', [elem, enableFlag]);
                    elem.setAttribute('data-taboverride-enabled', attrValue);
                    setListeners(elem);
                }
            }
        }

        return this;
    };

    /**
     * Gets or sets the tab size for all elements that have Tab Override enabled.
     * 0 represents the tab character.
     *
     * @param  {number}        [size]  the tab size
     * @return {number|Object}         the tab size or the tabOverride object
     */
    tabOverride.tabSize = function (size) {
        var i;

        if (arguments.length) {
            if (size && typeof size === 'number' && size > 0) {
                aTab = '';
                for (i = 0; i < size; i += 1) {
                    aTab += ' ';
                }
            } else {
                // size is falsy (0), not a number, or a negative number
                aTab = '\t';
            }
            return this;
        }

        return (aTab === '\t') ? 0 : aTab.length;
    };

    /**
     * Gets or sets the auto indent setting. True if each line should be
     * automatically indented (default = true).
     *
     * @param  {boolean}        [enable]  whether auto indent should be enabled
     * @return {boolean|Object}           whether auto indent is enabled or the
     *                                    tabOverride object
     */
    tabOverride.autoIndent = function (enable) {
        if (arguments.length) {
            autoIndent = enable ? true : false;
            return this;
        }

        return autoIndent;
    };

    /**
     * Gets or sets the tab key combination.
     *
     * @param  {number}        keyCode             the key code of the key to use for tab
     * @param  {string[]}      [modifierKeyNames]  the modifier key names - valid names are
     *                                             'alt', 'ctrl', 'meta', and 'shift'
     * @return {string|Object}                     the current tab key combination or the
     *                                             tabOverride object
     *
     * @method
     */
    tabOverride.tabKey = createKeyComboFunction(function (keyCode) {
        if (!arguments.length) {
            return tabKey;
        }
        tabKey = keyCode;
    }, tabModifierKeys);

    /**
     * Gets or sets the untab key combination.
     *
     * @param  {number}        keyCode             the key code of the key to use for untab
     * @param  {string[]}      [modifierKeyNames]  the modifier key names - valid names are
     *                                             'alt', 'ctrl', 'meta', and 'shift'
     * @return {string|Object}                     the current untab key combination or the
     *                                             tabOverride object
     *
     * @method
     */
    tabOverride.untabKey = createKeyComboFunction(function (keyCode) {
        if (!arguments.length) {
            return untabKey;
        }
        untabKey = keyCode;
    }, untabModifierKeys);
}));
