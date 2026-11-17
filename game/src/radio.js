// Virelia radio: three stations, a ticker line in the HUD, and VPD dispatch
// chatter. The ticker cycles every few seconds between the current track and a
// dispatch line, so the HUD always has something new to read. Track names live
// here (and in audio.js, which hums the bassline); the station can be switched
// with the R key while playing.
import { RADIO_DISPATCH, RADIO_STATIONS as STATIONS } from './config.js';

export const RADIO_STATIONS = STATIONS;
export const TICKER_SECONDS = 5;

export function createRadio() {
  return {
    station: 0,
    track: 0,
    line: 0,
    timer: 0,
    // The line the HUD is showing right now: station + track or dispatch.
    current: '',
  };
}

function trackLine(radio) {
  const st = STATIONS[radio.station];
  const track = st.tracks[radio.track % st.tracks.length];
  return st.name + ' · ' + track;
}

function dispatchLine(radio) {
  return 'VPD DISPATCH · ' + RADIO_DISPATCH[radio.line % RADIO_DISPATCH.length];
}

export function updateRadio(state, dt) {
  const radio = state.radio;
  if (!radio) return;
  radio.timer -= dt;
  if (radio.timer > 0) return;
  radio.timer = TICKER_SECONDS;
  // Alternate track / dispatch, advance the track each full round.
  radio.line += 1;
  if (radio.line % 2 === 0) {
    radio.track += 1;
    radio.current = trackLine(radio);
  } else {
    radio.current = dispatchLine(radio);
  }
  // Every sixth line, hop to the next station so all three get airtime.
  if (radio.line % 6 === 5) {
    radio.station = (radio.station + 1) % STATIONS.length;
    radio.track = 0;
  }
}

export function radioTickerText(state) {
  const radio = state.radio;
  if (!radio) return '';
  if (!radio.current) radio.current = trackLine(radio);
  return radio.current;
}

export function radioStationName(state) {
  const radio = state.radio;
  if (!radio) return '';
  return STATIONS[radio.station].name + ' — ' + STATIONS[radio.station].desc;
}

export function cycleStation(state) {
  const radio = state.radio;
  if (!radio) return;
  radio.station = (radio.station + 1) % STATIONS.length;
  radio.track = 0;
  radio.current = trackLine(radio);
  radio.timer = TICKER_SECONDS;
  state.bannerText = 'Radio: ' + radioStationName(state);
  state.bannerTimer = 2;
  state.audio?.tune();
}
