"""Procedural soundtrack + SFX for the Dynasty Manager pack ads.

Everything is synthesised here from oscillators and noise, so the audio is
owned outright: no sample licence, no music-library claim, safe for paid use.

usage: python3 marketing/postproduction/score-ad.py <style> <cue> <duration> <out.wav>
needs: pip install numpy scipy
styles: anthem | phonk | cinematic | preview
"""
import sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
rng = np.random.default_rng(7)


# ── primitives ──────────────────────────────────────────────────────────────
def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def env_adsr(n, a=0.005, d=0.1, s=0.0, r=0.05, hold=None):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    hold_n = n - a_n - d_n - r_n if hold is None else int(hold * SR)
    hold_n = max(hold_n, 0)
    e = np.concatenate([
        np.linspace(0, 1, max(a_n, 1)),
        np.linspace(1, s, max(d_n, 1)),
        np.full(hold_n, s),
        np.linspace(s, 0, max(r_n, 1)),
    ])
    if len(e) < n:
        e = np.pad(e, (0, n - len(e)))
    return e[:n]


def filt(x, kind, freq, order=2):
    nyq = SR / 2
    if kind == 'band':
        sos = butter(order, [freq[0] / nyq, min(freq[1] / nyq, 0.99)], btype='band', output='sos')
    else:
        sos = butter(order, min(freq / nyq, 0.99), btype=kind, output='sos')
    return sosfilt(sos, x)


def sweep_lp(x, f0, f1, steps=64):
    """Time-varying low-pass by crossfading blocks — cheap filter sweep."""
    out = np.zeros_like(x)
    n = len(x)
    edges = np.linspace(0, n, steps + 1).astype(int)
    for i in range(steps):
        f = f0 * (f1 / f0) ** (i / max(steps - 1, 1))
        a, b = max(edges[i] - 512, 0), min(edges[i + 1] + 512, n)
        seg = filt(x[a:b], 'low', f)
        out[edges[i]:edges[i + 1]] = seg[edges[i] - a:edges[i] - a + edges[i + 1] - edges[i]]
    return out


def saw(freq, t, detune=0.0):
    ph = (freq * (1 + detune) * t) % 1.0
    return 2 * ph - 1


def supersaw(freq, t, voices=7, spread=0.012):
    out = np.zeros_like(t)
    for v in range(voices):
        d = (v - (voices - 1) / 2) / ((voices - 1) / 2) * spread
        out += saw(freq, t + rng.random() / freq, d)
    return out / voices


def note(n):  # MIDI -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)


def reverb(x, secs=1.6, wet=0.25):
    n = int(secs * SR)
    ir = rng.standard_normal(n) * np.exp(-np.linspace(0, 7, n))
    ir = filt(ir, 'low', 6000)
    ir /= np.sqrt(np.sum(ir ** 2))
    return x * (1 - wet) + fftconvolve(x, ir)[:len(x)] * wet


def place(buf, sig, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf) or i + len(sig) <= 0:
        return
    if i < 0:
        sig, i = sig[-i:], 0
    end = min(len(buf), i + len(sig))
    buf[i:end] += sig[:end - i] * gain


# ── instruments ─────────────────────────────────────────────────────────────
def kick(punch=1.0):
    t = t_axis(0.45)
    f = 45 + 110 * np.exp(-t * 28)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    click = filt(rng.standard_normal(len(t)), 'high', 2500) * np.exp(-t * 300) * 0.4
    return np.tanh((body + click) * 1.6 * punch)


def clap():
    t = t_axis(0.35)
    n = rng.standard_normal(len(t))
    bursts = sum(np.exp(-np.clip(t - o, 0, None) * 60) * (t >= o) for o in (0, 0.011, 0.022))
    x = filt(n, 'band', (900, 6000)) * (bursts * 0.5 + np.exp(-t * 18) * 0.6)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.4
    return reverb(x + body, 0.8, 0.3)


def hat(open_=False):
    t = t_axis(0.25 if open_ else 0.05)
    x = filt(rng.standard_normal(len(t)), 'high', 7500)
    return x * np.exp(-t * (14 if open_ else 90)) * 0.5


def cowbell():
    t = t_axis(0.3)
    x = np.sign(np.sin(2 * np.pi * 540 * t)) + np.sign(np.sin(2 * np.pi * 800 * t))
    return filt(x, 'band', (500, 4000)) * np.exp(-t * 12) * 0.25


