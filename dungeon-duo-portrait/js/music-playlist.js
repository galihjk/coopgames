(function () {
  "use strict";

  /**
   * ============================================================
   * DUNGEON DUO MUSIC PLAYLIST
   * ============================================================
   *
   * Perilaku:
   * - Musik dungeon dipilih acak setiap masuk level baru.
   * - Musik dungeon tetap loop selama level berlangsung.
   * - Restart level yang sama tetap memakai lagu yang sama.
   * - Saat boss muncul, musik diganti dengan musik boss acak.
   * - Musik boss tetap loop sampai pindah level.
   * - Lagu yang sama tidak langsung dipilih kembali.
   */

  const MUSIC_CONFIG = {
    volume: 0.21,

    playlists: {
      dungeon: [
        "assets/audio/music/dungeon/dungeon_01.mp3",
        "assets/audio/music/dungeon/dungeon_02.mp3",
        "assets/audio/music/dungeon/dungeon_03.mp3",
        "assets/audio/music/dungeon/dungeon_04.mp3"
      ],

      boss: [
        "assets/audio/music/boss/boss_01.mp3",
        "assets/audio/music/boss/boss_02.mp3",
        "assets/audio/music/boss/boss_03.mp3",
        "assets/audio/music/boss/boss_04.mp3"
      ],
	  upgrade: [
		"assets/audio/music/upgrade.mp3"
	  ]
    }
  };

  const musicPlayer = new Audio();

  musicPlayer.loop = true;
  musicPlayer.preload = "auto";
  musicPlayer.volume = MUSIC_CONFIG.volume;
  
  /**
	 * Audio player khusus menu upgrade.
	 *
	 * Dibuat terpisah agar musik dungeon atau boss dapat dijeda,
	 * kemudian dilanjutkan dari posisi terakhir.
	 */
	const upgradeMusicPlayer = new Audio();

	upgradeMusicPlayer.loop = true;
	upgradeMusicPlayer.preload = "auto";
	upgradeMusicPlayer.volume = MUSIC_CONFIG.volume;

	const upgradeMusicState = {
	  active: false,
	  shouldResumeMainMusic: false,
	  lastTrack: null
	};

  const musicState = {
    category: null,
    contextKey: null,
    currentTrack: null,

    // Menyimpan lagu terakhir setiap kategori agar tidak langsung berulang.
    lastTrackByCategory: {
      dungeon: null,
      boss: null
    },

    // Menyimpan lagu yang sudah dipilih untuk level tertentu.
    // Contoh:
    // dungeon-level-3 => dungeon_02.mp3
    // boss-level-4    => boss_01.mp3
    trackByContext: new Map()
  };

  /**
   * Mengambil playlist berdasarkan kategori.
   */
  function getPlaylist(category) {
    const playlist = MUSIC_CONFIG.playlists[category];

    if (!Array.isArray(playlist)) {
      return [];
    }

    return playlist.filter(function (track) {
      return typeof track === "string" && track.trim() !== "";
    });
  }

	function selectRandomUpgradeTrack() {
	  const playlist = getPlaylist("upgrade");

	  if (playlist.length === 0) {
		console.warn(
		  '[DungeonMusic] Playlist "upgrade" masih kosong.'
		);

		return null;
	  }

	  if (playlist.length === 1) {
		upgradeMusicState.lastTrack = playlist[0];
		return playlist[0];
	  }

	  const availableTracks = playlist.filter(function (track) {
		return track !== upgradeMusicState.lastTrack;
	  });

	  const randomIndex = Math.floor(
		Math.random() * availableTracks.length
	  );

	  const selectedTrack = availableTracks[randomIndex];

	  upgradeMusicState.lastTrack = selectedTrack;

	  return selectedTrack;
	}
  /**
   * Memilih musik acak.
   *
   * Jika contextKey sudah pernah digunakan, lagu lama dikembalikan.
   * Ini membuat restart level menggunakan musik yang sama.
   */
  function selectTrack(category, contextKey) {
    if (musicState.trackByContext.has(contextKey)) {
      return musicState.trackByContext.get(contextKey);
    }

    const playlist = getPlaylist(category);

    if (playlist.length === 0) {
      console.warn(
        '[DungeonMusic] Playlist "' + category + '" masih kosong.'
      );

      return null;
    }

    if (playlist.length === 1) {
      musicState.trackByContext.set(contextKey, playlist[0]);
      musicState.lastTrackByCategory[category] = playlist[0];

      return playlist[0];
    }

    const lastTrack =
      musicState.lastTrackByCategory[category];

    // Hindari musik yang sama terpilih dua kali berturut-turut.
    const availableTracks = playlist.filter(function (track) {
      return track !== lastTrack;
    });

    const randomIndex = Math.floor(
      Math.random() * availableTracks.length
    );

    const selectedTrack = availableTracks[randomIndex];

    musicState.trackByContext.set(
      contextKey,
      selectedTrack
    );

    musicState.lastTrackByCategory[category] =
      selectedTrack;

    return selectedTrack;
  }

  /**
   * Memutar musik berdasarkan kategori dan context.
   */
  async function playMusic(category, contextKey) {
    const selectedTrack = selectTrack(
      category,
      contextKey
    );

    if (!selectedTrack) {
      return false;
    }

    const sameMusicContext =
      musicState.category === category &&
      musicState.contextKey === contextKey &&
      musicState.currentTrack === selectedTrack;

    // Musik yang benar sudah aktif.
    // Tidak perlu memulai ulang dari awal.
    if (sameMusicContext && !musicPlayer.paused) {
      return true;
    }

    // Jika lagunya sama tetapi sedang pause, lanjutkan.
    if (sameMusicContext && musicPlayer.paused) {
      try {
        await musicPlayer.play();
        return true;
      } catch (error) {
        console.warn(
          "[DungeonMusic] Browser belum mengizinkan musik dimainkan.",
          error
        );

        return false;
      }
    }

    musicPlayer.pause();
    musicPlayer.currentTime = 0;

    musicState.category = category;
    musicState.contextKey = contextKey;
    musicState.currentTrack = selectedTrack;

    musicPlayer.src = selectedTrack;
    musicPlayer.loop = true;
    musicPlayer.volume = MUSIC_CONFIG.volume;

    try {
      await musicPlayer.play();

      console.info(
        "[DungeonMusic] Playing:",
        category,
        selectedTrack
      );

      return true;
    } catch (error) {
      console.warn(
        "[DungeonMusic] Musik tidak dapat dimulai. " +
        "Pastikan pemanggilan dilakukan setelah pemain menekan tombol Start.",
        error
      );

      return false;
    }
  }

  /**
   * Musik dungeon untuk level tertentu.
   *
   * Level yang sama akan mendapat lagu yang sama selama satu sesi.
   */
  function playDungeon(level) {
    const safeLevel = Number(level) || 1;

    return playMusic(
      "dungeon",
      "dungeon-level-" + safeLevel
    );
  }

  /**
   * Musik boss untuk level tertentu.
   */
  function playBoss(level) {
    const safeLevel = Number(level) || 1;

    return playMusic(
      "boss",
      "boss-level-" + safeLevel
    );
  }

  /**
   * Menghentikan musik.
   */
  function stop() {
	  stopUpgradeWithoutResume();

	  musicPlayer.pause();
	  musicPlayer.currentTime = 0;
	}

  /**
   * Pause tanpa mengulang dari awal.
   */
  function pause() {
    musicPlayer.pause();
  }

  /**
   * Melanjutkan musik aktif.
   */
  async function resume() {
    if (!musicPlayer.src) {
      return false;
    }

    try {
      await musicPlayer.play();
      return true;
    } catch (error) {
      console.warn(
        "[DungeonMusic] Musik belum dapat dilanjutkan.",
        error
      );

      return false;
    }
  }

  /**
   * Mengatur volume.
   *
   * Nilai:
   * 0    = mute
   * 0.18 = rekomendasi
   * 1    = maksimum
   */
  function setVolume(volume) {
    const parsedVolume = Number(volume);

    if (!Number.isFinite(parsedVolume)) {
      return;
    }

    const safeVolume = Math.max(
      0,
      Math.min(1, parsedVolume)
    );

    MUSIC_CONFIG.volume = safeVolume;
	musicPlayer.volume = safeVolume;
	upgradeMusicPlayer.volume = safeVolume;
  }

  /**
   * Digunakan saat mulai run baru.
   *
   * Setelah reset, Level 1 dapat memperoleh lagu acak baru.
   */
  function resetRun() {
    stop();

    musicState.category = null;
    musicState.contextKey = null;
    musicState.currentTrack = null;

    musicState.trackByContext.clear();
  }

  /**
   * Informasi untuk debugging.
   */
  function getCurrentMusic() {
    return {
      category: musicState.category,
      contextKey: musicState.contextKey,
      track: musicState.currentTrack,
      paused: musicPlayer.paused,
      volume: musicPlayer.volume
    };
  }

  /**
   * Membantu browser mobile yang memblokir autoplay.
   *
   * Setelah musik pernah diminta tetapi diblokir, sentuhan berikutnya
   * akan mencoba melanjutkan musik.
   */
  async function tryResumeAfterInteraction() {
	  try {
		// Saat menu upgrade aktif, hanya coba lanjutkan musik upgrade.
		if (upgradeMusicState.active) {
		  if (
			upgradeMusicPlayer.src &&
			upgradeMusicPlayer.paused
		  ) {
			await upgradeMusicPlayer.play();
		  }

		  return;
		}

		// Jika menu upgrade tidak aktif, lanjutkan musik dungeon/boss.
		if (
		  musicPlayer.src &&
		  musicPlayer.paused &&
		  musicState.currentTrack
		) {
		  await musicPlayer.play();
		}
	  } catch (error) {
		// Browser mungkin masih memblokir audio.
	  }
	}

  document.addEventListener(
    "pointerdown",
    tryResumeAfterInteraction,
    { passive: true }
  );

  document.addEventListener(
    "keydown",
    tryResumeAfterInteraction
  );
  
  /**
	 * Memulai musik menu upgrade.
	 *
	 * Musik dungeon atau boss dijeda, bukan dihentikan.
	 * Karena itu, musik utama dapat dilanjutkan dari detik terakhir.
	 */
	async function playUpgrade() {
	  if (upgradeMusicState.active) {
		return true;
	  }

	  const selectedTrack = selectRandomUpgradeTrack();

	  if (!selectedTrack) {
		return false;
	  }

	  upgradeMusicState.shouldResumeMainMusic =
		Boolean(musicPlayer.src) &&
		!musicPlayer.paused;

	  // Jeda musik dungeon atau boss.
	  musicPlayer.pause();

	  upgradeMusicPlayer.pause();
	  upgradeMusicPlayer.currentTime = 0;
	  upgradeMusicPlayer.src = selectedTrack;
	  upgradeMusicPlayer.loop = true;
	  upgradeMusicPlayer.volume = MUSIC_CONFIG.volume;

	  upgradeMusicState.active = true;

	  try {
		await upgradeMusicPlayer.play();

		console.info(
		  "[DungeonMusic] Upgrade music:",
		  selectedTrack
		);

		return true;
	  } catch (error) {
		upgradeMusicState.active = false;

		console.warn(
		  "[DungeonMusic] Musik upgrade tidak dapat dimainkan.",
		  error
		);

		// Jika upgrade music gagal, lanjutkan musik utama.
		if (upgradeMusicState.shouldResumeMainMusic) {
		  try {
			await musicPlayer.play();
		  } catch (resumeError) {
			// Browser mungkin masih memblokir audio.
		  }
		}

		return false;
	  }
	}
	
	
	/**
	 * Menghentikan musik upgrade dan melanjutkan musik utama.
	 */
	async function stopUpgradeAndResume() {
	  if (!upgradeMusicState.active) {
		return true;
	  }

	  upgradeMusicPlayer.pause();
	  upgradeMusicPlayer.currentTime = 0;

	  upgradeMusicState.active = false;

	  const shouldResume =
		upgradeMusicState.shouldResumeMainMusic;

	  upgradeMusicState.shouldResumeMainMusic = false;

	  if (!shouldResume || !musicPlayer.src) {
		return true;
	  }

	  try {
		await musicPlayer.play();

		console.info(
		  "[DungeonMusic] Main music resumed:",
		  musicState.currentTrack
		);

		return true;
	  } catch (error) {
		console.warn(
		  "[DungeonMusic] Musik utama belum dapat dilanjutkan.",
		  error
		);

		return false;
	  }
	}
	
	function stopUpgradeWithoutResume() {
	  upgradeMusicPlayer.pause();
	  upgradeMusicPlayer.currentTime = 0;

	  upgradeMusicState.active = false;
	  upgradeMusicState.shouldResumeMainMusic = false;
	}

  /**
   * API global yang dipakai game.js.
   */
  window.DungeonMusic = {
	  playDungeon: playDungeon,
	  playBoss: playBoss,

	  playUpgrade: playUpgrade,
	  stopUpgradeAndResume: stopUpgradeAndResume,
	  stopUpgradeWithoutResume: stopUpgradeWithoutResume,

	  stop: stop,
	  pause: pause,
	  resume: resume,
	  setVolume: setVolume,
	  resetRun: resetRun,
	  getCurrentMusic: getCurrentMusic
	};
})();