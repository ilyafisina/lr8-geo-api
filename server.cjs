var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });
  app.get("/api/geocode", async (req, res) => {
    try {
      const q = req.query.q;
      if (!q) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "GisLabApp/1.0 (svyaznoy56rus@gmail.com; user-representative)",
          "Accept": "application/json"
        }
      });
      if (!response.ok) {
        throw new Error(`Nominatim query failed with status: ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error("Geocode proxy error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.get("/api/reverse", async (req, res) => {
    try {
      const lat = req.query.lat;
      const lon = req.query.lon;
      if (!lat || !lon) {
        return res.status(400).json({ error: "Parameters 'lat' and 'lon' are required" });
      }
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "GisLabApp/1.0 (svyaznoy56rus@gmail.com; user-representative)",
          "Accept": "application/json"
        }
      });
      if (!response.ok) {
        throw new Error(`Nominatim reverse lookup failed with status: ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error("Reverse proxy error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.get("/api/route", async (req, res) => {
    try {
      const { fromLat, fromLng, toLat, toLng, profile } = req.query;
      if (!fromLat || !fromLng || !toLat || !toLng) {
        return res.status(400).json({ error: "Missing required point coordinates" });
      }
      const selectedProfile = profile || "driving";
      let url = "";
      if (selectedProfile === "walking") {
        url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
      } else if (selectedProfile === "cycling") {
        url = `https://routing.openstreetmap.de/routed-bike/route/v1/bicycle/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
      } else {
        url = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
      }
      console.log(`Routing Request: Profile = ${selectedProfile}, Coordinates = [${fromLng}, ${fromLat}] -> [${toLng}, ${toLat}]`);
      let response;
      try {
        response = await fetch(url, {
          headers: {
            "User-Agent": "GisLabApp/1.0 (svyaznoy56rus@gmail.com; user-representative)"
          }
        });
      } catch (err) {
        if (selectedProfile === "driving") {
          console.warn("Primary routing server failed. Falling back to public OSRM router...");
          const fallbackUrl = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
          response = await fetch(fallbackUrl, {
            headers: {
              "User-Agent": "GisLabApp/1.0 (svyaznoy56rus@gmail.com; user-representative)"
            }
          });
        } else {
          throw err;
        }
      }
      if (!response.ok) {
        if (selectedProfile === "driving") {
          console.warn("Primary routing server status non-OK. Trying fallback public OSRM router...");
          const fallbackUrl = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
          const fallbackResponse = await fetch(fallbackUrl, {
            headers: {
              "User-Agent": "GisLabApp/1.0 (svyaznoy56rus@gmail.com; user-representative)"
            }
          });
          if (fallbackResponse.ok) {
            const data2 = await fallbackResponse.json();
            return res.json(data2);
          }
        }
        throw new Error(`OSRM routing failed with status: ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error("Route proxy error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
