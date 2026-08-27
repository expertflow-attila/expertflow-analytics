(function (window, document) {
  "use strict";
  var script = document.currentScript;
  var projectKey = script && script.getAttribute("data-project-key");
  var endpoint = script && script.getAttribute("data-endpoint") || new URL("/api/v1/events/batch", script.src).toString();
  var consent = script && script.getAttribute("data-consent") !== "required";
  var queueKey = "fios_queue_v1";
  var anonymousKey = "fios_anonymous_id";
  var sessionKey = "fios_session_id";
  var memoryQueue = [];
  function id(prefix) { return prefix + "_" + crypto.randomUUID(); }
  function read(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, value); } catch {} }
  var anonymousId = read(anonymousKey, id("anon")); write(anonymousKey, anonymousId);
  var sessionId = read(sessionKey, id("sess")); write(sessionKey, sessionId);
  try { memoryQueue = JSON.parse(read(queueKey, "[]")); } catch { memoryQueue = []; }
  function persist() { write(queueKey, JSON.stringify(memoryQueue.slice(-500))); }
  function envelope(name, properties) {
    var params = new URLSearchParams(window.location.search);
    return { event_id:id("evt"), event_name:name, event_version:1, timestamp:new Date().toISOString(), anonymous_id:anonymousId, session_id:sessionId,
      page:{url:window.location.href,path:window.location.pathname,referrer:document.referrer || undefined},
      utm:{source:params.get("utm_source")||undefined,medium:params.get("utm_medium")||undefined,campaign:params.get("utm_campaign")||undefined,content:params.get("utm_content")||undefined,term:params.get("utm_term")||undefined},
      properties:properties||{}, context:{language:navigator.language,screen_width:window.screen.width} };
  }
  function flush() {
    if (!consent || !projectKey || !memoryQueue.length || !navigator.onLine) return Promise.resolve();
    var batch = memoryQueue.slice(0, 100);
    return fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","x-project-key":projectKey},body:JSON.stringify({events:batch}),keepalive:true})
      .then(function(response){ if(!response.ok) throw new Error("ingest_failed"); memoryQueue.splice(0,batch.length); persist(); })
      .catch(function(){ persist(); });
  }
  function track(name, properties) { if(!consent) return; memoryQueue.push(envelope(name,properties)); persist(); if(memoryQueue.length>=10) flush(); }
  window.funnel = {
    track:track,
    page:function(properties){track("page_view",properties);},
    identify:function(person){track("identify",person||{});},
    reset:function(){anonymousId=id("anon");sessionId=id("sess");write(anonymousKey,anonymousId);write(sessionKey,sessionId);},
    consent:function(granted){consent=Boolean(granted);if(consent)flush();},
    flush:flush
  };
  window.addEventListener("online",flush);
  window.addEventListener("pagehide",flush);
  setInterval(flush,10000);
})(window,document);
