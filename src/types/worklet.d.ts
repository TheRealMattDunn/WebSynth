/** URL of a bundled, self-contained AudioWorklet module. See plugins/vite-plugin-audio-worklet.ts */
declare module '*.worklet.ts?audio-worklet' {
  const url: string;
  export default url;
}
