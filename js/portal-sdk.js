(function () {
  var TARGET = "playgama";
  var initialized = false;
  var playing = false;
  var memStorage = {};

  function emitPortalEvent(type) {
    try {
      window.dispatchEvent(new CustomEvent('nx-portal-event', { detail: { type: type } }));
    } catch (_) {}
  }

  function storageGet(key) {
    if (Object.prototype.hasOwnProperty.call(memStorage, key)) return memStorage[key];
    try {
      var val = window.localStorage.getItem('nx_portal_' + key);
      if (val !== null) memStorage[key] = val;
      return val;
    } catch (_) {
      return null;
    }
  }

  function storageSet(key, value) {
    var str = String(value);
    memStorage[key] = str;
    try { window.localStorage.setItem('nx_portal_' + key, str); } catch (_) {}
    try {
      if (TARGET === 'crazygames' && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.data) {
        window.CrazyGames.SDK.data.setItem(key, str);
      } else if (TARGET === 'playgama' && window.bridge && window.bridge.storage) {
        window.bridge.storage.set(key, str).catch(function () {});
      }
    } catch (_) {}
  }

  function getLeaderboard(boardId) {
    var k = 'lb_' + (boardId || 'default');
    var raw = storageGet(k);
    if (!raw) {
      try { raw = window.localStorage.getItem('nx_leaderboard'); } catch (_) {}
    }
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
    } catch (_) {
      return [];
    }
  }

  function submitScore(boardId, score, playerName) {
    var k = 'lb_' + (boardId || 'default');
    var list = getLeaderboard(boardId);
    list.push({ name: String(playerName || 'Jugador'), score: Math.round(Number(score) || 0), date: Date.now() });
    list.sort(function (a, b) { return b.score - a.score; });
    list = list.slice(0, 10);
    var json = JSON.stringify(list);
    storageSet(k, json);
    try { window.localStorage.setItem('nx_leaderboard', json); } catch (_) {}
    try {
      if (TARGET === 'playgama' && window.bridge && window.bridge.leaderboards && window.bridge.leaderboards.setScore) {
        window.bridge.leaderboards.setScore({ id: boardId || 'default', score: Math.round(Number(score) || 0) }).catch(function () {});
      }
    } catch (_) {}
    return list;
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    try {
      if (TARGET === 'poki' && window.PokiSDK) {
        await window.PokiSDK.init();
      } else if (TARGET === 'crazygames' && window.CrazyGames && window.CrazyGames.SDK) {
        await window.CrazyGames.SDK.init();
        if (window.CrazyGames.SDK.game && window.CrazyGames.SDK.game.loadingStart) {
          window.CrazyGames.SDK.game.loadingStart();
        }
      } else if (TARGET === 'playgama' && window.bridge) {
        await window.bridge.initialize();
      }
    } catch (err) {
      console.warn('[NexusPortal] SDK fallback activo:', err);
    }
  }

  function loadingFinished() {
    try {
      if (TARGET === 'poki' && window.PokiSDK && window.PokiSDK.gameLoadingFinished) {
        window.PokiSDK.gameLoadingFinished();
      } else if (TARGET === 'crazygames' && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
        window.CrazyGames.SDK.game.loadingStop();
      } else if (TARGET === 'playgama' && window.bridge && window.bridge.platform) {
        window.bridge.platform.sendMessage('game_ready');
      }
    } catch (err) {
      console.warn('[NexusPortal] loadingFinished:', err);
    }
  }

  function gameplayStart() {
    if (playing) return;
    playing = true;
    try {
      if (TARGET === 'poki' && window.PokiSDK && window.PokiSDK.gameplayStart) {
        window.PokiSDK.gameplayStart();
      } else if (TARGET === 'crazygames' && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
        window.CrazyGames.SDK.game.gameplayStart();
      }
    } catch (err) {
      console.warn('[NexusPortal] gameplayStart:', err);
    }
  }

  function gameplayStop() {
    if (!playing) return;
    playing = false;
    try {
      if (TARGET === 'poki' && window.PokiSDK && window.PokiSDK.gameplayStop) {
        window.PokiSDK.gameplayStop();
      } else if (TARGET === 'crazygames' && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
        window.CrazyGames.SDK.game.gameplayStop();
      }
    } catch (err) {
      console.warn('[NexusPortal] gameplayStop:', err);
    }
  }

  async function showAd() {
    gameplayStop();
    try {
      if (TARGET === 'poki' && window.PokiSDK && window.PokiSDK.commercialBreak) {
        await window.PokiSDK.commercialBreak();
      } else if (TARGET === 'crazygames' && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.ad) {
        await window.CrazyGames.SDK.ad.requestAd('midgame');
      } else if (TARGET === 'playgama' && window.bridge && window.bridge.advertisement) {
        await window.bridge.advertisement.showInterstitial();
      }
    } catch (err) {
      console.warn('[NexusPortal] showAd:', err);
    }
    emitPortalEvent('adClosed');
    gameplayStart();
  }

  async function showRewarded() {
    gameplayStop();
    var rewarded = false;
    try {
      if (TARGET === 'poki' && window.PokiSDK && window.PokiSDK.rewardedBreak) {
        rewarded = Boolean(await window.PokiSDK.rewardedBreak());
      } else if (TARGET === 'crazygames' && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.ad) {
        await window.CrazyGames.SDK.ad.requestAd('rewarded');
        rewarded = true;
      } else if (TARGET === 'playgama' && window.bridge && window.bridge.advertisement) {
        await window.bridge.advertisement.showRewarded();
        rewarded = true;
      } else {
        rewarded = true;
      }
    } catch (err) {
      console.warn('[NexusPortal] showRewarded:', err);
    }
    if (rewarded) emitPortalEvent('rewarded');
    emitPortalEvent('adClosed');
    gameplayStart();
    return rewarded;
  }

  window.NexusPortal = {
    target: TARGET,
    init: init,
    loadingFinished: loadingFinished,
    gameplayStart: gameplayStart,
    gameplayStop: gameplayStop,
    showAd: showAd,
    showInterstitial: showAd,
    showRewarded: showRewarded,
    storageGet: storageGet,
    storageSet: storageSet,
    submitScore: submitScore,
    getLeaderboard: getLeaderboard
  };
})();
