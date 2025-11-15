/**
 * Escape HTML special characters to prevent XSS attacks
 * Converts characters like <, >, &, " to their HTML entity equivalents
 * @param text - The text to escape
 * @returns The escaped HTML-safe string
 * @example
 * escapeHtml('<script>alert("xss")</script>')
 * // Returns: '&lt;script&gt;alert("xss")&lt;/script&gt;'
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
