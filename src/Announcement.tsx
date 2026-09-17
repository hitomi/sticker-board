import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

export default function Announcement({ content }: { content: string }) {
  const html = useMemo(() => {
    const fragment = DOMPurify.sanitize(
      marked.parse(content, { async: false, breaks: true }),
      {
        ALLOWED_TAGS: [
          "p",
          "br",
          "hr",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "strong",
          "em",
          "del",
          "blockquote",
          "ul",
          "ol",
          "li",
          "pre",
          "code",
          "a",
          "img",
          "table",
          "thead",
          "tbody",
          "tr",
          "th",
          "td",
          "input",
        ],
        ALLOWED_ATTR: [
          "href",
          "src",
          "alt",
          "title",
          "start",
          "align",
          "type",
          "checked",
          "disabled",
        ],
        RETURN_DOM_FRAGMENT: true,
      },
    );
    for (const link of fragment.querySelectorAll("a")) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    for (const input of fragment.querySelectorAll("input")) {
      // Markdown task lists are display-only, including when supplied as HTML.
      input.type = "checkbox";
      input.disabled = true;
    }
    const container = document.createElement("div");
    container.append(fragment);
    return container.innerHTML;
  }, [content]);
  return (
    <div
      className="announcement-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
