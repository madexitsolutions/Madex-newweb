"use client";

import { useEffect, useRef, useState } from "react";

type Tool = { label: string; title: string; kind: "block" | "exec" | "link"; arg: string; state?: string };

const TOOLS: Tool[] = [
  { label: "Absatz", title: "Normaler Text", kind: "block", arg: "p" },
  { label: "H2", title: "Überschrift", kind: "block", arg: "h2" },
  { label: "H3", title: "Zwischenüberschrift", kind: "block", arg: "h3" },
  { label: "F", title: "Fett (Strg+B)", kind: "exec", arg: "bold", state: "bold" },
  { label: "K", title: "Kursiv (Strg+I)", kind: "exec", arg: "italic", state: "italic" },
  { label: "• Liste", title: "Aufzählung", kind: "exec", arg: "insertUnorderedList", state: "insertUnorderedList" },
  { label: "1. Liste", title: "Nummerierte Liste", kind: "exec", arg: "insertOrderedList", state: "insertOrderedList" },
  { label: "Zitat", title: "Zitat", kind: "block", arg: "blockquote" },
  { label: "Link", title: "Link einfügen", kind: "link", arg: "createLink" },
  { label: "Link entfernen", title: "Link entfernen", kind: "exec", arg: "unlink" },
  { label: "Format löschen", title: "Formatierung entfernen", kind: "exec", arg: "removeFormat" },
];

function queryState(c: string) {
  try {
    return document.queryCommandState(c);
  } catch {
    return false;
  }
}

/**
 * Small rich-text editor (contenteditable) for descriptions and posts. The HTML
 * is written to a hidden input `name` and sanitised on the server
 * (sanitizeHtml) before it is stored. Pasting inserts plain text.
 */
export function RichText({ name, defaultValue = "", label, help, minHeight = 220 }: { name: string; defaultValue?: string; label: string; help?: string; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(defaultValue);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const id = `rt-${name}`;

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== defaultValue) ref.current.innerHTML = defaultValue;
    // only on mount: the editor owns its content afterwards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = () => setActive(Object.fromEntries(TOOLS.filter((t) => t.state).map((t) => [t.state!, queryState(t.state!)])));

  const apply = (tool: Tool) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    if (tool.kind === "block") document.execCommand("formatBlock", false, tool.arg);
    else if (tool.kind === "link") {
      const url = window.prompt("Adresse des Links (https://…, /seite, mailto:…)");
      if (!url) return;
      document.execCommand("createLink", false, url);
    } else document.execCommand(tool.arg, false);
    setHtml(el.innerHTML);
    refresh();
  };

  return (
    <div className="a-field a-rt">
      <span id={`${id}-label`}>{label}</span>
      <div className="a-rt__bar" role="toolbar" aria-label={`Formatierung: ${label}`}>
        {TOOLS.map((tool) => (
          <button key={tool.label} type="button" title={tool.title} aria-pressed={tool.state ? Boolean(active[tool.state]) : undefined} onMouseDown={(e) => e.preventDefault()} onClick={() => apply(tool)}>
            {tool.label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        id={id}
        className="a-rt__area"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-labelledby={`${id}-label`}
        style={{ minHeight }}
        onInput={(e) => setHtml(e.currentTarget.innerHTML)}
        onKeyUp={refresh}
        onMouseUp={refresh}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
      />
      <input type="hidden" name={name} value={html} />
      {help && <small>{help}</small>}
    </div>
  );
}
