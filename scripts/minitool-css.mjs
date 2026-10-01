import postcss from "postcss";

// Add only fallbacks for features used by the existing component styles.
export function miniToolCss(source) {
  const root = postcss.parse(source.replace('@import "tailwindcss";', ""));
  root.walkDecls((declaration) => {
    if (/\b\d+(?:d|s|l)vh\b/.test(declaration.value)) {
      declaration.cloneBefore({ value: declaration.value.replace(/\b(\d+)(?:d|s|l)vh\b/g, "$1vh") });
    }
    if (declaration.prop === "inset" && declaration.value === "0") {
      for (const prop of ["top", "right", "bottom", "left"]) declaration.cloneBefore({ prop });
    }
  });
  const layouts = new Map();
  root.walkRules((rule) => {
    rule.walkDecls(/^(display|flex-direction)$/, (declaration) => {
      for (const selector of rule.selectors) {
        const key = selector.trim().split(/\s+/).pop();
        const layout = layouts.get(key) || {};
        if (declaration.prop === "display") layout.display = declaration.value;
        else layout.direction = declaration.value;
        layouts.set(key, layout);
      }
    });
  });
  root.walkRules((rule) => {
    let gap;
    rule.walkDecls("gap", (declaration) => { gap = declaration.value; declaration.cloneBefore({ prop: "grid-gap" }); });
    if (!gap) return;
    for (const selector of rule.selectors) {
      const key = selector.trim().split(/\s+/).pop();
      const layout = layouts.get(key) || (key.includes("button") ? { display: "inline-flex" } : {});
      if (!/flex/.test(layout.display || "")) continue;
      const fallback = postcss.rule({ selector: `.no-flex-gap ${selector} > * + *` });
      fallback.append({ prop: layout.direction === "column" ? "margin-top" : "margin-left", value: gap });
      rule.parent.insertAfter(rule, fallback);
    }
  });
  return root.toString();
}
