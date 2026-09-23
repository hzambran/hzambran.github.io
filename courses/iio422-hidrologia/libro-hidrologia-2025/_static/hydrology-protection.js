/* Provide a session-only access gate and deter copying of protected course notes. */
(function () {
  "use strict";

  var sessionKey = "iio422-hydrology-notes-authorised";
  var usernameHash = "fbcaa0ec408d9be942f7eec610eea5424b615c9a60d64b2aed69410a8583849e";
  var passwordHash = "8e5a7b867a3d2be74ba0273fc5b098525f23a746847d5c3b8deee9dba95bbc6c";

  // Hash credentials so their plain-text values are not embedded in the page source.
  function sha256(value) {
    return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
      .then(function (buffer) {
        return Array.prototype.map.call(new Uint8Array(buffer), function (byte) {
          return byte.toString(16).padStart(2, "0");
        }).join("");
      });
  } // sha256

  // Reveal the notes only after the current browser tab has been authenticated.
  function unlock() {
    document.documentElement.classList.remove("hydrology-locked");
    var gate = document.getElementById("hydrology-access-gate");
    if (gate) gate.remove();
  } // unlock

  // Build the login form without exposing the protected document first.
  function showGate() {
    var gate = document.createElement("div");
    gate.id = "hydrology-access-gate";
    gate.innerHTML = [
      '<main class="hydrology-login-card" aria-labelledby="hydrology-login-title">',
      '<h1 id="hydrology-login-title">Apuntes de Hidrología</h1>',
      '<p>Contenido protegido para estudiantes autorizados de IIO422.</p>',
      '<form id="hydrology-login-form">',
      '<label for="hydrology-username">Usuario</label>',
      '<input id="hydrology-username" name="username" type="text" autocomplete="username" required>',
      '<label for="hydrology-password">Contraseña</label>',
      '<input id="hydrology-password" name="password" type="password" autocomplete="current-password" required>',
      '<button type="submit">Acceder</button>',
      '<p id="hydrology-login-error" role="alert" aria-live="polite"></p>',
      '</form>',
      '<a class="hydrology-course-link" href="/courses/iio422-hidrologia/">Volver a la página del curso</a>',
      '</main>'
    ].join("");
    document.body.appendChild(gate);

    document.getElementById("hydrology-login-form").addEventListener("submit", function (event) {
      event.preventDefault();
      var username = document.getElementById("hydrology-username").value;
      var password = document.getElementById("hydrology-password").value;

      Promise.all([sha256(username), sha256(password)]).then(function (hashes) {
        if (hashes[0] === usernameHash && hashes[1] === passwordHash) {
          sessionStorage.setItem(sessionKey, "yes");
          unlock();
        } else {
          document.getElementById("hydrology-login-error").textContent = "Usuario o contraseña incorrectos.";
          document.getElementById("hydrology-password").value = "";
          document.getElementById("hydrology-password").focus();
        }
      });
    });

    document.getElementById("hydrology-username").focus();
  } // showGate

  // Block common browser actions used to copy or save the rendered notes.
  function preventCopying() {
    ["copy", "cut", "contextmenu", "dragstart", "selectstart"].forEach(function (eventName) {
      document.addEventListener(eventName, function (event) {
        if (!event.target.closest("#hydrology-access-gate")) event.preventDefault();
      });
    });

    document.addEventListener("keydown", function (event) {
      var blockedKey = ["c", "p", "s", "u"].indexOf(event.key.toLowerCase()) !== -1;
      if ((event.ctrlKey || event.metaKey) && blockedKey && !event.target.closest("#hydrology-access-gate")) {
        event.preventDefault();
      }
    });
  } // preventCopying

  document.documentElement.classList.add("hydrology-locked");
  preventCopying();
  document.addEventListener("DOMContentLoaded", function () {
    if (sessionStorage.getItem(sessionKey) === "yes") unlock(); else showGate();
  });
}());
