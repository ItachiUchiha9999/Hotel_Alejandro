import express from "express";
import cors from "cors";
import stockMovementRoutes from "./routes/stockMovement.routes";
import catalogRoutes from "./routes/catalog.routes";
import movementTypeRoutes from "./routes/movementType.routes";


const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: "Backend Hotel Alejandro funcionando" });
});

app.use("/api/stock-movements", stockMovementRoutes);
app.use("/api/catalog", catalogRoutes);

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});
app.use("/api/movement-types", movementTypeRoutes);