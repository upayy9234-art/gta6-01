// Virelia radio: three stations, a ticker line in the HUD, and VPD dispatch
// chatter. The ticker cycles every few seconds between the current track and a
// dispatch line, so the HUD always has something new to read. Track names live
// here (and in audio.js, which hums the bassline); the station can be switched
// with the R key while playing.
// Every eighth line is a weather report instead of a plain dispatch line —
// when the sky has news, the radio says so first. Each kind has two variants
// that rotate, so the ticker never repeats the same line twice in a row.
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

// Weather reports ride the dispatch channel: two variants per kind, picked
// in rotation so the ticker never repeats the same line twice in a row.
const WEATHER_REPORTS = {
  rain: [
    'VPD DISPATCH · Rain over the harbour — wet roads, drive careful out there',
    'VPD DISPATCH · Rain slicking the Strip — units, slow it down',
  ],
  storm: [
    'VPD DISPATCH · Storm warning — lightning over Virelia, all units watch the skies',
    'VPD DISPATCH · Storm over the harbour — lightning strikes, stay sharp',
  ],
  fog: [
    'VPD DISPATCH · Fog rolling in off the water — visibility down across the city',
    'VPD DISPATCH · Fog on the boulevard — headlights on, eyes open',
  ],
};

export function weatherReportLine(state) {
  const kind = state.weather ? state.weather.kind : 'clear';
  const variants = WEATHER_REPORTS[kind];
  if (!variants) return '';
  const radio = state.radio;
  const pick = radio ? Math.floor(radio.line / 8) % variants.length : 0;
  return variants[pick];
}

export function updateRadio(state, dt) {
  const radio = state.radio;
  if (!radio) return;
  radio.timer -= dt;
  if (radio.timer > 0) return;
  radio.timer = TICKER_SECONDS;
  // Alternate track / dispatch, advance the track each full round.
  radio.line += 1;
  if (radio.line % 8 === 7) {
    // Every eighth line is a weather report — when the sky has news.
    const report = weatherReportLine(state);
    radio.current = report || dispatchLine(radio);
  } else if (radio.line % 2 === 0) {
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
