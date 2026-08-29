// SINCERELY 서비스워커
// 정책: index.html(및 기타 페이지 이동)은 항상 "네트워크 우선"으로 가져온다.
//       -> 코드를 고쳐서 배포하면 새로고침 시 바로 반영됨.
//       -> 오프라인일 때만 캐시에 있는 예전 버전을 보여준다.
// 정적 리소스(아이콘, 매니페스트)는 캐시 우선 + 백그라운드 갱신.

var CACHE_NAME = "sincerely-cache-v" + (self.registration && self.registration.scope ? 1 : 1);
var STATIC_ASSETS = ["./manifest.json", "./icon-512.png"];

self.addEventListener("install", function (event) {
  self.skipWaiting(); // 새 서비스워커를 즉시 활성화 대기 상태로
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS).catch(function () {
        // 개별 파일이 없어도 설치 자체는 실패하지 않게
      });
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    Promise.all([
      // 이전 버전 캐시 정리
      caches.keys().then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
        );
      }),
      // 열려 있는 모든 탭/PWA 창을 즉시 이 서비스워커가 제어하도록
      self.clients.claim(),
    ])
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;

  // HTML 탐색(페이지 이동/새로고침)은 네트워크 우선
  var isNavigation =
    req.mode === "navigate" ||
    (req.method === "GET" && req.headers.get("accept") && req.headers.get("accept").indexOf("text/html") !== -1);

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          var resClone = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, resClone); });
          return res;
        })
        .catch(function () {
          // 오프라인일 때만 캐시된 예전 버전 사용
          return caches.match(req).then(function (cached) {
            return cached || caches.match("./index.html");
          });
        })
    );
    return;
  }

  // 그 외 정적 리소스: 캐시 우선, 백그라운드에서 최신 버전으로 갱신
  event.respondWith(
    caches.match(req).then(function (cached) {
      var networkFetch = fetch(req)
        .then(function (res) {
          if (res && res.status === 200) {
            var resClone = res.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(req, resClone); });
          }
          return res;
        })
        .catch(function () { return cached; });
      return cached || networkFetch;
    })
  );
});

// 필요 시 페이지 쪽에서 즉시 업데이트를 강제하고 싶을 때 사용할 수 있는 훅
self.addEventListener("message", function (event) {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