def bass808(freq, dur, glide_from=None, drive=3.5):
    t = t_axis(dur)
    f = np.full_like(t, freq)
    if glide_from:
        f = freq + (glide_from - freq) * np.exp(-t * 18)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR)
    x = np.tanh(x * drive) * env_adsr(len(t), 0.003, dur * 0.6, 0.5, 0.08)
    return x


def chord_stab(notes, dur, bright=3500):
    t = t_axis(dur)
    x = sum(supersaw(note(n), t) for n in notes) / len(notes)
    x = filt(x, 'low', bright) * env_adsr(len(t), 0.01, dur * 0.5, 0.35, 0.12)
    return x


def pad(notes, dur, cutoff=900):
    t = t_axis(dur)
    x = sum(supersaw(note(n), t, 5, 0.008) for n in notes) / len(notes)
    return filt(x, 'low', cutoff) * env_adsr(len(t), 0.4, 0.2, 0.9, 0.6)


def brass(midi, dur):
    t = t_axis(dur)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.clip(t * 3, 0, 1)
    x = supersaw(note(midi), t * vib, 5, 0.006) + 0.5 * saw(note(midi - 12), t)
    x = sweep_lp(x, 700, 4200, 16) * env_adsr(len(t), 0.03, 0.15, 0.8, 0.12)
    return x


def taiko():
    t = t_axis(0.9)
    f = 60 + 60 * np.exp(-t * 20)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5)
    skin = filt(rng.standard_normal(len(t)), 'band', (150, 1200)) * np.exp(-t * 25) * 0.5
    return reverb(np.tanh(body * 1.4 + skin), 1.4, 0.3)


def strings_ostinato(notes, dur, bpm):
    step = 60 / bpm / 4
    t = t_axis(dur)
    out = np.zeros_like(t)
    for i in range(int(dur / step)):
        n = notes[i % len(notes)]
        seg = supersaw(note(n), t_axis(step), 5, 0.006)
        seg = filt(seg, 'low', 2800) * env_adsr(len(seg), 0.005, step * 0.8, 0.0, 0.01)
        place(out, seg, i * step)
    return out


# ── SFX ─────────────────────────────────────────────────────────────────────
def riser(dur):
    t = t_axis(dur)
    p = t / dur
    noise = filt(rng.standard_normal(len(t)), 'high', 400)
    noise = sweep_lp(noise, 500, 12000, 48) * p ** 2
    tone_f = 110 * 2 ** (p * 3)
    tone = np.sin(2 * np.pi * np.cumsum(tone_f) / SR) * 0.35 * p ** 1.5
    return (noise * 0.6 + tone) * np.minimum(1, (1 - p) * 40)


def impact():
    t = t_axis(3.0)
    f = 30 + 90 * np.exp(-t * 6)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    crack = filt(rng.standard_normal(len(t)), 'band', (200, 9000)) * np.exp(-t * 14)
    return reverb(np.tanh(sub * 2.2 + crack * 0.8), 2.4, 0.35)


def whoosh(dur=0.6, up=True):
    t = t_axis(dur)
    x = rng.standard_normal(len(t))
    x = sweep_lp(x, 300 if up else 6000, 6000 if up else 300, 24)
    return x * np.sin(np.pi * t / dur) ** 2 * 0.7


def flip():
    t = t_axis(0.14)
    x = filt(rng.standard_normal(len(t)), 'band', (1200, 8000)) * np.exp(-t * 45)
    snap = np.sin(2 * np.pi * 900 * t) * np.exp(-t * 90) * 0.4
    return x * 0.8 + snap


def shimmer(dur=2.5):
    t = t_axis(dur)
    x = np.zeros_like(t)
    for k, n in enumerate((86, 89, 93, 98, 101)):
        seg = np.sin(2 * np.pi * note(n) * t_axis(dur - k * 0.06)) * np.exp(-t_axis(dur - k * 0.06) * 2.2)
        place(x, seg, k * 0.06, 0.18)
    return reverb(x, 2.0, 0.45)


def crowd(dur, swell_at=0.4):
    """Stadium roar: many band-limited noise voices with slow random swells."""
    t = t_axis(dur)
    out = np.zeros_like(t)
    for lo, hi, g in ((180, 700, 1.0), (400, 1500, 0.8), (900, 3200, 0.45), (2500, 6000, 0.15)):
        v = filt(rng.standard_normal(len(t)), 'band', (lo, hi), 2)
        lfo = filt(rng.standard_normal(len(t)), 'low', 3)
        lfo = 0.75 + 0.25 * lfo / (np.abs(lfo).max() + 1e-9)
        out += v * lfo * g
    shape = np.clip(t / swell_at, 0, 1) ** 0.5 * np.exp(-np.clip(t - swell_at, 0, None) * 0.25)
    out = out * shape
    return reverb(out / (np.abs(out).max() + 1e-9), 1.8, 0.3)


