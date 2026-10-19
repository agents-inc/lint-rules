export function quotedAttribute(name: string, text: string): string {
  return `${name}="${text}"`
}

export function bracedStringAttribute(name: string, text: string): string {
  return `${name}={'${text}'}`
}

/** A template with nothing interpolated: `` name={`text`} ``. */
export function templateAttribute(name: string, text: string): string {
  return `${name}={\`${text}\`}`
}

/** An expression in braces, a number or boolean among them: `name={expression}`. */
export function expressionAttribute(name: string, expression: string): string {
  return `${name}={${expression}}`
}

/** The three ways JSX writes an attribute's fixed text, which all render the same attribute. */
export function fixedTextAttributeForms(name: string, text: string): string[] {
  return [quotedAttribute(name, text), bracedStringAttribute(name, text), templateAttribute(name, text)]
}

/** A template with one expression interpolated, which no rule can read: `` name={`${expression}`} ``. */
export function interpolatedTemplateAttribute(name: string, expression: string): string {
  return `${name}={\`\${${expression}}\`}`
}
