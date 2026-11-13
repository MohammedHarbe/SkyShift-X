/** The minified "basic" Plotly bundle ships no types; it exposes the same API as `plotly.js`. */
declare module 'plotly.js-basic-dist-min' {
  import type * as Plotly from 'plotly.js';
  const plotly: typeof Plotly;
  export default plotly;
}
