/**
 * `navigator.audioSession` — Safari 16.4+ and not yet in TypeScript's DOM lib.
 *
 * Declaring `type: 'playback'` is what stops the iPhone's hardware silent switch
 * from muting the instrument. Without it the app is completely silent for any
 * user whose ringer switch is off, with no error and nothing in the console.
 */
interface AudioSession {
  type:
    'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record';
}

interface Navigator {
  readonly audioSession?: AudioSession;
}
