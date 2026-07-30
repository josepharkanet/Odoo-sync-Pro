/* StockPromise storefront widget — vanilla, no deps.
   Reads per-warehouse stock via the app proxy and renders a delivery promise. */
(function () {
  var roots = document.querySelectorAll("[data-sp-widget]");
  for (var i = 0; i < roots.length; i++) init(roots[i]);

  function init(root) {
    var proxy = root.getAttribute("data-proxy");
    var labels = {
      select: root.getAttribute("data-label-select") || "Select your area",
      same_day: root.getAttribute("data-label-same-day") || "Same-day delivery",
      next_day: root.getAttribute("data-label-next-day") || "Next-day delivery",
      dated: root.getAttribute("data-label-dated") || "Delivery by {date}",
      sold_out: root.getAttribute("data-label-soldout") || "Sold out",
    };
    var variant = root.getAttribute("data-variant");
    var emirate = localStorage.getItem("sp_emirate") || "";
    var zones = [];

    fetchPromise();

    // Refetch when the shopper switches variant (product form's id input).
    document.addEventListener("change", function (e) {
      var t = e.target;
      if (t && t.name === "id" && t.value) {
        variant = t.value;
        fetchPromise();
      }
    });

    function fetchPromise() {
      if (!variant) return;
      root.classList.add("is-loading");
      var url =
        proxy +
        "?variant=" + encodeURIComponent(variant) +
        "&emirate=" + encodeURIComponent(emirate);
      fetch(url, { headers: { Accept: "application/json" } })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.zones) zones = data.zones;
          render(data || {});
        })
        .catch(function () { render({ status: "error", message: "" }); })
        .then(function () { root.classList.remove("is-loading"); });
    }

    function labelFor(data) {
      if (data.status === "same_day") return labels.same_day;
      if (data.status === "next_day") return labels.next_day;
      if (data.status === "dated") return labels.dated.replace("{date}", fmtDate(data.deliverBy));
      if (data.status === "sold_out") return labels.sold_out;
      return data.message || labels.select;
    }

    function fmtDate(ymd) {
      if (!ymd) return "";
      try {
        var d = new Date(ymd + "T00:00:00");
        return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
      } catch (e) { return ymd; }
    }

    function render(data) {
      var status = data.status || "select";
      var html = "";

      html += '<div class="sp-delivery__zone">';
      html += '<label class="sp-delivery__zone-label">' + esc(labels.select) + "</label>";
      html += '<select class="sp-delivery__select" aria-label="Delivery area">';
      html += '<option value="">—</option>';
      for (var i = 0; i < zones.length; i++) {
        var name = zones[i].name || zones[i].id;
        var sel = emirate && name.toLowerCase() === emirate.toLowerCase() ? " selected" : "";
        html += '<option value="' + esc(name) + '"' + sel + ">" + esc(name) + "</option>";
      }
      html += "</select></div>";

      if (data.status && data.status !== "unknown_zone" && data.status !== "error") {
        html += '<div class="sp-delivery__badge sp-status--' + esc(status) + '">' + esc(labelFor(data)) + "</div>";
        if (data.status === "dated" && data.warehouseName) {
          html += '<div class="sp-delivery__hint">ships from ' + esc(data.warehouseName) + "</div>";
        }
      } else {
        html += '<div class="sp-delivery__badge sp-status--select">' + esc(labels.select) + "</div>";
      }

      root.innerHTML = html;
      var select = root.querySelector(".sp-delivery__select");
      if (select) {
        select.addEventListener("change", function () {
          emirate = this.value;
          localStorage.setItem("sp_emirate", emirate);
          fetchPromise();
        });
      }
    }

    function esc(s) {
      return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    }
  }
})();
