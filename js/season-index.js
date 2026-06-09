(function () {
    'use strict';

    var SETS_PER_SEASON = 10;
    var MAX_SEASON_SCAN = 20;

    var SEASON_PALETTE = [
        { point: '#4CAF50', btn: '#2e7d32', random: '#1b5e20', randomHover: '#2e7d32' },
        { point: '#1976d2', btn: '#1565c0', random: '#0d47a1', randomHover: '#1565c0' },
        { point: '#8e24aa', btn: '#6a1b9a', random: '#4a148c', randomHover: '#6a1b9a' },
        { point: '#ff9800', btn: '#e65100', random: '#bf360c', randomHover: '#e65100' },
        { point: '#26a69a', btn: '#00695c', random: '#004d40', randomHover: '#00695c' }
    ];

    function seasonKey(n) {
        return 's' + String(n).padStart(2, '0');
    }

    function setIdsForSeason(seasonNum) {
        var start = (seasonNum - 1) * SETS_PER_SEASON + 1;
        return Array.from({ length: SETS_PER_SEASON }, function (_, i) {
            return String(start + i).padStart(3, '0');
        });
    }

    function applyPalette(section, seasonNum) {
        var c = SEASON_PALETTE[(seasonNum - 1) % SEASON_PALETTE.length];
        section.style.setProperty('--season-point', c.point);
        section.style.setProperty('--season-btn', c.btn);
        section.style.setProperty('--season-random', c.random);
        section.style.setProperty('--season-random-hover', c.randomHover);
    }

    function renderSeason(seasonNum, cfg) {
        var seasonId = seasonKey(seasonNum);
        var ids = setIdsForSeason(seasonNum);
        var section = document.createElement('div');
        section.className = 'season-section';
        applyPalette(section, seasonNum);

        var header = document.createElement('div');
        header.className = 'season-header';
        header.innerHTML =
            '<span class="season-title">SEASON ' + String(seasonNum).padStart(2, '0') + '</span>';
        section.appendChild(header);

        var grid = document.createElement('div');
        grid.className = 'grid';
        ids.forEach(function (id) {
            var a = document.createElement('a');
            a.className = 'btn-num';
            a.href = cfg.studyPage + '?s=' + seasonId + '&id=' + id;
            a.textContent = String(parseInt(id, 10));
            grid.appendChild(a);
        });
        section.appendChild(grid);

        if (cfg.randomPage) {
            var random = document.createElement('a');
            random.className = 'btn-random';
            random.href = cfg.randomPage + '?s=' + seasonId;
            random.textContent = '시즌 ' + seasonNum + ' 무한 랜덤 학습';
            section.appendChild(random);
        }

        return section;
    }

    function jsonExists(url) {
        return fetch(url, { method: 'HEAD' }).then(function (res) {
            if (res.ok) return true;
            return fetch(url).then(function (r) { return r.ok; });
        }).catch(function () { return false; });
    }

    function seasonExistsLocal(seasonNum) {
        var seasonId = seasonKey(seasonNum);
        var ids = setIdsForSeason(seasonNum);
        return ids.reduce(function (chain, id) {
            return chain.then(function (found) {
                if (found) return true;
                return jsonExists('data/seasons/' + seasonId + '/' + id + '.json');
            });
        }, Promise.resolve(false));
    }

    async function discoverLocalSeasons() {
        var found = [];
        for (var n = 1; n <= MAX_SEASON_SCAN; n++) {
            if (found.length > 0 && n > found[found.length - 1] + 1) break;
            var ok = await seasonExistsLocal(n);
            if (ok) found.push(n);
            else if (found.length > 0 && n > found[found.length - 1]) break;
        }
        return found;
    }

    function discoverFirebaseSeasons(db) {
        return db.ref('seasons').once('value').then(function (snap) {
            var val = snap.val() || {};
            return Object.keys(val)
                .map(function (k) { return parseInt(String(k).replace(/^s/i, ''), 10); })
                .filter(function (n) { return !isNaN(n) && n >= 1; })
                .sort(function (a, b) { return a - b; });
        });
    }

    function init(cfg) {
        var root = document.getElementById(cfg.rootId || 'seasons-root');
        if (!root) return;

        cfg.discover().then(function (seasonNums) {
            root.innerHTML = '';
            root.className = '';
            if (seasonNums.length === 0) {
                root.className = 'loading-msg';
                root.textContent = cfg.emptyMessage || '시즌 데이터가 없습니다.';
                return;
            }
            seasonNums.sort(function (a, b) { return b - a; }).forEach(function (n) {
                root.appendChild(renderSeason(n, cfg));
            });
        }).catch(function () {
            root.className = 'loading-msg';
            root.textContent = cfg.errorMessage || '목록을 불러오지 못했습니다.';
        });
    }

    window.SeasonIndex = {
        init: init,
        discoverLocalSeasons: discoverLocalSeasons,
        discoverFirebaseSeasons: discoverFirebaseSeasons,
        setIdsForSeason: setIdsForSeason
    };
})();
