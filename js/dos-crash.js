/**
 * DOS Crash Effect
 * Retro computer crash screen with animated glitches and CLI exposure
 */

class DOSCrash {
  constructor(options = {}) {
    this.container = options.container || document.body;
    this.onClose = options.onClose || (() => {});
    this.duration = options.duration || 0; // 0 = manual close only
    this.glitchIntensity = options.glitchIntensity || 0.7;
    this.scanlineIntensity = options.scanlineIntensity || 0.3;
    
    this.overlay = null;
    this.canvas = null;
    this.ctx = null;
    this.scanlineOffset = 0;
    this.glitchFrames = 0;
    this.isActive = false;
    this.startTime = 0;
    
    this.lines = [
      'C:\\RICHIE\\>',
      'Reading disk sectors...',
      'ERROR: Disk I/O failure',
      'CRITICAL SYSTEM ERROR',
      'Exception at 0x7F2A3D44',
      'Segmentation fault (core dumped)',
      'Fatal exception 0E at 0028:C0000005',
      'Stack overflow',
      'Dumping memory to CRASH.DMP...',
      'System halted.',
      '',
      'Press any key to reboot...'
    ];
    
    this.outputLines = [];
  }

  async init() {
    // Create overlay container
    this.overlay = document.createElement('div');
    this.overlay.id = 'dos-crash-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: #000;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      font-family: "Courier New", monospace;
      color: #00ff00;
      overflow: hidden;
      cursor: wait;
    `;

    // Canvas for scanlines and glitch effects
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'dos-crash-canvas';
    this.canvas.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 9998;
      pointer-events: none;
      mix-blend-mode: multiply;
      opacity: 0.15;
    `;
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();

    // Terminal content
    const terminal = document.createElement('div');
    terminal.id = 'dos-crash-terminal';
    terminal.style.cssText = `
      position: relative;
      z-index: 10000;
      max-width: 640px;
      padding: 40px;
      line-height: 1.6;
      font-size: 14px;
      letter-spacing: 0.05em;
      white-space: pre;
      word-wrap: break-word;
      text-shadow: 0 0 10px #00ff00;
    `;

    this.overlay.appendChild(this.canvas);
    this.overlay.appendChild(terminal);
    this.container.appendChild(this.overlay);

    this.terminalEl = terminal;
    this.isActive = true;
    this.startTime = Date.now();

    // Type out the error sequence
    await this.typeSequence();

    // Start animation loop
    this.animate();

    // Input handling
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('click', this.handleClose.bind(this));
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  async typeSequence() {
    this.outputLines = [];
    for (const line of this.lines) {
      this.outputLines.push(line);
      this.updateTerminal();
      
      // Glitch chance on certain lines
      if (Math.random() < 0.3) {
        await this.glitch(100);
      }
      
      // Type delay (faster for short lines)
      const delay = line.length < 30 ? 150 : 300;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  glitch(duration) {
    return new Promise(resolve => {
      const glitchStart = Date.now();
      const glitchAnim = setInterval(() => {
        if (Date.now() - glitchStart > duration) {
          clearInterval(glitchAnim);
          this.updateTerminal();
          resolve();
        }
      }, 30);
    });
  }

  updateTerminal() {
    if (!this.terminalEl) return;
    
    let text = this.outputLines.join('\n');
    
    // Add glitch characters occasionally
    if (Math.random() < 0.1 * this.glitchIntensity) {
      const glitchChars = ['█', '▓', '▒', '░', '?', '!', '@', '#'];
      const randomChar = glitchChars[Math.floor(Math.random() * glitchChars.length)];
      text = text.replace(/./g, (char, index) => {
        return Math.random() < 0.05 ? randomChar : char;
      });
    }
    
    this.terminalEl.textContent = text;
  }

  animate() {
    if (!this.isActive) return;

    // Draw scanlines
    this.drawScanlines();
    
    // Update glitch
    this.glitchFrames = (this.glitchFrames + 1) % 60;
    if (this.glitchFrames % 8 === 0) {
      this.distortTerminal();
    }

    // Check duration
    if (this.duration > 0 && Date.now() - this.startTime > this.duration) {
      this.close();
      return;
    }

    requestAnimationFrame(this.animate.bind(this));
  }

  drawScanlines() {
    if (!this.ctx) return;

    const h = this.canvas.height;
    const lineSpacing = 4;
    
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    this.ctx.clearRect(0, 0, this.canvas.width, h);
    
    for (let y = this.scanlineOffset; y < h; y += lineSpacing) {
      this.ctx.fillRect(0, y, this.canvas.width, 1);
    }
    
    this.scanlineOffset = (this.scanlineOffset + 1) % lineSpacing;
  }

  distortTerminal() {
    if (!this.terminalEl) return;

    const distortion = Math.random() * this.glitchIntensity;
    const offset = Math.random() < 0.5 ? -distortion : distortion;
    
    this.terminalEl.style.transform = `translateX(${offset * 20}px) scaleX(${1 - distortion * 0.1})`;
    this.overlay.style.opacity = 1 - distortion * 0.2;
    
    setTimeout(() => {
      if (this.isActive) {
        this.terminalEl.style.transform = 'none';
        this.overlay.style.opacity = '1';
      }
    }, Math.random() * 100 + 50);
  }

  handleKeyDown(e) {
    if (!this.isActive) return;
    
    // Any key to close
    this.close();
    e.preventDefault();
  }

  handleClose() {
    if (!this.isActive) return;
    this.close();
  }

  close() {
    if (!this.isActive) return;

    this.isActive = false;
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    document.removeEventListener('click', this.handleClose.bind(this));

    // Fade out
    if (this.overlay) {
      this.overlay.style.transition = 'opacity 0.3s ease-out';
      this.overlay.style.opacity = '0';
      
      setTimeout(() => {
        if (this.overlay && this.overlay.parentNode) {
          this.overlay.parentNode.removeChild(this.overlay);
        }
        this.onClose();
      }, 300);
    }
  }
}

// Export for use
window.DOSCrash = DOSCrash;
