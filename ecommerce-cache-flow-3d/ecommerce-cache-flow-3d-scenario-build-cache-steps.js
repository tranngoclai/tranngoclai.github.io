/* ══════════════════════════════════════════════
   BUILD CACHE — STEPS · 5 ARC (framing → install → compile → docker → publish)

   Arc B/C/D lần lượt minh hoạ ba chiến lược key khác nhau — cố tình để
   layout mỗi arc khác nhau (install: nhị phân hit/miss; compile: gauge tỉ
   lệ; docker: chuỗi layer với ranh giới rebuilt/reused rõ) để "khác chiến
   lược" cũng NHÌN khác, không chỉ đọc khác trong desc. */
(function() {
const KIT = window.SCENE_KIT;
const LV = window.ECOM_CACHE_LEVELS;
const POS = window.BUILD_CACHE_POS;

function framingArc() {
  return [{
    title: 'Level 9 không nằm trên đường request',
    pipelineStep: 0,
    cam: [-66, 0, 0], dist: 46,
    focus: ['ci-trigger', 'commit'],
    phases: [{
      title: 'Build cache chạy trong CI, không chạy khi user bấm F5',
      desc: KIT.desc(
        '<b>Hộp tím ở scenario này là một BUILD đang chạy trong CI — không phải request HTTP</b> như 3 scenario trước.',
        'Ba sub-cache ở đây (install, compile, docker) không bao giờ được đọc khi user tải trang — chúng chỉ chạy khi code được push.',
        'Đây là chính luật "one-way layering" mà flow3d-kit áp dụng cho model→world→steps: gộp chung build-time và runtime vào một world sẽ mô tả sai hệ thống, y như gộp model và view sẽ phá vỡ kit.'
      ),
      focus: ['ci-trigger', 'commit', 'ci-runner'],
      set: {
        'ci-trigger': KIT.pulse('accent', 'push nhận ✓', {at: 0.2}),
        commit: KIT.move(POS.lockfile, {tone: 'subject', badge: 'CI build bắt đầu', at: 1.0})
      },
      scene: function(a) {
        KIT.link(a, 'ci-trigger', 'commit', 'accent', {at: 0.25, dur: 0.65, label: 'trigger CI build'});
      }
    }]
  }];
}

function installArc(run) {
  const r = run.install;
  return [{
    title: 'Install — ' + (r.hit ? 'hit, all-or-nothing' : 'miss, all-or-nothing'),
    pipelineStep: 1,
    cam: [-62, 0, -2], dist: 46,
    focus: ['commit', 'lockfile-cache', 'ci-cache-bucket'],
    phases: [{
      title: r.hit ? 'Lockfile không đổi — restore node_modules, skip npm install' : 'Lockfile đổi — npm install chạy lại từ đầu',
      desc: KIT.desc(
        '<b>Key = hash TOÀN BỘ lockfile.</b> ' + r.key + '.',
        r.hit
          ? 'Hash khớp — CI restore thẳng node_modules từ bucket, tiết kiệm ' + r.savedSec.toFixed(0) + 's.'
          : 'Chỉ cần đổi MỘT dòng trong lockfile là toàn bộ cache mất — không có khái niệm "restore một phần" ở đây.',
        'All-or-nothing: khác hẳn compile arc tiếp theo, nơi từng module được xét riêng.'
      ),
      focus: ['commit', 'lockfile-cache', 'ci-cache-bucket'],
      set: {
        commit: KIT.move(POS.install, {tone: 'subject', badge: 'install', at: 0.3}),
        'lockfile-cache': KIT.mark(r.hit ? 'crown' : 'danger', r.hit ? 'HIT · skip install' : 'MISS · npm install', {at: 1.25}),
        'ci-cache-bucket': KIT.pulse(r.hit ? 'ok' : 'warn', r.hit ? 'restore node_modules' : 'save node_modules', {at: 1.9})
      },
      scene: function(a) {
        KIT.link(a, 'commit', 'lockfile-cache', r.hit ? 'ok' : 'danger', {at: 0.55, dur: 0.6, label: 'hash lockfile'});
        if (r.hit) {
          KIT.link(a, 'ci-cache-bucket', 'commit', 'ok', {at: 1.25, dur: 0.55, label: 'restore node_modules'});
        } else {
          KIT.link(a, 'commit', 'ci-cache-bucket', 'warn', {at: 1.25, dur: 0.55, label: 'npm install · save'});
        }
      },
      scoreMode: true,
      scoreTitle: 'Build cache · install',
      scores: [KIT.gauge('install time', r.sec, r.coldSec, ' s', {tone: r.hit ? 'ok' : 'warn'})]
    }]
  }];
}

function compileArc(run) {
  const r = run.compile;
  return [{
    title: 'Compile — ' + r.modulesChanged + '/' + r.modulesTotal + ' module rebuild',
    pipelineStep: 2,
    cam: [-50, 0, -2], dist: 42,
    focus: ['commit', 'bundler', 'module-cache'],
    phases: [{
      title: r.modulesReused + ' module tái sử dụng, ' + r.modulesChanged + ' module rebuild',
      desc: KIT.desc(
        '<b>Key = hash TỪNG module.</b> ' + r.key + '.',
        'Module không đổi → hash khớp → tái sử dụng output cũ. Module đổi → rebuild riêng nó, không đụng module khác.',
        'Partial reuse: đối lập trực tiếp với install arc (all-or-nothing) — đây là lý do compile cache thường tiết kiệm nhiều hơn dù ít module thay đổi.'
      ),
      focus: ['commit', 'bundler', 'module-cache'],
      set: {
        commit: KIT.move(POS.compile, {tone: 'subject', badge: 'compile', at: 0.3}),
        bundler: KIT.mark(r.hit ? 'crown' : 'ok', r.modulesChanged + ' rebuild', {at: 1.85}),
        'module-cache': KIT.pulse('ok', r.modulesReused + '/' + r.modulesTotal + ' hit', {at: 1.2})
      },
      scene: function(a) {
        KIT.link(a, 'commit', 'bundler', 'accent', {at: 0.5, dur: 0.55, label: r.modulesTotal + ' module hashes'});
        KIT.link(a, 'module-cache', 'bundler', 'ok', {at: 1.05, dur: 0.55, lift: 1.2, label: r.modulesReused + ' reuse'});
        KIT.link(a, 'bundler', 'commit', 'warn', {at: 1.6, dur: 0.55, lift: 2.0, label: r.modulesChanged + ' rebuild'});
      },
      scoreMode: true,
      scoreTitle: 'Build cache · compile',
      scores: [
        KIT.gauge('modules rebuilt', r.modulesChanged, r.modulesTotal, '', {tone: 'warn'}),
        KIT.gauge('compile time', r.sec, r.coldSec, ' s', {tone: 'ok'})
      ]
    }]
  }];
}

function dockerArc(run) {
  const r = run.docker;
  return [{
    title: 'Docker — layer ' + r.changedIndex + ' đổi, ' + r.rebuilt.length + '/' + r.layersTotal + ' rebuild theo',
    pipelineStep: 3,
    cam: [-42, 0, -2], dist: 42,
    focus: ['commit', 'docker-builder', 'layer-cache'],
    phases: [{
      title: 'Prefix invalidation: mọi layer SAU layer đổi đều rebuild',
      desc: KIT.desc(
        '<b>Key = hash CỘNG DỒN theo layer.</b> ' + r.key + '.',
        'Layer ' + r.changedIndex + ' đổi nội dung → layer ' + r.changedIndex + ' đến ' + (r.layersTotal - 1) + ' rebuild HẾT, kể cả những layer bản thân không đổi gì — vì hash của chúng phụ thuộc hash layer trước.',
        'Khác hẳn compile arc (chỉ module đổi mới rebuild): ở đây MỘT thay đổi lan ra toàn bộ phần đuôi của chain, không dừng lại ở chính nó.'
      ),
      focus: ['commit', 'docker-builder', 'layer-cache'],
      set: {
        commit: KIT.move(POS.docker, {tone: 'subject', badge: 'docker build', at: 0.3}),
        'docker-builder': KIT.mark(r.hit ? 'crown' : 'danger', r.rebuilt.length + ' layer rebuild', {at: 1.85}),
        'layer-cache': KIT.pulse(r.hit ? 'ok' : 'warn', r.reused.length + ' prefix hit', {at: 1.2})
      },
      scene: function(a) {
        KIT.link(a, 'commit', 'docker-builder', 'accent', {at: 0.5, dur: 0.55, label: 'Docker context'});
        KIT.link(a, 'layer-cache', 'docker-builder', r.hit ? 'ok' : 'warn', {at: 1.05, dur: 0.55, lift: 1.2, label: 'reuse layer 0–' + (r.changedIndex - 1)});
        KIT.link(a, 'docker-builder', 'commit', r.hit ? 'ok' : 'danger', {at: 1.6, dur: 0.55, lift: 2.0, label: 'rebuild layer ' + r.changedIndex + '–' + (r.layersTotal - 1)});
      },
      scoreMode: true,
      scoreTitle: 'Build cache · docker',
      scores: [
        KIT.gauge('layers rebuilt', r.rebuilt.length, r.layersTotal, '', {tone: 'danger'}),
        KIT.gauge('docker time', r.sec, r.coldSec, ' s', {tone: 'warn'})
      ]
    }]
  }];
}

function publishArc(run) {
  return [
    {
      title: 'Publish — registry nhận bundle mới',
      pipelineStep: 4,
      cam: [-10, 0, 0], dist: 34,
      focus: ['commit', 'registry'],
      phases: [{
        title: 'Image + bundle publish lên registry',
        desc: KIT.desc(
          '<b>Bundle cũ:</b> <code>' + run.bundleNameOld + '</code> · <b>bundle mới:</b> <code>' + run.bundleNameNew + '</code>.',
          run.bundleChanged
            ? 'Tên file đổi vì content hash đổi — 8 module rebuild ở compile arc đủ để tạo ra hash khác.'
            : 'Tên file KHÔNG đổi lần build này — không có module nào rebuild nên content hash giữ nguyên.',
          'Registry là nguồn thật cho cả CDN lẫn browser ở arc tiếp theo.'
        ),
        focus: ['commit', 'registry'],
        set: {
          commit: KIT.move(POS.registry, {tone: 'subject', badge: 'publish', at: 0.35}),
          registry: KIT.mark('live', run.bundleNameNew + ' ✓', {at: 1.35})
        },
        scene: function(a) {
          KIT.link(a, 'commit', 'registry', 'ok', {at: 0.55, dur: 0.7, label: 'push image + bundle'});
        }
      }]
    },
    {
      title: 'CDN purge — level 3',
      pipelineStep: 5,
      cam: [-14, 0, 0], dist: 48,
      focus: ['commit', 'registry', 'cdn-edge'],
      phases: [{
        title: 'CI gọi purge CDN cho URL bundle cũ',
        desc: KIT.desc(
          '<b>CDN Edge (level 3)</b> nhận lệnh purge từ CI — đúng cơ chế đã thấy ở write path.',
          'Đây là lệnh invalidate DUY NHẤT trong toàn bộ handoff — vì URL đã đổi, CDN chỉ cần dừng phục vụ URL cũ.',
          'Từ đây, request nào hỏi bundle CŨ sẽ miss CDN — nhưng thực ra không còn request nào hỏi bundle cũ nữa (xem phase kế).'
        ),
        focus: ['commit', 'registry', 'cdn-edge'],
        show: ['cdn-edge'],
        set: {'cdn-edge': KIT.mark('ok', 'URL cũ bị xoá ✓', {at: 1.2})},
        scene: function(a) {
          KIT.link(a, 'commit', 'cdn-edge', 'ok', {at: 0.35, dur: 0.75, lift: 3.0, label: 'PURGE URL cũ'});
        }
      }]
    },
    {
      title: 'Browser — không cần purge, chỉ cần URL mới',
      pipelineStep: 5,
      cam: [-19, 0, 0], dist: 58,
      focus: ['registry', 'cdn-edge', 'browser-cache'],
      phases: [{
        title: 'Content hash trong tên file = miễn nhiễm invalidation',
        desc: KIT.desc(
          '<b>HTML mới trỏ thẳng tới <code>' + run.bundleNameNew + '</code></b> — browser cache của user vẫn còn nguyên <code>' + run.bundleNameOld + '</code>, nhưng không ai hỏi tới nó nữa.',
          'KHÔNG có lệnh purge browser nào được gọi — không cần, vì URL khác nhau tự động là hai cache entry khác nhau.',
          'Đối lập trực tiếp với write path (phase 02): ở đó browser là level DUY NHẤT không thể purge và luôn ở tone warn. Ở đây, browser "tự invalidate" miễn phí nhờ URL đổi — đúng punchline của cả deck: build cache được tự do vì nó không bao giờ phục vụ sai GIÁ, chỉ có thể phục vụ sai (hoặc cũ) ARTIFACT, và artifact cũ vẫn còn nằm ở URL cũ, vô hại.'
        ),
        focus: ['registry', 'cdn-edge', 'browser-cache'],
        show: ['cdn-edge', 'browser-cache'],
        set: {
          'cdn-edge': KIT.mark('live', run.bundleNameNew, {at: 1.05}),
          'browser-cache': KIT.mark('crown', 'URL mới · cache ✓', {at: 1.7})
        },
        scene: function(a) {
          KIT.link(a, 'registry', 'cdn-edge', 'ok', {at: 0.25, dur: 0.7, lift: 2.6, label: 'origin fill · URL mới'});
          KIT.link(a, 'cdn-edge', 'browser-cache', 'ok', {at: 1.0, dur: 0.6, label: 'GET ' + run.bundleNameNew});
        },
        scoreMode: true,
        scoreTitle: 'Build cache · verdict',
        scores: [
          KIT.gauge('total build time', run.totalSec, run.coldTotalSec, ' s', {tone: 'ok'}),
          KIT.score('saved', Math.round(run.savedPct * 100), {txt: LV.fmtPct(run.savedPct), tone: 'ok'}),
          KIT.score('browser purge calls', 0, {tone: 'ok'})
        ]
      }]
    }
  ];
}

window.createBuildCacheSteps = function(run) {
  return framingArc()
    .concat(installArc(run))
    .concat(compileArc(run))
    .concat(dockerArc(run))
    .concat(publishArc(run));
};
})();
