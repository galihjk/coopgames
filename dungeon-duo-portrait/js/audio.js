(() => {
  const FILES = {
    musicDungeon: 'assets/audio/music_stone_dungeon.mp3',
    musicBoss: 'assets/audio/music_boss.mp3',
    uiClick: 'assets/audio/ui_click.mp3',
    waveWarning: 'assets/audio/wave_warning.mp3',
    portalOpen: 'assets/audio/portal_open.mp3',
    meleeSwing: 'assets/audio/weapon_melee_swing.mp3',
    meleeHit: 'assets/audio/weapon_melee_hit.mp3',
    rangedShot: 'assets/audio/weapon_ranged_shot.mp3',
    projectileHit: 'assets/audio/projectile_hit.mp3',
    playerHurt: 'assets/audio/player_hurt.mp3',
    playerDown: 'assets/audio/player_down.mp3',
    playerRevive: 'assets/audio/player_revive.mp3',
    enemySpawn: 'assets/audio/enemy_spawn.mp3',
    enemyHurt: 'assets/audio/enemy_hurt.mp3',
    enemyDeath: 'assets/audio/enemy_death.mp3',
    enemyWarn: 'assets/audio/enemy_attack_warning.mp3',
    bossIntro: 'assets/audio/boss_intro.mp3',
    bossSlam: 'assets/audio/boss_slam.mp3',
    pickupHeal: 'assets/audio/pickup_heal.mp3',
    pickupUpgrade: 'assets/audio/pickup_upgrade.mp3',
    levelComplete: 'assets/audio/level_complete.mp3',
    gameOver: 'assets/audio/game_over.mp3',
    shieldHit: 'assets/audio/shield_hit.mp3',
    shieldBreak: 'assets/audio/shield_break.mp3',
    shieldRecharge: 'assets/audio/shield_recharge.mp3',
    projectileFire: 'assets/audio/projectile_fire.mp3',
    projectileIce: 'assets/audio/projectile_ice.mp3',
    projectilePoison: 'assets/audio/projectile_poison.mp3',
    projectileLightning: 'assets/audio/projectile_lightning.mp3',
    projectileExplosion: 'assets/audio/projectile_explosion.mp3',
    projectileRicochet: 'assets/audio/projectile_ricochet.mp3',
    enemyChargeWarning: 'assets/audio/enemy_charge_warning.mp3',
    enemyCharge: 'assets/audio/enemy_charge.mp3',
    enemyHeal: 'assets/audio/enemy_heal.mp3',
    bossDashWarning: 'assets/audio/boss_dash_warning.mp3',
    bossDash: 'assets/audio/boss_dash.mp3',
    bossLaserWarning: 'assets/audio/boss_laser_warning.mp3',
    bossLaser: 'assets/audio/boss_laser.mp3',
    bossSummon: 'assets/audio/boss_summon.mp3'
  };

  class GameAudio {
    constructor() {
      this.enabled = true;
      this.ctx = null;
      this.buffers = new Map();
      this.music = null;
      this.loadAttempted = false;
    }

    async unlock() {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      if (!this.loadAttempted) this.preload();
    }

    async preload() {
      this.loadAttempted = true;
      await Promise.all(Object.entries(FILES).map(async ([key, url]) => {
        try {
          const response = await fetch(url);
          if (!response.ok) return;
          const data = await response.arrayBuffer();
          const buffer = await this.ctx.decodeAudioData(data);
          this.buffers.set(key, buffer);
        } catch (_) {
          // Audio assets are optional. Synth fallback keeps the MVP playable.
        }
      }));
    }

    setEnabled(value) {
      this.enabled = Boolean(value);
      if (!this.enabled) this.stopMusic();
    }

    play(name, volume = 0.35, rate = 1) {
      if (!this.enabled || !this.ctx) return;
      const buffer = this.buffers.get(name);
      if (buffer) {
        const source = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        source.buffer = buffer;
        source.playbackRate.value = rate;
        gain.gain.value = volume;
        source.connect(gain).connect(this.ctx.destination);
        source.start();
        return;
      }
      this.synth(name, volume, rate);
    }

    playMusic(name) {
      if (!this.enabled || !this.ctx) return;
      this.stopMusic();
      const buffer = this.buffers.get(name);
      if (buffer) {
        const source = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        source.buffer = buffer;
        source.loop = true;
        gain.gain.value = 0.18;
        source.connect(gain).connect(this.ctx.destination);
        source.start();
        this.music = source;
      }
    }

    stopMusic() {
      if (this.music) {
        try { this.music.stop(); } catch (_) {}
        this.music = null;
      }
    }

    synth(name, volume, rate) {
      const map = {
        uiClick: [520, 0.05, 'sine'], waveWarning: [180, 0.24, 'sawtooth'], portalOpen: [120, 0.4, 'sine'],
        meleeSwing: [260, 0.08, 'triangle'], meleeHit: [95, 0.09, 'square'], rangedShot: [620, 0.08, 'square'],
        projectileHit: [180, 0.07, 'triangle'], playerHurt: [140, 0.16, 'sawtooth'], playerDown: [80, 0.45, 'sawtooth'],
        playerRevive: [740, 0.35, 'sine'], enemySpawn: [210, 0.2, 'sine'], enemyHurt: [120, 0.08, 'square'],
        enemyDeath: [75, 0.22, 'sawtooth'], enemyWarn: [340, 0.18, 'square'], bossIntro: [58, 0.7, 'sawtooth'],
        bossSlam: [45, 0.32, 'square'], pickupHeal: [880, 0.18, 'sine'], pickupUpgrade: [980, 0.26, 'triangle'],
        levelComplete: [660, 0.5, 'sine'], gameOver: [55, 0.8, 'sawtooth'],
        shieldHit: [930, 0.11, 'sine'], shieldBreak: [170, 0.22, 'square'], shieldRecharge: [720, 0.2, 'sine'],
        projectileFire: [420, 0.1, 'sawtooth'], projectileIce: [1040, 0.09, 'sine'], projectilePoison: [260, 0.12, 'triangle'],
        projectileLightning: [1320, 0.08, 'square'], projectileExplosion: [72, 0.28, 'square'], projectileRicochet: [760, 0.07, 'triangle'],
        enemyChargeWarning: [240, 0.3, 'sawtooth'], enemyCharge: [110, 0.2, 'square'], enemyHeal: [820, 0.3, 'sine'],
        bossDashWarning: [150, 0.36, 'sawtooth'], bossDash: [60, 0.34, 'square'], bossLaserWarning: [620, 0.42, 'sine'], bossLaser: [95, 0.42, 'sawtooth'], bossSummon: [190, 0.45, 'triangle']
      };
      const [freq, duration, type] = map[name] || [300, 0.08, 'sine'];
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = type;
      osc.frequency.setValueAtTime(freq * rate, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.55 * rate), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    }
  }

  window.GameAudio = new GameAudio();
  window.DUNGEON_DUO_AUDIO_FILES = FILES;
})();
