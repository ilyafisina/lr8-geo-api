import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for JSON input parsing
  app.use(express.json());

  // CORS headers
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

  // API Route: Geocoding Search Proxy
  app.get("/api/geocode", async (req, res) => {
    try {
      const q = req.query.q;
      if (!q) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }
      
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q as string)}&limit=5&addressdetails=1`;
      
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
    } catch (err: any) {
      console.error("Geocode proxy error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // API Route: Reverse Geocoding Proxy
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
    } catch (err: any) {
      console.error("Reverse proxy error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // API Route: OSRM Route Proxy
  app.get("/api/route", async (req, res) => {
    try {
      const { fromLat, fromLng, toLat, toLng, profile } = req.query;
      if (!fromLat || !fromLng || !toLat || !toLng) {
        return res.status(400).json({ error: "Missing required point coordinates" });
      }
      
      const selectedProfile = (profile as string) || "driving";
      
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
        // If driving failed on openstreetmap.de, or connection failed, fallback to main osrm
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
        // Fallback check within code status if primary failed
        if (selectedProfile === "driving") {
          console.warn("Primary routing server status non-OK. Trying fallback public OSRM router...");
          const fallbackUrl = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
          const fallbackResponse = await fetch(fallbackUrl, {
            headers: {
              "User-Agent": "GisLabApp/1.0 (svyaznoy56rus@gmail.com; user-representative)"
            }
          });
          if (fallbackResponse.ok) {
            const data = await fallbackResponse.json();
            return res.json(data);
          }
        }
        throw new Error(`OSRM routing failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      console.error("Route proxy error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // Vite middleware to support instant compilation
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
