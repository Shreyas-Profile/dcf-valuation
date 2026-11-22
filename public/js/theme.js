// Runs before the page draws, so there's no flash of the wrong theme.
// Dark is the default; light only if the user picked it in Settings.
(function () {
  var light = false;
  try { light = (JSON.parse(localStorage.getItem("prefs") || "{}").theme === "light"); } catch (e) {}
  if (light) {
    document.documentElement.setAttribute("data-theme", "light");
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", "#f5f6f8");
  }
})();
