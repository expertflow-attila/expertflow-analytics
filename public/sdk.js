/**
 * Funnel Intelligence OS — browser tracking SDK
 *
 * Dependency-free, async, non-blocking. Authored directly as an IIFE so it
 * needs no build step and can be served from any origin. Targets browsers with
 * fetch, Promise and URLSearchParams — the same baseline the app itself needs.
 *
 * Usage:
 *   <script src="https://your-app.com/sdk.js" data-project-key="pk_..."></script>
 *
 *   funnel.page()
 *   funnel.track("lead_created", { leadMagnet: "AI Guide" })
 *   funnel.identify({ email: "a@b.com", userId: "42" })
 *   funnel.reset()
 *
 * Design notes:
 *  - Every event carries a client-generated `event_id`, so a retry after a
 *    network failure can never create a duplicate server-side.
 *  - The queue survives page unload via localStorage, and is flushed on the
 *    next page load. Losing the last event of a session is how funnels end up
 *    understating their final step.
 *  - UTM parameters are captured on first arrival and persisted for the
 *    attribution window, not re-read on every page.
 */
(function () {
  "use strict";

  if (window.funnel && window.funnel.__loaded) return;

  var script =
    document.currentScript ||
    (function () {
      var all = document.getElementsByTagName("script");
      return all[all.length - 1];
    })();

  var config = {
    projectKey: script ? script.getAttribute("data-project-key") : null,
    endpoint:
      (script && script.getAttribute("data-endpoint")) ||
      (script ? new URL(script.src, location.href).origin : location.origin),
    autoPage: (script && script.getAttribute("data-auto-page")) !== "false",
    requireConsent:
      (script && script.getAttribute("data-require-consent")) === "true",
    debug: (script && script.getAttribute("data-debug")) === "true",
    flushIntervalMs: 3000,
    maxBatchSize: 20,
    sessionTimeoutMs: 30 * 60 * 1000,
    utmTtlMs: 90 * 24 * 60 * 60 * 1000,
  };

  var STORAGE = {
    anonymousId: "fios_anon",
    session: "fios_session",
    utm: "fios_utm",
    queue: "fios_queue",
    consent: "fios_consent",
  };

  function log() {
    if (config.debug && window.console) {
      console.log.apply(console, ["[funnel]"].concat([].slice.call(arguments)));
    }
  }

  /* --- storage helpers ---------------------------------------------------- */

  function read(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage disabled or full — tracking degrades, page keeps working */
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  /* --- ids ---------------------------------------------------------------- */

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID().replace(/-/g, "");
    }
    var s = "";
    for (var i = 0; i < 32; i++) {
      s += Math.floor(Math.random() * 16).toString(16);
    }
    return s;
  }

  function anonymousId() {
    var existing = read(STORAGE.anonymousId);
    if (existing && existing.id) return existing.id;
    var id = "anon_" + uuid();
    write(STORAGE.anonymousId, { id: id, createdAt: Date.now() });
    return id;
  }

  /**
   * A session ends after 30 minutes of inactivity. Reading it also extends it,
   * which is why every event goes through this function.
   */
  function sessionId() {
    var now = Date.now();
    var existing = read(STORAGE.session);

    if (existing && now - existing.lastSeen < config.sessionTimeoutMs) {
      existing.lastSeen = now;
      write(STORAGE.session, existing);
      return { id: existing.id, isNew: false };
    }

    var session = { id: "sess_" + uuid(), startedAt: now, lastSeen: now };
    write(STORAGE.session, session);
    return { id: session.id, isNew: true };
  }

  /* --- acquisition context ------------------------------------------------ */

  function captureUtm() {
    var params = new URLSearchParams(location.search);
    var keys = ["source", "medium", "campaign", "content", "term"];
    var found = {};
    var hasAny = false;

    for (var i = 0; i < keys.length; i++) {
      var value = params.get("utm_" + keys[i]);
      if (value) {
        found[keys[i]] = value.slice(0, 200);
        hasAny = true;
      }
    }

    // Common ad-platform click ids imply paid traffic even without UTMs.
    if (!hasAny) {
      if (params.get("gclid")) {
        found = { source: "google", medium: "cpc" };
        hasAny = true;
      } else if (params.get("fbclid")) {
        found = { source: "facebook", medium: "paid" };
        hasAny = true;
      }
    }

    if (hasAny) {
      write(STORAGE.utm, { utm: found, capturedAt: Date.now() });
      return found;
    }

    var stored = read(STORAGE.utm);
    if (stored && Date.now() - stored.capturedAt < config.utmTtlMs) {
      return stored.utm;
    }
    return {};
  }

  function deviceType() {
    var ua = navigator.userAgent;
    if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return "tablet";
    if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
    return "desktop";
  }

  function browserName() {
    var ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return "Edge";
    if (/OPR\//.test(ua)) return "Opera";
    if (/Chrome\//.test(ua)) return "Chrome";
    if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";
    if (/Firefox\//.test(ua)) return "Firefox";
    return "Other";
  }

  /* --- queue -------------------------------------------------------------- */

  var queue = read(STORAGE.queue) || [];
  var flushTimer = null;
  var flushing = false;

  function persistQueue() {
    write(STORAGE.queue, queue.slice(0, 200));
  }

  function enqueue(envelope) {
    if (config.requireConsent && !hasConsent()) {
      log("consent not granted, dropping", envelope.event_name);
      return;
    }

    queue.push(envelope);
    persistQueue();
    log("queued", envelope.event_name, envelope);

    if (queue.length >= config.maxBatchSize) {
      flush();
    } else if (!flushTimer) {
      flushTimer = setTimeout(flush, config.flushIntervalMs);
    }
  }

  function flush(useBeacon) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (flushing || queue.length === 0 || !config.projectKey) return;

    var batch = queue.slice(0, config.maxBatchSize);
    var url = config.endpoint + "/api/v1/events";
    var payload = JSON.stringify({ events: batch, sent_at: isoNow() });

    // On page unload only sendBeacon is guaranteed to survive.
    if (useBeacon && navigator.sendBeacon) {
      var blob = new Blob([payload], { type: "application/json" });
      // The key travels in the URL because sendBeacon cannot set headers.
      var ok = navigator.sendBeacon(
        url + "?key=" + encodeURIComponent(config.projectKey),
        blob,
      );
      if (ok) {
        queue = queue.slice(batch.length);
        persistQueue();
      }
      return;
    }

    flushing = true;
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + config.projectKey,
      },
      body: payload,
      keepalive: true,
    })
      .then(function (response) {
        // 4xx other than 429 means the payload will never be accepted;
        // retrying it forever would block every later event behind it.
        if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
          queue = queue.slice(batch.length);
          persistQueue();
        }
        log("flushed", batch.length, "status", response.status);
      })
      .catch(function (error) {
        log("flush failed, will retry", error);
      })
      .then(function () {
        flushing = false;
        if (queue.length > 0 && !flushTimer) {
          flushTimer = setTimeout(flush, config.flushIntervalMs * 2);
        }
      });
  }

  function isoNow() {
    return new Date().toISOString();
  }

  /* --- consent ------------------------------------------------------------ */

  function hasConsent() {
    var stored = read(STORAGE.consent);
    return !!(stored && stored.granted);
  }

  /* --- envelope ----------------------------------------------------------- */

  function buildEnvelope(name, properties, extra) {
    var session = sessionId();
    var envelope = {
      event_id: "evt_" + uuid(),
      event_name: name,
      event_version: 1,
      timestamp: isoNow(),
      anonymous_id: anonymousId(),
      session_id: session.id,
      page: {
        url: location.href.slice(0, 2048),
        path: location.pathname,
        referrer: document.referrer || undefined,
        title: document.title ? document.title.slice(0, 512) : undefined,
      },
      utm: captureUtm(),
      properties: properties || {},
      context: {
        device_type: deviceType(),
        browser: browserName(),
        locale: navigator.language,
      },
    };

    if (extra) {
      for (var key in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, key)) {
          envelope[key] = extra[key];
        }
      }
    }

    envelope.__isNewSession = session.isNew;
    return envelope;
  }

  /**
   * Emits `session_started` ahead of the first event of a new session, so the
   * funnel engine always has an explicit session boundary to anchor on.
   */
  function emit(envelope) {
    var isNew = envelope.__isNewSession;
    delete envelope.__isNewSession;

    if (isNew && envelope.event_name !== "session_started") {
      var opener = {};
      for (var key in envelope) {
        if (Object.prototype.hasOwnProperty.call(envelope, key)) {
          opener[key] = envelope[key];
        }
      }
      opener.event_id = "evt_" + uuid();
      opener.event_name = "session_started";
      opener.properties = {};
      delete opener.identify;
      delete opener.revenue;
      enqueue(opener);
    }

    enqueue(envelope);
  }

  /* --- public API --------------------------------------------------------- */

  var api = {
    __loaded: true,
    __version: "1.0.0",

    page: function (properties) {
      emit(buildEnvelope("page_view", properties));
    },

    track: function (name, properties, options) {
      if (typeof name !== "string" || !/^[a-z0-9_]+$/.test(name)) {
        log("invalid event name, must be lowercase snake_case:", name);
        return;
      }
      var extra = {};
      if (options && options.revenue) extra.revenue = options.revenue;
      emit(buildEnvelope(name, properties, extra));
    },

    identify: function (traits) {
      if (!traits || (!traits.email && !traits.userId && !traits.user_id)) {
        log("identify requires an email or userId");
        return;
      }
      emit(
        buildEnvelope("identify", {}, {
          event_name: "identify",
          identify: {
            email: traits.email,
            user_id: traits.userId || traits.user_id,
            name: traits.name,
            stripe_customer_id: traits.stripeCustomerId,
            crm_contact_id: traits.crmContactId,
            traits: traits.traits,
          },
        }),
      );
      flush();
    },

    /** Clears all local identifiers. Call on logout. */
    reset: function () {
      remove(STORAGE.anonymousId);
      remove(STORAGE.session);
      remove(STORAGE.utm);
      log("reset");
    },

    consent: {
      grant: function () {
        write(STORAGE.consent, { granted: true, at: Date.now() });
        flush();
      },
      revoke: function () {
        write(STORAGE.consent, { granted: false, at: Date.now() });
        queue = [];
        persistQueue();
      },
      status: hasConsent,
    },

    flush: function () {
      flush();
    },
  };

  /* --- bootstrap ---------------------------------------------------------- */

  // Replay any calls made before the script finished loading.
  var pending = window.funnel && window.funnel.q ? window.funnel.q : [];
  window.funnel = api;
  for (var i = 0; i < pending.length; i++) {
    var call = pending[i];
    if (api[call[0]]) api[call[0]].apply(api, [].slice.call(call, 1));
  }

  if (!config.projectKey) {
    log("no data-project-key set; events will not be sent");
  }

  if (config.autoPage) {
    api.page();

    // Single-page apps: history navigation is not a page load.
    var lastPath = location.pathname;
    var notifyRouteChange = function () {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        api.page();
      }
    };
    ["pushState", "replaceState"].forEach(function (method) {
      var original = history[method];
      history[method] = function () {
        var result = original.apply(this, arguments);
        setTimeout(notifyRouteChange, 0);
        return result;
      };
    });
    window.addEventListener("popstate", notifyRouteChange);
  }

  window.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush(true);
  });
  window.addEventListener("pagehide", function () {
    flush(true);
  });
})();
