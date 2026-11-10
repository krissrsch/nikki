import test from 'node:test';
import assert from 'node:assert/strict';
import { lyricsUrls, pickLyrics, parseLrc } from './lyrics.js';

test('lyrics: LRC lines by time, several stamps on one line, tags dropped', () => {
  const lines = parseLrc('[ar:Queen]\n[00:12.50]Is this the real life?\r\n[00:05.00][01:00.00]Chorus\n[00:20.00]\nno stamp');
  assert.deepEqual(lines, [
    { t: 5, text: 'Chorus' },
    { t: 12.5, text: 'Is this the real life?' },
    { t: 20, text: '' },
    { t: 60, text: 'Chorus' },
  ]);
});

test('lyrics: get only with album and length, search always as fallback', () => {
  const [get, search] = lyricsUrls({ title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', duration: 354.6 });
  assert.equal(get, 'https://lrclib.net/api/get?track_name=Bohemian+Rhapsody&artist_name=Queen&album_name=A+Night+at+the+Opera&duration=355');
  assert.equal(search, 'https://lrclib.net/api/search?track_name=Bohemian+Rhapsody&artist_name=Queen');
  assert.deepEqual(lyricsUrls({ title: 'x', artist: 'y', album: '', duration: 100 }), ['https://lrclib.net/api/search?track_name=x&artist_name=y']);
});

test('lyrics: the first synced record wins, an instrumental has none, plain-only counts as missing', () => {
  assert.deepEqual(pickLyrics([{ plainLyrics: 'a' }, { syncedLyrics: '[00:01.00]b' }]), [{ t: 1, text: 'b' }]);
  assert.deepEqual(pickLyrics({ instrumental: true, syncedLyrics: null }), []);
  assert.equal(pickLyrics({ plainLyrics: 'only plain', syncedLyrics: null }), null);
  assert.equal(pickLyrics([]), null);
  assert.equal(pickLyrics(null), null);
});

test('lyrics: with a known length, a record more than 3 s off does not count', () => {
  const recs = [{ duration: 210, syncedLyrics: '[00:01.00]edit' }, { duration: 241, syncedLyrics: '[00:01.00]album' }];
  assert.deepEqual(pickLyrics(recs, 240), [{ t: 1, text: 'album' }]);
  assert.equal(pickLyrics(recs, 300), null);
  assert.deepEqual(pickLyrics(recs, 0), [{ t: 1, text: 'edit' }], 'unknown length: the first one');
});
