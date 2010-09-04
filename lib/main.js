const {Cc,Ci} = require("chrome");
const contextMenu = require("context-menu");
const request = require("request");
const self = require("self");
const notifications = require("notifications");
const beautify = require("beautify");

exports.main = function(options, callbacks) {
  var jsBeautifyMenuItem = contextMenu.Item({
    label: "JavaScript Beautifier (jsbeautifier.org)",
    context: "pre, code",
    onClick: function (contextObj, item) {
      contextObj.node.textContent = beautify.js_beautify(contextObj.node.textContent);
      notification("JavaScript Beautifier");
    }
  });

  var htmlBeautifyMenuItem = contextMenu.Item({
    label: "HTML beautify (Ham Cutlet)",
    context: "pre, code",
    onClick: function (contextObj, item) {
      request.Request({
        url: "http://hamcutlet.fjord.jp/",
        content: { source: contextObj.node.textContent },
        onComplete: function() {
          var dom = createHTMLDocument_XSLT(this.response.text);
          var result = decodeURIComponent(dom.querySelector('.source textarea').textContent);
          contextObj.node.textContent = result;
          notification("HTML Beautify");
        }
      }).post();
    }
  });

  var syntaxHighlightMenuItem = contextMenu.Item({
    label: "Syntax Highlight (google-code-prettify)",
    context: "pre, code",
    onClick: function (contextObj, item) {
      contextObj.node.id = "prettify_node";

      // load prettify.css & override the github style.
      addStyle(self.data.load("prettify.css"));
      addStyle(self.data.load("github.css"));

      var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
               .getService(Ci.nsIWindowMediator).getMostRecentWindow("navigator:browser");
      var win = wm.content.window;
      var doc = win.document;
      var iframe = doc.createElement("iframe");
      iframe.id = "codeIframe";
      iframe.style.display = "none";
      doc.body.appendChild(iframe);

      iframe.addEventListener("load", function() {
        var prettify = doc.createElement("script");
        prettify.textContent = self.data.load("prettify.js");
        this.contentDocument.getElementsByTagName('head')[0].appendChild(prettify);

        var pre = doc.createElement("pre");
        pre.className = "prettyprint";
        pre.textContent = contextObj.node.textContent;
        this.contentDocument.body.appendChild(pre);

        // doc.getElementById('codeIframe').contentWindow.prettyPrint()ができないのでlocationハック。
        // doc.getElementById('codeIframe').contentDocument.querySelector("pre").innerHTMLもなぜか別物が出力される。
        evalInPage(function(){
          var codeIframe = document.getElementById('codeIframe');
          codeIframe.contentWindow.prettyPrint();
          var ipre = codeIframe.contentDocument.querySelector("pre");
          var expre = document.getElementById("prettify_node");
          expre.parentNode.replaceChild(ipre, expre);

          expre.id = "";
          codeIframe.parentNode.removeChild(codeIframe);
        });
        notification("Syntax Highlight");
      }, false);
    }
  });
  contextMenu.add(jsBeautifyMenuItem);
  contextMenu.add(htmlBeautifyMenuItem);
  contextMenu.add(syntaxHighlightMenuItem);
}

//util functions
function evalInPage(fun) {
  var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
             .getService(Ci.nsIWindowMediator).getMostRecentWindow("navigator:browser");
  var win = wm.content.window;
  win.location.href = "javascript:void (" + fun + ")()";
}

function notification(msg) {
  notifications.notify({
    title: "Jetpack",
    text: msg
  });
}

function addStyle(css) {
  var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
             .getService(Ci.nsIWindowMediator).getMostRecentWindow("navigator:browser");
  var doc = wm.content.document;
  var style = doc.createElement("style");
  style.type = "text/css";
  style.appendChild(doc.createTextNode(css));
  doc.querySelector("head").appendChild(style);
}

function createHTMLDocument_XSLT(source) {
  var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
             .getService(Ci.nsIWindowMediator)
             .getMostRecentWindow("navigator:browser");
  var win = wm.content.window;
  var processor = new win.XSLTProcessor();
  var sheet = new win.DOMParser().parseFromString(
    '<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">' +
      '<xsl:output method="html"/>' +
      '<xsl:template match="/">' +
        '<html><head><title></title></head><body></body></html>' +
      '</xsl:template>' +
    '</xsl:stylesheet>',
    'application/xml'
  );
  processor.importStylesheet(sheet);
  var doc = processor.transformToDocument(sheet);
  var range = doc.createRange();
  range.selectNodeContents(doc.documentElement);
  range.deleteContents();
  doc.documentElement.appendChild(range.createContextualFragment(source));
  return doc;
}