# ── arrangement ─────────────────────────────────────────────────────────────
STYLES = {
    'anthem':    dict(bpm=140, root=50, prog=[(0, 3, 7), (-4, 0, 3), (3, 7, 10), (-2, 2, 5)], drums='trap'),
    'phonk':     dict(bpm=130, root=49, prog=[(0, 3, 7), (0, 3, 7), (-4, 0, 3), (-2, 2, 5)], drums='phonk'),
    'cinematic': dict(bpm=120, root=50, prog=[(0, 3, 7), (-4, 0, 3), (-7, -3, 0), (-2, 2, 5)], drums='epic'),
    'preview':   dict(bpm=110, root=50, prog=[(0, 3, 7), (-4, 0, 3), (3, 7, 10), (-2, 2, 5)], drums='soft'),
}


def score(style, cues, dur):
    st = STYLES[style]
    bpm, root, prog = st['bpm'], st['root'], st['prog']
    beat = 60 / bpm
    bar = beat * 4
    drop = cues['drop']
    music = np.zeros(int(dur * SR) + SR)
    sfx = np.zeros_like(music)

    def grid(start, end, step):
        # beat grid anchored on the drop so the downbeat lands on the reveal
        k0 = int(np.floor((start - drop) / step))
        k1 = int(np.ceil((end - drop) / step))
        return [drop + k * step for k in range(k0, k1) if start <= drop + k * step < end]

    def chord_at(time):
        idx = int(np.floor((time - drop) / bar)) % len(prog)
        return [root + 12 + i for i in prog[idx]]

    # 1) intro: dark filtered pad + ticking hats, stab on each card flip
    intro_end = cues['build']
    for b in grid(0, intro_end, bar):
        place(music, pad(chord_at(b), bar + 0.3, 1500 if style != 'preview' else 1800), b, 0.9)
    if style != 'preview':
        for h in grid(0, intro_end, beat / 2):
            place(music, hat(), h, 0.14)
        # heartbeat: muted kick + 808 root on every beat, the tension bed
        for k in grid(0, intro_end, beat):
            place(music, kick(0.7), k, 0.3)
        for b in grid(0, intro_end, bar):
            place(music, bass808(note(chord_at(b)[0] - 24), bar * 0.9, drive=2.5), b, 0.18)
    for f in cues.get('flips', []):
        place(sfx, flip(), f, 0.6)
        if style != 'preview':
            place(music, chord_stab(chord_at(f), 0.25, 1800), f, 0.25)

    # 2) build: riser + accelerating snare roll, drums cut 1/8 before the drop
    bl = drop - cues['build']
    place(sfx, riser(bl), cues['build'], 0.8)
    if style not in ('preview',):
        roll_t = cues['build']
        step = beat / 2
        while roll_t < drop - beat / 4:
            place(music, clap() * 0.6, roll_t, 0.12 + 0.35 * (roll_t - cues['build']) / bl)
            roll_t += step
            step = max(beat / 8, step * 0.86)
    place(sfx, whoosh(0.5, True), drop - 0.5, 0.6)

    # 3) drop: impact + crowd + full groove
    place(sfx, impact(), drop, 1.0)
    place(sfx, shimmer(), drop + 0.05, 0.8)
    if cues.get('crowd', True):
        place(sfx, crowd(min(dur - drop + 0.5, 9), 0.35), drop - 0.05, 0.42)

    end = dur
    drums = st['drums']
    for b in grid(drop, end, bar):
        ch = chord_at(b)
        if drums == 'epic':
            place(music, strings_ostinato([ch[0] + 12, ch[1] + 24, ch[2] + 12, ch[1] + 24], bar, bpm), b, 0.4)
            place(music, brass(ch[0] + 12, bar * 0.95), b, 0.5)
            place(music, brass(ch[2] + 12, bar * 0.95), b, 0.35)
        elif drums == 'soft':
            place(music, pad(ch, bar + 0.3, 1800), b, 0.4)
            place(music, strings_ostinato([ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12], bar, bpm), b, 0.12)
        else:
            place(music, pad(ch, bar + 0.3, 2200), b, 0.5)
            # brass hook: root on 1, fifth on the "and" of 2, third on 4
            for off, iv in ((0, 0), (beat * 1.5, 2), (beat * 3, 1)):
                place(music, brass(ch[iv] + 12, beat * 1.2), b + off, 0.55 if drums == 'trap' else 0.3)
            if drums == 'phonk':
                mel = [ch[0] + 24, ch[1] + 24, ch[2] + 24, ch[1] + 24]
                for i, s in enumerate(grid(b, b + bar, beat / 2)):
                    cb = cowbell()
                    place(music, cb, s, 0.5 if i % 2 == 0 else 0.3)
        # 808 / low end
        if drums in ('trap', 'phonk'):
            place(music, bass808(note(ch[0] - 24), beat * 1.5, note(ch[0] - 12)), b, 0.32)
            place(music, bass808(note(ch[0] - 24), beat * 1.0), b + beat * 2.5, 0.28)
            place(music, bass808(note(ch[2] - 24), beat * 1.0), b + beat * 3.5, 0.26)

    for s in grid(drop, end, beat):
        k = int(round((s - drop) / beat))
        if drums in ('trap', 'phonk'):
            if k % 4 in (0,) or (k % 8 == 5):
                place(music, kick(), s, 0.55)
            if k % 4 == 2:
                place(music, clap(), s, 0.55)
        elif drums == 'epic':
            if k % 2 == 0:
                place(music, taiko(), s, 0.6)
            if k % 4 == 3:
                place(music, taiko(), s + beat / 2, 0.4)
        elif drums == 'soft':
            if k % 4 == 0:
                place(music, kick(0.6), s, 0.4)
    if drums in ('trap', 'phonk'):
        for i, h in enumerate(grid(drop, end, beat / 4)):
            roll = (i // 8) % 4 == 3 and i % 2 == 1
            if i % 2 == 0 or roll:
                place(music, hat(), h, 0.11 if i % 4 == 0 else 0.07)
        for h in grid(drop, end, bar):
            place(music, hat(True), h + beat * 1.5, 0.06)

    # 4) transitions inside the drop
    for w in cues.get('whoosh', []):
        place(sfx, whoosh(0.45, False), w - 0.2, 0.5)
    if 'cta' in cues:
        place(sfx, impact() * 0.55, cues['cta'], 0.6)
        place(sfx, shimmer(1.5), cues['cta'], 0.5)

    # mix: duck music under the drop hit, sidechain-ish pump on kicks
    mix = music[:int(dur * SR)] * 0.9 + sfx[:int(dur * SR)]
    fade = int(0.35 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)
    mix = filt(mix, 'high', 35)
    # master tilt: tame the noise-born top end, keep air above 10k subtle
    mix = mix - 0.25 * filt(mix, 'high', 6000) - 0.15 * filt(mix, 'high', 11000)
    mix = np.tanh(mix * 1.1)
    # stereo: widen with a short Haas-style delayed copy of the high band
    hi = filt(mix, 'high', 1500)
    d = int(0.012 * SR)
    left = mix + 0.15 * np.concatenate([np.zeros(d), hi[:-d]])
    right = mix - 0.15 * np.concatenate([np.zeros(d), hi[:-d]])
    st_mix = np.stack([left, right], axis=1)
    return st_mix / (np.abs(st_mix).max() + 1e-9) * 0.89


CUES = {
    # 5-card pack plan (01, 02, 04, 05): flips while the grid turns, walkout
    # spin from 3.5s, rating slams in ~5.5s, summary ~10s, CTA 12.6s.
    'pack5': dict(flips=[0.3, 0.95, 1.6, 2.3, 2.95], build=3.45, drop=5.5, whoosh=[10.0], cta=12.6),
    # single-card Legends plan (03): packet 1-3s, rip 3.5, rating lands ~5.9
    'icon': dict(flips=[3.5], build=3.9, drop=5.9, whoosh=[], cta=7.5),
    # App Preview (06): packet, rip 1.5, four reveals, walkout 6.5, summary 8.5
    'preview': dict(flips=[1.5, 3.5, 4.5, 5.5, 6.0], build=5.8, drop=6.9, whoosh=[8.5], crowd=True),
}

if __name__ == '__main__':
    style, cue, dur, out = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
    audio = score(style, CUES[cue], dur)
    import wave
    pcm = (audio * 32767).astype('<i2')
    with wave.open(out, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print('wrote', out, f'{dur:.2f}s')
