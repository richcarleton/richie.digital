// ── MIDI control surface ──────────────────────────────────────────────────────
// Silent test mode — no audio. Samples/images directories pending.
//
// Note-on  → trigger comet
// CC 1     → dither depth (2–16)   chaos / glitch
// CC 7     → dither depth inverse  (smoothing direction)
// CC 74    → dither depth (common filter cutoff knob on many controllers)

if (!navigator.requestMIDIAccess) {
  console.log('[MIDI] Web MIDI API not supported in this browser.');
} else {
  navigator.requestMIDIAccess({ sysex: false }).then(onMIDIReady, onMIDIFail);
}

function onMIDIReady(access) {
  console.log(`[MIDI] Ready. ${access.inputs.size} input(s) found.`);

  for (const input of access.inputs.values()) {
    console.log(`[MIDI] Listening on: ${input.name}`);
    input.onmidimessage = handleMIDI;
  }

  access.onstatechange = e => {
    if (e.port.type === 'input' && e.port.state === 'connected') {
      console.log(`[MIDI] Device connected: ${e.port.name}`);
      e.port.onmidimessage = handleMIDI;
    }
  };
}

function onMIDIFail(err) {
  console.warn('[MIDI] Access denied or unavailable:', err);
}

function handleMIDI(msg) {
  const [status, note, value] = msg.data;
  const type = status & 0xf0;

  // any input resets the idle comet timer
  if (window.resetCometIdle) window.resetCometIdle();

  // ── Note On → trigger comet ───────────────────────────────────────────────
  if (type === 0x90 && value > 0) {
    if (window.triggerComet) window.triggerComet();
  }

  // ── CC → planet parameters ────────────────────────────────────────────────
  if (type === 0xb0 && window.planetUniforms) {
    const norm = value / 127;
    switch (note) {
      case 1:   // mod wheel — crank it for chaos
      case 74:  // common filter cutoff knob
        window.planetUniforms.setDitherDepth(2 + norm * 14); // 2 (blocky chaos) → 16 (smooth)
        break;
      // add more CC mappings here as the setup grows
    }
  }
}
