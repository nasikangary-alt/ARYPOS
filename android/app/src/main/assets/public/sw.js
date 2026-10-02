/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-43e44e5a'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "4407e7d462d6463a63f2daee75d2a153"
  }, {
    "url": "pwa-512x512.png",
    "revision": "99593d8a57577f17dcaabcdf4c71852c"
  }, {
    "url": "pwa-192x192.png",
    "revision": "c18cb4360b89f16adefa4d93ddd49aec"
  }, {
    "url": "index.html",
    "revision": "1dae36378e6a0f6a0b1cddae756c4b21"
  }, {
    "url": "icon.svg",
    "revision": "b9e9d2e5be0ef49a83ebb7f054962762"
  }, {
    "url": "icon-maskable.svg",
    "revision": "0c296509afc06b1d4f5d03f3f7840489"
  }, {
    "url": "favicon.ico",
    "revision": "e5c4b73e3f5b1d2d97e220a1bf5b606f"
  }, {
    "url": "ary-logo-mono.svg",
    "revision": "4bebfa1ab2ba7a4aebbf2ddb4d60c4ab"
  }, {
    "url": "ary-logo-icon.svg",
    "revision": "48275f48e664dfd4988d307bf3ad272d"
  }, {
    "url": "ary-logo-full.svg",
    "revision": "94767c3b348bf5224713e9c1f3368ff6"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "cf0fc2854409324fa3cad41247d2a93a"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/purify.es-Bvo9QlJ8.js",
    "revision": null
  }, {
    "url": "assets/jspdf.plugin.autotable-BrAqd2M3.js",
    "revision": null
  }, {
    "url": "assets/jspdf.es.min-C-PRLyu0.js",
    "revision": null
  }, {
    "url": "assets/index.es-iv-9IXoH.js",
    "revision": null
  }, {
    "url": "assets/index-C12hnudV.css",
    "revision": null
  }, {
    "url": "assets/index-C0pn_7tK.js",
    "revision": null
  }, {
    "url": "assets/html2canvas-D69PE284.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "cf0fc2854409324fa3cad41247d2a93a"
  }, {
    "url": "ary-logo-full.svg",
    "revision": "94767c3b348bf5224713e9c1f3368ff6"
  }, {
    "url": "ary-logo-icon.svg",
    "revision": "48275f48e664dfd4988d307bf3ad272d"
  }, {
    "url": "favicon.ico",
    "revision": "e5c4b73e3f5b1d2d97e220a1bf5b606f"
  }, {
    "url": "icon-maskable.svg",
    "revision": "0c296509afc06b1d4f5d03f3f7840489"
  }, {
    "url": "icon.svg",
    "revision": "b9e9d2e5be0ef49a83ebb7f054962762"
  }, {
    "url": "pwa-192x192.png",
    "revision": "c18cb4360b89f16adefa4d93ddd49aec"
  }, {
    "url": "pwa-512x512.png",
    "revision": "99593d8a57577f17dcaabcdf4c71852c"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "4407e7d462d6463a63f2daee75d2a153"
  }, {
    "url": "manifest.webmanifest",
    "revision": "0cba9623b3a92a802f91af00780ea899"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/__/, /\/[a-zA-Z0-9_-]+\.json$/]
  }));
  workbox.registerRoute(/^https:\/\/(?:firestore|identitytoolkit|securetoken)\.googleapis\.com\/.*/i, new workbox.NetworkOnly(), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
